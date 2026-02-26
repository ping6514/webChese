import { describe, expect, test } from 'vitest'
import { canShoot } from '../shooting'
import { createInitialState, type GameState } from '..'

function setUnitPos(s: GameState, unitId: string, x: number, y: number) {
  const u = s.units[unitId]
  if (!u) throw new Error(`Unit not found: ${unitId}`)
  s.units[unitId] = { ...u, pos: { x, y } }
}

describe('advisor shooting rules', () => {
  test('advisor can shoot diagonal-1 targets outside palace', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'
    s.resources.red = { ...s.resources.red, mana: 999 }

    const advisorId = 'red:advisor:0'
    const targetId = 'black:soldier:0'

    // Place advisor outside palace (normally illegal for movement, but shooting should still work).
    setUnitPos(s, advisorId, 4, 6)
    setUnitPos(s, targetId, 5, 5)

    expect(canShoot(s, advisorId, targetId).ok).toBe(true)
  })
})
