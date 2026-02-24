import { describe, expect, it } from 'vitest'
import { buildShotPlan, createInitialState, executeShotPlan } from '../index'

describe('DAMAGE_BONUS: cross river gating', () => {
  it('dark_moon_cannon_fenghua gives +1 damage only after crossing river', () => {
    const s0 = createInitialState()

    const attacker0 = Object.values(s0.units).find((u) => u.side === 'red' && u.base === 'cannon')
    const target0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'rook')
    const screen0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'cannon')
    if (!attacker0 || !target0) throw new Error('Missing baseline units')
    if (!screen0) throw new Error('Missing screen unit')

    const baseState = {
      ...s0,
      rules: { ...s0.rules, diceFixed: 6 },
      turn: { side: 'red' as const, phase: 'combat' as const },
      turnFlags: {
        shotUsed: {},
        soulReturnUsedCount: 0,
        abilityUsed: {},
        soulBuyUsed: false,
        buySoulActionsUsed: 0,
        buyItemActionsUsed: 0,
        necroActionsUsed: 0,
        bloodRitualUsed: false,
        necroBonusActions: 0,
      },
      resources: {
        ...s0.resources,
        red: { ...s0.resources.red, mana: 999 },
      },
      units: {
        ...s0.units,
        [attacker0.id]: {
          ...attacker0,
          pos: { x: 1, y: 5 },
          enchant: { soulId: 'dark_moon_cannon_fenghua' },
        },
        [screen0.id]: {
          ...screen0,
          pos: { x: 1, y: 2 },
        },
        [target0.id]: {
          ...target0,
          pos: { x: 1, y: 0 },
          hpCurrent: 10,
        },
      },
    }

    // Not crossed river (red crossed when y <= 4; here attacker at y=5)
    const plan0 = buildShotPlan(baseState, attacker0.id, target0.id)
    expect(plan0.ok).toBe(true)
    if (!plan0.ok) return
    const exec0 = executeShotPlan(baseState, plan0.plan)
    expect(exec0.ok).toBe(true)
    if (!exec0.ok) return
    const dmg0 = 10 - (exec0.state.units[target0.id]?.hpCurrent ?? 10)

    // Cross river: put attacker at y=4
    const crossedState = {
      ...baseState,
      units: {
        ...baseState.units,
        [attacker0.id]: {
          ...baseState.units[attacker0.id]!,
          pos: { x: 1, y: 4 },
        },
      },
    }

    const plan1 = buildShotPlan(crossedState, attacker0.id, target0.id)
    expect(plan1.ok).toBe(true)
    if (!plan1.ok) return
    const exec1 = executeShotPlan(crossedState, plan1.plan)
    expect(exec1.ok).toBe(true)
    if (!exec1.ok) return
    const dmg1 = 10 - (exec1.state.units[target0.id]?.hpCurrent ?? 10)

    expect(dmg1).toBe(dmg0 + 1)
  })
})
