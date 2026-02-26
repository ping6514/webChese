import { describe, expect, test } from 'vitest'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { createInitialState, type GameState } from '..'

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s))
}

function setUnitPos(s: GameState, unitId: string, x: number, y: number) {
  const u = s.units[unitId]
  if (!u) throw new Error(`Unit not found: ${unitId}`)
  s.units[unitId] = { ...u, pos: { x, y } }
}

describe('rng mode', () => {
  test('seeded mode: initial decks/displays and first combat dice are reproducible for same matchSeed', () => {
    const s1 = createInitialState({ rules: { rngMode: 'seeded', matchSeed: 'm1' } as any })
    const s2 = createInitialState({ rules: { rngMode: 'seeded', matchSeed: 'm1' } as any })

    expect(s1.displayByBase).toEqual(s2.displayByBase)
    expect(s1.itemDisplay).toEqual(s2.itemDisplay)

    s1.turn.phase = 'combat'
    s1.turn.side = 'red'
    s2.turn.phase = 'combat'
    s2.turn.side = 'red'

    // Ensure enough mana.
    s1.resources.red = { ...s1.resources.red, mana: 999 }
    s2.resources.red = { ...s2.resources.red, mana: 999 }

    // Use rook for a simple orthogonal shot.
    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'

    setUnitPos(s1, attackerId, 4, 9)
    setUnitPos(s1, targetId, 4, 7)
    setUnitPos(s2, attackerId, 4, 9)
    setUnitPos(s2, targetId, 4, 7)

    const p1 = buildShotPlan(s1, attackerId, targetId)
    const p2 = buildShotPlan(s2, attackerId, targetId)
    expect(p1.ok).toBe(true)
    expect(p2.ok).toBe(true)
    if (!p1.ok || !p2.ok) return

    const e1 = executeShotPlan(cloneState(s1), p1.plan)
    const e2 = executeShotPlan(cloneState(s2), p2.plan)
    expect(e1.ok).toBe(true)
    expect(e2.ok).toBe(true)
    if (!e1.ok || !e2.ok) return

    const d1 = e1.events.find((e) => e.type === 'DICE_ROLLED') as any
    const d2 = e2.events.find((e) => e.type === 'DICE_ROLLED') as any
    expect(d1.value).toBe(d2.value)

    expect(e1.state.rngState).not.toBeNull()
    expect(e2.state.rngState).not.toBeNull()
  })

  test('fixed mode: rngState stays null', () => {
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } as any })
    expect(s.rngState).toBeNull()

    s.turn.phase = 'combat'
    s.turn.side = 'red'
    s.resources.red = { ...s.resources.red, mana: 999 }

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'
    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 7)

    const plan = buildShotPlan(s, attackerId, targetId)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return

    const exec = executeShotPlan(cloneState(s), plan.plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return

    expect(exec.state.rngState).toBeNull()
  })
})
