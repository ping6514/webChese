import type { GameState, Unit } from './state'

export function getDefValue(unit: Unit, atkKey: string): number {
  const found = unit.def.find((d) => d.key === atkKey)
  return found ? found.value : 0
}

export type Modifier = {
  id: string
  scope: 'all' | 'side' | 'unit'
  side?: Unit['side']
  unitId?: string
  stat: 'atk' | 'def'
  key?: string
  add: number
}

export function applyModifiers(_state: GameState, unit: Unit): Unit {
  // Skeleton for future buff/auras/item modifiers.
  // For now it returns base unit values unchanged.
  return unit
}
