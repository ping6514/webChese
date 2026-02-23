import type { Pos } from './types'
import type { Phase, Side } from './types'

export type UnitMovedEvent = {
  type: 'UNIT_MOVED'
  unitId: string
  from: Pos
  to: Pos
}

export type PhaseChangedEvent = {
  type: 'PHASE_CHANGED'
  side: Side
  from: Phase
  to: Phase
}

export type ResourcesChangedEvent = {
  type: 'RESOURCES_CHANGED'
  side: Side
  gold: number
  mana: number
  storageMana: number
}

export type ShotFiredEvent = {
  type: 'SHOT_FIRED'
  attackerId: string
  targetUnitId: string
}

export type DiceRolledEvent = {
  type: 'DICE_ROLLED'
  sides: number
  value: number
}

export type DamageDealtEvent = {
  type: 'DAMAGE_DEALT'
  attackerId: string
  targetUnitId: string
  amount: number
}

export type UnitKilledEvent = {
  type: 'UNIT_KILLED'
  unitId: string
}

export type EnchantedEvent = {
  type: 'ENCHANTED'
  unitId: string
  soulId: string
}

export type Event =
  | UnitMovedEvent
  | PhaseChangedEvent
  | ResourcesChangedEvent
  | ShotFiredEvent
  | DiceRolledEvent
  | DamageDealtEvent
  | UnitKilledEvent
  | EnchantedEvent
