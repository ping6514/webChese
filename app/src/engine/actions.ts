import type { Pos } from './types'

export type MoveAction = {
  type: 'MOVE'
  unitId: string
  to: Pos
}

export type NextPhaseAction = {
  type: 'NEXT_PHASE'
}

export type ShootAction = {
  type: 'SHOOT'
  attackerId: string
  targetUnitId: string
}

export type EnchantAction = {
  type: 'ENCHANT'
  unitId: string
  soulId: string
}

export type Action = MoveAction | ShootAction | EnchantAction | NextPhaseAction
