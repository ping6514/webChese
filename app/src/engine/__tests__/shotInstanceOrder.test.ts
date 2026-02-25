import { describe, expect, test } from 'vitest'
import { executeShotPlan } from '../shotPlan'
import { createInitialState, type GameState } from '..'

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s))
}

function setUnitPos(s: GameState, unitId: string, x: number, y: number) {
  const u = s.units[unitId]
  if (!u) throw new Error(`Unit not found: ${unitId}`)
  s.units[unitId] = { ...u, pos: { x, y } }
}

describe('shot instance execution order', () => {
  test('instances are executed in deterministic kind priority order', () => {
    const s = createInitialState({ rules: { diceFixed: 1 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    // Ensure mana is sufficient; executeShotPlan will deduct mana.
    s.resources.red = { ...s.resources.red, mana: 999 }

    const attackerId = 'red:rook:0'

    // Put 4 enemy units on the same file; rook can shoot them.
    const tDirect = 'black:soldier:0'
    const tChain = 'black:soldier:1'
    const tSplash = 'black:soldier:2'
    const tPierce = 'black:soldier:3'

    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, tDirect, 4, 8)
    setUnitPos(s, tChain, 4, 7)
    setUnitPos(s, tSplash, 4, 6)
    setUnitPos(s, tPierce, 4, 5)

    // Make HP changes detectable and avoid accidental kills.
    for (const id of [tDirect, tChain, tSplash, tPierce]) {
      s.units[id] = { ...s.units[id]!, hpCurrent: 9 }
    }

    const plan = {
      attackerId,
      cost: 0,
      instances: [
        { kind: 'pierce', sourceUnitId: attackerId, targetUnitId: tPierce, fixedDamage: 1 },
        { kind: 'splash', sourceUnitId: attackerId, targetUnitId: tSplash, fixedDamage: 1 },
        { kind: 'chain', sourceUnitId: attackerId, targetUnitId: tChain, fixedDamage: 1 },
        { kind: 'direct', sourceUnitId: attackerId, targetUnitId: tDirect, fixedDamage: 1 },
      ],
      abilityUses: [],
    } as any

    const exec = executeShotPlan(cloneState(s), plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return

    const damageEvents = exec.events.filter((e) => e.type === 'DAMAGE_DEALT') as any[]

    const firstFourTargets = damageEvents
      .map((e) => e.targetUnitId)
      .filter((id) => id === tDirect || id === tChain || id === tSplash || id === tPierce)
      .slice(0, 4)

    expect(firstFourTargets).toEqual([tDirect, tChain, tSplash, tPierce])
  })
})
