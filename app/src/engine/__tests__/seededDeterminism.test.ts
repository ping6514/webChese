import { describe, expect, test } from 'vitest'
import { createInitialState, reduce } from '../index'

describe('seeded determinism (smoke)', () => {
  test('same matchSeed + same action sequence => same final state', () => {
    const makeBase = () => {
      const s0 = createInitialState({
        rules: {
          rngMode: 'seeded',
          matchSeed: 'seed-determinism-1',
        } as any,
      })
      const side = s0.turn.side
      const enemySide = side === 'red' ? 'black' : 'red'
      return {
        ...s0,
        turn: { ...s0.turn, phase: 'buy' as const },
        hands: {
          ...s0.hands,
          [side]: { ...s0.hands[side], items: ['item_cage_plunder', 'item_cage_plunder'], souls: [] },
          [enemySide]: { ...s0.hands[enemySide], souls: ['dark_moon_rook_lanhua', 'dark_moon_rook_yinghua', 'dark_moon_rook_lanhua'] },
        },
      }
    }

    const run = (baseState: any) => {
      const a1 = reduce(baseState, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_cage_plunder' })
      expect(a1.ok).toBe(true)
      if (!a1.ok) throw new Error(a1.error)

      const a2 = reduce(a1.state as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_cage_plunder' })
      expect(a2.ok).toBe(true)
      if (!a2.ok) throw new Error(a2.error)

      return a2.state
    }

    const s1 = run(makeBase())
    const s2 = run(makeBase())

    expect(s1).toEqual(s2)
  })
})
