import { describe, expect, it } from 'vitest'
import { createInitialState, reduce, soulCardsById, type GameState } from '../index'
import type { SoulAbility } from '../abilityTypes'
import { getAtkPanelBreakdownInState, getDefPanelBreakdownInState } from '../stats'

describe('AURA_STAT_BONUS hp healCurrent (conservative)', () => {
  it('heals revived unit by hp bonus once after REVIVE', () => {
    const auraSoulId = 'styx_advisor_minghu'
    const auraCard = soulCardsById[auraSoulId]
    if (!auraCard) throw new Error('missing test aura soul card')

    const oldAbilities = auraCard.abilities
    try {
      // Inject test-only aura that increases max HP by 3 and heals current by +3
      auraCard.abilities = [
        ...oldAbilities,
        { type: 'AURA_STAT_BONUS', for: 'ALLIES_IN_PALACE', bonus: { hp: 3, healCurrent: true } } as SoulAbility,
      ]

      const s0 = createInitialState({ rules: { startGoldFirst: 999, startGoldSecond: 999 } })

      // Put into necro phase and ensure aura unit is enchanted
      const auraUnitId = 'red:advisor:0'
      const auraUnit = s0.units[auraUnitId]
      if (!auraUnit) throw new Error('missing aura unit')

      // Create a soldier corpse in palace to revive (red palace: x 3-5, y 7-9)
      const pos = { x: 3, y: 7 }
      const s1 = {
        ...s0,
        turn: { side: 'red' as const, phase: 'necro' as const },
        units: {
          ...s0.units,
          [auraUnitId]: { ...auraUnit, enchant: { soulId: auraSoulId }, pos: { x: 4, y: 8 } },
        },
        corpsesByPos: {
          [`${pos.x},${pos.y}`]: [{ ownerSide: 'red', base: 'soldier' as const }],
        },
      }

      const res = reduce(s1 as GameState, { type: 'REVIVE', pos })
      expect(res.ok).toBe(true)
      if (!res.ok) return

      const revived = Object.values(res.state.units).find((u) => String(u.id).startsWith('red:soldier:revive:'))
      expect(!!revived).toBe(true)
      if (!revived) return

      // Base soldier hp=8; aura hp+3 => max=11; healCurrent should heal +3 to 11.
      expect(revived.hpCurrent).toBe(11)
      expect(res.events.some((e) => e.type === 'UNIT_HP_CHANGED' && e.unitId === revived.id)).toBe(true)
    } finally {
      auraCard.abilities = oldAbilities
    }
  })

  it('revives the topmost allied corpse even when enemy corpses are stacked above other allied corpses', () => {
    const s0 = createInitialState({ rules: { startGoldFirst: 999, startGoldSecond: 999 } })
    const side = s0.turn.side
    const enemySide = side === 'red' ? 'black' : 'red'
    const pos = { x: 0, y: 5 }

    const s1 = {
      ...s0,
      turn: { side, phase: 'necro' as const },
      corpsesByPos: {
        ...s0.corpsesByPos,
        [`${pos.x},${pos.y}`]: [
          { ownerSide: side, base: 'soldier' as const },
          { ownerSide: enemySide, base: 'rook' as const },
          { ownerSide: side, base: 'knight' as const },
        ],
      },
    }

    const res = reduce(s1 as GameState, { type: 'REVIVE', pos })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const revived = Object.values(res.state.units).find((u) =>
      String(u.id).startsWith(`${side}:knight:revive:`),
    )
    expect(!!revived).toBe(true)
    expect(res.state.corpsesByPos[`${pos.x},${pos.y}`]).toEqual([
      { ownerSide: side, base: 'soldier' },
      { ownerSide: enemySide, base: 'rook' },
    ])
  })

  it('cannot revive onto a tile that currently has a living unit', () => {
    const s0 = createInitialState({ rules: { startGoldFirst: 999, startGoldSecond: 999 } })
    const side = s0.turn.side
    const occupiedUnit = Object.values(s0.units).find((u) => u.side === side)
    if (!occupiedUnit) throw new Error('missing occupied unit')
    const pos = { ...occupiedUnit.pos }

    const s1 = {
      ...s0,
      turn: { side, phase: 'necro' as const },
      corpsesByPos: {
        ...s0.corpsesByPos,
        [`${pos.x},${pos.y}`]: [{ ownerSide: side, base: 'soldier' as const }],
      },
    }

    const res = reduce(s1 as GameState, { type: 'REVIVE', pos })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('目標位置已有單位')
  })

  it('supports numeric atk/def bonuses in AURA_STAT_BONUS', () => {
    const auraSoulId = 'styx_advisor_minghu'
    const auraCard = soulCardsById[auraSoulId]
    if (!auraCard) throw new Error('Missing aura card')

    const oldAbilities = auraCard.abilities
    try {
      const s0 = createInitialState({ rules: { startGoldFirst: 999, startGoldSecond: 999 } })

      const auraUnit0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'advisor')
      const target0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'rook')
      if (!auraUnit0 || !target0) throw new Error('Missing baseline units')

      const baseState = {
        ...s0,
        units: {
          ...s0.units,
          [auraUnit0.id]: {
            ...auraUnit0,
            pos: { x: 4, y: 0 },
            enchant: { soulId: auraSoulId },
          },
          [target0.id]: {
            ...target0,
            pos: { x: 3, y: 0 },
          },
        },
      }

      // Baseline (without injected AURA_STAT_BONUS)
      auraCard.abilities = oldAbilities
      const atkBase = getAtkPanelBreakdownInState(baseState as GameState, target0.id)
      const defBase = getDefPanelBreakdownInState(baseState as GameState, target0.id)

      // With injected numeric bonuses
      auraCard.abilities = [
        ...oldAbilities,
        { type: 'AURA_STAT_BONUS', for: 'ALLIES_IN_PALACE', bonus: { atk: 2, def: 1 } } as SoulAbility,
      ]

      const atkAfter = getAtkPanelBreakdownInState(baseState as GameState, target0.id)
      const defAfter = getDefPanelBreakdownInState(baseState as GameState, target0.id)

      expect(atkAfter.total - atkBase.total).toBe(2)
      expect(defAfter.phys.total - defBase.phys.total).toBe(1)
      expect(defAfter.magic.total - defBase.magic.total).toBe(1)
    } finally {
      auraCard.abilities = oldAbilities
    }
  })
})
