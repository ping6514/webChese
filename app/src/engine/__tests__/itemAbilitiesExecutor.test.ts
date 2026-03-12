import { describe, expect, it } from 'vitest'
import { createInitialState, reduce } from '../index'
import { createRngState, nextU32 } from '../../serverSim'

describe('items: abilities executor (A1)', () => {
  it('HEAL_UNIT: item_lingxue_holy_grail heals an allied unit (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const target0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'rook')
    if (!target0) throw new Error('Missing target unit')

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'buy' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_lingxue_holy_grail'],
        },
      },
      units: {
        ...s0.units,
        [target0.id]: {
          ...target0,
          hpCurrent: 1,
        },
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_lingxue_holy_grail', targetUnitId: target0.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.hands[side].items).not.toContain('item_lingxue_holy_grail')
    expect(after.itemDiscard).toContain('item_lingxue_holy_grail')
    expect(after.units[target0.id]!.hpCurrent).toBeGreaterThan(1)
  })

  it('REFRESH_ITEM_DISPLAY: item_dark_moon_scope refreshes item display (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'buy' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_dark_moon_scope'],
        },
      },
      itemDisplay: ['item_lingxue_holy_grail', null, 'item_wizard_greed'],
      itemDeck: ['item_soul_overload', 'item_nether_seal'],
      itemDiscard: [],
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_dark_moon_scope' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.hands[side].items).not.toContain('item_dark_moon_scope')
    expect(after.itemDiscard).toContain('item_dark_moon_scope')

    // Existing display items should be discarded
    expect(after.itemDiscard).toContain('item_lingxue_holy_grail')
    expect(after.itemDiscard).toContain('item_wizard_greed')

    // New items should be drawn from deck into empty slots
    expect(after.itemDisplay.filter(Boolean).length).toBeGreaterThan(0)
  })

  it('falls back to legacy switch-case when abilities include unsupported types (item_bone_refine)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'buy' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_bone_refine'],
        },
      },
      corpsesByPos: {
        ...s0.corpsesByPos,
        '0,0': [{ ownerSide: side, base: 'soldier' }],
      },
      resources: {
        ...s0.resources,
        [side]: { ...s0.resources[side], gold: 0, mana: 0 },
      },
    }

    const res = reduce(baseState as any, {
      type: 'USE_ITEM_FROM_HAND',
      itemId: 'item_bone_refine',
      targetPos: { x: 0, y: 0 },
      choice: 'gold',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.hands[side].items).not.toContain('item_bone_refine')
    expect(after.itemDiscard).toContain('item_bone_refine')
    expect(after.corpsesByPos['0,0']).toBeUndefined()
    expect(after.resources[side].gold).toBeGreaterThan(0)
  })

  it('GAIN_NECRO_ACTION + ENCHANT_GOLD_DISCOUNT: item_soul_infusion updates turnFlags (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'necro' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_soul_infusion'],
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        itemNecroBonus: 0,
        enchantGoldDiscount: 0,
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_soul_infusion' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.hands[side].items).not.toContain('item_soul_infusion')
    expect(after.itemDiscard).toContain('item_soul_infusion')
    expect(after.turnFlags.itemNecroBonus).toBeGreaterThanOrEqual(1)
    expect(after.turnFlags.enchantGoldDiscount).toBeGreaterThanOrEqual(1)
  })

  it('GRANT_FREE_SHOOT: item_soul_overload increments freeShootBonus (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'combat' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_soul_overload'],
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        freeShootBonus: 0,
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_soul_overload' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_soul_overload')
    expect(after.turnFlags.freeShootBonus).toBeGreaterThanOrEqual(1)
  })

  it('GRANT_FREE_SHOOT restrict UNIT_NOT_SHOT_THIS_TURN: freeShootBonus is not consumed by an attacker that already shot', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const attacker0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'knight')
    const target0 = Object.values(s0.units).find((u) => u.side !== side && u.base === 'soldier')
    if (!attacker0 || !target0) throw new Error('Missing shooter units')

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'combat' as const },
      units: {
        ...s0.units,
        [attacker0.id]: {
          ...attacker0,
          // Give attacker MOVE_THEN_SHOOT ability so a 2nd shot is legal when moved.
          enchant: { soulId: 'iron_guard_knight_lianjunma' },
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        freeShootBonus: 1,
        movedThisTurn: { ...s0.turnFlags.movedThisTurn, [attacker0.id]: true },
        shotUsed: { ...s0.turnFlags.shotUsed, [attacker0.id]: true },
      },
      resources: {
        ...s0.resources,
        [side]: {
          ...s0.resources[side],
          mana: 0,
        },
      },
    }

    const res = reduce(baseState as any, {
      type: 'SHOOT',
      attackerId: attacker0.id,
      targetUnitId: target0.id,
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('魔力不足')
  })

  it('DISABLE_UNIT_ACTIONS: item_nether_seal adds target unit to sealedUnitIds (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side
    const enemySide = side === 'red' ? 'black' : 'red'

    const target0 = Object.values(s0.units).find((u) => u.side === enemySide && u.base === 'rook')
    if (!target0) throw new Error('Missing enemy target unit')

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'combat' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_nether_seal'],
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        sealedUnitIds: [],
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_nether_seal', targetUnitId: target0.id })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_nether_seal')
    expect(after.turnFlags.sealedUnitIds).toContain(target0.id)
  })

  it('GRANT_REVIVE_BONUS: item_last_stand_contract increments lastStandContractBonus (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'necro' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_last_stand_contract'],
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        lastStandContractBonus: 0,
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_last_stand_contract' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_last_stand_contract')
    expect(after.turnFlags.lastStandContractBonus).toBeGreaterThanOrEqual(1)
  })

  it('PLUNDER_CAGE_SOUL: item_cage_plunder requires enemy souls >=1 and own souls < soulHandMax', () => {
    const s0 = createInitialState()
    const side = s0.turn.side
    const enemySide = side === 'red' ? 'black' : 'red'

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'buy' as const },
      hands: {
        ...s0.hands,
        [side]: { ...s0.hands[side], items: ['item_cage_plunder'], souls: [] },
        [enemySide]: { ...s0.hands[enemySide], souls: [] },
      },
    }

    const rBlocked = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_cage_plunder' })
    expect(rBlocked.ok).toBe(false)

    const okState = {
      ...baseState,
      hands: {
        ...baseState.hands,
        [enemySide]: { ...baseState.hands[enemySide], souls: ['dark_moon_rook_lanhua'] },
      },
    }

    const rOk = reduce(okState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_cage_plunder' })
    expect(rOk.ok).toBe(true)
    if (!rOk.ok) return

    const after = rOk.state
    expect(after.itemDiscard).toContain('item_cage_plunder')
    expect(after.hands[side].souls.length).toBe(1)
    expect(after.hands[enemySide].souls.length).toBe(0)
  })

  it('PLUNDER_CAGE_SOUL: item_cage_plunder uses rngState in seeded mode (deterministic)', () => {
    const rng0 = createRngState('seed-plunder-1')
    const s0 = createInitialState({ rules: { rngMode: 'seeded', matchSeed: 'seed-plunder-1' } as any })
    const side = s0.turn.side
    const enemySide = side === 'red' ? 'black' : 'red'

    const enemySouls = ['dark_moon_rook_lanhua', 'dark_moon_rook_yinghua', 'dark_moon_rook_lanhua']
    const expectedIdx = nextU32({ x: rng0.x }) % enemySouls.length
    const expectedStolen = enemySouls[expectedIdx]!

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'buy' as const },
      hands: {
        ...s0.hands,
        [side]: { ...s0.hands[side], items: ['item_cage_plunder'], souls: [] },
        [enemySide]: { ...s0.hands[enemySide], souls: enemySouls },
      },
      rngState: { x: rng0.x },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_cage_plunder' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.hands[side].souls).toContain(expectedStolen)
    expect(after.hands[enemySide].souls.length).toBe(enemySouls.length - 1)
    expect(after.rngState?.x).not.toBe(baseState.rngState.x)
  })

  it('DETACH_SOUL: item_dead_return_path strips allied enchanted unit and returns soul to ally cage', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const target0 = Object.values(s0.units).find((u) => u.side === side && u.base === 'rook')
    if (!target0) throw new Error('Missing allied target')

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'necro' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_dead_return_path'],
          souls: [],
        },
      },
      units: {
        ...s0.units,
        [target0.id]: {
          ...target0,
          hpCurrent: 1,
          enchant: { soulId: 'dark_moon_rook_lanhua' },
        },
      },
    }

    const res = reduce(baseState as any, {
      type: 'USE_ITEM_FROM_HAND',
      itemId: 'item_dead_return_path',
      targetUnitId: target0.id,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_dead_return_path')
    expect(after.units[target0.id]!.enchant).toBeUndefined()
    expect(after.units[target0.id]!.hpCurrent).toBeGreaterThan(1)
    expect(after.hands[side].souls).toContain('dark_moon_rook_lanhua')
  })

  it('DETACH_SOUL: item_soul_detach_needle strips enemy enchanted unit and returns soul to enemy cage', () => {
    const s0 = createInitialState()
    const side = s0.turn.side
    const enemySide = side === 'red' ? 'black' : 'red'

    const target0 = Object.values(s0.units).find((u) => u.side === enemySide && u.base === 'rook')
    if (!target0) throw new Error('Missing enemy target')

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'necro' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_soul_detach_needle'],
        },
        [enemySide]: {
          ...s0.hands[enemySide],
          souls: [],
        },
      },
      units: {
        ...s0.units,
        [target0.id]: {
          ...target0,
          hpCurrent: 1,
          enchant: { soulId: 'dark_moon_rook_yinghua' },
        },
      },
    }

    const res = reduce(baseState as any, {
      type: 'USE_ITEM_FROM_HAND',
      itemId: 'item_soul_detach_needle',
      targetUnitId: target0.id,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_soul_detach_needle')
    expect(after.units[target0.id]!.enchant).toBeUndefined()
    expect(after.hands[enemySide].souls).toContain('dark_moon_rook_yinghua')
  })

  it('ON_KILL_GAIN_RESOURCE: item_death_chain sets deathChainActive (via abilities executor)', () => {
    const s0 = createInitialState()
    const side = s0.turn.side

    const baseState = {
      ...s0,
      turn: { ...s0.turn, phase: 'combat' as const },
      hands: {
        ...s0.hands,
        [side]: {
          ...s0.hands[side],
          items: ['item_death_chain'],
        },
      },
      turnFlags: {
        ...s0.turnFlags,
        deathChainActive: false,
        deathChainKillCount: 0,
      },
    }

    const res = reduce(baseState as any, { type: 'USE_ITEM_FROM_HAND', itemId: 'item_death_chain' })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    const after = res.state
    expect(after.itemDiscard).toContain('item_death_chain')
    expect(after.turnFlags.deathChainActive).toBe(true)
    expect(after.turnFlags.onKillGainResource).toEqual({ resource: 'mana', amount: 1, perTurnCap: 3 })
  })
})
