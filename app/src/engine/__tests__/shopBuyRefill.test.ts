import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'

describe('shop buy + display refill', () => {
  it('BUY_SOUL_FROM_DISPLAY adds to hand, deducts gold, clears display then refills from deck', () => {
    const s0 = createInitialState()

    const side = s0.turn.side
    const base = 'rook' as const

    const display0 = s0.displayByBase[base]
    const deck0 = s0.soulDeckByBase[base] ?? []

    expect(s0.turn.phase).toBe('buy')
    expect(display0).not.toBeNull()
    expect(display0).not.toBeUndefined()
    expect(deck0.length).toBeGreaterThan(0)

    if (!display0) throw new Error('Expected rook display card')

    const gold0 = s0.resources[side].gold

    const res = reduce(s0, { type: 'BUY_SOUL_FROM_DISPLAY', base })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const s1 = res.state

    expect(s1.resources[side].gold).toBe(gold0 - 2)
    expect(s1.hands[side].souls).toContain(display0)

    // Display should be refilled from top of deck.
    // createInitialState pre-fills display by shifting 1 card from deck.
    // So after buying display, refill should set it to deck0[0] and deck should shift by 1.
    expect(s1.displayByBase[base]).toBe(deck0[0] ?? null)
    expect(s1.soulDeckByBase[base]?.length ?? 0).toBe(Math.max(0, deck0.length - 1))

    // 3-in-1 soul buy: cannot buy another soul in the same turn
    const res2 = reduce(s1, { type: 'BUY_SOUL_FROM_DECK', base })
    expect(res2.ok).toBe(false)
  })
})
