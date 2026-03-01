import { describe, expect, it } from 'vitest'
import { buildShotPlan, createInitialState } from '../index'

describe('shooting ignore blocking', () => {
  it('IGNORE_BLOCKING count allows rook shot through 1 blocker (after crossing river)', () => {
    const s0 = createInitialState()

    const attacker0 = s0.units['red:rook:0']
    const blocker0 = s0.units['red:soldier:0']
    const target0 = s0.units['black:rook:0']

    expect(attacker0?.base).toBe('rook')
    expect(blocker0?.base).toBe('soldier')
    expect(target0?.base).toBe('rook')

    if (!attacker0 || !blocker0 || !target0) throw new Error('Missing baseline units')

    const attackerId = attacker0.id
    const targetId = target0.id

    const baseState = {
      ...s0,
      units: {
        ...s0.units,
        [attackerId]: {
          ...attacker0,
          pos: { x: 0, y: 4 },
        },
        [blocker0.id]: {
          ...blocker0,
          pos: { x: 0, y: 2 },
        },
        [targetId]: {
          ...target0,
          pos: { x: 0, y: 0 },
        },
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
    }

    const blocked = buildShotPlan(baseState, attackerId, targetId)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error).toBe('Blocked')

    // dark_moon_rook_lanhua abilities include CROSS_RIVER + IGNORE_BLOCKING count=1
    const withEnchant = {
      ...baseState,
      units: {
        ...baseState.units,
        [attackerId]: {
          ...attacker0,
          pos: { x: 0, y: 4 },
          enchant: { soulId: 'dark_moon_rook_lanhua' },
        },
      },
    }

    const allowed = buildShotPlan(withEnchant, attackerId, targetId)
    expect(allowed.ok).toBe(true)
  })
})
