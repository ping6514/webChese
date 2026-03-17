import type { Event } from './events'
import type { GameState } from './state'
import type { BattleAction } from './actions'
import { consumeATB } from './atb'
import { applyResolvedDamage, resolveAttackDamage } from './damage'
import { HEX_DIRECTIONS, hexDistance, hexKey } from '../game/hex'

export type ReduceResult = {
  newState: GameState
  events: Event[]
}

export function reduce(state: GameState, action: BattleAction): ReduceResult {
  switch (action.type) {
    case 'MOVE':
      return reduceMove(state, action)
    case 'ATTACK':
      return reduceAttack(state, action)
    case 'PASS':
      return reducePass(state, action)
  }

  return { newState: state, events: [] }
}

function isStraightLineMove(from: { q: number; r: number }, to: { q: number; r: number }): boolean {
  const dq = to.q - from.q
  const dr = to.r - from.r
  if (dq === 0 && dr === 0) return true

  return HEX_DIRECTIONS.some((dir) => {
    if (dir.q === 0) {
      return dq === 0 && dr !== 0 && Math.sign(dr) === Math.sign(dir.r)
    }
    if (dir.r === 0) {
      return dr === 0 && dq !== 0 && Math.sign(dq) === Math.sign(dir.q)
    }
    return dq !== 0 && dr !== 0 && dq * dir.r === dr * dir.q && Math.sign(dq) === Math.sign(dir.q) && Math.sign(dr) === Math.sign(dir.r)
  })
}

function reduceMove(
  state: GameState,
  action: Extract<BattleAction, { type: 'MOVE' }>,
): ReduceResult {
  const unit = state.units[action.unitId]
  if (!unit || unit.isDead) {
    return { newState: state, events: [] }
  }

  const destination = state.cells[hexKey(action.to.q, action.to.r)]
  const moveSpec = action.moveSpec
  if (!destination || (!moveSpec?.ignoreTerrain && !destination.passable)) {
    return { newState: state, events: [] }
  }

  const isSameCell = unit.pos.q === action.to.q && unit.pos.r === action.to.r
  const nextFacing = action.facing ?? unit.facing
  const maxRange = moveSpec?.maxRangeOverride ?? unit.move

  const isOccupied = Object.values(state.units).some((other) =>
    other.id !== unit.id
    && !other.isDead
    && other.pos.q === action.to.q
    && other.pos.r === action.to.r,
  )
  if (!isSameCell && isOccupied && !moveSpec?.ignoreUnits) {
    return { newState: state, events: [] }
  }

  if (!isSameCell && hexDistance(unit.pos, action.to) > maxRange) {
    return { newState: state, events: [] }
  }

  if (!isSameCell && moveSpec?.routeRule === 'straight_line' && !isStraightLineMove(unit.pos, action.to)) {
    return { newState: state, events: [] }
  }

  if (isSameCell && nextFacing === unit.facing) {
    return { newState: state, events: [] }
  }

  const movedState: GameState = {
    ...state,
    units: {
      ...state.units,
      [unit.id]: {
        ...unit,
        pos: action.to,
        facing: nextFacing,
      },
    },
  }

  return {
    newState: consumeATB(movedState, unit.id, action.recoveryMs ?? 8),
    events: [{
      type: 'UNIT_MOVED',
      unitId: unit.id,
      from: unit.pos,
      to: action.to,
      path: action.path ?? [unit.pos, action.to],
    }],
  }
}

function reduceAttack(
  state: GameState,
  action: Extract<BattleAction, { type: 'ATTACK' }>,
): ReduceResult {
  const attacker = state.units[action.attackerId]
  const target = state.units[action.targetId]

  if (!attacker || !target) {
    return { newState: state, events: [] }
  }

  if (attacker.isDead || target.isDead) {
    return { newState: state, events: [] }
  }

  const resolved = resolveAttackDamage(attacker, target, action.profile, action.defense)
  const damageResult = applyResolvedDamage(state, resolved)
  const recoveryMs = action.recoveryMs ?? 0
  const nextState = consumeATB(damageResult.newState, attacker.id, recoveryMs)

  return {
    newState: nextState,
    events: damageResult.events,
  }
}

function reducePass(
  state: GameState,
  action: Extract<BattleAction, { type: 'PASS' }>,
): ReduceResult {
  const unit = state.units[action.unitId]
  if (!unit || unit.isDead) {
    return { newState: state, events: [] }
  }

  return {
    newState: consumeATB(state, action.unitId, action.recoveryMs ?? 0),
    events: [],
  }
}
