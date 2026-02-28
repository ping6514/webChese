import type { Action, GameState, Side } from '../engine'
import { countCorpses } from '../engine/corpses'
import { canSacrifice } from '../engine/guards'
import {
  canBuySoulFromDisplay,
  canBuySoulFromDeck,
  canBuyItemFromDisplay,
  canMove,
  canShootAction,
  canEnchant,
  canRevive,
  getLegalMoves,
  reduce,
  getSoulCard,
} from '../engine'
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

// ─── Scoring helpers (higher score = better choice) ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type W = any  // getMergedWeights() returns any; named alias for clarity

function scoreShootTarget(W: W, target: any, myCorpses: number): number {
  const sw = W.shootScoring
  let score = 0
  if (target.base === 'king')
    score += Math.abs(sw.targetIsKing)                 // 15000 – prioritize attacking king
  if (target.base === 'rook' || target.base === 'cannon' || target.base === 'knight')
    score += Math.abs(sw.targetIsHighValueBase)        // 8000
  const tgtPriority: number = target.enchant?.soulId
    ? (W.buyPriority[target.enchant.soulId as string] ?? 0)
    : 0
  if (tgtPriority > 50)
    score += Math.abs(sw.targetHasHighPrioritySoul)    // 5000
  // Lower HP → easier kill → more score
  score += (100 - ((target.hpCurrent as number) ?? 100)) * Math.abs(sw.targetHpPerPoint) / 10
  // More my corpses → more score (corpse-synergy payoff)
  score += Math.floor(myCorpses / 10) * Math.abs(sw.myCorpsesBonusPer10)
  return score
}

function scoreMoveTarget(W: W, to: { x: number; y: number }, enemies: any[]): number {
  const mw = W.moveScoring
  let enemyKing: any = null
  for (let i = 0; i < enemies.length; i++) {
    if ((enemies[i] as any).base === 'king') { enemyKing = enemies[i]; break }
  }
  const distToKing = enemyKing
    ? Math.abs((enemyKing.pos.x as number) - to.x) + Math.abs((enemyKing.pos.y as number) - to.y)
    : 20
  let distToNearest = 20
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i] as any
    const d = Math.abs((e.pos.x as number) - to.x) + Math.abs((e.pos.y as number) - to.y)
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
      type DisplayCandidate = { base: string; soulId: string; score: number }
      const displayCandidates: DisplayCandidate[] = []
      const displayByBase = state.displayByBase as Record<string, string>
      for (const base of Object.keys(displayByBase)) {
        const soulId = displayByBase[base]
        if (soulId && canBuySoulFromDisplay(state, base as any).ok) {
          const score: number = (W.buyPriority[soulId] ?? W.buyPriority['default'] ?? 10) as number
          displayCandidates.push({ base, soulId, score })
        }
      }

      let bought = false
      const chosen = pickEpsilonGreedy(displayCandidates, c => c.score, rng, epsilon)
      if (chosen) {
        actions.push({ type: 'BUY_SOUL_FROM_DISPLAY', base: chosen.base as any })
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

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'necro': {
      const units = state.units as Record<string, any>
      const myUnits: any[] = Object.keys(units).map(id => units[id]).filter((u: any) => u.side === side)

      // Sacrifice logic (eternal_night synergy)
      const hasEternalNight = myUnits.some((u: any) => getSoulCard((u.enchant?.soulId as string) ?? '')?.clan === 'eternal_night')
      if (hasEternalNight) {
        type SacrificePair = { sourceUnitId: string; targetUnitId: string }
        const sacrificePairs: SacrificePair[] = []
        for (const src of myUnits) {
          const srcCard = getSoulCard((src.enchant?.soulId as string) ?? '')
          if (srcCard?.clan === 'eternal_night' && srcCard.abilities.some((a: any) => a.type === 'SACRIFICE_SHOT_BUFF')) {
            for (const tgt of myUnits) {
              if ((tgt.id as string) !== (src.id as string) && !tgt.enchant && canSacrifice(state, src.id as string, tgt.id as string).ok)
                sacrificePairs.push({ sourceUnitId: src.id as string, targetUnitId: tgt.id as string })
            }
          }
        }
        const pair = pick(sacrificePairs, rng)
        if (pair) actions.push({ type: 'SACRIFICE', sourceUnitId: pair.sourceUnitId, targetUnitId: pair.targetUnitId })
      }

      // Enchant: epsilon-greedy by buyPriority score
      const soulHand: string[] = state.hands[side].souls.slice()
      type EnchantCandidate = { unitId: string; soulId: string; score: number }
      const enchantCandidates: EnchantCandidate[] = []
      for (const unit of myUnits) {
        if (unit.enchant) continue
        for (const soulId of soulHand) {
          if (canEnchant(state, unit.id as string, soulId).ok) {
            const score: number = (W.buyPriority[soulId] ?? W.buyPriority['default'] ?? 10) as number
            enchantCandidates.push({ unitId: unit.id as string, soulId, score })
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
        const hasTieredAura = myUnits.some((u: any) => {
          const card = getSoulCard((u.enchant?.soulId as string) ?? '')
          return card?.abilities.some((a: any) =>
            a.type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS' || a.type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA'
          )
        })
        const corpseKeys = Object.keys(state.corpsesByPos)
        const soldierCorpseKeys = hasTieredAura
          ? corpseKeys.filter(k => {
              const stack = (state.corpsesByPos as Record<string, any[]>)[k]
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
      const lrUnit = myUnits.find((u: any) => {
        const card = getSoulCard((u.enchant?.soulId as string) ?? '')
        if (!card) return false
        return card.abilities.some((a: any) => {
          if (a.type !== 'LOGISTICS_REVIVE') return false
          const perTurn = Number(a.perTurn ?? 1)
          const used = (state.turnFlags.abilityUsed as Record<string, number>)?.[`${u.id as string}:LOGISTICS_REVIVE`] ?? 0
          return used < perTurn
        })
      })
      if (lrUnit) {
        // Find a soldier corpse owned by this side
        const soldierKey = Object.keys(state.corpsesByPos).find(k => {
          const stack = (state.corpsesByPos as Record<string, any[]>)[k]
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

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'combat': {
      let tmp: GameState = state
      const maxActions = 5

      for (let i = 0; i < maxActions; i++) {
        const allUnits = state.units as Record<string, any>
        const tmpUnits = tmp.units as Record<string, any>
        const myUnits: any[] = Object.keys(tmpUnits).map(id => tmpUnits[id]).filter((u: any) => u.side === side)
        const enemies: any[] = Object.keys(tmpUnits).map(id => tmpUnits[id]).filter((u: any) => u.side !== side)
        void allUnits  // suppress unused warning
        if (enemies.length === 0) break

        const myCorpses = countCorpses(tmp, side)

        // Score shoot candidates
        type Candidate = { action: Action; score: number }
        const shootCandidates: Candidate[] = []
        for (const a of myUnits) {
          for (const t of enemies) {
            if (canShootAction(tmp, a.id as string, t.id as string, null).ok) {
              shootCandidates.push({
                action: { type: 'SHOOT', attackerId: a.id as string, targetUnitId: t.id as string },
                score: scoreShootTarget(W, t, myCorpses),
              })
            }
          }
        }

        let act: Action | null = null
        const bestShoot = pickEpsilonGreedy(shootCandidates, c => c.score, rng, epsilon)
        if (bestShoot) act = bestShoot.action

        // If no shoot, score move candidates
        if (!act) {
          const movers = myUnits.filter((u: any) => getLegalMoves(tmp, u.id as string).length > 0)
          const mover = pick(movers, rng)
          if (mover) {
            type MoveCandidate = { to: { x: number; y: number }; score: number }
            const moveCandidates: MoveCandidate[] = getLegalMoves(tmp, mover.id as string)
              .filter(to => canMove(tmp, mover.id as string, to).ok)
              .map(to => ({ to, score: scoreMoveTarget(W, to, enemies) }))
            const bestMove = pickEpsilonGreedy(moveCandidates, c => c.score, rng, epsilon)
            if (bestMove) act = { type: 'MOVE', unitId: mover.id as string, to: bestMove.to }
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
