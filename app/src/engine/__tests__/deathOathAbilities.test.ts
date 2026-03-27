import { describe, expect, test } from 'vitest'
import { createInitialState, type GameState, soulCardsById } from '..'
import { buildShotPlan, executeShotPlan } from '../shotPlan'
import { getDefPanelBreakdownInState } from '../stats'

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

describe('death oath abilities', () => {
  test('HEAL_SELF_AND_KING_ON_KILL heals both self and allied king on kill', () => {
    const card = soulCardsById['death_oath_rook_xuelie']
    if (!card) throw new Error('Missing death_oath_rook_xuelie')

    const oldAbilities = card.abilities
    try {
      card.abilities = [{ type: 'HEAL_SELF_AND_KING_ON_KILL', selfAmount: 2, kingAmount: 2 } as any]

      const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 6 } as any })
      s.turn.phase = 'combat'
      s.turn.side = 'red'

      const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
      const redKingId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'king')!.id
      const blackSoldierId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id

      enchantUnit(s, redRookId, 'death_oath_rook_xuelie')
      s.units[redRookId] = { ...s.units[redRookId]!, hpCurrent: 8 }
      s.units[redKingId] = { ...s.units[redKingId]!, hpCurrent: 10 }
      s.units[blackSoldierId] = { ...s.units[blackSoldierId]!, hpCurrent: 6 }

      setUnitPos(s, redRookId, 4, 4)
      setUnitPos(s, blackSoldierId, 4, 1)
      for (const u of Object.values(s.units)) {
        if (u.id === redRookId || u.id === blackSoldierId) continue
        if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(s, u.id, 0, 0)
      }

      const plan = buildShotPlan(s, redRookId, blackSoldierId)
      expect(plan.ok).toBe(true)
      if (!plan.ok) return

      const res = executeShotPlan(s, plan.plan)
      expect(res.ok).toBe(true)
      if (!res.ok) return

      expect(res.state.units[redRookId]?.hpCurrent).toBe(10)
      expect(res.state.units[redKingId]?.hpCurrent).toBe(12)
      expect(res.events.some((e: any) => e.type === 'ABILITY_TRIGGERED' && e.abilityType === 'HEAL_SELF_AND_KING_ON_KILL')).toBe(true)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('BELOW_MAX_HP_DEFENSE_BONUS only applies while unit is damaged', () => {
    const card = soulCardsById['death_oath_advisor_moming']
    if (!card) throw new Error('Missing death_oath_advisor_moming')

    const oldAbilities = card.abilities
    try {
      card.abilities = [
        {
          type: 'COUNTER',
          targets: [{ type: 'SELF' }, { type: 'ALLY_BASE', base: 'king' }],
          damage: { dice: 6, atkKey: 'phys', atkValue: 0 },
          perTurn: 1,
        } as any,
        {
          type: 'BELOW_MAX_HP_DEFENSE_BONUS',
          defBonus: [{ key: 'phys', value: 2 }, { key: 'magic', value: 2 }],
        } as any,
      ]

      const s = createInitialState()
      const advisorId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'advisor')!.id
      enchantUnit(s, advisorId, 'death_oath_advisor_moming')
      s.units[advisorId] = { ...s.units[advisorId]!, hpCurrent: 8 }

      const full = getDefPanelBreakdownInState(s as any, advisorId)
      s.units[advisorId] = { ...s.units[advisorId]!, hpCurrent: s.units[advisorId]!.hpCurrent - 1 }
      const hurt = getDefPanelBreakdownInState(s as any, advisorId)

      expect(hurt.phys.total - full.phys.total).toBe(2)
      expect(hurt.magic.total - full.magic.total).toBe(2)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('UNIT_COUNT_ADVANTAGE_AURA grants allied defense when ahead by margin', () => {
    const card = soulCardsById['death_oath_elephant_fenhun']
    if (!card) throw new Error('Missing death_oath_elephant_fenhun')

    const oldAbilities = card.abilities
    try {
      card.abilities = [
        { type: 'BLOOD_SACRIFICE', hpCost: 2, onActivate: { type: 'FREE_SHOOT', perTurn: 1 } } as any,
        {
          type: 'UNIT_COUNT_ADVANTAGE_AURA',
          scope: 'global',
          margin: 2,
          defBonus: [{ key: 'phys', value: 2 }, { key: 'magic', value: 2 }],
        } as any,
      ]

      const s = createInitialState()
      const elephantId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
      const rookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id

      enchantUnit(s, elephantId, 'death_oath_elephant_fenhun')
      const before = getDefPanelBreakdownInState(s as any, rookId)

      const blackSoldierId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id
      const blackAdvisorId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'advisor')!.id
      delete s.units[blackSoldierId]
      delete s.units[blackAdvisorId]

      const after = getDefPanelBreakdownInState(s as any, rookId)
      expect(after.phys.total - before.phys.total).toBe(2)
      expect(after.magic.total - before.magic.total).toBe(2)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('UNIT_COUNT_UNDERDOG_AURA grants allied attack when behind by margin', () => {
    const base = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } as any })
    base.turn.phase = 'combat'
    base.turn.side = 'red'

    const redRookId = Object.values(base.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const redElephantId = Object.values(base.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
    const blackSoldierId = Object.values(base.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id

    const withAura = JSON.parse(JSON.stringify(base)) as GameState
    enchantUnit(withAura, redElephantId, 'death_oath_elephant_jueyu')
    setUnitPos(withAura, redRookId, 4, 4)
    setUnitPos(withAura, blackSoldierId, 4, 1)
    for (const u of Object.values(withAura.units)) {
      if (u.id === redRookId || u.id === redElephantId || u.id === blackSoldierId) continue
      if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(withAura, u.id, 0, 0)
    }
    const redSoldierId = Object.values(withAura.units).find((u) => u.side === 'red' && u.base === 'soldier')!.id
    const redAdvisorId = Object.values(withAura.units).find((u) => u.side === 'red' && u.base === 'advisor')!.id
    delete withAura.units[redSoldierId]
    delete withAura.units[redAdvisorId]

    const withoutAura = JSON.parse(JSON.stringify(withAura)) as GameState
    const elephantWithoutAura = withoutAura.units[redElephantId]
    if (!elephantWithoutAura) throw new Error('Missing elephant in withoutAura state')
    delete elephantWithoutAura.enchant

    const plan0 = buildShotPlan(withoutAura, redRookId, blackSoldierId)
    expect(plan0.ok).toBe(true)
    if (!plan0.ok) return
    const res0 = executeShotPlan(withoutAura, plan0.plan)
    expect(res0.ok).toBe(true)
    if (!res0.ok) return

    const plan1 = buildShotPlan(withAura, redRookId, blackSoldierId)
    expect(plan1.ok).toBe(true)
    if (!plan1.ok) return
    const res1 = executeShotPlan(withAura, plan1.plan)
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    const dmg0 = res0.events.find((e: any) => e.type === 'DAMAGE_DEALT' && e.targetUnitId === blackSoldierId) as any
    const dmg1 = res1.events.find((e: any) => e.type === 'DAMAGE_DEALT' && e.targetUnitId === blackSoldierId) as any
    expect((dmg1?.amount ?? 0) - (dmg0?.amount ?? 0)).toBe(2)
  })

  test('PALACE_GUARD only protects own king, not opponent king', () => {
    // P1 (red) 的士附魔鐵誓（有 PALACE_GUARD）
    // P1 的車攻打 P2 (black) 的帥
    // 期望：PALACE_GUARD 不應觸發，黑方帥不應減傷
    const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 3 } as any })
    s.turn.phase = 'combat'
    s.turn.side = 'red'

    const redRookId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
    const redAdvisorId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'advisor')!.id
    const blackKingId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'king')!.id

    // P1 的士附魔鐵誓
    enchantUnit(s, redAdvisorId, 'death_oath_advisor_tieshi')

    // 把紅車移到可攻擊黑帥的位置
    setUnitPos(s, redRookId, 4, 1)
    // 清掉中間阻擋的單位
    for (const u of Object.values(s.units)) {
      if (u.id === redRookId || u.id === blackKingId || u.id === redAdvisorId) continue
      if (u.pos.x === 4) setUnitPos(s, u.id, 0, 5)
    }

    // 不附魔版本（基準傷害）
    const sWithout = JSON.parse(JSON.stringify(s)) as GameState
    const advisorWithout = sWithout.units[redAdvisorId]
    if (advisorWithout) delete (advisorWithout as any).enchant

    const plan0 = buildShotPlan(sWithout, redRookId, blackKingId)
    expect(plan0.ok).toBe(true)
    if (!plan0.ok) return
    const res0 = executeShotPlan(sWithout, plan0.plan)
    expect(res0.ok).toBe(true)
    if (!res0.ok) return
    const dmg0 = res0.events.find((e: any) => e.type === 'DAMAGE_DEALT' && e.targetUnitId === blackKingId) as any

    // 附魔版本
    const plan1 = buildShotPlan(s, redRookId, blackKingId)
    expect(plan1.ok).toBe(true)
    if (!plan1.ok) return
    const res1 = executeShotPlan(s, plan1.plan)
    expect(res1.ok).toBe(true)
    if (!res1.ok) return
    const dmg1 = res1.events.find((e: any) => e.type === 'DAMAGE_DEALT' && e.targetUnitId === blackKingId) as any

    // PALACE_GUARD 不應保護黑帥 → 傷害應相同
    expect(dmg0?.amount).toBe(dmg1?.amount)

    // 確認 PALACE_GUARD 事件沒有被觸發在這次攻擊中
    const guardTriggered = res1.events.some((e: any) => e.type === 'ABILITY_TRIGGERED' && e.abilityType === 'PALACE_GUARD')
    expect(guardTriggered).toBe(false)
  })
})
