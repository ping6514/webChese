import { describe, expect, test } from 'vitest'
import { createRngState, rollDice, shuffle } from '../../serverSim'

describe('serverSim', () => {
  test('rollDice is deterministic for same seed', () => {
    const rng1 = createRngState('seed-1')
    const rng2 = createRngState('seed-1')

    const a = [rollDice(6, rng1), rollDice(6, rng1), rollDice(6, rng1)]
    const b = [rollDice(6, rng2), rollDice(6, rng2), rollDice(6, rng2)]

    expect(a).toEqual(b)
  })

  test('shuffle is deterministic for same seed', () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const a = shuffle(base, createRngState('seed-2'))
    const b = shuffle(base, createRngState('seed-2'))
    expect(a).toEqual(b)
  })

  test('different seeds produce different shuffles (smoke)', () => {
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const a = shuffle(base, createRngState('seed-a'))
    const b = shuffle(base, createRngState('seed-b'))

    // Extremely low chance of collision; good enough as a smoke test.
    expect(a).not.toEqual(b)
  })
})
