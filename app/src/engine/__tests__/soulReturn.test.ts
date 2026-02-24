import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'

describe('soul return (buy phase)', () => {
  it('RETURN_SOUL_TO_DECK_BOTTOM removes from hand, appends to base deck bottom, and is once per turn', () => {
    const s0 = createInitialState()

    const side = s0.turn.side
    const base = 'rook' as const

    const soulId = s0.displayByBase[base]
    if (!soulId) throw new Error('Expected rook display card')

    const deck0 = s0.soulDeckByBase[base] ?? []

    const sWithSoul = {
      ...s0,
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          souls: [soulId],
        },
      },
    }

    const res1 = reduce(sWithSoul, { type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId })
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    const s1 = res1.state
    expect(s1.hands[side].souls).toEqual([])
    expect(s1.soulDeckByBase[base]?.[s1.soulDeckByBase[base]!.length - 1]).toBe(soulId)
    expect(s1.turnFlags.soulReturnUsedCount).toBe(1)

    // Cannot return again in the same turn
    const res2 = reduce(s1, { type: 'RETURN_SOUL_TO_DECK_BOTTOM', soulId })
    expect(res2.ok).toBe(false)

    // Ensure the deck grew by 1
    expect(s1.soulDeckByBase[base]?.length ?? 0).toBe(deck0.length + 1)
  })
})
