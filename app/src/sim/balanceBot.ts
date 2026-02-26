import type { Action } from '../engine'
import type { GameState, Side } from '../engine'
// 放在檔案最上面，與其他 import 一起
import { countCorpses } from '../engine/corpses'  // ← 加這一行
import { canSacrifice } from '../engine/guards'  // ← 加這一行（假設 guards.ts 裡有 export canSacrifice）
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

function pick<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined
  const i = Math.floor(rng() * arr.length)
  return arr[i]
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

export type BotContext = {
  seed: number
}

export type BotStepResult = {
  actions: Action[]
  boughtSoulIds: string[]
  soulBuyGoldSpent: number
  enchantedSoulIds: string[]
  enchantGoldSpent: number
  soulGoldSpent: number  // deprecated alias
}

// 簡單的卡牌優先級權重（可未來從 sim 報告動態更新）
const CARD_PRIORITY: Record<string, number> = {
  'eternal_night_rook_guhua': 100,    // 骨華（目前最強）
  'eternal_night_knight_hunling': 80, // 魂靈
  'styx_rook_mingyanche': 60,
  'dark_moon_rook_lanhua': 50,
  // ... 可繼續加其他高勝率卡
}

function getCardPriority(soulId: string): number {
  return CARD_PRIORITY[soulId] ?? 10  // 預設 10
}

export function decideActions(state: GameState, side: Side, ctx: BotContext): BotStepResult {
  const rng = makeRng(ctx.seed)
  const actions: Action[] = []
  const boughtSoulIds: string[] = []
  let soulBuyGoldSpent = 0
  const enchantedSoulIds: string[] = []
  let enchantGoldSpent = 0

  const result = (): BotStepResult => ({
    actions,
    boughtSoulIds,
    soulBuyGoldSpent,
    enchantedSoulIds,
    enchantGoldSpent,
    soulGoldSpent: soulBuyGoldSpent,
  })

  if (state.turn.side !== side) return result()

  switch (state.turn.phase) {
    case 'buy': {
      // 1. 優先 display 高優先級魂卡
      let displayCandidates: { base: PieceBase; soulId: string; priority: number }[] = []
      for (const base of Object.keys(state.displayByBase) as PieceBase[]) {
        const soulId = state.displayByBase[base]
        if (soulId && canBuySoulFromDisplay(state, base).ok) {
          const pri = getCardPriority(soulId)
          displayCandidates.push({ base, soulId, priority: pri })
        }
      }

      // 按 priority 降序排序，優先買高分卡
      displayCandidates.sort((a, b) => b.priority - a.priority)

      let bought = false
      for (const cand of displayCandidates) {
        actions.push({ type: 'BUY_SOUL_FROM_DISPLAY', base: cand.base })
        boughtSoulIds.push(cand.soulId)
        soulBuyGoldSpent += state.rules.buySoulFromDisplayGoldCost
        bought = true
        break  // 一次只買一張 display（可改成多買）
      }

      // 2. 如果 display 沒買到，盲抽 deck 時也偏好高優先基底（但 blind 無法知道 soulId，只能猜）
      if (!bought) {
        const deckBases = ['rook', 'knight', 'cannon'] as const  // 優先高輸出基底
        const shuffledDeck = deckBases.slice().sort(() => rng() - 0.5)
        for (const base of shuffledDeck) {
          if (canBuySoulFromDeck(state, base).ok) {
            actions.push({ type: 'BUY_SOUL_FROM_DECK', base })
            soulBuyGoldSpent += state.rules.buySoulFromDeckGoldCost
            bought = true
            break
          }
        }
      }

      // 3. 最後買 item（保持原樣）
      if (!bought) {
        const slots = [0, 1, 2].filter((s) => canBuyItemFromDisplay(state, s).ok)
        const slot = pick(slots, rng)
        if (slot != null) actions.push({ type: 'BUY_ITEM_FROM_DISPLAY', slot })
      }

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'necro': {
      // 優先獻祭（如果有永夜單位且條件允許）
      const myUnits = Object.values(state.units).filter(u => u.side === side)
      const hasEternalNight = myUnits.some(u => getSoulCard(u.enchant?.soulId ?? '')?.clan === 'eternal_night')

      if (hasEternalNight) {
        // 找可獻祭的 pair（source 有 SACRIFICE_SHOT_BUFF，target 是弱單位）
        const sacrificePairs = []
        for (const src of myUnits) {
          const srcCard = getSoulCard(src.enchant?.soulId ?? '')
          if (srcCard?.clan === 'eternal_night' && srcCard.abilities.some(a => a.type === 'SACRIFICE_SHOT_BUFF')) {
            for (const tgt of myUnits) {
              if (tgt.id !== src.id && !tgt.enchant && canSacrifice(state, src.id, tgt.id).ok) {
                sacrificePairs.push({ sourceUnitId: src.id, targetUnitId: tgt.id })
              }
            }
          }
        }

        if (sacrificePairs.length > 0) {
          const pair = pick(sacrificePairs, rng)!
          actions.push({ type: 'SACRIFICE', sourceUnitId: pair.sourceUnitId, targetUnitId: pair.targetUnitId })
        }
      }

      // 再嘗試附魔（優先高優先級魂卡）
      const soulHand = state.hands[side].souls.slice()
      const unitIds = myUnits.filter(u => !u.enchant).map(u => u.id)

      const pairs: Array<{ unitId: string; soulId: string; pri: number }> = []
      for (const unitId of unitIds) {
        for (const soulId of soulHand) {
          if (canEnchant(state, unitId, soulId).ok) {
            const pri = getCardPriority(soulId)
            pairs.push({ unitId, soulId, pri })
          }
        }
      }

      pairs.sort((a, b) => b.pri - a.pri)  // 高優先先附魔
      const p = pairs[0]  // 取最高優先的一個
      if (p) {
        actions.push({ type: 'ENCHANT', unitId: p.unitId, soulId: p.soulId })
        enchantedSoulIds.push(p.soulId)
        const card = getSoulCard(p.soulId)
        enchantGoldSpent += card?.costGold ?? 0
      }

      actions.push({ type: 'NEXT_PHASE' })
      return result()
    }

    case 'combat': {
      let tmp: GameState = state
      const maxActions = 5

      for (let i = 0; i < maxActions; i++) {
        const myUnits = Object.values(tmp.units).filter(u => u.side === side)
        const enemies = Object.values(tmp.units).filter(u => u.side !== side)
        if (enemies.length === 0) break

        type Candidate = { action: Action; score: number }

        // 射擊候選
        const shootCandidates: Candidate[] = []
        for (const a of myUnits) {
          for (const t of enemies) {
            if (canShootAction(tmp, a.id, t.id, null).ok) {
              let score = t.base === 'king' ? -10000 : (t.hpCurrent ?? 999) * -1

              // 加分：目標有高價值魂卡（例如對方骨華）
              if (t.enchant?.soulId && getCardPriority(t.enchant.soulId) > 50) score -= 5000

              // 加分：殺了能增加我方屍骸，觸發自己能力
              const afterKillCorpses = countCorpses(tmp, side) + 1
              if (afterKillCorpses >= 7) score -= 3000  // 假設能觸發骨華 +1 傷

              shootCandidates.push({ action: { type: 'SHOOT', attackerId: a.id, targetUnitId: t.id }, score })
            }
          }
        }

        let act: Action | null = null
        if (shootCandidates.length > 0) {
          shootCandidates.sort((a, b) => a.score - b.score)
          const top = shootCandidates[0]
          act = top.action
        }

        // 如果不能射，移動靠近敵人
        if (!act) {
          const movers = myUnits.filter(u => getLegalMoves(tmp, u.id).length > 0)
          const m = pick(movers, rng)
          if (m) {
            const moves = getLegalMoves(tmp, m.id)
            const scored = moves.map(to => {
              const minDist = enemies.reduce((best, e) => {
                const d = Math.abs(e.pos.x - to.x) + Math.abs(e.pos.y - to.y)
                return d < best ? d : best
              }, Infinity)
              return { to, score: minDist }
            })
            scored.sort((a, b) => a.score - b.score)
            const bestMoves = scored.filter(s => s.score === scored[0]?.score).map(s => s.to)
            const to = pick(bestMoves, rng)
            if (to && canMove(tmp, m.id, to).ok) act = { type: 'MOVE', unitId: m.id, to }
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