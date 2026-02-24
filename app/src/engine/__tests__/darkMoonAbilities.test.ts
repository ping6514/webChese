import { describe, expect, test } from 'vitest'
import { canMove, createInitialState, reduce, type GameState } from '..'
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
    const base = createInitialState({ rules: { diceFixed: 3 } as any })
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

  test('MOVE_THEN_SHOOT allows one extra shot after moving (perTurn=1)', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redKnightId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'knight')!.id
    const blackSoldierId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id

    enchantUnit(s, redKnightId, 'dark_moon_knight_yingzi')

    setUnitPos(s, redKnightId, 4, 4)
    setUnitPos(s, blackSoldierId, 7, 7)

    // Ensure the move destination is empty
    for (const u of Object.values(s.units)) {
      if (u.id === redKnightId || u.id === blackSoldierId) continue
      if (u.pos.x === 6 && u.pos.y === 5) setUnitPos(s, u.id, 0, 0)
    }

    // Ensure the shoot leg is not blocked (from (6,5) to (7,7) leg is (6,6))
    for (const u of Object.values(s.units)) {
      if (u.id === redKnightId || u.id === blackSoldierId) continue
      if (u.pos.x === 6 && u.pos.y === 6) setUnitPos(s, u.id, 0, 0)
    }

    // Move somewhere legal to activate movedThisTurn
    const moveRes = reduce(s, { type: 'MOVE', unitId: redKnightId, to: { x: 6, y: 5 } })
    expect(moveRes.ok).toBe(true)
    const afterMove = moveRes.ok ? moveRes.state : s

    // First shot
    const p1 = buildShotPlan(afterMove, redKnightId, blackSoldierId)
    expect(p1.ok).toBe(true)
    const e1 = executeShotPlan(afterMove, (p1 as any).plan)
    expect(e1.ok).toBe(true)

    // Second shot should still be allowed due to MOVE_THEN_SHOOT
    const after1 = (e1 as any).state as GameState
    const p2 = buildShotPlan(after1, redKnightId, blackSoldierId)
    expect(p2.ok).toBe(true)
    const e2 = executeShotPlan(after1, (p2 as any).plan)
    expect(e2.ok).toBe(true)

    // Third shot should fail
    const after2 = (e2 as any).state as GameState
    const p3 = buildShotPlan(after2, redKnightId, blackSoldierId)
    expect(p3.ok).toBe(false)
  })

  test('COUNTER_ON_KING_DAMAGED damages attacker when king takes damage', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
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
    const res = executeShotPlan(s, (plan as any).plan)
    expect(res.ok).toBe(true)

    const after = (res as any).state as GameState
    const attackerHp1 = after.units[redRookId]?.hpCurrent ?? 0
    expect(attackerHp1).toBeLessThan(attackerHp0)
  })

  test('AURA_DAMAGE_BONUS adds +1 to cross-river unit damage when resonance is active', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
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

    // Baseline damage without aura would be: diceFixed(3) + atk(2) - def(0) = 5
    // With aura +1: 6
    expect((preview as any).rawDamage).toBe(6)
  })
})
