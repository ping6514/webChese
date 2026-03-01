import type { Action } from './actions'
import type { Event } from './events'
import { isOnBoard } from './types'
import type { GameState } from './state'
import { getUnitAt, BASE_STATS, getReviveGoldCost, refillDisplayByBase } from './state'
import { FREE_SHOOT_MANA_SENTINEL, DEATH_CHAIN_MAX_KILLS } from './gameConfig'
import { reduceUseItem } from './itemReducers'
import { isLegalMove } from './legalMoves'
import { buildShotPlan, executeShotPlan } from './shotPlan'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import { killUnit } from './kill'
import { canSacrifice } from './guards'

export type ReduceOk = {
  ok: true
  state: GameState
  events: Event[]
}

function refillItemDisplay(state: GameState, slot: number): GameState {
  const cur = state.itemDisplay[slot]
  if (cur != null) return state
  if (state.itemDeck.length === 0) return state

  const nextDeck = [...state.itemDeck]
  const nextItemId = nextDeck.shift() ?? null
  const nextDisplay = state.itemDisplay.slice()
  nextDisplay[slot] = nextItemId

  return {
    ...state,
    itemDeck: nextDeck,
    itemDisplay: nextDisplay,
  }
}

export type ReduceErr = {
  ok: false
  error: string
}

export type ReduceResult = ReduceOk | ReduceErr

// ── FORMATION_COMMAND helper ──────────────────────────────────────────────────
function findFormationCommandHelper(state: GameState, unitId: string): { allyId: string; abilityKey: string } | null {
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

// ── LOGISTICS_REVIVE helper ───────────────────────────────────────────────────
function findLogisticsReviveHelper(state: GameState): { allyId: string; abilityKey: string } | null {
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function pushResourcesEvent(events: Event[], state: GameState, side: GameState['turn']['side']) {
  const r = state.resources[side]
  events.push({ type: 'RESOURCES_CHANGED', side, gold: r.gold, mana: r.mana, storageMana: r.storageMana })
}

function autoTurnStart(state: GameState, events: Event[]): GameState {
  const side = state.turn.side
  const r = state.resources[side]

  const goldFromStorage = r.storageMana * state.rules.storageToGoldRate
  const gold = clamp(r.gold + goldFromStorage, 0, state.limits.goldMax)
  const mana = clamp(r.mana + state.rules.incomeMana, 0, state.limits.manaMax)
  const goldAfterIncome = clamp(gold + state.rules.incomeGold, 0, state.limits.goldMax)

  const next: GameState = {
    ...state,
    resources: {
      ...state.resources,
      [side]: {
        ...r,
        gold: goldAfterIncome,
        mana,
        storageMana: 0,
      },
    },
  }

  pushResourcesEvent(events, next, side)
  return next
}

function autoTurnEnd(state: GameState, events: Event[]): GameState {
  const side = state.turn.side
  const r = state.resources[side]

  const stored = clamp(r.storageMana + r.mana, 0, state.limits.storageManaMax)

  const next: GameState = {
    ...state,
    resources: {
      ...state.resources,
      [side]: {
        ...r,
        mana: 0,
        storageMana: stored,
      },
    },
  }

  pushResourcesEvent(events, next, side)
  return next
}

function nextPhaseOf(p: GameState['turn']['phase']): GameState['turn']['phase'] {
  switch (p) {
    case 'turnStart': return 'buy'
    case 'buy':       return 'necro'
    case 'necro':     return 'combat'
    case 'combat':    return 'turnEnd'
    case 'turnEnd':   return 'turnStart'
    default: {
      const _exhaustive: never = p
      return _exhaustive
    }
  }
}

function reduceNextPhase(state: GameState): ReduceResult {
  const events: Event[] = []
  const side = state.turn.side
  const from = state.turn.phase

  let nextState: GameState = {
    ...state,
    turn: { ...state.turn, phase: nextPhaseOf(state.turn.phase) },
  }

  if (nextState.turn.phase === 'turnEnd') {
    nextState = autoTurnEnd(nextState, events)
    nextState = { ...nextState, turn: { ...nextState.turn, phase: 'turnStart' } }
  }

  if (nextState.turn.phase === 'turnStart') {
    const nextSide = side === 'red' ? 'black' : 'red'
    nextState = {
      ...nextState,
      turn: { ...nextState.turn, side: nextSide },
      status: {
        ...nextState.status,
        kingInvincibleSide: nextState.status.kingInvincibleSide === nextSide ? null : nextState.status.kingInvincibleSide,
      },
      turnFlags: {
        ...nextState.turnFlags,
        shotUsed: {},
        movedThisTurn: {},
        soulReturnUsedCount: 0,
        abilityUsed: {},
        soulBuyUsed: false,
        buySoulActionsUsed: 0,
        buyItemActionsUsed: 0,
        necroActionsUsed: 0,
        bloodRitualUsed: false,
        necroBonusActions: 0,
        freeShootBonus: 0,
        enchantGoldDiscount: 0,
        itemNecroBonus: 0,
        lastStandContractBonus: 0,
        lastStandNoEnchantUnitIds: [],
        darkMoonScopeActive: false,
        deathChainActive: false,
        deathChainKillCount: 0,
        sealedUnitIds: [],
      },
    }
    nextState = autoTurnStart(nextState, events)
    nextState = { ...nextState, turn: { ...nextState.turn, phase: 'buy' } }
    events.push({ type: 'PHASE_CHANGED', side: nextState.turn.side, from: 'turnStart', to: 'buy' })
    return { ok: true, state: nextState, events }
  }

  events.push({ type: 'PHASE_CHANGED', side, from, to: nextState.turn.phase })
  return { ok: true, state: nextState, events }
}

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case 'MOVE': {
      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
      if (state.turn.phase !== 'combat') return { ok: false, error: 'Not in combat phase' }

      const r = state.resources[state.turn.side]
      const cost = state.rules.moveManaCost

      // 整編：周圍有 FORMATION_COMMAND 的卒免費移動（不消耗魔力）
      const fcHelper = unit.base === 'soldier' ? findFormationCommandHelper(state, unit.id) : null
      const effectiveCost = fcHelper ? 0 : cost

      if (r.mana < effectiveCost) return { ok: false, error: 'Not enough mana' }
      if (!isOnBoard(action.to)) return { ok: false, error: 'Target position out of board' }

      const occupied = getUnitAt(state, action.to)
      if (occupied) return { ok: false, error: 'Target position occupied' }

      if (!isLegalMove(state, unit.id, action.to)) return { ok: false, error: 'Illegal move' }

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          mana: r.mana - effectiveCost,
        },
      }

      const prevAbilityUsed = state.turnFlags.abilityUsed ?? {}
      const nextAbilityUsed = fcHelper
        ? { ...prevAbilityUsed, [fcHelper.abilityKey]: (prevAbilityUsed[fcHelper.abilityKey] ?? 0) + 1 }
        : prevAbilityUsed

      const nextState: GameState = {
        ...state,
        resources: nextResources,
        turnFlags: {
          ...state.turnFlags,
          movedThisTurn: {
            ...state.turnFlags.movedThisTurn,
            [unit.id]: true,
          },
          abilityUsed: nextAbilityUsed,
        },
        units: {
          ...state.units,
          [unit.id]: {
            ...unit,
            pos: { ...action.to },
          },
        },
      }

      const moveEvents: Event[] = [
        {
          type: 'UNIT_MOVED',
          unitId: unit.id,
          from: unit.pos,
          to: { ...action.to },
        },
        {
          type: 'RESOURCES_CHANGED',
          side: state.turn.side,
          gold: nextState.resources[state.turn.side].gold,
          mana: nextState.resources[state.turn.side].mana,
          storageMana: nextState.resources[state.turn.side].storageMana,
        },
      ]
      if (fcHelper) {
        moveEvents.push({ type: 'ABILITY_TRIGGERED', unitId: fcHelper.allyId, abilityType: 'FORMATION_COMMAND', text: '整編' })
      }

      return { ok: true, state: nextState, events: moveEvents }
    }

    case 'BLOOD_RITUAL': {
      if (state.turn.phase !== 'necro') return { ok: false, error: 'Not in necro phase' }
      if (state.turnFlags.bloodRitualUsed) return { ok: false, error: 'Blood ritual already used this turn' }

      const side = state.turn.side
      const king = Object.values(state.units).find((u) => u.side === side && u.base === 'king')
      if (!king) return { ok: false, error: 'King not found' }
      if (king.hpCurrent <= 3) return { ok: false, error: 'King HP too low' }

      const nextKing = { ...king, hpCurrent: king.hpCurrent - 3 }

      const nextState: GameState = {
        ...state,
        units: {
          ...state.units,
          [king.id]: nextKing,
        },
        turnFlags: {
          ...state.turnFlags,
          bloodRitualUsed: true,
          necroBonusActions: (state.turnFlags.necroBonusActions ?? 0) + 1,
        },
      }

      return { ok: true, state: nextState, events: [] }
    }

    case 'BUY_ITEM_FROM_DISPLAY': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      const side = state.turn.side
      if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return { ok: false, error: 'No item buy actions left this turn' }
      if (state.hands[side].items.length >= state.limits.itemHandMax) return { ok: false, error: `Item hand full (${state.limits.itemHandMax})` }
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= 3) return { ok: false, error: 'Invalid item slot' }

      const itemId = state.itemDisplay[action.slot]
      if (!itemId) return { ok: false, error: 'No item in display' }

      const item = getItemCard(itemId)
      if (!item) return { ok: false, error: 'Item not found' }

      const r = state.resources[side]
      if (r.gold < item.costGold) return { ok: false, error: 'Not enough gold' }

      let nextState: GameState = {
        ...state,
        itemDisplay: state.itemDisplay.map((v, i) => (i === action.slot ? null : v)),
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            items: [...state.hands[side].items, itemId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - item.costGold,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          buyItemActionsUsed: state.turnFlags.buyItemActionsUsed + 1,
        },
      }

      nextState = refillItemDisplay(nextState, action.slot)

      return {
        ok: true,
        state: nextState,
        events: [
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }

    case 'DISCARD_ITEM_FROM_HAND': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return { ok: false, error: 'No item buy actions left this turn' }
      const side = state.turn.side
      const hand = state.hands[side].items
      if (!hand.includes(action.itemId)) return { ok: false, error: 'Item not in hand' }

      const nextHand = hand.filter((id) => id !== action.itemId)
      const nextState: GameState = {
        ...state,
        itemDiscard: [...state.itemDiscard, action.itemId],
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            items: nextHand,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          buyItemActionsUsed: state.turnFlags.buyItemActionsUsed + 1,
        },
      }

      return { ok: true, state: nextState, events: [] }
    }
    case 'SHOOT': {
      const hasFreeShoot = (state.turnFlags.freeShootBonus ?? 0) > 0
      // 魂能超載：暫時提升魔力以確保免費射擊能通過消耗檢查
      const stateForShot = hasFreeShoot ? {
        ...state,
        resources: {
          ...state.resources,
          [state.turn.side]: {
            ...state.resources[state.turn.side],
            mana: Math.max(state.resources[state.turn.side].mana, FREE_SHOOT_MANA_SENTINEL),
          },
        },
      } : state

      const planRes = buildShotPlan(stateForShot, action.attackerId, action.targetUnitId, action.extraTargetUnitId)
      if (!planRes.ok) return { ok: false, error: (planRes as { ok: false; error: string }).error }

      const execRes = executeShotPlan(stateForShot, planRes.plan)
      if (!execRes.ok) return execRes

      let finalState = execRes.state
      const buildEvents: Event[] = Array.isArray((planRes.plan as any).__buildEvents) ? ((planRes.plan as any).__buildEvents as any[]) : []

      if (hasFreeShoot) {
        // 恢復原始魔力（射擊免費）並遞減 freeShootBonus
        const side = state.turn.side
        finalState = {
          ...finalState,
          resources: {
            ...finalState.resources,
            [side]: {
              ...finalState.resources[side],
              mana: state.resources[side].mana,  // 恢復原始魔力
            },
          },
          turnFlags: {
            ...finalState.turnFlags,
            freeShootBonus: Math.max(0, (finalState.turnFlags.freeShootBonus ?? 0) - 1),
          },
        }
        buildEvents.push({
          type: 'RESOURCES_CHANGED',
          side,
          gold: finalState.resources[side].gold,
          mana: finalState.resources[side].mana,
          storageMana: finalState.resources[side].storageMana,
        })
      }

      // 死亡連鎖：本回合每擊殺一個單位恢復 1 點魔力（最多 3 次）
      const afterEvents: Event[] = []
      if (finalState.turnFlags.deathChainActive ?? false) {
        const shootSide = state.turn.side
        const killedCount = execRes.events.filter((e) => e.type === 'UNIT_KILLED').length
        if (killedCount > 0) {
          const usedSoFar = finalState.turnFlags.deathChainKillCount ?? 0
          const allowed = Math.min(killedCount, DEATH_CHAIN_MAX_KILLS - usedSoFar)
          if (allowed > 0) {
            const r = finalState.resources[shootSide]
            const newMana = Math.min(r.mana + allowed, finalState.limits.manaMax)
            finalState = {
              ...finalState,
              resources: { ...finalState.resources, [shootSide]: { ...r, mana: newMana } },
              turnFlags: { ...finalState.turnFlags, deathChainKillCount: usedSoFar + killedCount },
            }
            afterEvents.push({ type: 'RESOURCES_CHANGED', side: shootSide, gold: finalState.resources[shootSide].gold, mana: newMana, storageMana: finalState.resources[shootSide].storageMana })
          }
        }
      }
      return { ok: true, state: finalState, events: [...buildEvents, ...execRes.events, ...afterEvents] }
    }

    case 'SACRIFICE': {
      if (state.turn.phase !== 'combat') return { ok: false, error: 'Not in combat phase' }

      const src = state.units[action.sourceUnitId]
      const tgt = state.units[action.targetUnitId]
      if (!src || !tgt) return { ok: false, error: 'Unit not found' }

      const g = canSacrifice(state, src.id, tgt.id, action.range)
      if (!g.ok) return { ok: false, error: (g as { ok: false; reason: string }).reason }

      const nextState0: GameState = {
        ...state,
        units: { ...state.units },
        corpsesByPos: { ...state.corpsesByPos },
        graveyard: {
          red: [...state.graveyard.red],
          black: [...state.graveyard.black],
        },
      }

      let nextState: GameState = nextState0
      const events: Event[] = []

      // Eternal Night advisors: self sacrifice grants allied king invincibility for one full enemy turn.
      const soulId = src.enchant?.soulId ?? null
      if ((soulId === 'eternal_night_advisor_guhu' || soulId === 'eternal_night_advisor_hunshi') && src.id === tgt.id) {
        nextState = {
          ...nextState,
          status: {
            ...nextState.status,
            kingInvincibleSide: src.side,
          },
        }
      }

      if (src.id !== tgt.id && soulId) {
        const card = getSoulCard(soulId)
        const ab = card?.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SHOT_BUFF')
        const buff = (ab as any)?.buff
        if (buff) {
          const nextBuff = {
            ignoreBlockingAll: (buff as any).ignoreBlockingAll ? (true as const) : undefined,
            chainRadius: Number.isFinite((buff as any).chainRadius as any) ? Math.max(0, Math.floor(Number((buff as any).chainRadius))) : undefined,
            damageBonusPerCorpsesCap: Number.isFinite((buff as any).damageBonusPerCorpsesCap as any)
              ? Math.max(0, Math.floor(Number((buff as any).damageBonusPerCorpsesCap)))
              : undefined,
          }

          nextState = {
            ...nextState,
            status: {
              ...nextState.status,
              sacrificeBuffByUnitId: {
                ...nextState.status.sacrificeBuffByUnitId,
                [src.id]: nextBuff,
              },
            },
          }
        }
      }

      nextState = killUnit(nextState, tgt.id, events)
      // 死亡連鎖：sacrifice 擊殺也觸發
      if (nextState.turnFlags.deathChainActive ?? false) {
        const sacSide = state.turn.side
        const killedCount = events.filter((e) => e.type === 'UNIT_KILLED').length
        const usedSoFar = nextState.turnFlags.deathChainKillCount ?? 0
        const allowed = Math.min(killedCount, DEATH_CHAIN_MAX_KILLS - usedSoFar)
        if (allowed > 0) {
          const r = nextState.resources[sacSide]
          const newMana = Math.min(r.mana + allowed, nextState.limits.manaMax)
          nextState = {
            ...nextState,
            resources: { ...nextState.resources, [sacSide]: { ...r, mana: newMana } },
            turnFlags: { ...nextState.turnFlags, deathChainKillCount: usedSoFar + killedCount },
          }
          events.push({ type: 'RESOURCES_CHANGED', side: sacSide, gold: nextState.resources[sacSide].gold, mana: newMana, storageMana: nextState.resources[sacSide].storageMana })
        }
      }
      return { ok: true, state: nextState, events }
    }
    case 'ENCHANT': {
      if (state.turn.phase !== 'necro') return { ok: false, error: 'Not in necro phase' }
      const necroMax = state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0) + (state.turnFlags.itemNecroBonus ?? 0)
      if (state.turnFlags.necroActionsUsed >= necroMax) {
        return { ok: false, error: 'No necro actions left this turn' }
      }

      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
      if (unit.enchant) return { ok: false, error: 'Unit already enchanted' }

      // 死戰契約：契約復活的單位本回合不可附魔
      if ((state.turnFlags.lastStandNoEnchantUnitIds ?? []).includes(action.unitId)) {
        return { ok: false, error: '此單位本回合不可附魔（死戰契約）' }
      }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: 'Soul card not found' }
      if (card.base !== unit.base) return { ok: false, error: 'Soul base mismatch' }

      const r = state.resources[state.turn.side]
      // 冥魂灌注：附魔成本折扣
      const discount = state.turnFlags.enchantGoldDiscount ?? 0
      const effectiveCost = Math.max(0, card.costGold - discount)
      if (r.gold < effectiveCost) return { ok: false, error: 'Not enough gold' }

      const hand = state.hands[state.turn.side].souls
      if (!hand.includes(action.soulId)) return { ok: false, error: 'Soul not in hand' }

      const nextHand = hand.filter((id) => id !== action.soulId)

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          gold: r.gold - effectiveCost,
        },
      }

      const nextUnit = {
        ...unit,
        enchant: { soulId: card.id },
        hpCurrent: card.stats.hp,
        atk: { ...card.stats.atk },
        def: card.stats.def.map((d) => ({ ...d })),
      }

      const nextState: GameState = {
        ...state,
        resources: nextResources,
        hands: {
          ...state.hands,
          [state.turn.side]: {
            ...state.hands[state.turn.side],
            souls: nextHand,
          },
        },
        units: {
          ...state.units,
          [unit.id]: nextUnit,
        },
        turnFlags: {
          ...state.turnFlags,
          necroActionsUsed: state.turnFlags.necroActionsUsed + 1,
          enchantGoldDiscount: 0,  // 折扣一次性消耗
        },
      }

      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'ENCHANTED', unitId: unit.id, soulId: card.id },
          {
            type: 'RESOURCES_CHANGED',
            side: state.turn.side,
            gold: nextState.resources[state.turn.side].gold,
            mana: nextState.resources[state.turn.side].mana,
            storageMana: nextState.resources[state.turn.side].storageMana,
          },
        ],
      }
    }
    case 'REVIVE': {
      if (state.turn.phase !== 'necro') return { ok: false, error: 'Not in necro phase' }

      const side = state.turn.side
      const r = state.resources[side]

      const posKey = `${action.pos.x},${action.pos.y}`
      const stack = state.corpsesByPos[posKey]
      if (!stack || stack.length === 0) return { ok: false, error: 'No corpses here' }

      const occupied = getUnitAt(state, action.pos)
      if (occupied) return { ok: false, error: 'Target position occupied' }

      const index = action.corpseIndex ?? stack.length - 1
      if (index < 0 || index >= stack.length) return { ok: false, error: 'Invalid corpse index' }

      const corpse = stack[index]
      if (!corpse) return { ok: false, error: 'Invalid corpse index' }
      if (corpse.ownerSide !== state.turn.side) return { ok: false, error: 'Not your corpse' }

      // 死戰契約 & 後勤（召侍）：可跳過死靈術次數與財力限制
      const usingContract = (state.turnFlags.lastStandContractBonus ?? 0) > 0
      const lrHelper = corpse.base === 'soldier' ? findLogisticsReviveHelper(state) : null
      const usingLogisticsRevive = !!lrHelper

      const necroMax = state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0) + (state.turnFlags.itemNecroBonus ?? 0)
      if (!usingContract && !usingLogisticsRevive && state.turnFlags.necroActionsUsed >= necroMax) {
        return { ok: false, error: 'No necro actions left this turn' }
      }

      const cost = getReviveGoldCost(corpse.base)
      const effectiveGoldCost = usingLogisticsRevive ? 0 : cost
      if (r.gold < effectiveGoldCost) return { ok: false, error: 'Not enough gold' }

      // Create a deterministic new unit id without relying on time/random.
      let reviveIdx = 0
      while (state.units[`${corpse.ownerSide}:${corpse.base}:revive:${reviveIdx}`]) reviveIdx++
      const unitId = `${corpse.ownerSide}:${corpse.base}:revive:${reviveIdx}`

      const baseStats = BASE_STATS[corpse.base]
      let hpCurrent = baseStats.hp
      let atk = { key: baseStats.atkKey, value: baseStats.atk }
      let def = baseStats.def.map((d) => ({ ...d }))

      const nextStack = [...stack]
      nextStack.splice(index, 1)

      const nextCorpsesByPos = { ...state.corpsesByPos }
      if (nextStack.length === 0) {
        delete nextCorpsesByPos[posKey]
      } else {
        nextCorpsesByPos[posKey] = nextStack
      }

      const prevAbilityUsedRevive = state.turnFlags.abilityUsed ?? {}
      const nextAbilityUsedRevive = lrHelper
        ? { ...prevAbilityUsedRevive, [lrHelper.abilityKey]: (prevAbilityUsedRevive[lrHelper.abilityKey] ?? 0) + 1 }
        : prevAbilityUsedRevive

      const nextState: GameState = {
        ...state,
        corpsesByPos: nextCorpsesByPos,
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - effectiveGoldCost,
          },
        },
        units: {
          ...state.units,
          [unitId]: {
            id: unitId,
            side: corpse.ownerSide,
            base: corpse.base,
            pos: { ...action.pos },
            hpCurrent,
            atk,
            def,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          // 死戰契約：不計入死靈術次數，但該單位本回合不可附魔
          // 後勤：不計入死靈術次數，直接免費
          necroActionsUsed: (usingContract || usingLogisticsRevive) ? state.turnFlags.necroActionsUsed : state.turnFlags.necroActionsUsed + 1,
          lastStandContractBonus: usingContract ? Math.max(0, (state.turnFlags.lastStandContractBonus ?? 0) - 1) : (state.turnFlags.lastStandContractBonus ?? 0),
          lastStandNoEnchantUnitIds: usingContract
            ? [...(state.turnFlags.lastStandNoEnchantUnitIds ?? []), unitId]
            : (state.turnFlags.lastStandNoEnchantUnitIds ?? []),
          abilityUsed: nextAbilityUsedRevive,
        },
      }

      const reviveEvents: Event[] = [
        { type: 'REVIVED', unitId, pos: { ...action.pos } },
        {
          type: 'RESOURCES_CHANGED',
          side,
          gold: nextState.resources[side].gold,
          mana: nextState.resources[side].mana,
          storageMana: nextState.resources[side].storageMana,
        },
      ]
      if (lrHelper) {
        reviveEvents.push({ type: 'ABILITY_TRIGGERED', unitId: lrHelper.allyId, abilityType: 'LOGISTICS_REVIVE', text: '後勤' })
      }

      return { ok: true, state: nextState, events: reviveEvents }
    }
    case 'BUY_SOUL_FROM_DECK': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: 'No soul buy actions left this turn' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: 'Soul buy already used this turn' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `Soul hand full (${state.limits.soulHandMax})` }
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromDeckGoldCost) return { ok: false, error: 'Not enough gold' }

      const deck = state.soulDeckByBase[action.base]
      if (!deck || deck.length === 0) return { ok: false, error: 'Deck empty' }

      const nextDeck = [...deck]
      const soulId = nextDeck.shift()
      if (!soulId) return { ok: false, error: 'Deck empty' }

      const nextState: GameState = {
        ...state,
        soulDeckByBase: {
          ...state.soulDeckByBase,
          [action.base]: nextDeck,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromDeckGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      const deckCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: deckCard?.name ?? soulId, base: action.base, source: 'deck' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }

    case 'RETURN_SOUL_TO_DECK_BOTTOM': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      const side = state.turn.side
      if (state.turnFlags.soulReturnUsedCount >= state.limits.soulReturnPerTurn) return { ok: false, error: 'Soul return already used this turn' }

      const hand = state.hands[side].souls
      if (!hand.includes(action.soulId)) return { ok: false, error: 'Soul not in hand' }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: 'Soul card not found' }

      const nextHand = hand.filter((id) => id !== action.soulId)
      const deck = state.soulDeckByBase[card.base] ?? []
      const nextDeck = [...deck, action.soulId]

      const nextState: GameState = {
        ...state,
        soulDeckByBase: {
          ...state.soulDeckByBase,
          [card.base]: nextDeck,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: nextHand,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulReturnUsedCount: state.turnFlags.soulReturnUsedCount + 1,
        },
      }

      return { ok: true, state: nextState, events: [] }
    }
    case 'BUY_SOUL_FROM_DISPLAY': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: 'No soul buy actions left this turn' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: 'Soul buy already used this turn' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `Soul hand full (${state.limits.soulHandMax})` }
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromDisplayGoldCost) return { ok: false, error: 'Not enough gold' }

      const soulId = state.displayByBase[action.base]
      if (!soulId) return { ok: false, error: 'No display card' }

      let nextState: GameState = {
        ...state,
        displayByBase: {
          ...state.displayByBase,
          [action.base]: null,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromDisplayGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      nextState = refillDisplayByBase(nextState, action.base)

      const displayCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: displayCard?.name ?? soulId, base: action.base, source: 'display' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }
    case 'BUY_SOUL_FROM_ENEMY_GRAVEYARD': {
      if (state.turn.phase !== 'buy') return { ok: false, error: 'Not in buy phase' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: 'No soul buy actions left this turn' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: 'Soul buy already used this turn' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `Soul hand full (${state.limits.soulHandMax})` }
      const enemy = side === 'red' ? 'black' : 'red'
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromEnemyGraveyardGoldCost) return { ok: false, error: 'Not enough gold' }

      const gy = state.graveyard[enemy]
      if (gy.length === 0) return { ok: false, error: 'Enemy graveyard empty' }

      // 暗月窺視鏡：可指定任意位置的靈魂
      let soulId: string
      let soulIndex: number
      if ((state.turnFlags.darkMoonScopeActive ?? false) && action.soulId) {
        soulIndex = gy.indexOf(action.soulId)
        if (soulIndex === -1) return { ok: false, error: 'Soul not in enemy graveyard' }
        soulId = gy[soulIndex]!
      } else {
        soulIndex = 0
        soulId = gy[0]!
        if (!soulId) return { ok: false, error: 'Enemy graveyard empty' }
      }

      const nextEnemyGy = gy.filter((_, i) => i !== soulIndex)

      const nextState: GameState = {
        ...state,
        graveyard: {
          ...state.graveyard,
          [enemy]: nextEnemyGy,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromEnemyGraveyardGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      const gyCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: gyCard?.name ?? soulId, base: gyCard?.base ?? '', source: 'graveyard' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }
    case 'NEXT_PHASE':
      return reduceNextPhase(state)
    case 'USE_ITEM_FROM_HAND':
      return reduceUseItem(state, action)

    default: {
      const _exhaustive: never = action
      return { ok: false, error: `Unknown action: ${String(_exhaustive)}` }
    }
  }
}
