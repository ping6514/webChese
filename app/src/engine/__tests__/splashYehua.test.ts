import { describe, expect, it } from 'vitest'
import { buildShotPlan, createInitialState, executeShotPlan } from '../index'

describe('SPLASH', () => {
  it('dark_moon_cannon_yehua splashes equal fixed damage to adjacent enemies (after crossing river)', () => {
    const s0 = createInitialState()

    const attacker0 = Object.values(s0.units).find((u) => u.side === 'red' && u.base === 'cannon')
    const screen0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'cannon')
    const target0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'rook')
    const splash0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'knight')
    if (!attacker0 || !screen0 || !target0 || !splash0) throw new Error('Missing baseline units')

    const baseState = {
      ...s0,
      rules: { ...s0.rules, diceFixed: 6 },
      turn: { side: 'red' as const, phase: 'combat' as const },
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
        red: { ...s0.resources.red, mana: 999 },
      },
      units: {
        ...s0.units,
        [attacker0.id]: {
          ...attacker0,
          pos: { x: 1, y: 4 },
          enchant: { soulId: 'dark_moon_cannon_yehua' },
        },
        // Cannon needs exactly 1 screen unless ignore blocking; we set a single screen.
        [screen0.id]: {
          ...screen0,
          pos: { x: 1, y: 2 },
        },
        [target0.id]: {
          ...target0,
          pos: { x: 1, y: 0 },
          hpCurrent: 10,
        },
        // adjacent (Chebyshev distance 1) to target at (1,0)
        [splash0.id]: {
          ...splash0,
          pos: { x: 2, y: 0 },
          hpCurrent: 10,
        },
      },
    }

    const planRes = buildShotPlan(baseState, attacker0.id, target0.id)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    // should include at least one splash instance
    expect(planRes.plan.instances.some((i) => i.kind === 'splash')).toBe(true)

    const execRes = executeShotPlan(baseState, planRes.plan)
    expect(execRes.ok).toBe(true)
    if (!execRes.ok) return

    const targetHp = execRes.state.units[target0.id]?.hpCurrent ?? 10
    const splashHp = execRes.state.units[splash0.id]?.hpCurrent ?? 10

    const dmgMain = 10 - targetHp
    const dmgSplash = 10 - splashHp

    expect(dmgMain).toBeGreaterThan(0)
    expect(dmgSplash).toBe(dmgMain)
  })
})
