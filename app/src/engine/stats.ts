import type { GameState, Unit } from './state'
import { getSoulCard } from './cards'
import { countCorpses } from './corpses'

export function getDefValue(unit: Unit, atkKey: string): number {
  const found = unit.def.find((d) => d.key === atkKey)
  return found ? found.value : 0
}

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

export function getDefValueInState(state: GameState, unit: Unit, atkKey: string): number {
  let defValue = getDefValue(unit, atkKey)

  // AURA_DEF_BONUS: allied aura units can add to defenders' DEF.
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities) {
      if (ab.type !== 'AURA_DEF_BONUS') continue

      const key = String((ab as any).key ?? '')
      if (!key || key !== atkKey) continue

      const amount = Number((ab as any).amount ?? 0)
      if (!(Number.isFinite(amount) && amount > 0)) continue

      const when = (ab as any).when
      const whenType = String(when?.type ?? '')
      if (whenType === 'SOURCE_IN_PALACE' && !palaceContains(auraUnit.side, auraUnit.pos)) continue

      if (whenType === 'CORPSES_GTE') {
        const need = Number(when?.count ?? 0)
        if (!(Number.isFinite(need) && need > 0)) continue
        const corpses = countCorpses(state, auraUnit.side)
        if (corpses < need) continue
      }

      const forKey = String((ab as any).for ?? '')
      if (forKey === 'ALLIES_IN_PALACE' && !palaceContains(unit.side, unit.pos)) continue

      if (forKey === 'CLAN') {
        const clan = String((ab as any).clan ?? '')
        if (!clan) continue
        const soulId = unit.enchant?.soulId
        const card = soulId ? getSoulCard(soulId) : undefined
        if (!card) continue
        if (String(card.clan ?? '') !== clan) continue

        const excludeBase = String((ab as any).excludeBase ?? '')
        if (excludeBase && unit.base === excludeBase) continue
      }

      defValue += amount
    }
  }

  return defValue
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
