import { describe, expect, test } from 'vitest'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { buildShotPreview } from '../shotPreview'
import { createInitialState, type GameState } from '..'
import { getSoulCard } from '../cards'

function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s))
}

function setUnitPos(s: GameState, unitId: string, x: number, y: number) {
  const u = s.units[unitId]
  if (!u) throw new Error(`Unit not found: ${unitId}`)
  s.units[unitId] = { ...u, pos: { x, y } }
}

function enchantUnit(s: GameState, unitId: string, soulId: string) {
  const u = s.units[unitId]
  if (!u) throw new Error(`Unit not found: ${unitId}`)
  const card = getSoulCard(soulId)
  if (!card) throw new Error(`Soul card not found: ${soulId}`)
  s.units[unitId] = {
    ...u,
    enchant: { soulId },
    hpCurrent: card.stats.hp,
    atk: { ...card.stats.atk },
    def: card.stats.def.map((d) => ({ ...d })),
  }
}

function moveUnitAwayFromLine(s: GameState, x: number, yMin: number, yMax: number, keep: string[]) {
  for (const u of Object.values(s.units)) {
    if (keep.includes(u.id)) continue
    if (u.pos.x === x && u.pos.y >= yMin && u.pos.y <= yMax) {
      setUnitPos(s, u.id, 8, 9)
    }
  }
}

describe('styx abilities', () => {
  test('MINGLEI: magicDefMinus and target-cross-river bonus damage are applied in preview', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:elephant:0'
    const targetId = 'black:soldier:0'

    // Use elephant shoot pattern (2-diagonal with eye clear) for a stable test setup.
    setUnitPos(s, attackerId, 4, 4)
    setUnitPos(s, targetId, 6, 6) // 2-diagonal away

    // Ensure eye is empty at (5,5)
    for (const u of Object.values(s.units)) {
      if (u.id === attackerId || u.id === targetId) continue
      if (u.pos.x === 5 && u.pos.y === 5) setUnitPos(s, u.id, 0, 0)
    }

    // Enchant attacker with minglei
    enchantUnit(s, attackerId, 'styx_elephant_mingleixiang')

    // Put target in crossed-river state (black crossed when y>=5)
    setUnitPos(s, targetId, 6, 6)

    const preview = buildShotPreview(s, attackerId, targetId)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return

    // minglei: target magic def -1 and +1 damage if target crossed river
    // base: dice(3) + atk(3) - def(target.magic=0) = 6
    // with magicDefMinus(1): def stays 0 (min 0)
    // with crossed bonus +1 => 7
    expect(preview.rawDamage).toBe(7)
  })

  test('HEAL_KING_ON_KILL heals allied king by 1 and does not exceed max HP', () => {
    const s = createInitialState({ rules: { diceFixed: 6 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:knight:0'
    const targetId = 'black:soldier:0'
    const kingId = 'red:king:0'

    enchantUnit(s, attackerId, 'styx_knight_xueyan')

    // Set positions so knight can shoot target (L shape)
    setUnitPos(s, attackerId, 4, 4)
    setUnitPos(s, targetId, 5, 6)

    // Ensure knight shoot leg is not blocked (from (4,4) to (5,6) leg is (4,5))
    for (const u of Object.values(s.units)) {
      if (u.id === attackerId || u.id === targetId || u.id === kingId) continue
      if (u.pos.x === 4 && u.pos.y === 5) setUnitPos(s, u.id, 0, 0)
    }

    // Damage should kill the soldier
    const kingHp0 = s.units[kingId]!.hpCurrent

    // Artificially reduce king hp to ensure healing is visible
    s.units[kingId] = { ...s.units[kingId]!, hpCurrent: Math.max(1, kingHp0 - 2) }
    const kingHpStart = s.units[kingId]!.hpCurrent

    const planRes = buildShotPlan(s, attackerId, targetId)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    // Ensure target will die
    s.units[targetId] = { ...s.units[targetId]!, hpCurrent: 1 }

    const exec = executeShotPlan(s, planRes.plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return

    const after = exec.state
    expect(after.units[targetId]).toBeUndefined()

    const kingHp1 = after.units[kingId]!.hpCurrent
    expect(kingHp1).toBe(kingHpStart + 1)

    const hpEvents = exec.events.filter((e) => e.type === 'UNIT_HP_CHANGED') as any[]
    expect(hpEvents.some((e) => e.unitId === kingId && e.reason === 'HEAL_KING_ON_KILL' && e.from === kingHpStart && e.to === kingHpStart + 1)).toBe(true)

    // cap check: set king to max, then perform another kill and assert HP doesn't exceed max.
    const maxHp = 15
    const s3 = cloneState(after)
    s3.units[kingId] = { ...s3.units[kingId]!, hpCurrent: maxHp }

    // Simulate a fresh turn so we can shoot again.
    s3.turnFlags = {
      ...s3.turnFlags,
      shotUsed: {},
      movedThisTurn: {},
    }
    s3.resources = {
      ...s3.resources,
      red: {
        ...s3.resources.red,
        mana: 999,
      },
    }

    const target2 = 'black:soldier:1'
    // Put a second target into a legal knight shoot location (L shape from attacker at 4,4 -> 5,6).
    setUnitPos(s3, target2, 5, 6)
    s3.units[target2] = { ...s3.units[target2]!, hpCurrent: 1 }

    const plan2 = buildShotPlan(s3, attackerId, target2)
    expect(plan2.ok).toBe(true)
    if (!plan2.ok) return
    const exec2 = executeShotPlan(s3, plan2.plan)
    expect(exec2.ok).toBe(true)
    if (!exec2.ok) return

    expect(exec2.state.units[kingId]!.hpCurrent).toBe(maxHp)
  })

  test('PIERCE(LINE_ENEMIES,count=2) hits the first 2 enemies on the line (including target)', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const enemy1 = 'black:soldier:0'
    const enemy2 = 'black:soldier:1'

    enchantUnit(s, attackerId, 'styx_rook_mingyanche')

    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, enemy1, 4, 5)
    setUnitPos(s, enemy2, 4, 2)

    // Clear other blockers on file 4
    moveUnitAwayFromLine(s, 4, 3, 8, [attackerId, enemy1, enemy2])

    const planRes = buildShotPlan(s, attackerId, enemy1)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    // Should contain one extra pierce instance for enemy2
    const instances = planRes.plan.instances
    const pierceTargets = instances.filter((i) => (i as any).kind === 'pierce').map((i) => i.targetUnitId)
    expect(pierceTargets).toEqual([enemy2])

    // Make both enemies 1 hp; both should die after execute
    const s2 = cloneState(s)
    s2.units[enemy1] = { ...s2.units[enemy1]!, hpCurrent: 1 }
    s2.units[enemy2] = { ...s2.units[enemy2]!, hpCurrent: 1 }

    const exec = executeShotPlan(s2, planRes.plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return

    expect(exec.state.units[enemy1]).toBeUndefined()
    expect(exec.state.units[enemy2]).toBeUndefined()
  })

  test('PIERCE(CANNON_SCREEN_AND_TARGET) adds damage to the screen enemy when cannon shoots with 1 screen', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:cannon:0'
    const targetId = 'black:soldier:0'
    const screenId = 'black:soldier:1'

    enchantUnit(s, attackerId, 'styx_cannon_baoyan')

    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 0)
    setUnitPos(s, screenId, 4, 5)

    // Clear other blockers on the file
    moveUnitAwayFromLine(s, 4, 1, 8, [attackerId, targetId, screenId])

    const planRes = buildShotPlan(s, attackerId, targetId)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    const pierceTargets = planRes.plan.instances.filter((i) => (i as any).kind === 'pierce').map((i) => i.targetUnitId)
    expect(pierceTargets).toEqual([screenId])
  })

  test('CHAIN: extraTargetUnitId adds a chain instance with equal damage', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'
    const extraId = 'black:soldier:1'

    enchantUnit(s, attackerId, 'styx_rook_feiyan')

    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 4)
    setUnitPos(s, extraId, 5, 5) // chebyshev distance 1 from (4,4)

    // Clear file blockers
    moveUnitAwayFromLine(s, 4, 5, 8, [attackerId, targetId, extraId])

    const planRes = buildShotPlan(s, attackerId, targetId, extraId)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    const chainTargets = planRes.plan.instances.filter((i) => (i as any).kind === 'chain').map((i) => i.targetUnitId)
    expect(chainTargets).toEqual([extraId])
  })
})
