import type { Event } from './events'
import type { UseItemFromHandAction } from './actions'
import type { GameState } from './state'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import type { ItemAbilityTarget } from './items'
import { refillDisplayByBase, BASE_STATS } from './state'
import type { PieceBase } from './types'
import { nextU32, type RngState } from '../serverSim'

type ItemReduceResult =
  | { ok: true; state: GameState; events: Event[] }
  | { ok: false; error: string }

type ItemAbilityExecResult =
  | { ok: true; state: GameState; events: Event[] }
  | { ok: false; error: string }
  | { ok: false; unsupported: true; abilityType?: string; reason?: string }

function applyFirstItemUseIfGoldLtGainGold(state: GameState, events: Event[]): GameState {
  const side = state.turn.side
  let nextState = state

  for (const u of Object.values(state.units)) {
    if (u.side !== side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    for (const ab of card.abilities) {
      if (ab.type !== 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD') continue
      const perTurn = Number(ab.perTurn ?? 1)
      const threshold = Number(ab.threshold ?? 0)
      const amount = Number(ab.amount ?? 0)
      if (!(Number.isFinite(perTurn) && perTurn > 0)) continue
      if (!(Number.isFinite(threshold) && threshold > 0)) continue
      if (!(Number.isFinite(amount) && amount > 0)) continue

      const key = `${u.id}:FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD`
      const used = Number(nextState.turnFlags.abilityUsed?.[key] ?? 0)
      if (used >= perTurn) continue
      const r = nextState.resources[side]
      if (r.gold >= threshold) continue
      const gained = Math.floor(amount)
      const nextGold = Math.min(nextState.limits.goldMax, r.gold + gained)
      nextState = {
        ...nextState,
        resources: { ...nextState.resources, [side]: { ...r, gold: nextGold } },
        turnFlags: {
          ...nextState.turnFlags,
          abilityUsed: { ...(nextState.turnFlags.abilityUsed ?? {}), [key]: used + 1 },
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: u.id, abilityType: 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD', text: `回扣 +${gained}G` })
      events.push({ type: 'RESOURCES_CHANGED', side, gold: nextState.resources[side].gold, mana: nextState.resources[side].mana, storageMana: nextState.resources[side].storageMana })
    }
  }

  return nextState
}

function resolveTargetUnit(
  state: GameState,
  action: UseItemFromHandAction,
  targetSpec: ItemAbilityTarget | undefined,
): { ok: true; unitId: string; unit: GameState['units'][string] } | { ok: false; error: string } | { ok: false; unsupported: true; reason: string } {
  if (!action.targetUnitId) return { ok: false, error: '需要目標單位' }
  const unit = state.units[action.targetUnitId]
  if (!unit) return { ok: false, error: '找不到單位' }

  const targetType = targetSpec?.type ?? ''
  if (!targetType) return { ok: false, unsupported: true, reason: 'target.type 必填' }
  const needsEnchant = targetType === 'ALLY_ENCHANTED_UNIT' || targetType === 'ENEMY_ENCHANTED_UNIT'
  if (needsEnchant && !unit.enchant) return { ok: false, error: '該單位未附魔' }
  if (targetType === 'ALLY_UNIT' || targetType === 'ALLY_ENCHANTED_UNIT') {
    if (unit.side !== state.turn.side) return { ok: false, error: '只能選擇己方單位' }
    return { ok: true, unitId: action.targetUnitId, unit }
  }
  if (targetType === 'ENEMY_UNIT' || targetType === 'ENEMY_ENCHANTED_UNIT') {
    if (unit.side === state.turn.side) return { ok: false, error: '只能選擇敵方單位' }
    return { ok: true, unitId: action.targetUnitId, unit }
  }
  return { ok: false, unsupported: true, reason: `target.type 未支援: ${targetType}` }
}

function executeItemAbilitiesA1(
  state: GameState,
  action: UseItemFromHandAction,
  item: ReturnType<typeof getItemCard>,
): ItemAbilityExecResult {
  if (!item) return { ok: false, error: '找不到道具卡' }
  const abs = item.abilities
  if (!Array.isArray(abs) || abs.length === 0) return { ok: false, unsupported: true, reason: '沒有 abilities' }

  let nextState = state
  const events: Event[] = []

  for (const ab of abs as any[]) {
    const type = String(ab?.type ?? '')
    if (!type) return { ok: false, error: '道具 abilities 缺少 type' }

    if (type === 'HEAL_UNIT') {
      const amount = Math.floor(Number(ab?.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'HEAL_UNIT amount 無效' }
      const targetRes = resolveTargetUnit(nextState, action, ab?.target)
      if (!targetRes.ok) {
        if ('unsupported' in targetRes) return { ok: false, unsupported: true, abilityType: type, reason: targetRes.reason }
        if ('error' in targetRes) return { ok: false, error: targetRes.error }
        return { ok: false, error: '目標解析失敗' }
      }
      const unit = targetRes.unit
      const baseStats = BASE_STATS[unit.base]
      const hpMax = unit.enchant ? (getSoulCard(unit.enchant.soulId)?.stats.hp ?? baseStats.hp) : baseStats.hp
      const capToMaxHp = ab?.capToMaxHp === true
      const from = unit.hpCurrent
      const to = capToMaxHp ? Math.min(hpMax, unit.hpCurrent + amount) : (unit.hpCurrent + amount)
      nextState = {
        ...nextState,
        units: { ...nextState.units, [unit.id]: { ...unit, hpCurrent: to } },
      }
      events.push({ type: 'UNIT_HP_CHANGED', unitId: unit.id, from, to, reason: item.name })
      continue
    }

    if (type === 'GRANT_FREE_SHOOT') {
      const amount = Math.floor(Number(ab?.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'GRANT_FREE_SHOOT amount 無效' }
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          freeShootBonus: (nextState.turnFlags.freeShootBonus ?? 0) + amount,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'DETACH_SOUL') {
      const targetRes = resolveTargetUnit(nextState, action, ab?.target)
      if (!targetRes.ok) {
        if ('unsupported' in targetRes) return { ok: false, unsupported: true, abilityType: type, reason: targetRes.reason }
        if ('error' in targetRes) return { ok: false, error: targetRes.error }
        return { ok: false, error: '目標解析失敗' }
      }
      const target = targetRes.unit
      if (!target.enchant) return { ok: false, error: '該單位未附魔' }

      const strippedSoulId = target.enchant.soulId
      const baseStats = BASE_STATS[target.base]
      const resetToBaseStats = ab?.resetUnit?.toBaseStats === true
      const healToFull = ab?.resetUnit?.healToFull === true
      if (!(resetToBaseStats && healToFull)) {
        return { ok: false, unsupported: true, abilityType: type, reason: 'resetUnit 目前僅支援 toBaseStats+healToFull' }
      }

      const strippedUnit = {
        ...target,
        hpCurrent: baseStats.hp,
        atk: { key: baseStats.atkKey, value: baseStats.atk },
        def: baseStats.def.map((d) => ({ ...d })),
        enchant: undefined,
      }

      const returnToType = String(ab?.returnTo?.type ?? '')
      if (returnToType !== 'ALLY_CAGE' && returnToType !== 'ENEMY_CAGE') {
        return { ok: false, unsupported: true, abilityType: type, reason: `returnTo.type 未支援: ${returnToType}` }
      }
      const cageSide = returnToType === 'ALLY_CAGE' ? nextState.turn.side : target.side

      nextState = {
        ...nextState,
        units: { ...nextState.units, [target.id]: strippedUnit },
        hands: {
          ...nextState.hands,
          [cageSide]: {
            ...nextState.hands[cageSide],
            souls: [...nextState.hands[cageSide].souls, strippedSoulId],
          },
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: target.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'DISABLE_UNIT_ACTIONS') {
      const targetRes = resolveTargetUnit(nextState, action, ab?.target)
      if (!targetRes.ok) {
        if ('unsupported' in targetRes) return { ok: false, unsupported: true, abilityType: type, reason: targetRes.reason }
        if ('error' in targetRes) return { ok: false, error: targetRes.error }
        return { ok: false, error: '目標解析失敗' }
      }
      const targetUnitId = targetRes.unitId

      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          sealedUnitIds: [...(nextState.turnFlags.sealedUnitIds ?? []), targetUnitId],
        },
      }
      events.push({ type: 'ABILITY_TRIGGERED', unitId: targetUnitId, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'REMOVE_CORPSE') {
      if (!action.targetPos) return { ok: false, error: '需要目標位置' }
      const posKey = `${action.targetPos.x},${action.targetPos.y}`
      const stack = nextState.corpsesByPos[posKey]
      if (!stack || stack.length === 0) return { ok: false, error: '該位置沒有屍骸' }
      let topIdx = -1
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]?.ownerSide === nextState.turn.side) {
          topIdx = i
          break
        }
      }
      if (topIdx < 0) return { ok: false, error: '沒有己方屍骸' }
      const nextStack = stack.slice(0, topIdx).concat(stack.slice(topIdx + 1))
      const nextCorpsesByPos = { ...nextState.corpsesByPos }
      if (nextStack.length === 0) delete nextCorpsesByPos[posKey]
      else nextCorpsesByPos[posKey] = nextStack
      nextState = { ...nextState, corpsesByPos: nextCorpsesByPos }
      continue
    }

    if (type === 'CHOICE_GAIN_RESOURCE') {
      const choice = String(action.choice ?? '')
      if (choice !== 'gold' && choice !== 'mana') return { ok: false, error: '需要選擇增益' }
      const opts = (ab?.options ?? []) as Array<{ resource: string; amount: number }>
      if (!Array.isArray(opts) || opts.length === 0) return { ok: false, error: 'CHOICE_GAIN_RESOURCE options 無效' }
      const picked = opts.find((o) => String(o?.resource ?? '') === choice)
      if (!picked) return { ok: false, error: 'CHOICE_GAIN_RESOURCE 選項無效' }
      const amount = Math.floor(Number(picked.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'CHOICE_GAIN_RESOURCE amount 無效' }
      const side = nextState.turn.side
      const r = nextState.resources[side]
      const nextR = choice === 'gold'
        ? { ...r, gold: Math.min(r.gold + amount, nextState.limits.goldMax) }
        : { ...r, mana: Math.min(r.mana + amount, nextState.limits.manaMax) }
      nextState = {
        ...nextState,
        resources: { ...nextState.resources, [side]: nextR },
      }
      events.push({
        type: 'RESOURCES_CHANGED',
        side,
        gold: nextState.resources[side].gold,
        mana: nextState.resources[side].mana,
        storageMana: nextState.resources[side].storageMana,
      })
      continue
    }

    if (type === 'PLUNDER_CAGE_SOUL') {
      const amount = Math.floor(Number(ab?.amount ?? 1))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'PLUNDER_CAGE_SOUL amount 無效' }
      if (amount !== 1) return { ok: false, unsupported: true, abilityType: type, reason: `amount 未支援: ${amount}` }

      const side = nextState.turn.side
      const enemySide = side === 'red' ? 'black' : 'red'
      const enemySouls = nextState.hands[enemySide].souls
      if (enemySouls.length < 1) return { ok: false, error: '敵方牢籠沒有靈魂卡' }
      if (nextState.hands[side].souls.length >= nextState.limits.soulHandMax) return { ok: false, error: `己方牢籠已滿（${nextState.limits.soulHandMax}張），無法發動` }

      const rngState: RngState | null = nextState.rules.rngMode === 'seeded'
        ? (nextState.rngState ? { x: nextState.rngState.x } : null)
        : null
      const idx = rngState
        ? (nextU32(rngState) % enemySouls.length)
        : Math.floor(Math.random() * enemySouls.length)
      const stolen = enemySouls[idx]
      nextState = {
        ...nextState,
        hands: {
          ...nextState.hands,
          [enemySide]: { ...nextState.hands[enemySide], souls: enemySouls.filter((_, i) => i !== idx) },
          [side]: { ...nextState.hands[side], souls: [...nextState.hands[side].souls, stolen] },
        },
      }
      if (rngState) {
        nextState = {
          ...nextState,
          rngState: { x: rngState.x },
        }
      }

      const king = Object.values(nextState.units).find((u) => u.side === side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'REFRESH_ITEM_DISPLAY') {
      // Refresh item display: move existing items to discard, draw new ones
      let s = nextState
      for (let slot = 0; slot < s.itemDisplay.length; slot++) {
        const cur = s.itemDisplay[slot]
        if (cur != null) {
          const nextDisplay = s.itemDisplay.slice()
          nextDisplay[slot] = null
          s = { ...s, itemDisplay: nextDisplay, itemDiscard: [...s.itemDiscard, cur] }
        }
      }
      for (let slot = 0; slot < s.itemDisplay.length; slot++) {
        if (s.itemDisplay[slot] == null && s.itemDeck.length > 0) {
          const nextDeck = s.itemDeck.slice()
          const drawn = nextDeck.shift() ?? null
          const nextDisplay = s.itemDisplay.slice()
          nextDisplay[slot] = drawn
          s = { ...s, itemDeck: nextDeck, itemDisplay: nextDisplay }
        }
      }
      nextState = s
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'REFRESH_SOUL_DISPLAY_ALL') {
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
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'GAIN_NECRO_ACTION') {
      const amount = Math.floor(Number(ab?.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'GAIN_NECRO_ACTION amount 無效' }
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          itemNecroBonus: (nextState.turnFlags.itemNecroBonus ?? 0) + amount,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'ENCHANT_GOLD_DISCOUNT') {
      const amount = Math.floor(Number(ab?.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'ENCHANT_GOLD_DISCOUNT amount 無效' }
      const scope = String(ab?.scope ?? 'NEXT_ENCHANT')
      if (scope !== 'NEXT_ENCHANT') return { ok: false, error: `ENCHANT_GOLD_DISCOUNT scope 未支援: ${scope}` }
      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          enchantGoldDiscount: (nextState.turnFlags.enchantGoldDiscount ?? 0) + amount,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'GRANT_REVIVE_BONUS') {
      const amount = Math.floor(Number(ab?.amount ?? 0))
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'GRANT_REVIVE_BONUS amount 無效' }

      // Match existing legacy behavior: just mark contract bonus and let REVIVE reducer consume it.
      // We only support the "free + ignoreNecroActionLimit" flavor for now.
      const free = ab?.revive?.free === true
      const ignoreNecro = ab?.revive?.ignoreNecroActionLimit === true
      if (!(free && ignoreNecro)) {
        return { ok: false, unsupported: true, abilityType: type, reason: 'revive 目前僅支援 free+ignoreNecroActionLimit' }
      }

      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          lastStandContractBonus: (nextState.turnFlags.lastStandContractBonus ?? 0) + amount,
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    if (type === 'ON_KILL_GAIN_RESOURCE') {
      const resource = String(ab?.resource ?? '')
      const amount = Math.floor(Number(ab?.amount ?? 0))
      const perTurnCap = Math.floor(Number(ab?.perTurnCap ?? 0))

      if (!resource) return { ok: false, error: 'ON_KILL_GAIN_RESOURCE resource 無效' }
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'ON_KILL_GAIN_RESOURCE amount 無效' }
      if (!Number.isFinite(perTurnCap) || perTurnCap <= 0) return { ok: false, error: 'ON_KILL_GAIN_RESOURCE perTurnCap 無效' }

      nextState = {
        ...nextState,
        turnFlags: {
          ...nextState.turnFlags,
          // Backward compatible: existing reducer hooks still look at deathChainActive/deathChainKillCount.
          deathChainActive: true,
          onKillGainResource: { resource, amount, perTurnCap },
        },
      }
      const king = Object.values(nextState.units).find((u) => u.side === nextState.turn.side && u.base === 'king')
      if (king) events.push({ type: 'ABILITY_TRIGGERED', unitId: king.id, abilityType: action.itemId, text: item.name })
      continue
    }

    return { ok: false, unsupported: true, abilityType: type, reason: 'ability type 未實作' }
  }

  return { ok: true, state: nextState, events }
}

export function reduceUseItem(state: GameState, action: UseItemFromHandAction): ItemReduceResult {
  const side = state.turn.side
  const hand = state.hands[side].items
  if (!hand.includes(action.itemId)) return { ok: false, error: '道具卡不在手牌中' }
  const item = getItemCard(action.itemId)
  if (!item) return { ok: false, error: '找不到道具卡' }
  const limitPerTurn = Number(item.limitPerTurn ?? 0)
  if (Number.isFinite(limitPerTurn) && limitPerTurn > 0) {
    const used = Number(state.turnFlags.itemUsedByItemId?.[action.itemId] ?? 0)
    if (used >= limitPerTurn) return { ok: false, error: '此道具本回合已達使用上限' }
  }

  const timing = item.timing
  if (timing === 'buy' && state.turn.phase !== 'buy') return { ok: false, error: '此道具只能在購買階段使用' }
  if (timing === 'necro' && state.turn.phase !== 'necro') return { ok: false, error: '此道具只能在死靈術階段使用' }
  if (timing === 'combat' && state.turn.phase !== 'combat') return { ok: false, error: '此道具只能在戰鬥階段使用' }

  const removeIdx = hand.indexOf(action.itemId)
  const nextHand = [...hand.slice(0, removeIdx), ...hand.slice(removeIdx + 1)]
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

  // A1 executor: prefer item.abilities[] if supported, otherwise fallback to legacy switch-case.
  const execRes = executeItemAbilitiesA1(nextState, action, item)
  if (execRes.ok) {
    const mergedEvents = [...events, ...execRes.events]
    let finalState = execRes.state
    if (Number.isFinite(limitPerTurn) && limitPerTurn > 0) {
      const used = Number(finalState.turnFlags.itemUsedByItemId?.[action.itemId] ?? 0)
      finalState = {
        ...finalState,
        turnFlags: {
          ...finalState.turnFlags,
          itemUsedByItemId: {
            ...(finalState.turnFlags.itemUsedByItemId ?? {}),
            [action.itemId]: used + 1,
          },
        },
      }
    }
    finalState = applyFirstItemUseIfGoldLtGainGold(finalState, mergedEvents)
    return { ok: true, state: finalState, events: mergedEvents }
  }
  if (!execRes.ok && 'unsupported' in execRes) {
    const detail = execRes.abilityType ? ` (${execRes.abilityType}${execRes.reason ? `: ${execRes.reason}` : ''})` : (execRes.reason ? ` (${execRes.reason})` : '')
    return { ok: false, error: `道具 abilities 尚未支援: ${action.itemId}${detail}` }
  }
  if ('error' in execRes) return { ok: false, error: execRes.error }
  return { ok: false, error: '道具 abilities 執行失敗' }
}
