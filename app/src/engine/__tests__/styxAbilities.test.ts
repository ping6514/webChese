import { describe, expect, test } from 'vitest'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { buildShotPreview } from '../shotPreview'
import { createInitialState, reduce, type GameState } from '..'
import { getSoulCard } from '../cards'
import type { AbilityTriggeredEvent } from '../events'

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
  test('TARGET_DEF_MINUS + DAMAGE_BONUS(target cross river) are applied in preview', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
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

    // Enchant attacker with Styx elephant using target def reduction + target-cross-river damage bonus
    enchantUnit(s, attackerId, 'styx_elephant_mingleixiang')

    // Put target in crossed-river state (black crossed when y>=5)
    setUnitPos(s, targetId, 6, 6)

    const preview = buildShotPreview(s, attackerId, targetId)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return

    // target magic def -2 (min 0) and +2 damage if target crossed river
    // base: dice(3) + atk(3) - def(target.magic=0) = 6
    // with magicDefMinus(2): def stays 0 (already 0, min 0)
    // with crossed bonus +2 => 8
    expect(preview.rawDamage).toBe(8)
  })

  test('RESONANCE(styx>=3) grants free shoot and free move at turn start (via Styx elephants)', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })

    // Trigger turn start for black by ending red's turn.
    s.turn.phase = 'turnEnd'
    s.turn.side = 'red'

    // Enchant 3 black units with Styx souls, including both elephants.
    enchantUnit(s, 'black:elephant:0', 'styx_elephant_mingleixiang')
    enchantUnit(s, 'black:elephant:1', 'styx_elephant_mingyanxiang')
    enchantUnit(s, 'black:rook:0', 'styx_rook_mingyanche')

    const res = reduce(s, { type: 'NEXT_PHASE' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.state.turn.side).toBe('black')
    expect(res.state.turn.phase).toBe('buy')

    expect(res.state.turnFlags.freeShootBonus).toBe(1)
    expect(res.state.turnFlags.freeMoveBonus).toBe(1)
  })

  test('KILL_MANA_GAIN grants mana on kill and does not exceed max mana', () => {
    const s = createInitialState({ rules: { diceFixed: 6 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:knight:0'
    const targetId = 'black:soldier:0'

    enchantUnit(s, attackerId, 'styx_knight_xueyan')

    // Set positions so knight can shoot target (L shape)
    setUnitPos(s, attackerId, 4, 4)
    setUnitPos(s, targetId, 5, 6)

    // Ensure knight shoot leg is not blocked (from (4,4) to (5,6) leg is (4,5))
    for (const u of Object.values(s.units)) {
      if (u.id === attackerId || u.id === targetId) continue
      if (u.pos.x === 4 && u.pos.y === 5) setUnitPos(s, u.id, 0, 0)
    }

    // Ensure we can observe mana gain (need enough mana to shoot)
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 1 } }
    const manaStart = s.resources.red.mana

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

    // shoot cost is deducted first, then KILL_MANA_GAIN is applied
    const expectedMana = Math.min(after.limits.manaMax, Math.max(0, manaStart - planRes.plan.cost) + 1)
    expect(after.resources.red.mana).toBe(expectedMana)
    const abEvents = exec.events.filter((e): e is AbilityTriggeredEvent => e.type === 'ABILITY_TRIGGERED')
    expect(abEvents.some((e) => e.abilityType === 'KILL_MANA_GAIN')).toBe(true)

    // cap check: set mana to max, then perform another kill and assert mana doesn't exceed max.
    const maxMana = after.limits.manaMax
    const s3 = cloneState(after)
    s3.resources = { ...s3.resources, red: { ...s3.resources.red, mana: maxMana } }

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

    expect(exec2.state.resources.red.mana).toBe(maxMana)
  })

  test('PIERCE(LINE_ENEMIES,count=2) hits the first 2 enemies on the line (including target)', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
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

    // PIERCE is optional: with mana=1 the gate fails so pierce is skipped,
    // but the unit can still perform a normal shot at base cost.
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 1 } }
    const lowManaPlan = buildShotPlan(s, attackerId, enemy1)
    expect(lowManaPlan.ok).toBe(true)
    if (lowManaPlan.ok) {
      expect(lowManaPlan.plan.cost).toBe(1)
      const lowManaPierce = lowManaPlan.plan.instances.filter((i) => i.kind === 'pierce')
      expect(lowManaPierce).toHaveLength(0)
    }
    const lowManaPreview = buildShotPreview(s, attackerId, enemy1)
    expect(lowManaPreview.ok).toBe(true)
    if (lowManaPreview.ok) {
      expect(lowManaPreview.cost).toBe(1)
      expect(lowManaPreview.effects.some((e) => e.kind === 'PIERCE')).toBe(false)
    }

    // Enough mana for gate and for cost
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 2 } }

    const planRes = buildShotPlan(s, attackerId, enemy1)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    // New: PIERCE manaCost=1 → total shoot cost becomes 2
    expect(planRes.plan.cost).toBe(2)

    // Should contain one extra pierce instance for enemy2
    const instances = planRes.plan.instances
    const pierceTargets = instances.filter((i) => i.kind === 'pierce').map((i) => i.targetUnitId)
    expect(pierceTargets).toEqual([enemy2])

    // Make both enemies 1 hp; both should die after execute
    const s2 = cloneState(s)
    s2.resources = { ...s2.resources, red: { ...s2.resources.red, mana: 2 } }
    s2.units[enemy1] = { ...s2.units[enemy1]!, hpCurrent: 1 }
    s2.units[enemy2] = { ...s2.units[enemy2]!, hpCurrent: 1 }

    const exec = executeShotPlan(s2, planRes.plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return

    // Mana should be deducted by plan.cost
    expect(exec.state.resources.red.mana).toBe(0)

    expect(exec.state.units[enemy1]).toBeUndefined()
    expect(exec.state.units[enemy2]).toBeUndefined()
  })

  test('PIERCE(CANNON_SCREEN_AND_TARGET) adds damage to the screen enemy when cannon shoots with 1 screen', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
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

    // PIERCE is optional: mana=1 → gate fails, base cannon shot still legal.
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 1 } }
    const lowManaPlan = buildShotPlan(s, attackerId, targetId)
    expect(lowManaPlan.ok).toBe(true)
    if (lowManaPlan.ok) {
      expect(lowManaPlan.plan.cost).toBe(1)
      const lowManaPierce = lowManaPlan.plan.instances.filter((i) => i.kind === 'pierce')
      expect(lowManaPierce).toHaveLength(0)
    }
    const lowManaPreview = buildShotPreview(s, attackerId, targetId)
    expect(lowManaPreview.ok).toBe(true)
    if (lowManaPreview.ok) {
      expect(lowManaPreview.cost).toBe(1)
      expect(lowManaPreview.effects.some((e) => e.kind === 'PIERCE')).toBe(false)
    }

    // mana=2 → PIERCE triggers, total cost becomes base(1) + manaCost(1) = 2
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 2 } }

    const planRes = buildShotPlan(s, attackerId, targetId)
    expect(planRes.ok).toBe(true)
    if (!planRes.ok) return

    expect(planRes.plan.cost).toBe(2)

    const pierceTargets = planRes.plan.instances.filter((i) => i.kind === 'pierce').map((i) => i.targetUnitId)
    expect(pierceTargets).toEqual([screenId])

    const exec = executeShotPlan(s, planRes.plan)
    expect(exec.ok).toBe(true)
    if (!exec.ok) return
    expect(exec.state.resources.red.mana).toBe(0)
  })

  test('CHAIN: extraTargetUnitId adds a chain instance with equal damage', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
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

    const chainTargets = planRes.plan.instances.filter((i) => i.kind === 'chain').map((i) => i.targetUnitId)
    expect(chainTargets).toEqual([extraId])
  })
})
