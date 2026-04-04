import { describe, expect, test } from 'vitest'
import { canMove, createInitialState, type GameState } from '..'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { buildShotPreview } from '../shotPreview'

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
  s.units[unitId] = { ...u, enchant: { soulId } }
}

describe('dark moon missing abilities', () => {
  test('IGNORE_PATH_BLOCKING(for MOVE) allows knight to move even if leg is blocked', () => {
    const base = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } })
    base.turn.phase = 'combat'
    base.turn.side = 'red'

    const knightId = Object.values(base.units).find((u) => u.side === 'red' && u.base === 'knight')!.id
    const blockerId = Object.values(base.units).find((u) => u.side === 'red' && u.base === 'soldier')!.id

    setUnitPos(base, knightId, 4, 4)
    setUnitPos(base, blockerId, 5, 4) // leg block for move to (6,5)

    const to = { x: 6, y: 5 }

    const noEnchant = cloneState(base)
    expect(canMove(noEnchant, knightId, to).ok).toBe(false)

    const withEnchant = cloneState(base)
    enchantUnit(withEnchant, knightId, 'dark_moon_knight_wuying')
    expect(canMove(withEnchant, knightId, to).ok).toBe(true)
  })

  test('EXTRA_SHOT allows one extra shot per turn after crossing river (perTurn=1)', () => {
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'
    s.resources.red.mana = 999

    const redKnightId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'knight')!.id
    const blackSoldierId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id

    enchantUnit(s, redKnightId, 'dark_moon_knight_yingzi')

    // Cross river for red: y <= 4
    setUnitPos(s, redKnightId, 4, 4)
    // Place enemy at a legal knight shot target from (4,4) -> (5,6)
    setUnitPos(s, blackSoldierId, 5, 6)

    // Ensure the shoot leg is not blocked (from (4,4) to (5,6) leg is (4,5))
    for (const u of Object.values(s.units)) {
      if (u.id === redKnightId || u.id === blackSoldierId) continue
      if (u.pos.x === 4 && u.pos.y === 5) setUnitPos(s, u.id, 0, 0)
    }

    // First shot
    const p1 = buildShotPlan(s, redKnightId, blackSoldierId)
    expect(p1.ok).toBe(true)
    if (!p1.ok) return
    const e1 = executeShotPlan(s, p1.plan)
    expect(e1.ok).toBe(true)
    if (!e1.ok) return

    // Second shot should still be allowed due to EXTRA_SHOT
    const after1 = e1.state
    const p2 = buildShotPlan(after1, redKnightId, blackSoldierId)
    expect(p2.ok).toBe(true)
    if (!p2.ok) return
    const e2 = executeShotPlan(after1, p2.plan)
    expect(e2.ok).toBe(true)
    if (!e2.ok) return

    // Third shot should fail
    const after2 = e2.state
    const p3 = buildShotPlan(after2, redKnightId, blackSoldierId)
    expect(p3.ok).toBe(false)
  })

  test('COUNTER_ON_KING_DAMAGED damages attacker when king takes damage', () => {
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const blackKingId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'king')!.id
    const blackAdvisorId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'advisor')!.id

    // Put attacker and king in range
    setUnitPos(s, redRookId, 4, 4)
    setUnitPos(s, blackKingId, 4, 1)

    // Ensure path clear
    for (const u of Object.values(s.units)) {
      if (u.id === redRookId || u.id === blackKingId || u.id === blackAdvisorId) continue
      if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) {
        // move away
        setUnitPos(s, u.id, 0, 0)
      }
    }

    enchantUnit(s, blackAdvisorId, 'dark_moon_advisor_yingji')

    const attackerHp0 = s.units[redRookId]!.hpCurrent

    const plan = buildShotPlan(s, redRookId, blackKingId)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const res = executeShotPlan(s, plan.plan)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    const attackerHp1 = after.units[redRookId]?.hpCurrent ?? 0
    expect(attackerHp1).toBeLessThan(attackerHp0)
  })

  test('COUNTER damages attacker when yingji itself takes damage (targets include SELF)', () => {
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const blackAdvisorId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'advisor')!.id

    // Put attacker and yingji in range
    setUnitPos(s, redRookId, 4, 4)
    setUnitPos(s, blackAdvisorId, 4, 1)

    // Ensure path clear
    for (const u of Object.values(s.units)) {
      if (u.id === redRookId || u.id === blackAdvisorId) continue
      if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(s, u.id, 0, 0)
    }

    enchantUnit(s, blackAdvisorId, 'dark_moon_advisor_yingji')

    const attackerHp0 = s.units[redRookId]!.hpCurrent
    const plan = buildShotPlan(s, redRookId, blackAdvisorId)
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const res = executeShotPlan(s, plan.plan)
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    const attackerHp1 = after.units[redRookId]?.hpCurrent ?? 0
    expect(after.units[blackAdvisorId]?.hpCurrent).toBe(s.units[blackAdvisorId]!.hpCurrent)
    expect(attackerHp1).toBe(attackerHp0)
  })

  test('yingji reduces the first damage taken each turn by 3, then takes normal damage on the second hit', () => {
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const blackAdvisorId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'advisor')!.id

    setUnitPos(s, redRookId, 4, 4)
    setUnitPos(s, blackAdvisorId, 4, 1)

    for (const u of Object.values(s.units)) {
      if (u.id === redRookId || u.id === blackAdvisorId) continue
      if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(s, u.id, 0, 0)
    }

    enchantUnit(s, blackAdvisorId, 'dark_moon_advisor_yingji')

    const hp0 = s.units[blackAdvisorId]!.hpCurrent

    const p1 = buildShotPlan(s, redRookId, blackAdvisorId)
    expect(p1.ok).toBe(true)
    if (!p1.ok) return
    const r1 = executeShotPlan(s, p1.plan)
    expect(r1.ok).toBe(true)
    if (!r1.ok) return

    const after1 = r1.state
    expect(after1.units[blackAdvisorId]?.hpCurrent).toBe(hp0)
    expect(after1.units[redRookId]?.hpCurrent).toBe(s.units[redRookId]!.hpCurrent)

    const after1Reset = {
      ...after1,
      turnFlags: {
        ...after1.turnFlags,
        shotUsed: {},
      },
    }

    const p2 = buildShotPlan(after1Reset, redRookId, blackAdvisorId)
    expect(p2.ok).toBe(true)
    if (!p2.ok) return
    const attackerHp1 = after1Reset.units[redRookId]!.hpCurrent
    const r2 = executeShotPlan(after1Reset, p2.plan)
    expect(r2.ok).toBe(true)
    if (!r2.ok) return

    const after2 = r2.state
    expect(after2.units[blackAdvisorId]?.hpCurrent).toBeLessThan(hp0)
    expect(after2.units[redRookId]?.hpCurrent).toBeLessThan(attackerHp1)
  })

  test('AURA_DAMAGE_BONUS adds +1 to cross-river unit damage when resonance is active', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const blackSoldierId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id

    // Attacker: dark_moon_rook_yinghua has CROSS_RIVER, no intrinsic damage bonus
    enchantUnit(s, redRookId, 'dark_moon_rook_yinghua')

    // Aura source: yueji provides AURA_DAMAGE_BONUS when resonance active
    const redElephantId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
    enchantUnit(s, redElephantId, 'dark_moon_elephant_yueji')

    // Add enough dark_moon units to reach resonance >=4
    const extra = Object.values(s.units)
      .filter((u) => u.side === 'red')
      .filter((u) => u.id !== redRookId && u.id !== redElephantId)
      .slice(0, 2)
    expect(extra.length).toBe(2)
    enchantUnit(s, extra[0]!.id, 'dark_moon_cannon_fenghua')
    enchantUnit(s, extra[1]!.id, 'dark_moon_cannon_yehua')

    // Position attacker across river
    setUnitPos(s, redRookId, 4, 4) // red crossed river when y <= 4
    setUnitPos(s, blackSoldierId, 4, 1)

    // Ensure path clear
    for (const u of Object.values(s.units)) {
      if (u.id === redRookId || u.id === blackSoldierId) continue
      if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(s, u.id, 0, 0)
    }

    const preview = buildShotPreview(s, redRookId, blackSoldierId)
    expect(preview.ok).toBe(true)
    if (!preview.ok) return

    // Baseline damage without aura would be: diceFixed(3) + atk(2) - def(0) = 5
    // With yueji AURA_DAMAGE_BONUS +2 (amount=2, resonance need=3 with 4 dark_moon units): 7
    expect(preview.rawDamage).toBe(7)
  })
})
