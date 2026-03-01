import { describe, expect, it } from 'vitest'
import { buildShotPlan, createInitialState, executeShotPlan, getSoulCard } from '../index'

describe('DAMAGE_SHARE: dark_moon_advisor_yeji shares damage', () => {
  it('shares up to N damage (from card) to the palace ally when allies in palace >= 2, leaving target at least 1 damage', () => {
    const s0 = createInitialState()

    const card = getSoulCard('dark_moon_advisor_yeji')
    if (!card) throw new Error('Missing soul card')
    const ab = card.abilities.find((a) => a.type === 'DAMAGE_SHARE') as any
    const shareN = Number(ab?.amount ?? 0)
    if (!Number.isFinite(shareN) || shareN <= 0) throw new Error('Invalid DAMAGE_SHARE amount')

    const attacker0 = Object.values(s0.units).find((u) => u.side === 'red' && u.base === 'rook')
    const target0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'rook')
    const yeji0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'advisor')
    const palaceBuddy0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'king')

    if (!attacker0 || !target0 || !yeji0 || !palaceBuddy0) throw new Error('Missing baseline units')

    // attacker shoots target; black has 2 units in palace (yeji + king)
    const baseState = {
      ...s0,
      rules: {
        ...s0.rules,
        diceFixed: 6,
      },
      turn: {
        side: 'red' as const,
        phase: 'combat' as const,
      },
      turnFlags: {
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
      resources: {
        ...s0.resources,
        red: {
          ...s0.resources.red,
          mana: 999,
        },
      },
      units: {
        ...s0.units,
        [attacker0.id]: {
          ...attacker0,
          pos: { x: 4, y: 6 },
          atk: { key: 'phys', value: 3 },
        },
        [target0.id]: {
          ...target0,
          pos: { x: 4, y: 4 },
          hpCurrent: 10,
        },
        [yeji0.id]: {
          ...yeji0,
          pos: { x: 3, y: 0 },
          hpCurrent: 8,
          enchant: { soulId: 'dark_moon_advisor_yeji' },
        },
        [palaceBuddy0.id]: {
          ...palaceBuddy0,
          pos: { x: 4, y: 0 },
          hpCurrent: 15,
        },
      },
    }

    const planRes = buildShotPlan(baseState, attacker0.id, target0.id)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    const execRes = executeShotPlan(baseState, planRes.plan)
    expect(execRes.ok).toBe(true)
    if (!execRes.ok) return

    const after = execRes.state

    // without sharing, damage would be >= 1; we expect at least 1 damage remains on target
    expect(after.units[target0.id]?.hpCurrent).toBeLessThanOrEqual(9)

    // total damage accounted: target got at least 1, yeji got up to N
    const targetDamage = 10 - (after.units[target0.id]?.hpCurrent ?? 10)
    const yejiDamage = 8 - (after.units[yeji0.id]?.hpCurrent ?? 8)
    expect(targetDamage).toBeGreaterThanOrEqual(1)
    expect(yejiDamage).toBeGreaterThanOrEqual(0)
    expect(yejiDamage).toBeLessThanOrEqual(shareN)
  })
})
