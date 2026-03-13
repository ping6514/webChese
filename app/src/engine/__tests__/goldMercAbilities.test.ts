import { describe, expect, test } from 'vitest'
import { createInitialState, reduce, soulCardsById, type GameState } from '..'
import { getAtkPanelBreakdownInState, getDefPanelBreakdownInState } from '../stats'

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

describe('gold merc new abilities', () => {
  test('FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD grants gold after first attack of turn', () => {
    const card = soulCardsById['gold_merc_elephant_shoujin']
    if (!card) throw new Error('Missing gold_merc_elephant_shoujin')

    const oldAbilities = card.abilities
    try {
      card.abilities = [{ type: 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD', threshold: 8, amount: 1, perTurn: 1 } as any]

      const s = createInitialState({ rules: { rngMode: 'fixed', diceFixed: 6 } as any })
      s.turn.phase = 'combat'
      s.turn.side = 'red'

      const attackerId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
      const targetId = Object.values(s.units).find((u) => u.side === 'black' && u.base === 'soldier')!.id
      enchantUnit(s, attackerId, 'gold_merc_elephant_shoujin')
      s.resources.red.gold = 7
      s.units[targetId] = { ...s.units[targetId]!, hpCurrent: 6 }
      setUnitPos(s, attackerId, 4, 4)
      setUnitPos(s, targetId, 4, 1)
      for (const u of Object.values(s.units)) {
        if (u.id === attackerId || u.id === targetId) continue
        if (u.pos.x === 4 && u.pos.y > 1 && u.pos.y < 4) setUnitPos(s, u.id, 0, 0)
      }

      const res = reduce(s as any, { type: 'SHOOT', attackerId, targetUnitId: targetId })
      expect(res.ok).toBe(true)
      if (!res.ok) return

      expect(res.state.resources.red.gold).toBe(8)
      expect(res.events.some((e: any) => e.type === 'ABILITY_TRIGGERED' && e.abilityType === 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD')).toBe(true)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD grants gold after first item use of turn', () => {
    const card = soulCardsById['gold_merc_elephant_caishi']
    if (!card) throw new Error('Missing gold_merc_elephant_caishi')

    const oldAbilities = card.abilities
    try {
      card.abilities = [{ type: 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD', threshold: 7, amount: 1, perTurn: 1 } as any]

      const s = createInitialState()
      s.turn.phase = 'buy'
      s.turn.side = 'red'

      const auraId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
      enchantUnit(s, auraId, 'gold_merc_elephant_caishi')
      s.resources.red.gold = 6
      s.hands.red.items = ['item_lingxue_holy_grail']

      const targetId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
      s.units[targetId] = { ...s.units[targetId]!, hpCurrent: 1 }

      const res = reduce(s as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_lingxue_holy_grail', targetUnitId: targetId })
      expect(res.ok).toBe(true)
      if (!res.ok) return

      expect(res.state.resources.red.gold).toBe(7)
      expect(res.events.some((e: any) => e.type === 'ABILITY_TRIGGERED' && e.abilityType === 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD')).toBe(true)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('ITEM_VALUE_AURA grants allied DEF when item value threshold is met', () => {
    const card = soulCardsById['gold_merc_elephant_shoujin']
    if (!card) throw new Error('Missing gold_merc_elephant_shoujin')

    const oldAbilities = card.abilities
    try {
      card.abilities = [{ type: 'ITEM_VALUE_AURA', threshold: 8, scope: 'global', bonus: { def: { phys: 1, magic: 1 } } } as any]

      const s = createInitialState()
      const auraId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
      const targetId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
      enchantUnit(s, auraId, 'gold_merc_elephant_shoujin')
      s.hands.red.items = ['item_soul_overload', 'item_bone_refine']

      const panel = getDefPanelBreakdownInState(s as any, targetId)
      expect(panel.phys.total - panel.phys.base).toBe(1)
      expect(panel.magic.total - panel.magic.base).toBe(1)
    } finally {
      card.abilities = oldAbilities
    }
  })

  test('ITEM_VALUE_AURA grants allied ATK when item value threshold is met', () => {
    const card = soulCardsById['gold_merc_elephant_caishi']
    if (!card) throw new Error('Missing gold_merc_elephant_caishi')

    const oldAbilities = card.abilities
    try {
      card.abilities = [{ type: 'ITEM_VALUE_AURA', threshold: 8, scope: 'global', bonus: { atk: 1 } } as any]

      const s = createInitialState()
      const auraId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'elephant')!.id
      const targetId = Object.values(s.units).find((u) => u.side === 'red' && u.base === 'rook')!.id
      enchantUnit(s, auraId, 'gold_merc_elephant_caishi')
      s.hands.red.items = ['item_soul_overload', 'item_bone_refine']

      const panel = getAtkPanelBreakdownInState(s as any, targetId)
      expect(panel.total - panel.base).toBe(1)
    } finally {
      card.abilities = oldAbilities
    }
  })
})
