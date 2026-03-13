import type { Action } from './actions'
import type { GameState } from './state'
import { getUnitAt } from './state'
import { getReviveGoldCost } from './state'
import type { PieceBase, Pos } from './types'
import { isOnBoard } from './types'
import { isLegalMove } from './legalMoves'
import { getSoulCard } from './cards'
import { buildShotPlan } from './shotPlan'
import { getItemCard } from './items'
import { FREE_SHOOT_MANA_SENTINEL } from './gameConfig'

export type GuardResult = { ok: true } | { ok: false; reason: string }

export function canSacrifice(state: GameState, sourceUnitId: string, targetUnitId: string, range?: number): GuardResult {
  if (state.turn.phase !== 'combat') return fail('需要在戰鬥階段')

  const src = state.units[sourceUnitId]
  const tgt = state.units[targetUnitId]
  if (!src || !tgt) return fail('找不到單位')
  const srcSoulId = src.enchant?.soulId ?? null
  const srcCard = srcSoulId ? getSoulCard(srcSoulId) : null
  if (!srcSoulId || !srcCard) return fail('來源單位沒有獻祭技能')
  if (String((srcCard as any).clan ?? '') !== 'eternal_night') return fail('來源單位沒有獻祭技能')
  const sacAb = srcCard.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SHOT_BUFF')
  const selfSacAb = srcCard.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SELF_APPLY_STATUS')
  const hasSacrifice = !!sacAb || !!selfSacAb
  if (!hasSacrifice) return fail('來源單位沒有獻祭技能')

  if (state.turnFlags.shotUsed?.[src.id]) return fail('本回合已射擊過')
  if (sacAb && (sacAb as any).requiresMovedThisTurn && !state.turnFlags.movedThisTurn?.[src.id]) return fail('獻祭前必須先移動')

  // Advisors: sacrifice self only.
  if (selfSacAb) {
    if (src.id !== tgt.id) return fail('此技能只能對自身獻祭')
  }

  // Rook/Knight: sacrifice allied unit (not self).
  if (sacAb) {
    if (src.id === tgt.id) return fail('不能對自身獻祭')
  }
  if (src.side !== state.turn.side) return fail('不是你的回合')
  if (tgt.side !== state.turn.side) return fail('不能獻祭敵方單位')
  if (tgt.base === 'king') return fail('不能獻祭帥/將')

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
  if (dist > r) return fail('超出範圍')

  return ok()
}

export function canBuyItemFromDisplay(state: GameState, slot: number): GuardResult {
  if (state.turn.phase !== 'buy') return fail('需要在購買階段')
  if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return fail('本回合購買道具次數已用完')
  const hand = state.hands[state.turn.side].items
  if (hand.length >= state.limits.itemHandMax) return fail(`道具手牌已滿（${state.limits.itemHandMax}張）`)
  if (!Number.isInteger(slot) || slot < 0 || slot >= 3) return fail('無效的道具欄位')
  const itemId = state.itemDisplay[slot]
  if (!itemId) return fail('展示區無道具')
  const item = getItemCard(itemId)
  if (!item) return fail('找不到道具卡')
  const r = state.resources[state.turn.side]
  if (r.gold < item.costGold) return fail('財力不足')
  return ok()
}

export function canBloodRitual(state: GameState): GuardResult {
  if (state.turn.phase !== 'necro') return fail('需要在死靈術階段')
  if (state.turnFlags.bloodRitualUsed) return fail('本回合已使用過血液祭儀')

  // Find current side king.
  const king = Object.values(state.units).find((u) => u.side === state.turn.side && u.base === 'king')
  if (!king) return fail('找不到帥/將')
  if (king.hpCurrent <= 3) return fail('帥/將血量過低（最少需要 4 HP）')
  return ok()
}

export function canDiscardItemFromHand(state: GameState, itemId: string): GuardResult {
  if (state.turn.phase !== 'buy') return fail('需要在購買階段')
  const hand = state.hands[state.turn.side].items
  if (!hand.includes(itemId)) return fail('道具不在手牌中')
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
    case 'SURRENDER':
      return ok()
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
    case 'USE_ITEM_FROM_HAND':
      return canUseItemFromHand(state, action.itemId)
    case 'SACRIFICE':
      return canSacrifice(state, action.sourceUnitId, action.targetUnitId, action.range)
    case 'NEXT_PHASE':
      if (action.expectedPhase && action.expectedPhase !== state.turn.phase) {
        return fail(`階段不同步：目前為 ${state.turn.phase}`)
      }
      return ok()
    default: {
      const _exhaustive: never = action
      return fail(`Unknown action: ${String(_exhaustive)}`)
    }
  }
}

function necroActionsPerTurn(state: GameState): number {
  return state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0) + (state.turnFlags.itemNecroBonus ?? 0)
}

export function canUseItemFromHand(state: GameState, itemId: string): GuardResult {
  const side = state.turn.side
  const hand = state.hands[side].items
  if (!hand.includes(itemId)) return fail('道具不在手牌中')
  const item = getItemCard(itemId)
  if (!item) return fail('找不到道具卡')
  const timing = item.timing
  if (timing === 'buy' && state.turn.phase !== 'buy') return fail('此道具只能在購買階段使用')
  if (timing === 'necro' && state.turn.phase !== 'necro') return fail('此道具只能在死靈術階段使用')
  if (timing === 'combat' && state.turn.phase !== 'combat') return fail('此道具只能在戰鬥階段使用')
  // 牢籠掠奪：己方牢籠已有 5 張 or 敵方牢籠為空
  if (itemId === 'item_cage_plunder') {
    const enemySide = side === 'red' ? 'black' : 'red'
    if (state.hands[enemySide].souls.length < 1) return fail('敵方牢籠沒有靈魂卡')
    if (state.hands[side].souls.length >= state.limits.soulHandMax) return fail(`己方牢籠已滿（${state.limits.soulHandMax}張），無法發動`)
  }
  return ok()
}

// Helper: find an ally with FORMATION_COMMAND within radius of the given soldier unit.
function findFormationCommand(state: GameState, unitId: string): { allyId: string; abilityKey: string } | null {
  const unit = state.units[unitId]
  if (!unit || unit.base !== 'soldier') return null
  for (const u of Object.values(state.units)) {
    if (u.side !== unit.side || u.id === unit.id) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue
    const ab = card.abilities.find((a) => a.type === 'FORMATION_COMMAND')
    if (!ab) continue
    const perTurn = Number((ab as any).perTurn ?? 1)
    const key = `${u.id}:FORMATION_COMMAND`
    const used = state.turnFlags.abilityUsed?.[key] ?? 0
    if (used >= perTurn) continue
    return { allyId: u.id, abilityKey: key }
  }
  return null
}

export function canMove(state: GameState, unitId: string, to: Pos): GuardResult {
  const unit = state.units[unitId]
  if (!unit) return fail('找不到單位')
  if (unit.side !== state.turn.side) return fail('不是你的回合')
  if (state.turn.phase !== 'combat') return fail('需要在戰鬥階段')
  if ((state.turnFlags.sealedUnitIds ?? []).includes(unitId)) return fail('此單位已被冥鎖封印，本回合無法移動')

  const r = state.resources[state.turn.side]
  const cost = state.rules.moveManaCost
  // 整編：周圍有 FORMATION_COMMAND 的卒免費移動
  const fc = findFormationCommand(state, unit.id)
  const canUseFreeMove = (state.turnFlags.freeMoveBonus ?? 0) > 0 && !state.turnFlags.movedThisTurn?.[unitId]
  const effectiveManaCost = (fc || canUseFreeMove) ? 0 : cost
  if (r.mana < effectiveManaCost) return fail('魔力不足')
  if (!isOnBoard(to)) return fail('目標位置超出棋盤')
  if (getUnitAt(state, to)) return fail('目標位置已有單位')
  if (!isLegalMove(state, unit.id, to)) return fail('不合法的移動')
  return ok()
}

export function canShootAction(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null): GuardResult {
  if (state.turn.phase !== 'combat') return fail('需要在戰鬥階段')

  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker || !target) return fail('找不到單位')
  if ((state.turnFlags.sealedUnitIds ?? []).includes(attackerId)) return fail('此單位已被冥鎖封印，本回合無法射擊')
  if (attacker.side !== state.turn.side) return fail('不是你的回合')

  // 魂能超載: 若有免費射擊，暫時提升魔力以通過消耗檢查
  const canUseFreeShoot = (state.turnFlags.freeShootBonus ?? 0) > 0 && !state.turnFlags.shotUsed?.[attackerId]
  const stateForCheck = canUseFreeShoot ? {
    ...state,
    resources: {
      ...state.resources,
      [state.turn.side]: {
        ...state.resources[state.turn.side],
        mana: Math.max(state.resources[state.turn.side].mana, FREE_SHOOT_MANA_SENTINEL),
      },
    },
  } : state

  const planRes = buildShotPlan(stateForCheck, attackerId, targetUnitId, extraTargetUnitId)
  if (!planRes.ok) return fail((planRes as { ok: false; error: string }).error)
  return ok()
}

export function canEnchant(state: GameState, unitId: string, soulId: string): GuardResult {
  if (state.turn.phase !== 'necro') return fail('需要在死靈術階段')
  if (state.turnFlags.necroActionsUsed >= necroActionsPerTurn(state)) return fail('本回合死靈術行動已用完')

  const unit = state.units[unitId]
  if (!unit) return fail('找不到單位')
  if (unit.side !== state.turn.side) return fail('不是你的回合')
  if (unit.enchant) return fail('單位已有附魔')

  // 死戰契約：本回合由契約復活的單位不可附魔
  if ((state.turnFlags.lastStandNoEnchantUnitIds ?? []).includes(unitId)) {
    return fail('此單位本回合不可附魔（死戰契約）')
  }

  const card = getSoulCard(soulId)
  if (!card) return fail('找不到靈魂卡')
  if (card.base !== unit.base) return fail('靈魂卡棋種不符')

  const r = state.resources[state.turn.side]
  // 冥魂灌注：附魔成本折扣
  const discount = state.turnFlags.enchantGoldDiscount ?? 0
  const effectiveCost = Math.max(0, card.costGold - discount)
  if (r.gold < effectiveCost) return fail('財力不足')

  const hand = state.hands[state.turn.side].souls
  if (!hand.includes(soulId)) return fail('靈魂卡不在手牌中')

  return ok()
}

// Helper: find an ally with LOGISTICS_REVIVE ability available this turn.
function findLogisticsRevive(state: GameState): { allyId: string; abilityKey: string } | null {
  for (const u of Object.values(state.units)) {
    if (u.side !== state.turn.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue
    const ab = card.abilities.find((a) => a.type === 'LOGISTICS_REVIVE')
    if (!ab) continue
    const perTurn = Number((ab as any).perTurn ?? 1)
    const key = `${u.id}:LOGISTICS_REVIVE`
    const used = state.turnFlags.abilityUsed?.[key] ?? 0
    if (used >= perTurn) continue
    return { allyId: u.id, abilityKey: key }
  }
  return null
}

export function canRevive(state: GameState, pos: Pos): GuardResult {
  if (state.turn.phase !== 'necro') return fail('Not in necro phase')

  const posKey = `${pos.x},${pos.y}`
  const stack = state.corpsesByPos[posKey]
  if (!stack || stack.length === 0) return fail('No corpses here')
  if (getUnitAt(state, pos)) return fail('Target position occupied')

  const corpse = [...stack].reverse().find((c) => c.ownerSide === state.turn.side)
  if (!corpse) return fail('No corpses here')

  // 後勤：召侍在場且卒屍骸可免費復活（不消耗死靈術次數）
  const usingContract = (state.turnFlags.lastStandContractBonus ?? 0) > 0
  const lr = corpse.base === 'soldier' ? findLogisticsRevive(state) : null
  const usingLogisticsRevive = !!lr

  if (!usingContract && !usingLogisticsRevive && state.turnFlags.necroActionsUsed >= necroActionsPerTurn(state)) {
    return fail('No necro actions left this turn')
  }

  const cost = getReviveGoldCost(corpse.base)
  const effectiveGoldCost = (usingLogisticsRevive || usingContract) ? 0 : cost
  const r = state.resources[state.turn.side]
  if (r.gold < effectiveGoldCost) return fail('Not enough gold')

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
