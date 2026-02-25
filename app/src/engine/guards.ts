import type { Action } from './actions'
import type { GameState } from './state'
import { getUnitAt } from './state'
import type { PieceBase, Pos } from './types'
import { isOnBoard } from './types'
import { isLegalMove } from './legalMoves'
import { getSoulCard } from './cards'
import { buildShotPlan } from './shotPlan'
import { getItemCard } from './items'

export type GuardResult = { ok: true } | { ok: false; reason: string }

const EN_SACRIFICE_SELF_SOUL_IDS = new Set(['eternal_night_advisor_guhu', 'eternal_night_advisor_hunshi'])

export function canSacrifice(state: GameState, sourceUnitId: string, targetUnitId: string, range?: number): GuardResult {
  if (state.turn.phase !== 'combat') return fail('Not in combat phase')

  const src = state.units[sourceUnitId]
  const tgt = state.units[targetUnitId]
  if (!src || !tgt) return fail('Unit not found')
  const srcSoulId = src.enchant?.soulId ?? null
  const srcCard = srcSoulId ? getSoulCard(srcSoulId) : null
  if (!srcSoulId || !srcCard) return fail('Source has no sacrifice ability')
  if (String((srcCard as any).clan ?? '') !== 'eternal_night') return fail('Source has no sacrifice ability')
  const sacAb = srcCard.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SHOT_BUFF')
  const hasSacrifice = !!sacAb || EN_SACRIFICE_SELF_SOUL_IDS.has(srcSoulId)
  if (!hasSacrifice) return fail('Source has no sacrifice ability')

  if (state.turnFlags.shotUsed?.[src.id]) return fail('Already shot this turn')
  if (sacAb && (sacAb as any).requiresMovedThisTurn && !state.turnFlags.movedThisTurn?.[src.id]) return fail('Must move before sacrifice')

  // Advisors: sacrifice self only.
  if (EN_SACRIFICE_SELF_SOUL_IDS.has(srcSoulId)) {
    if (src.id !== tgt.id) return fail('Must sacrifice self')
  }

  // Rook/Knight: sacrifice allied unit (not self).
  if (sacAb) {
    if (src.id === tgt.id) return fail('Cannot sacrifice self')
  }
  if (src.side !== state.turn.side) return fail('Not your turn')
  if (tgt.side !== state.turn.side) return fail('Cannot sacrifice enemy')
  if (tgt.base === 'king') return fail('Cannot sacrifice king')

  const r = (() => {
    const r0 = Number.isFinite(range as any) ? Math.max(0, Math.floor(range as number)) : null
    if (r0 != null) return r0
    if (sacAb) {
      const rr = Number((sacAb as any).range ?? 0)
      if (Number.isFinite(rr) && rr > 0) return Math.floor(rr)
    }
    return 1
  })()
  const dist = Math.max(Math.abs(src.pos.x - tgt.pos.x), Math.abs(src.pos.y - tgt.pos.y))
  if (dist > r) return fail('Out of range')

  return ok()
}

export function canBuyItemFromDisplay(state: GameState, slot: number): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return fail('No item buy actions left this turn')
  const hand = state.hands[state.turn.side].items
  if (hand.length >= state.limits.itemHandMax) return fail(`Item hand full (${state.limits.itemHandMax})`)
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return fail('Invalid item slot')
  const itemId = state.itemDisplay[slot]
  if (!itemId) return fail('No item in display')
  const item = getItemCard(itemId)
  if (!item) return fail('Item not found')
  const r = state.resources[state.turn.side]
  if (r.gold < item.costGold) return fail('Not enough gold')
  return ok()
}

export function canBloodRitual(state: GameState): GuardResult {
  if (state.turn.phase !== 'necro') return fail('Not in necro phase')
  if (state.turnFlags.bloodRitualUsed) return fail('Blood ritual already used this turn')

  // Find current side king.
  const king = Object.values(state.units).find((u) => u.side === state.turn.side && u.base === 'king')
  if (!king) return fail('King not found')
  if (king.hpCurrent <= 3) return fail('King HP too low')
  return ok()
}

export function canDiscardItemFromHand(state: GameState, itemId: string): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return fail('No item buy actions left this turn')
  const hand = state.hands[state.turn.side].items
  if (!hand.includes(itemId)) return fail('Item not in hand')
  return ok()
}

function ok(): GuardResult {
  return { ok: true }
}

function fail(reason: string): GuardResult {
  return { ok: false, reason }
}

export function canDispatch(state: GameState, action: Action): GuardResult {
  switch (action.type) {
    case 'MOVE':
      return canMove(state, action.unitId, action.to)
    case 'SHOOT':
      return canShootAction(state, action.attackerId, action.targetUnitId, action.extraTargetUnitId)
    case 'ENCHANT':
      return canEnchant(state, action.unitId, action.soulId)
    case 'REVIVE':
      return canRevive(state, action.pos)
    case 'BLOOD_RITUAL':
      return canBloodRitual(state)
    case 'BUY_SOUL_FROM_DECK':
      return canBuySoulFromDeck(state, action.base)
    case 'BUY_SOUL_FROM_DISPLAY':
      return canBuySoulFromDisplay(state, action.base)
    case 'BUY_SOUL_FROM_ENEMY_GRAVEYARD':
      return canBuySoulFromEnemyGraveyard(state)
    case 'RETURN_SOUL_TO_DECK_BOTTOM':
      return canReturnSoulToDeckBottom(state, action.soulId)
    case 'BUY_ITEM_FROM_DISPLAY':
      return canBuyItemFromDisplay(state, action.slot)
    case 'DISCARD_ITEM_FROM_HAND':
      return canDiscardItemFromHand(state, action.itemId)
    case 'SACRIFICE':
      return canSacrifice(state, action.sourceUnitId, action.targetUnitId, action.range)
    case 'NEXT_PHASE':
      return ok()
    default: {
      const _exhaustive: never = action
      return fail(`Unknown action: ${String(_exhaustive)}`)
    }
  }
}

function necroActionsPerTurn(state: GameState): number {
  return state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0)
}

export function canMove(state: GameState, unitId: string, to: Pos): GuardResult {
  const unit = state.units[unitId]
  if (!unit) return fail('Unit not found')
  if (unit.side !== state.turn.side) return fail('Not your turn')
  if (state.turn.phase !== 'combat') return fail('Not in combat phase')

  const r = state.resources[state.turn.side]
  const cost = state.rules.moveManaCost
  if (r.mana < cost) return fail('Not enough mana')
  if (!isOnBoard(to)) return fail('Target position out of board')
  if (getUnitAt(state, to)) return fail('Target position occupied')
  if (!isLegalMove(state, unit.id, to)) return fail('Illegal move')
  return ok()
}

export function canShootAction(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null): GuardResult {
  if (state.turn.phase !== 'combat') return fail('Not in combat phase')

  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker || !target) return fail('Unit not found')
  if (attacker.side !== state.turn.side) return fail('Not your turn')

  const planRes = buildShotPlan(state, attackerId, targetUnitId, extraTargetUnitId)
  return planRes.ok ? ok() : fail(planRes.error)
}

export function canEnchant(state: GameState, unitId: string, soulId: string): GuardResult {
  if (state.turn.phase !== 'necro') return fail('Not in necro phase')
  if (state.turnFlags.necroActionsUsed >= necroActionsPerTurn(state)) return fail('No necro actions left this turn')

  const unit = state.units[unitId]
  if (!unit) return fail('Unit not found')
  if (unit.side !== state.turn.side) return fail('Not your turn')
  if (unit.enchant) return fail('Unit already enchanted')

  const card = getSoulCard(soulId)
  if (!card) return fail('Soul card not found')
  if (card.base !== unit.base) return fail('Soul base mismatch')

  const r = state.resources[state.turn.side]
  if (r.gold < card.costGold) return fail('Not enough gold')

  const hand = state.hands[state.turn.side].souls
  if (!hand.includes(soulId)) return fail('Soul not in hand')

  return ok()
}

export function canRevive(state: GameState, pos: Pos): GuardResult {
  if (state.turn.phase !== 'necro') return fail('Not in necro phase')
  if (state.turnFlags.necroActionsUsed >= necroActionsPerTurn(state)) return fail('No necro actions left this turn')
  const posKey = `${pos.x},${pos.y}`
  const stack = state.corpsesByPos[posKey]
  if (!stack || stack.length === 0) return fail('No corpses here')
  if (getUnitAt(state, pos)) return fail('Target position occupied')

  const r = state.resources[state.turn.side]
  if (r.gold < state.rules.reviveGoldCost) return fail('Not enough gold')

  const corpse = stack[stack.length - 1]
  if (!corpse) return fail('No corpses here')
  if (corpse.ownerSide !== state.turn.side) return fail('Not your corpse')

  return ok()
}

export function canBuySoulFromDeck(state: GameState, base: PieceBase): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return fail('No soul buy actions left this turn')
  if (state.turnFlags.soulBuyUsed) return fail('Soul buy already used this turn')
  const hand = state.hands[state.turn.side].souls
  if (hand.length >= state.limits.soulHandMax) return fail(`Soul hand full (${state.limits.soulHandMax})`)
  const side = state.turn.side
  const r = state.resources[side]
  if (r.gold < state.rules.buySoulFromDeckGoldCost) return fail('Not enough gold')
  const deck = state.soulDeckByBase[base]
  if (!deck || deck.length === 0) return fail('Deck empty')
  return ok()
}

export function canBuySoulFromDisplay(state: GameState, base: PieceBase): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return fail('No soul buy actions left this turn')
  if (state.turnFlags.soulBuyUsed) return fail('Soul buy already used this turn')
  const hand = state.hands[state.turn.side].souls
  if (hand.length >= state.limits.soulHandMax) return fail(`Soul hand full (${state.limits.soulHandMax})`)
  const side = state.turn.side
  const r = state.resources[side]
  if (r.gold < state.rules.buySoulFromDisplayGoldCost) return fail('Not enough gold')
  const soulId = state.displayByBase[base]
  if (!soulId) return fail('No display card')
  return ok()
}

export function canBuySoulFromEnemyGraveyard(state: GameState): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return fail('No soul buy actions left this turn')
  if (state.turnFlags.soulBuyUsed) return fail('Soul buy already used this turn')
  const hand = state.hands[state.turn.side].souls
  if (hand.length >= state.limits.soulHandMax) return fail(`Soul hand full (${state.limits.soulHandMax})`)
  const side = state.turn.side
  const enemy = side === 'red' ? 'black' : 'red'
  const r = state.resources[side]
  if (r.gold < state.rules.buySoulFromEnemyGraveyardGoldCost) return fail('Not enough gold')
  const gy = state.graveyard[enemy]
  if (!gy || gy.length === 0) return fail('Enemy graveyard empty')
  return ok()
}

export function canReturnSoulToDeckBottom(state: GameState, soulId: string): GuardResult {
  if (state.turn.phase !== 'buy') return fail('Not in buy phase')
  if (state.turnFlags.soulReturnUsedCount >= state.limits.soulReturnPerTurn) return fail('Soul return already used this turn')
  const hand = state.hands[state.turn.side].souls
  if (!hand.includes(soulId)) return fail('Soul not in hand')
  const card = getSoulCard(soulId)
  if (!card) return fail('Soul card not found')
  return ok()
}
