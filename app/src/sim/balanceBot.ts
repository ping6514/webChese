import type { Action, GameState, Side, Unit, PieceBase, UseItemFromHandAction } from '../engine'
import { countCorpses } from '../engine/corpses'
import { canSacrifice } from '../engine/guards'
import {
  canBuySoulFromDisplay,
  canBuySoulFromDeck,
  canBuyItemFromDisplay,
  canUseItemFromHand,
  canMove,
  canShootAction,
  canEnchant,
  canRevive,
  getLegalMoves,
  reduce,
  getSoulCard,
  BASE_STATS,
} from '../engine'
import type { SoulAbility } from '../engine/abilityTypes'
import { findAbility } from '../engine/abilityTypes'
import { getMergedWeights } from './botWeights'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function pick<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(rng() * arr.length) % arr.length]
}

/**
 * Epsilon-greedy selection: higher score = better.
 * - With probability `epsilon`: random pick (explore)
 * - Otherwise: pick highest score (exploit)
 */
function pickEpsilonGreedy<T>(
  arr: T[],
  getScore: (t: T) => number,
  rng: () => number,
  epsilon: number,
): T | undefined {
  if (arr.length === 0) return undefined
  if (rng() < epsilon) return pick(arr, rng)
  // Exploit: linear scan for highest score
  let best: T = arr[0] as T
  for (let i = 1; i < arr.length; i++) {
    const t = arr[i] as T
    if (getScore(t) > getScore(best)) best = t
  }
  return best
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type BotContext = {
  seed: number
  /** Exploration rate: 0 = pure greedy, 1 = pure random. Default: 0.2 */
  epsilon?: number
  /** Which weights to use. Default: 'blend' (70% dynamic + 30% base).
   *  Use 'base' for a fixed baseline opponent during validation. */
  weightsMode?: 'base' | 'dynamic' | 'blend'
}

export type BotStepResult = {
  actions: Action[]
  boughtSoulIds: string[]
  soulBuyGoldSpent: number
  enchantedSoulIds: string[]
  enchantGoldSpent: number
  soulGoldSpent: number  // deprecated alias
}

// ─── Item usage helper ────────────────────────────────────────────────────────

/** Try using an item; returns updated state on success, original state on fail */
function tryUseItem(
  state: GameState,
  itemId: string,
  extra: Record<string, unknown> = {},
): { ok: boolean; state: GameState } {
  if (!canUseItemFromHand(state, itemId).ok) return { ok: false, state }
  const r = reduce(state, { type: 'USE_ITEM_FROM_HAND', itemId, ...extra } as UseItemFromHandAction)
  if (!r.ok) return { ok: false, state }
  return { ok: true, state: r.state }
}

/** King HP ratio for checking damage */
function kingHpRatio(state: GameState, side: Side): number {
  const king = Object.values(state.units).find((u) => u.side === side && u.base === 'king')
  if (!king) return 1
  const maxHp = king.enchant ? (getSoulCard(king.enchant.soulId)?.stats?.hp ?? BASE_STATS.king.hp) : BASE_STATS.king.hp
  return king.hpCurrent / maxHp
}

// ─── Scoring helpers (higher score = better choice) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any  // getMergedWeights() returns any; named alias for clarity

function scoreShootTarget(W: W, target: Unit, myCorpses: number): number {
  const sw = W.shootScoring
  let score = 0
  if (target.base === 'king')
    score += Math.abs(sw.targetIsKing)                 // 15000 – prioritize attacking king
  if (target.base === 'rook' || target.base === 'cannon' || target.base === 'knight')
    score += Math.abs(sw.targetIsHighValueBase)        // 8000
  const tgtPriority: number = target.enchant?.soulId
    ? (W.buyPriority[target.enchant.soulId] ?? 0)
    : 0
  if (tgtPriority > 50)
    score += Math.abs(sw.targetHasHighPrioritySoul)    // 5000
  // Lower HP → easier kill → more score
  score += (100 - target.hpCurrent) * Math.abs(sw.targetHpPerPoint) / 10
  // More my corpses → more score (corpse-synergy payoff)
  score += Math.floor(myCorpses / 10) * Math.abs(sw.myCorpsesBonusPer10)
  return score
}

function scoreMoveTarget(W: W, to: { x: number; y: number }, enemies: Unit[]): number {
  const mw = W.moveScoring
  let enemyKing: Unit | undefined
  for (let i = 0; i < enemies.length; i++) {
    const u = enemies[i]
    if (u?.base === 'king') { enemyKing = u; break }
  }
  const distToKing = enemyKing
    ? Math.abs(enemyKing.pos.x - to.x) + Math.abs(enemyKing.pos.y - to.y)
    : 20
  let distToNearest = 20
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i]
    if (!e) continue
    const d = Math.abs(e.pos.x - to.x) + Math.abs(e.pos.y - to.y)
    if (d < distToNearest) distToNearest = d
  }
  // Negate distances: closer → higher score
  return -(distToKing * mw.distanceToEnemyKingPerTile + distToNearest * mw.distanceToAnyEnemyPerTile)
}

// ─── Main decision function ───────────────────────────────────────────────────

export function decideActions(state: GameState, side: Side, ctx: BotContext): BotStepResult {
  const rng = makeRng(ctx.seed)
  const epsilon = ctx.epsilon ?? 0.2
  const W: W = getMergedWeights(ctx.weightsMode ?? 'blend')

  const actions: Action[] = []
  const boughtSoulIds: string[] = []
  let soulBuyGoldSpent = 0
  const enchantedSoulIds: string[] = []
  let enchantGoldSpent = 0

  const result = (): BotStepResult => ({
    actions, boughtSoulIds, soulBuyGoldSpent,
    enchantedSoulIds, enchantGoldSpent,
    soulGoldSpent: soulBuyGoldSpent,
  })

  if (state.turn.side !== side) return result()

  switch (state.turn.phase) {
    case 'buy': {
      // Score display cards by buyPriority weight, use Object.keys for ES5 compat
      type DisplayCandidate = { base: PieceBase; soulId: string; score: number }
      const displayCandidates: DisplayCandidate[] = []
      for (const base of Object.keys(state.displayByBase) as PieceBase[]) {
        const soulId = state.displayByBase[base]
        if (soulId && canBuySoulFromDisplay(state, base).ok) {
          const score: number = (W.buyPriority[soulId] ?? W.buyPriority['default'] ?? 10) as number
          displayCandidates.push({ base, soulId, score })
        }
      }

      let bought = false
      const chosen = pickEpsilonGreedy(displayCandidates, c => c.score, rng, epsilon)
      if (chosen) {
        actions.push({ type: 'BUY_SOUL_FROM_DISPLAY', base: chosen.base })
        boughtSoulIds.push(chosen.soulId)
        soulBuyGoldSpent += state.rules.buySoulFromDisplayGoldCost
        bought = true
      }

      // Blind deck buy: prefer high-output bases (rook/knight/cannon)
      if (!bought) {
        const deckBases = (['rook', 'knight', 'cannon'] as const)
          .slice()
          .sort(() => rng() - 0.5)
        for (const base of deckBases) {
          if (canBuySoulFromDeck(state, base).ok) {
            actions.push({ type: 'BUY_SOUL_FROM_DECK', base })
            soulBuyGoldSpent += state.rules.buySoulFromDeckGoldCost
            bought = true
            break
          }
        }
      }

      // Last resort: item
      if (!bought) {
        const slots = ([0, 1, 2] as const).filter(s => canBuyItemFromDisplay(state, s).ok)
        const slot = pick([...slots], rng)
        if (slot != null) actions.push({ type: 'BUY_ITEM_FROM_DISPLAY', slot })
      }

      // Item usage in buy phase
      const buyItemHand = (state.hands[side].items ?? []) as string[]
      for (const itemId of buyItemHand) {
        if (itemId === 'item_lingxue_holy_grail') {
          // Heal king if HP below 70%
          if (kingHpRatio(state, side) < 0.7) {
            const king = Object.values(state.units).find((u) => u.side === side && u.base === 'king')
            if (king && canUseItemFromHand(state, itemId).ok)
              actions.push({ type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: king.id })
          }
        } else if (itemId === 'item_bone_refine') {
          // Convert own corpse to gold
          const myCorpseKey = Object.keys(state.corpsesByPos).find(k => {
            const stack = state.corpsesByPos[k]
            return stack?.some((c) => c.ownerSide === side)
          })
          if (myCorpseKey && canUseItemFromHand(state, itemId).ok) {
            const parts = myCorpseKey.split(',')
            const targetPos = { x: Number(parts[0]), y: Number(parts[1]) }
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId, targetPos, choice: 'gold' })
          }
        } else if (itemId === 'item_dark_moon_scope' || itemId === 'item_wizard_greed') {
          // Refresh display (always useful)
          if (canUseItemFromHand(state, itemId).ok)
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId })
        } else if (itemId === 'item_cage_plunder') {
          // Steal enemy soul 40% of the time
          if (rng() < 0.4 && canUseItemFromHand(state, itemId).ok)
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId })
        }
      }

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'necro': {
      const myUnits: Unit[] = Object.values(state.units).filter((u) => u.side === side)
      const necroItemHand = (state.hands[side].items ?? []) as string[]

      // Item: soul_detach_needle — strip most valuable enemy enchant
      for (const itemId of necroItemHand) {
        if (itemId === 'item_soul_detach_needle' && canUseItemFromHand(state, itemId).ok) {
          const enemyEnchanted = Object.values(state.units).filter((u) => u.side !== side && u.enchant)
          if (enemyEnchanted.length > 0) {
            const target = enemyEnchanted.reduce((best: Unit, u: Unit) => {
              const sa = (W.buyPriority[u.enchant?.soulId ?? ''] ?? 0) as number
              const sb = (W.buyPriority[best.enchant?.soulId ?? ''] ?? 0) as number
              return sa > sb ? u : best
            })
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: target.id })
          }
          break
        }
      }

      // Sacrifice logic (eternal_night synergy)
      const hasEternalNight = myUnits.some((u) => getSoulCard(u.enchant?.soulId ?? '')?.clan === 'eternal_night')
      if (hasEternalNight) {
        type SacrificePair = { sourceUnitId: string; targetUnitId: string }
        const sacrificePairs: SacrificePair[] = []
        for (const src of myUnits) {
          const srcCard = getSoulCard(src.enchant?.soulId ?? '')
          if (
            srcCard?.clan === 'eternal_night'
            && srcCard.abilities.some((a: SoulAbility) => a.type === 'SACRIFICE_SHOT_BUFF' || a.type === 'SACRIFICE_SELF_APPLY_STATUS')
          ) {
            for (const tgt of myUnits) {
              if (canSacrifice(state, src.id, tgt.id).ok)
                sacrificePairs.push({ sourceUnitId: src.id, targetUnitId: tgt.id })
            }
          }
        }
        const pair = pick(sacrificePairs, rng)
        if (pair) actions.push({ type: 'SACRIFICE', sourceUnitId: pair.sourceUnitId, targetUnitId: pair.targetUnitId })
      }

      // Item: soul_infusion — extra necro action + enchant gold discount
      for (const itemId of necroItemHand) {
        if (itemId === 'item_soul_infusion' && state.hands[side].souls.length > 0 && canUseItemFromHand(state, itemId).ok) {
          actions.push({ type: 'USE_ITEM_FROM_HAND', itemId })
          break
        }
      }

      // Enchant: epsilon-greedy by buyPriority score
      const soulHand: string[] = state.hands[side].souls.slice()
      type EnchantCandidate = { unitId: string; soulId: string; score: number }
      const enchantCandidates: EnchantCandidate[] = []
      for (const unit of myUnits) {
        if (unit.enchant) continue
        for (const soulId of soulHand) {
          if (canEnchant(state, unit.id, soulId).ok) {
            const score: number = (W.buyPriority[soulId] ?? W.buyPriority['default'] ?? 10) as number
            enchantCandidates.push({ unitId: unit.id, soulId, score })
          }
        }
      }

      const p = pickEpsilonGreedy(enchantCandidates, c => c.score, rng, epsilon)
      if (p) {
        actions.push({ type: 'ENCHANT', unitId: p.unitId, soulId: p.soulId })
        enchantedSoulIds.push(p.soulId)
        enchantGoldSpent += getSoulCard(p.soulId)?.costGold ?? 0
      } else {
        // Fallback: prefer soldier corpses if any ally has a tiered aura (iron_guard synergy)
        const hasTieredAura = myUnits.some((u) => {
          const card = getSoulCard(u.enchant?.soulId ?? '')
          return card?.abilities.some((a: SoulAbility) =>
            a.type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS' || a.type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA'
          )
        })
        const corpseKeys = Object.keys(state.corpsesByPos)
        const soldierCorpseKeys = hasTieredAura
          ? corpseKeys.filter(k => {
              const stack = state.corpsesByPos[k]
              const top = stack?.[stack.length - 1]
              return top?.base === 'soldier' && top?.ownerSide === side
            })
          : []
        const posKey = pick(soldierCorpseKeys.length > 0 ? soldierCorpseKeys : corpseKeys, rng)
        if (posKey) {
          const parts = posKey.split(',')
          const x0 = Number(parts[0])
          const y0 = Number(parts[1])
          if (isFinite(x0) && isFinite(y0)) {
            const pos = { x: x0, y: y0 }
            if (canRevive(state, pos).ok) actions.push({ type: 'REVIVE', pos })
          }
        }
      }

      // LOGISTICS_REVIVE: 召侍允許免費額外復活卒，不消耗死靈術次數
      // 若己方有可用的 LOGISTICS_REVIVE，嘗試再復活一個卒
      const lrUnit = myUnits.find((u) => {
        const card = getSoulCard(u.enchant?.soulId ?? '')
        if (!card) return false
        const lrAb = findAbility(card.abilities, 'LOGISTICS_REVIVE')
        if (!lrAb) return false
        const perTurn = Number(lrAb.perTurn ?? 1)
        const used = state.turnFlags.abilityUsed[`${u.id}:LOGISTICS_REVIVE`] ?? 0
        return used < perTurn
      })
      if (lrUnit) {
        // Find a soldier corpse owned by this side
        const soldierKey = Object.keys(state.corpsesByPos).find(k => {
          const stack = state.corpsesByPos[k]
          const top = stack?.[stack.length - 1]
          return top?.base === 'soldier' && top?.ownerSide === side
        })
        if (soldierKey) {
          const parts = soldierKey.split(',')
          const x0 = Number(parts[0])
          const y0 = Number(parts[1])
          if (isFinite(x0) && isFinite(y0)) {
            const pos = { x: x0, y: y0 }
            if (canRevive(state, pos).ok) actions.push({ type: 'REVIVE', pos })
          }
        }
      }

      // Item: last_stand_contract — free extra revive if corpses available
      for (const itemId of necroItemHand) {
        if (itemId === 'item_last_stand_contract' && canUseItemFromHand(state, itemId).ok) {
          if (countCorpses(state, side) > 0)
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId })
          break
        }
      }

      // Item: dead_return_path — protect enchanted king if HP critically low
      for (const itemId of necroItemHand) {
        if (itemId === 'item_dead_return_path' && kingHpRatio(state, side) < 0.35 && canUseItemFromHand(state, itemId).ok) {
          const kingUnit = Object.values(state.units).find((u) => u.side === side && u.base === 'king' && u.enchant)
          if (kingUnit)
            actions.push({ type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: kingUnit.id })
          break
        }
      }

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'combat': {
      let tmp: GameState = state
      const combatItemHand = (state.hands[side].items ?? []) as string[]

      // Item usage before combat loop
      for (const itemId of combatItemHand) {
        if (itemId === 'item_soul_overload' && canUseItemFromHand(tmp, itemId).ok) {
          // Free shoot bonus — always useful in combat
          const r = tryUseItem(tmp, itemId)
          if (r.ok) { actions.push({ type: 'USE_ITEM_FROM_HAND', itemId }); tmp = r.state }
        } else if (itemId === 'item_death_chain' && canUseItemFromHand(tmp, itemId).ok) {
          // Mana on kills — useful in aggressive turns
          const r = tryUseItem(tmp, itemId)
          if (r.ok) { actions.push({ type: 'USE_ITEM_FROM_HAND', itemId }); tmp = r.state }
        } else if (itemId === 'item_nether_seal' && canUseItemFromHand(tmp, itemId).ok) {
          // Lock down most dangerous enemy unit
          const enemies = Object.values(tmp.units).filter((u) => u.side !== side)
          if (enemies.length > 0) {
            const target = enemies.reduce((best: Unit, u: Unit) => {
              const sa = u.base === 'king' ? 10000 : ((W.buyPriority[u.enchant?.soulId ?? ''] ?? 0) as number)
              const sb = best.base === 'king' ? 10000 : ((W.buyPriority[best.enchant?.soulId ?? ''] ?? 0) as number)
              return sa > sb ? u : best
            })
            const r = tryUseItem(tmp, itemId, { targetUnitId: target.id })
            if (r.ok) { actions.push({ type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: target.id }); tmp = r.state }
          }
        }
      }

      const maxActions = 5

      for (let i = 0; i < maxActions; i++) {
        const myUnits: Unit[] = Object.values(tmp.units).filter((u) => u.side === side)
        const enemies: Unit[] = Object.values(tmp.units).filter((u) => u.side !== side)
        if (enemies.length === 0) break

        const myCorpses = countCorpses(tmp, side)

        // Score shoot candidates
        type Candidate = { action: Action; score: number }
        const shootCandidates: Candidate[] = []
        for (const a of myUnits) {
          for (const t of enemies) {
            if (canShootAction(tmp, a.id, t.id, null).ok) {
              const baseScore = scoreShootTarget(W, t, myCorpses)
              shootCandidates.push({
                action: { type: 'SHOOT', attackerId: a.id, targetUnitId: t.id },
                score: baseScore,
              })
              // GOLD_FOR_DAMAGE: if attacker has this ability and we have enough gold, also consider spending gold
              const aSoulId = a.enchant?.soulId ?? ''
              if (aSoulId) {
                const aCard = getSoulCard(aSoulId)
                const goldAb = aCard ? findAbility(aCard.abilities, 'GOLD_FOR_DAMAGE') : null
                if (goldAb) {
                  const goldCost = Number(goldAb.goldCost ?? 0)
                  if ((tmp.resources[side].gold as number) >= goldCost) {
                    // Higher-value targets (king or enchanted) warrant spending gold
                    if ((t.base === 'king' || t.enchant) && rng() < 0.7) {
                      shootCandidates.push({
                        action: { type: 'SHOOT', attackerId: a.id, targetUnitId: t.id, spendGoldForDamage: true },
                        score: baseScore + 200,
                      })
                    }
                  }
                }
              }
            }
          }
        }

        let act: Action | null = null
        const bestShoot = pickEpsilonGreedy(shootCandidates, c => c.score, rng, epsilon)
        if (bestShoot) act = bestShoot.action

        // If no shoot, score move candidates
        if (!act) {
          const movers = myUnits.filter((u) => getLegalMoves(tmp, u.id).length > 0)
          const mover = pick(movers, rng)
          if (mover) {
            type MoveCandidate = { to: { x: number; y: number }; score: number }
            const moveCandidates: MoveCandidate[] = getLegalMoves(tmp, mover.id)
              .filter(to => canMove(tmp, mover.id, to).ok)
              .map(to => ({ to, score: scoreMoveTarget(W, to, enemies) }))
            const bestMove = pickEpsilonGreedy(moveCandidates, c => c.score, rng, epsilon)
            if (bestMove) act = { type: 'MOVE', unitId: mover.id, to: bestMove.to }
          }
        }

        if (!act) break
        actions.push(act)
        const r = reduce(tmp, act)
        if (!r.ok) break
        tmp = r.state
      }

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    default:
      actions.push({ type: 'NEXT_PHASE' })
      return result()
  }
}
