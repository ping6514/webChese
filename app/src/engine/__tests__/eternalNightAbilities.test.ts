import { describe, expect, test } from 'vitest'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { canShoot } from '../shooting'
import { reduce } from '../reduce'
import { createInitialState, type GameState } from '..'
import { getSoulCard } from '../cards'

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

function putCorpses(s: GameState, ownerSide: 'red' | 'black', count: number) {
  const key = '0,0'
  s.corpsesByPos[key] = []
  for (let i = 0; i < count; i++) {
    s.corpsesByPos[key].push({ ownerSide, base: 'soldier' })
  }
}

function clearCells(s: GameState, cells: Array<{ x: number; y: number }>, keep: Set<string>) {
  for (const u of Object.values(s.units)) {
    if (keep.has(u.id)) continue
    if (cells.some((c) => c.x === u.pos.x && c.y === u.pos.y)) {
      setUnitPos(s, u.id, 8, 9)
    }
  }
}

describe('eternal night abilities', () => {
  test('xuegu MOVE_THEN_SHOOT requires corpses>=3', () => {
    const s0 = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } as any })
    s0.turn.phase = 'combat'
    s0.turn.side = 'red'

    const attackerId = 'red:knight:0'
    const targetId = 'black:soldier:0'

    enchantUnit(s0, attackerId, 'eternal_night_knight_xuegu')

    setUnitPos(s0, attackerId, 4, 4)
    setUnitPos(s0, targetId, 7, 7)

    const keep0 = new Set([attackerId, targetId])
    clearCells(
      s0,
      [
        { x: 6, y: 5 },
        { x: 6, y: 6 },
      ],
      keep0,
    )

    // Move once to activate movedThisTurn.
    // Move from (4,4) -> (6,5) is legal and keeps a clear shot to (7,7).
    const moveRes = reduce(s0, { type: 'MOVE', unitId: attackerId, to: { x: 6, y: 5 } })
    expect(moveRes.ok).toBe(true)
    const s1 = moveRes.ok ? (moveRes.state as GameState) : s0

    // First shot.
    const p1 = buildShotPlan(s1, attackerId, targetId)
    expect(p1.ok).toBe(true)
    if (!p1.ok) return
    const e1 = executeShotPlan(s1, p1.plan)
    expect(e1.ok).toBe(true)
    if (!e1.ok) return

    // Without enough corpses, second shot should be blocked.
    const s2 = e1.state
    const c2 = canShoot(s2, attackerId, targetId)
    expect(c2.ok).toBe(false)

    // With corpses>=3, second shot should be allowed.
    const s3: GameState = JSON.parse(JSON.stringify(s2))
    putCorpses(s3, 'red', 3)
    const p2 = buildShotPlan(s3, attackerId, targetId)
    expect(p2.ok).toBe(true)
  })

  test('suigu CHAIN requires corpses>=3 to add chain instance', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:cannon:0'
    const targetId = 'black:soldier:0'
    const extraId = 'black:soldier:1'

    enchantUnit(s, attackerId, 'eternal_night_cannon_suigu')

    // Arrange cannon shot with one screen: attacker (4,9), screen (4,7), target (4,6)
    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 6)

    // Ensure between has exactly one unit as screen.
    const keep = new Set([attackerId, targetId, extraId])
    clearCells(
      s,
      [
        { x: 4, y: 8 },
        { x: 4, y: 7 },
      ],
      keep,
    )

    const someScreen = Object.values(s.units).find((u) => !keep.has(u.id))!.id
    setUnitPos(s, someScreen, 4, 7)

    // Place extra target adjacent to main target.
    setUnitPos(s, extraId, 5, 6)

    // corpses<3: chain should not be added.
    putCorpses(s, 'red', 2)
    const p0 = buildShotPlan(s, attackerId, targetId, extraId)
    expect(p0.ok).toBe(true)
    if (!p0.ok) return
    const chain0 = p0.plan.instances.filter((i) => (i as any).kind === 'chain').map((i) => i.targetUnitId)
    expect(chain0).toEqual([])

    // corpses>=3: chain should be added.
    putCorpses(s, 'red', 3)
    const p1 = buildShotPlan(s, attackerId, targetId, extraId)
    expect(p1.ok).toBe(true)
    if (!p1.ok) return
    const chain1 = p1.plan.instances.filter((i) => (i as any).kind === 'chain').map((i) => i.targetUnitId)
    expect(chain1).toEqual([extraId])
  })
})
