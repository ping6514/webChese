import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'

describe('engine phase flow', () => {
  it('NEXT_PHASE from turnEnd swaps side and auto-enters buy (turnStart is transient)', () => {
    const s0 = createInitialState()

    const startSide = s0.turn.side
    const nextSide = startSide === 'red' ? 'black' : 'red'

    // Put state into turnEnd to simulate end-of-turn transition.
    const sTurnEnd = {
      ...s0,
      turn: {
        ...s0.turn,
        phase: 'turnEnd' as const,
      },
      turnFlags: {
        ...s0.turnFlags,
        shotUsed: { 'some:unit': true as const },
      },
    }

    const res = reduce(sTurnEnd, { type: 'NEXT_PHASE' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    // Should have swapped to enemy side and auto jumped to buy.
    expect(res.state.turn.side).toBe(nextSide)
    expect(res.state.turn.phase).toBe('buy')

    // shotUsed should reset for the new turn.
    expect(res.state.turnFlags.shotUsed).toEqual({})

    // Should contain the synthetic PHASE_CHANGED for turnStart -> buy.
    expect(res.events.some((e) => e.type === 'PHASE_CHANGED' && e.from === 'turnStart' && e.to === 'buy')).toBe(true)
  })
})
