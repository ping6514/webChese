import { describe, expect, it } from 'vitest'
import { buildShotPlan, createInitialState } from '../index'

describe('shooting: elephant can shoot across river', () => {
  it('elephant may shoot a target across river, still obeys eye block', () => {
    const s0 = createInitialState()

    const elephant0 = Object.values(s0.units).find((u) => u.side === 'red' && u.base === 'elephant')
    const target0 = Object.values(s0.units).find((u) => u.side === 'black' && u.base === 'rook')
    const blocker0 = Object.values(s0.units).find((u) => u.side === 'red' && u.base === 'soldier')

    expect(elephant0?.base).toBe('elephant')
    expect(target0?.base).toBe('rook')
    expect(blocker0?.base).toBe('soldier')

    if (!elephant0 || !target0 || !blocker0) throw new Error('Missing baseline units')

    const attackerId = elephant0.id
    const targetId = target0.id

    // Put elephant near river (red side) and shoot across river to y=4
    // Legal elephant diagonal: (2,2). Put attacker (2,6) target (4,4).
    const baseState = {
      ...s0,
      units: {
        ...s0.units,
        [attackerId]: {
          ...elephant0,
          pos: { x: 2, y: 6 },
        },
        [targetId]: {
          ...target0,
          pos: { x: 4, y: 4 },
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

    const allowed = buildShotPlan(baseState, attackerId, targetId)
    expect(allowed.ok).toBe(true)

    // Eye block at (3,5)
    const withEyeBlock = {
      ...baseState,
      units: {
        ...baseState.units,
        [blocker0.id]: {
          ...blocker0,
          pos: { x: 3, y: 5 },
        },
      },
    }

    const blocked = buildShotPlan(withEyeBlock, attackerId, targetId)
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.error).toBe('Blocked')
  })
})
