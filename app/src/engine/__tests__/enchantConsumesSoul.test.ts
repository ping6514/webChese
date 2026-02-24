import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'

describe('enchant consumes soul card from hand', () => {
  it('ENCHANT removes soulId from current side hand on success', () => {
    const s0 = createInitialState()

    const side = s0.turn.side
    const unit0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'rook')
    if (!unit0) throw new Error('Missing unit')

    const soulId = 'dark_moon_rook_lanhua'

    const baseState = {
      ...s0,
      turn: {
        side,
        phase: 'necro' as const,
      },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          souls: [soulId],
        },
      },
      resources: {
        ...s0.resources,
        [side]: {
          ...s0.resources[side],
          gold: 999,
        },
      },
    }

    const res = reduce(baseState, { type: 'ENCHANT', unitId: unit0.id, soulId })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.state.units[unit0.id]?.enchant?.soulId).toBe(soulId)
    expect(res.state.hands[side].souls).toEqual([])
  })
})
