import { describe, expect, test } from 'vitest'
import { buildShotPreview } from '../shotPreview'
import { buildShotPlan } from '../shotPlan'
import { createInitialState, type GameState } from '..'
import { getSoulCard } from '../cards'
import { abilityUseKey } from '../effects'

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

function markAbilityUsed(s: GameState, unitId: string, abilityType: string, count = 1) {
  const key = abilityUseKey(unitId, abilityType)
  s.turnFlags = {
    ...s.turnFlags,
    abilityUsed: { ...(s.turnFlags.abilityUsed ?? {}), [key]: count },
  }
}

describe('shotPreview ↔ engine mirror', () => {
  test('AURA_IGNORE_BLOCKING preview omits effect when perTurn already used', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const auraSourceId = 'red:advisor:0'
    const attackerId = 'red:king:0'
    const targetId = 'black:soldier:0'

    enchantUnit(s, auraSourceId, 'dark_moon_advisor_yeji')
    // 夜姬 needs ATTACKER_IN_PALACE; king starts in palace by default.
    // Ensure target on same file as attacker so a shoot path exists.
    setUnitPos(s, targetId, s.units[attackerId]!.pos.x, 0)
    moveUnitAwayFromLine(s, s.units[attackerId]!.pos.x, 1, 8, [attackerId, targetId])

    const before = buildShotPreview(s, attackerId, targetId)
    expect(before.ok).toBe(true)
    if (before.ok) {
      expect(before.effects.some((e) => e.kind === 'AURA_IGNORE_BLOCKING_COUNT')).toBe(true)
    }

    markAbilityUsed(s, auraSourceId, 'AURA_IGNORE_BLOCKING')
    const after = buildShotPreview(s, attackerId, targetId)
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.effects.some((e) => e.kind === 'AURA_IGNORE_BLOCKING_COUNT')).toBe(false)
    }
  })

  test('SPLASH preview omits effect when perTurn already used', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:cannon:0'
    const targetId = 'black:soldier:0'
    const splashableId = 'black:soldier:1'

    enchantUnit(s, attackerId, 'dark_moon_cannon_yehua')
    // SPLASH on dark_moon_cannon_yehua requires AFTER_CROSS_RIVER → place attacker past river.
    setUnitPos(s, attackerId, 4, 4) // red attacker past midline (y < 5 for red side post-cross)
    setUnitPos(s, targetId, 4, 1)
    // place a cannon screen so cannon can shoot legally (between=1)
    const screenId = Object.values(s.units).find((u) => u.id !== attackerId && u.id !== targetId && u.id !== splashableId)!.id
    setUnitPos(s, screenId, 4, 3)
    setUnitPos(s, splashableId, 5, 1) // within radius 1 of target
    // Clear other blockers
    moveUnitAwayFromLine(s, 4, 0, 9, [attackerId, targetId, screenId])

    const before = buildShotPreview(s, attackerId, targetId)
    expect(before.ok).toBe(true)
    if (before.ok) {
      expect(before.effects.some((e) => e.kind === 'SPLASH')).toBe(true)
    }

    markAbilityUsed(s, attackerId, 'SPLASH')
    const after = buildShotPreview(s, attackerId, targetId)
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.effects.some((e) => e.kind === 'SPLASH')).toBe(false)
    }
  })

  test('CHAIN preview omits chain effect when perTurn already used', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'
    const extraId = 'black:soldier:1'

    enchantUnit(s, attackerId, 'styx_rook_feiyan')
    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 0)
    setUnitPos(s, extraId, 4, 1) // chebyshev 1 from target
    moveUnitAwayFromLine(s, 4, 1, 8, [attackerId, targetId])
    setUnitPos(s, extraId, 4, 1)
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 5 } }

    const before = buildShotPreview(s, attackerId, targetId, extraId)
    expect(before.ok).toBe(true)
    if (before.ok) {
      expect(before.effects.some((e) => e.kind === 'CHAIN')).toBe(true)
    }

    markAbilityUsed(s, attackerId, 'CHAIN')
    const after = buildShotPreview(s, attackerId, targetId, extraId)
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.effects.some((e) => e.kind === 'CHAIN')).toBe(false)
    }
  })

  test('FREE_SHOOT preview drops cost to 0 and emits FREE_SHOOT effect when conditions met', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'

    enchantUnit(s, attackerId, 'iron_guard_rook_tieche')
    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 0)
    moveUnitAwayFromLine(s, 4, 1, 8, [attackerId, targetId])

    // iron_guard_rook_tieche: FREE_SHOOT when SOLDIERS_GTE 5, perTurn 1.
    // createInitialState seeds 5 soldiers per side, so condition is satisfied by default.
    const preview = buildShotPreview(s, attackerId, targetId)
    expect(preview.ok).toBe(true)
    if (preview.ok) {
      expect(preview.cost).toBe(0)
      expect(preview.effects.some((e) => e.kind === 'FREE_SHOOT')).toBe(true)
    }

    // After perTurn exhausted, FREE_SHOOT no longer active → cost back to base.
    markAbilityUsed(s, attackerId, 'FREE_SHOOT')
    const after = buildShotPreview(s, attackerId, targetId)
    expect(after.ok).toBe(true)
    if (after.ok) {
      expect(after.cost).toBe(s.rules.shootManaCost)
      expect(after.effects.some((e) => e.kind === 'FREE_SHOOT')).toBe(false)
    }
  })

  test('ARMY_RALLY preview shows rally instance when adjacent allied soldier exists', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'

    enchantUnit(s, attackerId, 'iron_guard_rook_junhua')
    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 0)
    moveUnitAwayFromLine(s, 4, 1, 8, [attackerId, targetId])

    // Park an allied soldier within chebyshev 1 of target
    const allySoldier = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'soldier')!
    setUnitPos(s, allySoldier.id, 5, 0)

    const preview = buildShotPreview(s, attackerId, targetId)
    expect(preview.ok).toBe(true)
    if (preview.ok) {
      const rally = preview.effects.find((e) => e.kind === 'ARMY_RALLY')
      expect(rally).toBeTruthy()
      if (rally && rally.kind === 'ARMY_RALLY') {
        expect(rally.sourceUnitId).toBe(allySoldier.id)
        expect(rally.targetUnitId).toBe(targetId)
      }
    }
  })

  test('BLOOD_SACRIFICE PIERCE sub-effect soft-skips when mana gate not met (no longer blocks shot)', () => {
    const s = createInitialState({ rules: { diceFixed: 3 } })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const attackerId = 'red:rook:0'
    const targetId = 'black:soldier:0'

    setUnitPos(s, attackerId, 4, 9)
    setUnitPos(s, targetId, 4, 5)
    moveUnitAwayFromLine(s, 4, 1, 8, [attackerId, targetId])

    // Synthetic BS PIERCE shot effect carrying a manaGte gate the player cannot meet.
    // Mirrors how BLOOD_SACRIFICE arms its onActivate effect for the next shot.
    s.resources = { ...s.resources, red: { ...s.resources.red, mana: 1 } }
    s.turnFlags = {
      ...s.turnFlags,
      bloodSacrificeActiveShotEffect: {
        unitId: attackerId,
        effect: {
          type: 'PIERCE',
          mode: 'LINE_ENEMIES',
          count: 2,
          requiresManaGte: 99, // unreachable; ensures soft-skip path is exercised
          manaCost: 1,
        },
      } as unknown as GameState['turnFlags']['bloodSacrificeActiveShotEffect'],
    }

    const plan = buildShotPlan(s, attackerId, targetId)
    expect(plan.ok).toBe(true)
    if (plan.ok) {
      // Soft-skip: BS sub-effect didn't fire, so no extra pierce instance & base cost only.
      expect(plan.plan.cost).toBe(s.rules.shootManaCost)
      const pierce = plan.plan.instances.filter((i) => i.kind === 'pierce')
      expect(pierce).toHaveLength(0)
    }
  })
})
