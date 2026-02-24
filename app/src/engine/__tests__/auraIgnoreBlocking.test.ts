import { describe, expect, it } from 'vitest'
import { buildShotPlan, buildShotPreview, createInitialState } from '../index'

describe('AURA_IGNORE_BLOCKING', () => {
  it('dark_moon_advisor_yeji allows allied rook to ignore 1 blocker when attacker is in palace', () => {
    const s0 = createInitialState()

    const attacker0 = s0.units['red:rook:0']
    const target0 = s0.units['black:rook:0']
    const aura0 = s0.units['red:advisor:0']
    const blocker0 = s0.units['red:soldier:0']
    const moveAway0 = s0.units['black:advisor:0']

    if (!attacker0 || !target0 || !aura0 || !blocker0 || !moveAway0) throw new Error('Missing baseline units')

    const attackerId = attacker0.id
    const targetId = target0.id

    const baseState = {
      ...s0,
      units: {
        ...s0.units,
        // attacker rook inside palace (x 3-5, y 7-9)
        [attackerId]: {
          ...attacker0,
          pos: { x: 3, y: 8 },
        },
        // place exactly 1 blocker between attacker and target
        [blocker0.id]: {
          ...blocker0,
          pos: { x: 3, y: 4 },
        },
        // target rook on same file
        [targetId]: {
          ...target0,
          pos: { x: 3, y: 0 },
        },
        // move black advisor away from (3,0) so it doesn't collide
        [moveAway0.id]: {
          ...moveAway0,
          pos: { x: 8, y: 0 },
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

    const withAura = {
      ...baseState,
      units: {
        ...baseState.units,
        [aura0.id]: {
          ...aura0,
          enchant: { soulId: 'dark_moon_advisor_yeji' },
        },
      },
    }

    const allowed = buildShotPlan(withAura, attackerId, targetId)
    expect(allowed.ok).toBe(true)

    const preview = buildShotPreview(withAura, attackerId, targetId)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return

    expect(preview.effects.some((e) => e.kind === 'AURA_IGNORE_BLOCKING_COUNT' && e.byUnitId === aura0.id)).toBe(true)
  })
})
