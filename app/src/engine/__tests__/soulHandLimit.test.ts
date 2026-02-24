import { describe, expect, it } from 'vitest'
import { canBuySoulFromDeck, canBuySoulFromDisplay, canBuySoulFromEnemyGraveyard, createInitialState } from '../index'

describe('soul hand limit', () => {
  it('when soul hand is full (5), all soul buys are blocked with a clear reason', () => {
    const s0 = createInitialState()
    const base = 'rook' as const

    const full = {
      ...s0,
      hands: {
        ...s0.hands,
        [s0.turn.side]: {
          ...s0.hands[s0.turn.side],
          souls: ['a', 'b', 'c', 'd', 'e'],
        },
      },
    }

    const g1 = canBuySoulFromDeck(full, base)
    expect(g1.ok).toBe(false)
    if (!g1.ok) expect(g1.reason).toBe('Soul hand full (5)')

    const g2 = canBuySoulFromDisplay(full, base)
    expect(g2.ok).toBe(false)
    if (!g2.ok) expect(g2.reason).toBe('Soul hand full (5)')

    const g3 = canBuySoulFromEnemyGraveyard(full)
    expect(g3.ok).toBe(false)
    if (!g3.ok) expect(g3.reason).toBe('Soul hand full (5)')
  })
})
