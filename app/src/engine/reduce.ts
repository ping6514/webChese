import type { Action } from './actions'
import type { Event } from './events'
import { isOnBoard } from './types'
import type { GameState } from './state'
import { getUnitAt } from './state'
import { isLegalMove } from './legalMoves'
import { buildShotPlan, executeShotPlan } from './shotPlan'
import { getSoulCard } from './cards'

export type ReduceOk = {
  ok: true
  state: GameState
  events: Event[]
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
    case 'SHOOT': {
      const planRes = buildShotPlan(state, action.attackerId, action.targetUnitId)
      if (!planRes.ok) return { ok: false, error: planRes.error }

      const execRes = executeShotPlan(state, planRes.plan)
      if (!execRes.ok) return { ok: false, error: execRes.error }

      return { ok: true, state: execRes.state, events: execRes.events }
    }
    case 'ENCHANT': {
      if (state.turn.phase !== 'necro') return { ok: false, error: 'Not in necro phase' }

      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
      if (unit.enchant) return { ok: false, error: 'Unit already enchanted' }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: 'Soul card not found' }
      if (card.base !== unit.base) return { ok: false, error: 'Soul base mismatch' }

      const r = state.resources[state.turn.side]
      if (r.gold < card.costGold) return { ok: false, error: 'Not enough gold' }

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
        units: {
          ...state.units,
          [unit.id]: nextUnit,
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
