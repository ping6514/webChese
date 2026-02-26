import type { Action } from '../engine'
import type { GameState, Side } from '../engine'
import {
  canBuySoulFromDisplay,
  canBuyItemFromDisplay,
  canMove,
  canShootAction,
  canEnchant,
  canRevive,
  getLegalMoves,
  reduce,
} from '../engine'

function pick<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined
  const i = Math.floor(rng() * arr.length)
  return arr[i]
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    // LCG
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
  soulGoldSpent: number
}

export function decideActions(state: GameState, side: Side, ctx: BotContext): BotStepResult {
  const rng = makeRng(ctx.seed)
  const actions: Action[] = []
  const boughtSoulIds: string[] = []
  let soulGoldSpent = 0

  if (state.turn.side !== side) return { actions, boughtSoulIds, soulGoldSpent }

  switch (state.turn.phase) {
    case 'buy': {
      // Buy exactly one soul from display if possible.
      const bases = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier'] as const
      const buyable = bases.filter((b) => canBuySoulFromDisplay(state, b).ok)
      const base = pick(buyable, rng)
      if (base) {
        const soulId = state.displayByBase[base]
        if (soulId) {
          actions.push({ type: 'BUY_SOUL_FROM_DISPLAY', base })
          boughtSoulIds.push(soulId)
          soulGoldSpent += state.rules.buySoulFromDisplayGoldCost
        }
      } else {
        // If cannot buy soul, try buy a random item.
        const slots = [0, 1, 2].filter((slot) => canBuyItemFromDisplay(state, slot).ok)
        const slot = pick(slots, rng)
        if (slot != null) {
          const itemId = state.itemDisplay[slot]
          const cost = itemId ? 0 : 0
          actions.push({ type: 'BUY_ITEM_FROM_DISPLAY', slot })
          void cost
        }
      }
      actions.push({ type: 'NEXT_PHASE' })
      return { actions, boughtSoulIds, soulGoldSpent }
    }

    case 'necro': {
      // Try enchant a random eligible unit with a random hand soul.
      const soulHand = state.hands[side].souls.slice()
      const unitIds = Object.values(state.units)
        .filter((u) => u.side === side && !u.enchant)
        .map((u) => u.id)

      const pairs: Array<{ unitId: string; soulId: string }> = []
      for (const unitId of unitIds) {
        for (const soulId of soulHand) {
          if (canEnchant(state, unitId, soulId).ok) pairs.push({ unitId, soulId })
        }
      }
      const p = pick(pairs, rng)
      if (p) actions.push({ type: 'ENCHANT', unitId: p.unitId, soulId: p.soulId })
      else {
        // If cannot enchant, maybe revive at random corpse position.
        const posKeys = Object.keys(state.corpsesByPos)
        const posKey = pick(posKeys, rng)
        if (posKey) {
          const parts = posKey.split(',')
          const x0 = parts.length >= 1 ? Number(parts[0]) : NaN
          const y0 = parts.length >= 2 ? Number(parts[1]) : NaN
          if (Number.isFinite(x0) && Number.isFinite(y0)) {
            const pos = { x: x0, y: y0 }
            if (canRevive(state, pos).ok) actions.push({ type: 'REVIVE', pos })
          }
        }
      }
      actions.push({ type: 'NEXT_PHASE' })
      return { actions, boughtSoulIds, soulGoldSpent }
    }

    case 'combat': {
      // MVP: allow multiple actions in combat so games converge faster.
      // We simulate the chosen actions locally so subsequent picks are based on updated state.
      let tmp: GameState = state
      const maxActionsThisCombat = 5

      for (let i = 0; i < maxActionsThisCombat; i++) {
        const myUnits = Object.values(tmp.units).filter((u) => u.side === side)
        const enemies = Object.values(tmp.units).filter((u) => u.side !== side)

        const shootActions: Action[] = []
        for (const a of myUnits) {
          for (const t of enemies) {
            if (canShootAction(tmp, a.id, t.id, null).ok) {
              shootActions.push({ type: 'SHOOT', attackerId: a.id, targetUnitId: t.id })
            }
          }
        }

        let act: Action | null = pick(shootActions, rng) ?? null
        if (!act) {
          const movers = myUnits.filter((u) => getLegalMoves(tmp, u.id).length > 0)
          const m = pick(movers, rng)
          if (m) {
            const moves = getLegalMoves(tmp, m.id)
            const to = pick(moves, rng)
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
      return { actions, boughtSoulIds, soulGoldSpent }
    }

    default:
      // Let engine auto phases progress.
      actions.push({ type: 'NEXT_PHASE' })
      return { actions, boughtSoulIds, soulGoldSpent }
  }
}
