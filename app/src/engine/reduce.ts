import type { Action } from './actions'
import type { Event } from './events'
import { isOnBoard } from './types'
import type { PieceBase } from './types'
import type { GameState } from './state'
import { getUnitAt } from './state'
import { BASE_STATS } from './state'
import { isLegalMove } from './legalMoves'
import { buildShotPlan, executeShotPlan } from './shotPlan'
import { getSoulCard } from './cards'
import { getItemCard } from './items'

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

function refillDisplayByBase(state: GameState, base: PieceBase): GameState {
  const deck = state.soulDeckByBase[base]
  const cur = state.displayByBase[base]
  if (cur != null) return state
  if (!deck || deck.length === 0) return state

  const nextDeck = [...deck]
  const nextCard = nextDeck.shift() ?? null
  return {
    ...state,
    soulDeckByBase: {
      ...state.soulDeckByBase,
      [base]: nextDeck,
    },
    displayByBase: {
      ...state.displayByBase,
      [base]: nextCard,
    },
  }
}

export type ReduceErr = {
  ok: false
  error: string
}

export type ReduceResult = ReduceOk | ReduceErr

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

export function reduce(state: GameState, action: Action): ReduceResult {
  switch (action.type) {
    case 'MOVE': {
      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
      if (state.turn.phase !== 'combat') return { ok: false, error: 'Not in combat phase' }

      const r = state.resources[state.turn.side]
      const cost = state.rules.moveManaCost
      if (r.mana < cost) return { ok: false, error: 'Not enough mana' }
      if (!isOnBoard(action.to)) return { ok: false, error: 'Target position out of board' }

      const occupied = getUnitAt(state, action.to)
      if (occupied) return { ok: false, error: 'Target position occupied' }

      if (!isLegalMove(state, unit.id, action.to)) return { ok: false, error: 'Illegal move' }

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          mana: r.mana - cost,
        },
      }

      const nextState: GameState = {
        ...state,
        resources: nextResources,
        turnFlags: {
          ...state.turnFlags,
          movedThisTurn: {
            ...state.turnFlags.movedThisTurn,
            [unit.id]: true,
          },
        },
        units: {
          ...state.units,
          [unit.id]: {
            ...unit,
            pos: { ...action.to },
          },
        },
      }

      return {
        ok: true,
        state: nextState,
        events: [
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
        ],
      }
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
      const planRes = buildShotPlan(state, action.attackerId, action.targetUnitId, action.extraTargetUnitId)
      if (!planRes.ok) return { ok: false, error: planRes.error }

      const execRes = executeShotPlan(state, planRes.plan)
      if (!execRes.ok) return { ok: false, error: execRes.error }

      return { ok: true, state: execRes.state, events: execRes.events }
    }
    case 'ENCHANT': {
      if (state.turn.phase !== 'necro') return { ok: false, error: 'Not in necro phase' }
      if (state.turnFlags.necroActionsUsed >= state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0)) {
        return { ok: false, error: 'No necro actions left this turn' }
      }

      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
      if (unit.enchant) return { ok: false, error: 'Unit already enchanted' }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: 'Soul card not found' }
      if (card.base !== unit.base) return { ok: false, error: 'Soul base mismatch' }

      const r = state.resources[state.turn.side]
      if (r.gold < card.costGold) return { ok: false, error: 'Not enough gold' }

      const hand = state.hands[state.turn.side].souls
      if (!hand.includes(action.soulId)) return { ok: false, error: 'Soul not in hand' }

      const nextHand = hand.filter((id) => id !== action.soulId)

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          gold: r.gold - card.costGold,
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
      if (state.turnFlags.necroActionsUsed >= state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0)) {
        return { ok: false, error: 'No necro actions left this turn' }
      }

      const side = state.turn.side
      const r = state.resources[side]

      if (r.gold < state.rules.reviveGoldCost) return { ok: false, error: 'Not enough gold' }

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

      const nextState: GameState = {
        ...state,
        corpsesByPos: nextCorpsesByPos,
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.reviveGoldCost,
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
          necroActionsUsed: state.turnFlags.necroActionsUsed + 1,
        },
      }

      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'REVIVED', unitId, pos: { ...action.pos } },
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
      const soulId = gy[0]
      if (!soulId) return { ok: false, error: 'Enemy graveyard empty' }

      const nextEnemyGy = gy.slice(1)

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
    case 'NEXT_PHASE': {
      const events: Event[] = []
      const side = state.turn.side
      const from = state.turn.phase

      const nextPhase = (p: GameState['turn']['phase']): GameState['turn']['phase'] => {
        switch (p) {
          case 'turnStart':
            return 'buy'
          case 'buy':
            return 'necro'
          case 'necro':
            return 'combat'
          case 'combat':
            return 'turnEnd'
          case 'turnEnd':
            return 'turnStart'
          default: {
            const _exhaustive: never = p
            return _exhaustive
          }
        }
      }

      let nextState: GameState = {
        ...state,
        turn: {
          ...state.turn,
          phase: nextPhase(state.turn.phase),
        },
      }

      // Auto processing phases
      if (nextState.turn.phase === 'turnEnd') {
        nextState = autoTurnEnd(nextState, events)
      }

      if (nextState.turn.phase === 'turnStart') {
        // swap side first, then apply turn start income for the new side
        const nextSide = side === 'red' ? 'black' : 'red'
        nextState = {
          ...nextState,
          turn: {
            ...nextState.turn,
            side: nextSide,
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
          },
        }
        nextState = autoTurnStart(nextState, events)

        // after auto turn start, immediately enter buy and wait for player
        nextState = {
          ...nextState,
          turn: {
            ...nextState.turn,
            phase: 'buy',
          },
        }
        events.push({ type: 'PHASE_CHANGED', side: nextState.turn.side, from: 'turnStart', to: 'buy' })

        return {
          ok: true,
          state: nextState,
          events,
        }
      }

      events.push({ type: 'PHASE_CHANGED', side, from, to: nextState.turn.phase })
      return { ok: true, state: nextState, events }
    }
    default: {
      const _exhaustive: never = action
      return { ok: false, error: `Unknown action: ${String(_exhaustive)}` }
    }
  }
}
