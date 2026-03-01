import type { Event } from './events'
import { BASE_STATS, refillDisplayByBase, type GameState } from './state'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import type { PieceBase } from './types'
import { HOLY_GRAIL_HEAL_AMOUNT } from './gameConfig'
import type { UseItemFromHandAction } from './actions'

type ItemReduceResult =
  | { ok: true; state: GameState; events: Event[] }
  | { ok: false; error: string }

export function reduceUseItem(state: GameState, action: UseItemFromHandAction): ItemReduceResult {
  const side = state.turn.side
  const hand = state.hands[side].items
  if (!hand.includes(action.itemId)) return { ok: false, error: 'Item not in hand' }
  const item = getItemCard(action.itemId)
  if (!item) return { ok: false, error: 'Item not found' }

  const timing = item.timing
  if (timing === 'buy' && state.turn.phase !== 'buy') return { ok: false, error: 'Must be in buy phase' }
  if (timing === 'necro' && state.turn.phase !== 'necro') return { ok: false, error: 'Must be in necro phase' }
  if (timing === 'combat' && state.turn.phase !== 'combat') return { ok: false, error: 'Must be in combat phase' }

  const nextHand = hand.filter((id) => id !== action.itemId)
  let nextState: GameState = {
    ...state,
    itemDiscard: [...state.itemDiscard, action.itemId],
    hands: {
      ...state.hands,
      [side]: { ...state.hands[side], items: nextHand },
    },
  }
  const events: Event[] = []
  events.push({ type: 'ITEM_USED', side, itemId: action.itemId, itemName: item.name })

  switch (action.itemId) {
    case 'item_lingxue_holy_grail': {
      if (!action.targetUnitId) return { ok: false, error: '需要目標單位' }
      const unit = nextState.units[action.targetUnitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== side) return { ok: false, error: '只能選擇己方單位' }
      const baseStats = BASE_STATS[unit.base]
      const hpMax = unit.enchant ? (getSoulCard(unit.enchant.soulId)?.stats.hp ?? baseStats.hp) : baseStats.hp
      const from = unit.hpCurrent
      const to = Math.min(hpMax, unit.hpCurrent + HOLY_GRAIL_HEAL_AMOUNT)
      nextState = {
        ...nextState,
        units: { ...nextState.units, [unit.id]: { ...unit, hpCurrent: to } },
      }
      events.push({ type: 'UNIT_HP_CHANGED', unitId: unit.id, from, to, reason: '靈血聖杯' })
      break
    }
    case 'item_bone_refine': {
      if (!action.targetPos) return { ok: false, error: '需要目標位置' }
      if (!action.choice) return { ok: false, error: '需要選擇增益' }
      const posKey = `${action.targetPos.x},${action.targetPos.y}`
      const stack = nextState.corpsesByPos[posKey]
      if (!stack || stack.length === 0) return { ok: false, error: '該位置沒有屍骸' }
      const topIdx = stack.length - 1
      const topCorpse = stack[topIdx]
      if (!topCorpse || topCorpse.ownerSide !== side) return { ok: false, error: '沒有己方屍骸' }
      const nextStack = stack.slice(0, topIdx)
      const nextCorpsesByPos = { ...nextState.corpsesByPos }
      if (nextStack.length === 0) delete nextCorpsesByPos[posKey]
      else nextCorpsesByPos[posKey] = nextStack
      const goldAmt = item.effect?.goldAmount ?? 9
      const manaAmt = item.effect?.manaAmount ?? 2
      const r = nextState.resources[side]
      const nextR = action.choice === 'gold'
        ? { ...r, gold: Math.min(r.gold + goldAmt, nextState.limits.goldMax) }
        : { ...r, mana: Math.min(r.mana + manaAmt, nextState.limits.manaMax) }
      nextState = {
        ...nextState,
        corpsesByPos: nextCorpsesByPos,
        resources: { ...nextState.resources, [side]: nextR },
      }
      events.push({
        type: 'RESOURCES_CHANGED',
        side,
        gold: nextState.resources[side].gold,
        mana: nextState.resources[side].mana,
        storageMana: nextState.resources[side].storageMana,
      })
      break
    }
    case 'item_dead_return_path': {
      if (!action.targetUnitId) return { ok: false, error: '需要目標單位' }
      const unit = nextState.units[action.targetUnitId]
      if (!unit) return { ok: false, error: 'Unit not found' }
      if (unit.side !== side) return { ok: false, error: '只能選擇己方單位' }
      if (!unit.enchant) return { ok: false, error: '該單位未附魔' }
      const strippedSoulId = unit.enchant.soulId
      const baseStats = BASE_STATS[unit.base]
      const strippedUnit = {
        ...unit,
        hpCurrent: baseStats.hp,
        atk: { key: baseStats.atkKey, value: baseStats.atk },
        def: baseStats.def.map((d) => ({ ...d })),
        enchant: undefined,
      }
      nextState = {
        ...nextState,
        units: { ...nextState.units, [unit.id]: strippedUnit },
        hands: {
          ...nextState.hands,
          [side]: {
            ...nextState.hands[side],
            souls: [...nextState.hands[side].souls, strippedSoulId],
          },
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: unit.id, abilityType: 'dead_return_path', text: '靈魂剝離' })
      break
    }
    case 'item_wizard_greed': {
      const bases: PieceBase[] = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier']
      let s = nextState
      for (const base of bases) {
        const cur = s.displayByBase[base]
        if (cur != null) {
          const deck = s.soulDeckByBase[base] ?? []
          s = {
            ...s,
            soulDeckByBase: { ...s.soulDeckByBase, [base]: [...deck, cur] },
            displayByBase: { ...s.displayByBase, [base]: null },
          }
        }
        s = refillDisplayByBase(s, base)
      }
      nextState = s
      break
    }
    case 'item_soul_infusion': {
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          itemNecroBonus: (nextState.turnFlags.itemNecroBonus ?? 0) + 1,
          enchantGoldDiscount: (nextState.turnFlags.enchantGoldDiscount ?? 0) + 1,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'soul_infusion', text: '+死靈術' })
      break
    }
    case 'item_soul_overload': {
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          freeShootBonus: (nextState.turnFlags.freeShootBonus ?? 0) + 1,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'soul_overload', text: '魂能超載' })
      break
    }
    case 'item_last_stand_contract': {
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          lastStandContractBonus: (nextState.turnFlags.lastStandContractBonus ?? 0) + 1,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'last_stand_contract', text: '死戰契約' })
      break
    }
    case 'item_dark_moon_scope': {
      nextState = {
        ...nextState,
        turnFlags: { ...nextState.turnFlags, darkMoonScopeActive: true },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'dark_moon_scope', text: '暗月窺視' })
      break
    }
    case 'item_death_chain': {
      nextState = {
        ...nextState,
        turnFlags: { ...nextState.turnFlags, deathChainActive: true },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'death_chain', text: '死亡連鎖' })
      break
    }
    case 'item_nether_seal': {
      if (!action.targetUnitId) return { ok: false, error: '需要目標單位' }
      const target = nextState.units[action.targetUnitId]
      if (!target) return { ok: false, error: 'Unit not found' }
      if (target.side === side) return { ok: false, error: '只能封印敵方單位' }
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          sealedUnitIds: [...(nextState.turnFlags.sealedUnitIds ?? []), action.targetUnitId],
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: action.targetUnitId, abilityType: 'nether_seal', text: '冥鎖封印' })
      break
    }
    case 'item_cage_plunder': {
      const enemySide = side === 'red' ? 'black' : 'red'
      const enemySouls = nextState.hands[enemySide].souls
      if (enemySouls.length === 0) return { ok: false, error: '敵方牢籠沒有靈魂卡' }
      if (nextState.hands[side].souls.length >= 5) return { ok: false, error: '己方牢籠已有 5 張' }
      const idx = Math.floor(Math.random() * enemySouls.length)
      const stolen = enemySouls[idx]
      nextState = {
        ...nextState,
        hands: {
          ...nextState.hands,
          [enemySide]: { ...nextState.hands[enemySide], souls: enemySouls.filter((_, i) => i !== idx) },
          [side]: { ...nextState.hands[side], souls: [...nextState.hands[side].souls, stolen] },
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: 'cage_plunder', text: '牢籠掠奪' })
      break
    }
    case 'item_soul_detach_needle': {
      if (!action.targetUnitId) return { ok: false, error: '需要目標單位' }
      const target = nextState.units[action.targetUnitId]
      if (!target) return { ok: false, error: 'Unit not found' }
      if (target.side === side) return { ok: false, error: '只能選擇敵方單位' }
      if (!target.enchant) return { ok: false, error: '該單位未附魔' }
      const enemySide = target.side
      const strippedSoulId = target.enchant.soulId
      const baseStats = BASE_STATS[target.base]
      const strippedUnit = {
        ...target,
        hpCurrent: baseStats.hp,
        atk: { key: baseStats.atkKey, value: baseStats.atk },
        def: baseStats.def.map((d) => ({ ...d })),
        enchant: undefined,
      }
      nextState = {
        ...nextState,
        units: { ...nextState.units, [target.id]: strippedUnit },
        hands: {
          ...nextState.hands,
          [enemySide]: {
            ...nextState.hands[enemySide],
            souls: [...nextState.hands[enemySide].souls, strippedSoulId],
          },
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: target.id, abilityType: 'soul_detach_needle', text: '靈魂剝離' })
      break
    }
    default:
      return { ok: false, error: `道具效果未實作: ${action.itemId}` }
  }

  return { ok: true, state: nextState, events }
}
