import type { Action } from './actions'
import type { Event } from './events'
import { isOnBoard } from './types'
import type { Side } from './types'
import type { GameState } from './state'
import { getUnitAt, BASE_STATS, getReviveGoldCost, refillDisplayByBase } from './state'
import { FREE_SHOOT_MANA_SENTINEL, DEATH_CHAIN_MAX_KILLS } from './gameConfig'
import { reduceUseItem } from './itemReducers'
import { isLegalMove } from './legalMoves'
import { buildShotPlan, executeShotPlan } from './shotPlan'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import { killUnit } from './kill'
import { canSacrifice } from './guards'
import { getMaxHpForUnitInState } from './stats'

export type ReduceOk = {
  ok: true
  state: GameState
  events: Event[]
}

function refillItemDisplay(state: GameState, slot: number): GameState {
  const cur = state.itemDisplay[slot]
  if (cur != null) return state
  if (state.itemDeck.length === 0) return state

  const nextDeck = [...state.itemDeck]
  const nextItemId = nextDeck.shift() ?? null
  const nextDisplay = state.itemDisplay.slice()
  nextDisplay[slot] = nextItemId

  return {
    ...state,
    itemDeck: nextDeck,
    itemDisplay: nextDisplay,
  }
}

export type ReduceErr = {
  ok: false
  error: string
}

export type ReduceResult = ReduceOk | ReduceErr

function applyFirstAttackIfGoldLtGainGold(state: GameState, attackerId: string, events: Event[]): GameState {
  const attacker = state.units[attackerId]
  if (!attacker) return state
  const side = attacker.side

  let nextState = state

  // Check all ally units for FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD (self or global scope)
  for (const auraUnit of Object.values(nextState.units)) {
    if (auraUnit.side !== side) continue
    const soulId = auraUnit.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    for (const ab of card.abilities as any[]) {
      if (ab.type !== 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD') continue
      const scope = String(ab.scope ?? 'self')
      // self scope: only triggers when this unit itself attacks
      if (scope === 'self' && auraUnit.id !== attackerId) continue
      const perTurn = Number(ab.perTurn ?? 1)
      const threshold = Number(ab.threshold ?? 0)
      const amount = Number(ab.amount ?? 0)
      if (!(Number.isFinite(perTurn) && perTurn > 0)) continue
      if (!(Number.isFinite(threshold) && threshold > 0)) continue
      if (!(Number.isFinite(amount) && amount > 0)) continue

      // global scope uses side-level key (one trigger per turn regardless of which unit attacks)
      const key = scope === 'global'
        ? `${auraUnit.id}:FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD:global`
        : `${attackerId}:FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD`
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
      events.push({ type: 'ABILITY_TRIGGERED', unitId: auraUnit.id, abilityType: 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD', text: `逐利 +${gained}G` })
      events.push({ type: 'RESOURCES_CHANGED', side, gold: nextState.resources[side].gold, mana: nextState.resources[side].mana, storageMana: nextState.resources[side].storageMana })
    }
  }

  return nextState
}

function applyAuraStatHpHealOnceAfterNecroAction(state: GameState, events: Event[]): GameState {
  // Conservative: only heals after ENCHANT / REVIVE, and only once per (auraUnitId -> targetUnitId).
  const used = state.status.auraStatHpHealUsedByKey ?? {}
  let nextState = state
  let nextUsed: Record<string, true> | null = null

  function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
    if (pos.x < 3 || pos.x > 5) return false
    if (side === 'red') return pos.y >= 7 && pos.y <= 9
    return pos.y >= 0 && pos.y <= 2
  }

  function crossedRiver(side: 'red' | 'black', y: number): boolean {
    return side === 'red' ? y <= 4 : y >= 5
  }

  function isResonanceActive(s: GameState, sourceUnitId: string, need: number, clan: string): boolean {
    if (!Number.isFinite(need) || need <= 0) return false
    const source = s.units[sourceUnitId]
    if (!source) return false
    let count = 0
    for (const u of Object.values(s.units)) {
      if (u.side !== source.side) continue
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const c = getSoulCard(soulId)
      if (!c) continue
      if (c.clan !== clan) continue
      count++
    }
    return count >= need
  }

  function auraWhenOk(s: GameState, auraUnit: any, when: any, clanFallback: string): boolean {
    const type = String(when?.type ?? '')
    if (!type) return true
    if (type === 'SOURCE_IN_PALACE') return palaceContains(auraUnit.side, auraUnit.pos)
    if (type === 'CORPSES_GTE') {
      const need = Number(when?.count ?? 0)
      if (!(Number.isFinite(need) && need > 0)) return false
      // countCorpses is in reduce.ts already via other systems; for conservative healing we only support resonance here.
      // If you need CORPSES_GTE for healCurrent, we can extend later.
      return false
    }
    if (type === 'RESONANCE_ACTIVE') {
      const soulId = auraUnit.enchant?.soulId
      const card = soulId ? getSoulCard(soulId) : undefined
      const res = card?.abilities.find((a) => a.type === 'RESONANCE') as any
      const need = Number(res?.need ?? 0)
      const resClan = String(res?.clan ?? '')
      return isResonanceActive(s, auraUnit.id, need, resClan || clanFallback)
    }
    return true
  }

  function auraForKeysOk(targetUnit: any, ab: any): boolean {
    const forRaw = ab?.for
    const forKeys = Array.isArray(forRaw) ? forRaw.map((x: any) => String(x ?? '')).filter(Boolean) : [String(forRaw ?? '')].filter(Boolean)
    if (forKeys.length === 0) return false
    for (const forKey of forKeys) {
      if (forKey === 'ALLIES_IN_PALACE') {
        if (!palaceContains(targetUnit.side, targetUnit.pos)) return false
        continue
      }
      if (forKey === 'CROSS_RIVER_UNITS') {
        if (!crossedRiver(targetUnit.side, targetUnit.pos.y)) return false
        continue
      }
      if (forKey === 'CLAN') {
        const clan = String(ab?.clan ?? '')
        if (!clan) return false
        const soulId = targetUnit.enchant?.soulId
        const card = soulId ? getSoulCard(soulId) : undefined
        if (!card) return false
        if (String(card.clan ?? '') !== clan) return false
        const excludeBase = String(ab?.excludeBase ?? '')
        if (excludeBase && targetUnit.base === excludeBase) return false
        continue
      }
    }
    return true
  }

  for (const auraUnit of Object.values(nextState.units)) {
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      const bonus = ab.bonus ?? {}
      if (bonus.healCurrent !== true) continue
      const hp = Number(bonus.hp ?? 0)
      if (!Number.isFinite(hp) || hp <= 0) continue
      const add = Math.floor(hp)

      if (!auraWhenOk(nextState, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue

      // For now we reuse the same filter semantics as stats.ts by calling exported helpers indirectly:
      // We apply heal only if this aura actually contributes to the target's max HP bonus right now.
      // (This prevents healing non-targets when for/when doesn't match.)
      for (const target of Object.values(nextState.units)) {
        if (target.side !== auraUnit.side) continue

        if (!auraForKeysOk(target, ab)) continue

        // Quick check: if target's computed max HP doesn't include this aura, we skip.
        // We approximate by checking whether removing heal doesn't change max; but we don't have removal.
        // Instead, rely on stats.ts filtering by recomputing max and then allowing heal; this may over-heal
        // if the aura's hp bonus is gated out. To avoid that, we require for/when to be present and evaluated
        // in stats.ts layer later. (Next iteration can factor shared filter helpers.)

        const key = `${auraUnit.id}:${target.id}:AURA_STAT_BONUS_HP`
        if (used[key]) continue

        const maxHp = getMaxHpForUnitInState(nextState, target.id)
        if (maxHp <= 0) continue
        if (target.hpCurrent >= maxHp) {
          // Still mark used? No: keep it available if later the unit gets damaged; but that would enable
          // retroactive healing. Conservatively, we only mark when we actually heal.
          continue
        }

        const from = target.hpCurrent
        const to = Math.min(maxHp, from + add)
        if (to === from) continue

        nextState = {
          ...nextState,
          units: {
            ...nextState.units,
            [target.id]: { ...target, hpCurrent: to },
          },
          status: {
            ...nextState.status,
            auraStatHpHealUsedByKey: nextUsed ?? { ...used },
          },
        }
        nextUsed = nextState.status.auraStatHpHealUsedByKey ?? { ...used }
        nextUsed[key] = true

        events.push({ type: 'UNIT_HP_CHANGED', unitId: target.id, from, to, reason: '光環回復' })
      }
    }
  }

  if (nextUsed) {
    nextState = { ...nextState, status: { ...nextState.status, auraStatHpHealUsedByKey: nextUsed } }
  }
  return nextState
}

// ── FORMATION_COMMAND helper ──────────────────────────────────────────────────
function findFormationCommandHelper(state: GameState, unitId: string): { allyId: string; abilityKey: string } | null {
  const unit = state.units[unitId]
  if (!unit || unit.base !== 'soldier') return null
  for (const u of Object.values(state.units)) {
    if (u.side !== unit.side || u.id === unit.id) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue
    const ab = card.abilities.find((a) => a.type === 'FORMATION_COMMAND')
    if (!ab) continue
    const perTurn = Number((ab as any).perTurn ?? 1)
    const key = `${u.id}:FORMATION_COMMAND`
    const used = state.turnFlags.abilityUsed?.[key] ?? 0
    if (used >= perTurn) continue
    return { allyId: u.id, abilityKey: key }
  }
  return null
}

// ── LOGISTICS_REVIVE helper ───────────────────────────────────────────────────
function findLogisticsReviveHelper(state: GameState): { allyId: string; abilityKey: string } | null {
  for (const u of Object.values(state.units)) {
    if (u.side !== state.turn.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue
    const ab = card.abilities.find((a) => a.type === 'LOGISTICS_REVIVE')
    if (!ab) continue
    const perTurn = Number((ab as any).perTurn ?? 1)
    const key = `${u.id}:LOGISTICS_REVIVE`
    const used = state.turnFlags.abilityUsed?.[key] ?? 0
    if (used >= perTurn) continue
    return { allyId: u.id, abilityKey: key }
  }
  return null
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function pushResourcesEvent(events: Event[], state: GameState, side: GameState['turn']['side']) {
  const r = state.resources[side]
  events.push({ type: 'RESOURCES_CHANGED', side, gold: r.gold, mana: r.mana, storageMana: r.storageMana })
}

function isResonanceActive(s: GameState, side: Side, need: number, clan: string): boolean {
  if (!Number.isFinite(need) || need <= 0) return false
  if (!clan) return false
  let count = 0
  for (const u of Object.values(s.units)) {
    if (u.side !== side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const c = getSoulCard(soulId)
    if (!c) continue
    if (c.clan !== clan) continue
    count++
  }
  return count >= need
}

function autoTurnStart(state: GameState, events: Event[]): GameState {
  const side = state.turn.side
  const r = state.resources[side]

  const goldFromStorage = r.storageMana * state.rules.storageToGoldRate
  const gold = clamp(r.gold + goldFromStorage, 0, state.limits.goldMax)
  const mana = clamp(r.mana + state.rules.incomeMana, 0, state.limits.manaMax)

  // INCOME_BONUS: passive gold income from allied enchanted units
  let incomeBonus = 0
  for (const u of Object.values(state.units)) {
    if (u.side !== side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue
    for (const ab of card.abilities) {
      if (ab.type !== 'INCOME_BONUS') continue
      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) incomeBonus += amount
    }
  }

  const goldAfterIncome = clamp(gold + state.rules.incomeGold + incomeBonus, 0, state.limits.goldMax)

  let next: GameState = {
    ...state,
    resources: {
      ...state.resources,
      [side]: {
        ...r,
        gold: goldAfterIncome,
        mana,
        storageMana: 0,
      },
    },
  }

  // Resonance-based per-turn grants (e.g. Styx elephants)
  let freeShootBonus = next.turnFlags.freeShootBonus ?? 0
  let freeMoveBonus = next.turnFlags.freeMoveBonus ?? 0
  for (const u of Object.values(next.units)) {
    if (u.side !== side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    const res = card.abilities.find((a) => a.type === 'RESONANCE') as any
    const need = Number(res?.need ?? 0)
    const clan = String(res?.clan ?? '')
    if (!isResonanceActive(next, side, need, clan)) continue

    for (const ab of card.abilities as any[]) {
      if (String(ab?.when?.type ?? '') !== 'RESONANCE_ACTIVE') continue
      const perTurn = Number(ab?.perTurn ?? 0)
      if (!(Number.isFinite(perTurn) && perTurn > 0)) continue

      if (ab.type === 'AURA_GRANT_FREE_SHOOT') {
        const key = `${u.id}:AURA_GRANT_FREE_SHOOT`
        const used = Number(next.turnFlags.abilityUsed?.[key] ?? 0)
        if (used >= perTurn) continue
        const amount = Math.floor(Number(ab?.amount ?? 0))
        if (!(Number.isFinite(amount) && amount > 0)) continue
        freeShootBonus += amount
        next = {
          ...next,
          turnFlags: {
            ...next.turnFlags,
            abilityUsed: { ...next.turnFlags.abilityUsed, [key]: used + 1 },
          },
        }
        continue
      }

      if (ab.type === 'AURA_GRANT_FREE_MOVE') {
        const key = `${u.id}:AURA_GRANT_FREE_MOVE`
        const used = Number(next.turnFlags.abilityUsed?.[key] ?? 0)
        if (used >= perTurn) continue
        const amount = Math.floor(Number(ab?.amount ?? 0))
        if (!(Number.isFinite(amount) && amount > 0)) continue
        freeMoveBonus += amount
        next = {
          ...next,
          turnFlags: {
            ...next.turnFlags,
            abilityUsed: { ...next.turnFlags.abilityUsed, [key]: used + 1 },
          },
        }
      }
    }
  }

  if (freeShootBonus !== (next.turnFlags.freeShootBonus ?? 0) || freeMoveBonus !== (next.turnFlags.freeMoveBonus ?? 0)) {
    next = {
      ...next,
      turnFlags: {
        ...next.turnFlags,
        freeShootBonus,
        freeMoveBonus,
      },
    }
  }

  pushResourcesEvent(events, next, side)

  // INCOME_REPORT: breakdown for UI toast
  const reportItems: import('./events').IncomeReportItem[] = []
  reportItems.push({ label: '基本收入', amount: state.rules.incomeGold, kind: 'gold' })
  if (goldFromStorage > 0) reportItems.push({ label: '儲存轉換', amount: goldFromStorage, kind: 'gold' })
  if (incomeBonus > 0) reportItems.push({ label: '附魔加成', amount: incomeBonus, kind: 'gold' })
  reportItems.push({ label: '魔力', amount: state.rules.incomeMana, kind: 'mana' })
  events.push({ type: 'INCOME_REPORT', side, items: reportItems })

  return next
}

function autoTurnEnd(state: GameState, events: Event[]): GameState {
  const side = state.turn.side
  const r = state.resources[side]

  const stored = clamp(r.storageMana + r.mana, 0, state.limits.storageManaMax)

  const next: GameState = {
    ...state,
    resources: {
      ...state.resources,
      [side]: {
        ...r,
        mana: 0,
        storageMana: stored,
      },
    },
  }

  pushResourcesEvent(events, next, side)
  return next
}

function nextPhaseOf(p: GameState['turn']['phase']): GameState['turn']['phase'] {
  switch (p) {
    case 'turnStart': return 'buy'
    case 'buy':       return 'necro'
    case 'necro':     return 'combat'
    case 'combat':    return 'turnEnd'
    case 'turnEnd':   return 'turnStart'
    default: {
      const _exhaustive: never = p
      return _exhaustive
    }
  }
}

function reduceNextPhase(state: GameState): ReduceResult {
  const events: Event[] = []
  const side = state.turn.side
  const from = state.turn.phase

  let nextState: GameState = {
    ...state,
    turn: { ...state.turn, phase: nextPhaseOf(state.turn.phase) },
  }

  if (nextState.turn.phase === 'turnEnd') {
    nextState = autoTurnEnd(nextState, events)
    nextState = { ...nextState, turn: { ...nextState.turn, phase: 'turnStart' } }
  }

  if (nextState.turn.phase === 'turnStart') {
    const nextSide = side === 'red' ? 'black' : 'red'
    nextState = {
      ...nextState,
      turn: { ...nextState.turn, side: nextSide },
      status: {
        ...nextState.status,
        kingInvincibleSide: nextState.status.kingInvincibleSide === nextSide ? null : nextState.status.kingInvincibleSide,
        sacrificeBuffByUnitId: {},
      },
      turnFlags: {
        ...nextState.turnFlags,
        shotUsed: {},
        movedThisTurn: {},
        enemyKilledThisTurnCount: 0,
        soulReturnUsedCount: 0,
        abilityUsed: {},
        itemUsedByItemId: {},
        soulBuyUsed: false,
        buySoulActionsUsed: 0,
        buyItemActionsUsed: 0,
        necroActionsUsed: 0,
        bloodRitualUsed: false,
        necroBonusActions: 0,
        freeShootBonus: 0,
        freeMoveBonus: 0,
        enchantGoldDiscount: 0,
        itemNecroBonus: 0,
        lastStandContractBonus: 0,
        lastStandNoEnchantUnitIds: [],
        darkMoonScopeActive: false,
        deathChainActive: false,
        deathChainKillCount: 0,
        sealedUnitIds: [],
      },
    }
    nextState = autoTurnStart(nextState, events)
    nextState = { ...nextState, turn: { ...nextState.turn, phase: 'buy' } }
    events.push({ type: 'PHASE_CHANGED', side: nextState.turn.side, from: 'turnStart', to: 'buy' })
    return { ok: true, state: nextState, events }
  }

  events.push({ type: 'PHASE_CHANGED', side, from, to: nextState.turn.phase })
  return { ok: true, state: nextState, events }
}

export function reduce(state: GameState, action: Action): ReduceResult {
  if (action.type !== 'SURRENDER' && state.status?.winnerSide) {
    return { ok: true, state, events: [] }
  }

  switch (action.type) {
    case 'SURRENDER': {
      const losingSide = action.side
      const winnerSide: Side = losingSide === 'red' ? 'black' : 'red'
      if (state.status?.winnerSide === winnerSide) return { ok: true, state, events: [] }
      const next: GameState = {
        ...state,
        status: {
          ...state.status,
          winnerSide,
        },
      }
      return { ok: true, state: next, events: [] }
    }
    case 'MOVE': {
      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: '找不到單位' }
      if (unit.side !== state.turn.side) return { ok: false, error: '不是你的回合' }
      if (state.turn.phase !== 'combat') return { ok: false, error: '需要在戰鬥階段' }

      const r = state.resources[state.turn.side]
      const cost = state.rules.moveManaCost

      // 整編：周圍有 FORMATION_COMMAND 的卒免費移動（不消耗魔力）
      const fcHelper = unit.base === 'soldier' ? findFormationCommandHelper(state, unit.id) : null
      const canUseFreeMove = !fcHelper && (state.turnFlags.freeMoveBonus ?? 0) > 0 && !state.turnFlags.movedThisTurn?.[unit.id]
      const effectiveCost = (fcHelper || canUseFreeMove) ? 0 : cost

      if (r.mana < effectiveCost) return { ok: false, error: '魔力不足' }
      if (!isOnBoard(action.to)) return { ok: false, error: '目標位置超出棋盤' }

      const occupied = getUnitAt(state, action.to)
      if (occupied) return { ok: false, error: '目標位置已有單位' }

      if (!isLegalMove(state, unit.id, action.to)) return { ok: false, error: '不合法的移動' }

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          mana: r.mana - effectiveCost,
        },
      }

      const freeMoveBonus = state.turnFlags.freeMoveBonus ?? 0
      const nextFreeMoveBonus = canUseFreeMove ? Math.max(0, freeMoveBonus - 1) : freeMoveBonus

      const prevAbilityUsed = state.turnFlags.abilityUsed ?? {}
      const nextAbilityUsed = fcHelper
        ? { ...prevAbilityUsed, [fcHelper.abilityKey]: (prevAbilityUsed[fcHelper.abilityKey] ?? 0) + 1 }
        : prevAbilityUsed

      const nextState: GameState = {
        ...state,
        resources: nextResources,
        turnFlags: {
          ...state.turnFlags,
          movedThisTurn: {
            ...state.turnFlags.movedThisTurn,
            [unit.id]: true,
          },
          freeMoveBonus: nextFreeMoveBonus,
          abilityUsed: nextAbilityUsed,
        },
        units: {
          ...state.units,
          [unit.id]: {
            ...unit,
            pos: { ...action.to },
          },
        },
      }

      const moveEvents: Event[] = [
        {
          type: 'UNIT_MOVED',
          unitId: unit.id,
          from: unit.pos,
          to: { ...action.to },
        },
        {
          type: 'RESOURCES_CHANGED',
          side: state.turn.side,
          gold: nextState.resources[state.turn.side].gold,
          mana: nextState.resources[state.turn.side].mana,
          storageMana: nextState.resources[state.turn.side].storageMana,
        },
      ]
      if (fcHelper) {
        moveEvents.push({ type: 'ABILITY_TRIGGERED', unitId: fcHelper.allyId, abilityType: 'FORMATION_COMMAND', text: '整編' })
      }

      return { ok: true, state: nextState, events: moveEvents }
    }

    case 'BLOOD_RITUAL': {
      if (state.turn.phase !== 'necro') return { ok: false, error: '需要在死靈術階段' }
      if (state.turnFlags.bloodRitualUsed) return { ok: false, error: '本回合已使用過血液祭儀' }

      const side = state.turn.side
      const king = Object.values(state.units).find((u) => u.side === side && u.base === 'king')
      if (!king) return { ok: false, error: '找不到帥/將' }
      if (king.hpCurrent <= 3) return { ok: false, error: '帥/將血量過低（最少需要 4 HP）' }

      const nextKing = { ...king, hpCurrent: king.hpCurrent - 3 }

      const nextState: GameState = {
        ...state,
        units: {
          ...state.units,
          [king.id]: nextKing,
        },
        turnFlags: {
          ...state.turnFlags,
          bloodRitualUsed: true,
          necroBonusActions: (state.turnFlags.necroBonusActions ?? 0) + 1,
        },
      }

      return { ok: true, state: nextState, events: [] }
    }

    case 'BUY_ITEM_FROM_DISPLAY': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      if (state.turnFlags.buyItemActionsUsed >= state.limits.buyItemActionsPerTurn) return { ok: false, error: '本回合購買道具次數已用完' }
      if (state.hands[side].items.length >= state.limits.itemHandMax) return { ok: false, error: `道具手牌已滿（${state.limits.itemHandMax}張）` }
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= 3) return { ok: false, error: '無效的道具欄位' }

      const itemId = state.itemDisplay[action.slot]
      if (!itemId) return { ok: false, error: '展示區無道具' }

      const item = getItemCard(itemId)
      if (!item) return { ok: false, error: '找不到道具卡' }

      const r = state.resources[side]
      if (r.gold < item.costGold) return { ok: false, error: '財力不足' }

      let nextState: GameState = {
        ...state,
        itemDisplay: state.itemDisplay.map((v, i) => (i === action.slot ? null : v)),
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            items: [...state.hands[side].items, itemId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - item.costGold,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          buyItemActionsUsed: state.turnFlags.buyItemActionsUsed + 1,
        },
      }

      nextState = refillItemDisplay(nextState, action.slot)

      return {
        ok: true,
        state: nextState,
        events: [
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }

    case 'DISCARD_ITEM_FROM_HAND': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      const hand = state.hands[side].items
      if (!hand.includes(action.itemId)) return { ok: false, error: '道具不在手牌中' }

      const idx = hand.indexOf(action.itemId)
      const nextHand = idx >= 0 ? [...hand.slice(0, idx), ...hand.slice(idx + 1)] : hand
      const nextState: GameState = {
        ...state,
        itemDiscard: [...state.itemDiscard, action.itemId],
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            items: nextHand,
          },
        },
      }

      return { ok: true, state: nextState, events: [] }
    }
    case 'SHOOT': {
      const hasFreeShoot = (state.turnFlags.freeShootBonus ?? 0) > 0 && !state.turnFlags.shotUsed?.[action.attackerId]
      const prePlanEvents: Event[] = []
      // 魂能超載：暫時提升魔力以確保免費射擊能通過消耗檢查
      let stateForShot = hasFreeShoot ? {
        ...state,
        resources: {
          ...state.resources,
          [state.turn.side]: {
            ...state.resources[state.turn.side],
            mana: Math.max(state.resources[state.turn.side].mana, FREE_SHOOT_MANA_SENTINEL),
          },
        },
      } : state

      // BLOOD_SACRIFICE: deduct king HP and inject temporary shot effect
      if (action.sacrificeHp) {
        const attacker = stateForShot.units[action.attackerId]
        const attackerCard = attacker?.enchant?.soulId ? getSoulCard(attacker.enchant.soulId) : undefined
        const bsAb = attackerCard?.abilities.find((a) => a.type === 'BLOOD_SACRIFICE')
        if (bsAb && (bsAb as any).onActivate) {
          const hpCost = Number((bsAb as any).hpCost ?? 1)
          const king = Object.values(stateForShot.units).find((u) => u.side === stateForShot.turn.side && u.base === 'king')
          if (king && king.hpCurrent > hpCost) {
            stateForShot = { ...stateForShot, units: { ...stateForShot.units, [king.id]: { ...king, hpCurrent: king.hpCurrent - hpCost } } }
            const onActivate = (bsAb as any).onActivate as Record<string, unknown>
            if (onActivate.type === 'MOVE_THEN_SHOOT') {
              const cur = stateForShot.turnFlags.bloodSacrificeMoveThenShoot ?? {}
              stateForShot = { ...stateForShot, turnFlags: { ...stateForShot.turnFlags, bloodSacrificeMoveThenShoot: { ...cur, [action.attackerId]: true } } }
            } else {
              stateForShot = { ...stateForShot, turnFlags: { ...stateForShot.turnFlags, bloodSacrificeActiveShotEffect: { unitId: action.attackerId, effect: onActivate } } }
            }
            prePlanEvents.push({ type: 'ABILITY_TRIGGERED', unitId: action.attackerId, abilityType: 'BLOOD_SACRIFICE', text: `血祭 帥-${hpCost}HP` })
          }
        }
      }

      const planRes = buildShotPlan(stateForShot, action.attackerId, action.targetUnitId, action.extraTargetUnitId, action.suppressPierce)
      if (!planRes.ok) return { ok: false, error: (planRes as { ok: false; error: string }).error }

      // GOLD_FOR_DAMAGE: validate and inject gold spend into plan
      if (action.spendGoldForDamage) {
        const attacker = stateForShot.units[action.attackerId]
        const attackerCard = attacker?.enchant?.soulId ? getSoulCard(attacker.enchant.soulId) : undefined
        const goldAb = attackerCard?.abilities.find((a) => a.type === 'GOLD_FOR_DAMAGE')
        if (goldAb) {
          const goldCost = Number((goldAb as any).goldCost ?? 0)
          const damageBonus = Number((goldAb as any).damageBonus ?? 0)
          const availGold = stateForShot.resources[stateForShot.turn.side].gold
          if (goldCost > 0 && damageBonus > 0 && availGold >= goldCost) {
            ;(planRes.plan as any).__goldForDamage = { cost: goldCost, bonus: damageBonus }
          }
        }
      }

      // FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD: check gold BEFORE attack executes (before any kill/gold effects)
      const preShotGoldEvents: Event[] = []
      stateForShot = applyFirstAttackIfGoldLtGainGold(stateForShot, action.attackerId, preShotGoldEvents)

      const execRes = executeShotPlan(stateForShot, planRes.plan)
      if (!execRes.ok) return execRes

      let finalState = execRes.state
      const buildEvents: Event[] = Array.isArray((planRes.plan as any).__buildEvents) ? ((planRes.plan as any).__buildEvents as any[]) : []

      if (hasFreeShoot) {
        // 恢復原始魔力（射擊免費）並遞減 freeShootBonus
        const side = state.turn.side
        finalState = {
          ...finalState,
          resources: {
            ...finalState.resources,
            [side]: {
              ...finalState.resources[side],
              mana: state.resources[side].mana,  // 恢復原始魔力
            },
          },
          turnFlags: {
            ...finalState.turnFlags,
            freeShootBonus: Math.max(0, (finalState.turnFlags.freeShootBonus ?? 0) - 1),
          },
        }
        buildEvents.push({
          type: 'RESOURCES_CHANGED',
          side,
          gold: finalState.resources[side].gold,
          mana: finalState.resources[side].mana,
          storageMana: finalState.resources[side].storageMana,
        })
      }

      // 死亡連鎖：本回合每擊殺一個單位恢復 1 點魔力（最多 3 次）
      const afterEvents: Event[] = []
      if (finalState.turnFlags.deathChainActive ?? false) {
        const shootSide = state.turn.side
        const killedCount = execRes.events.filter((e) => e.type === 'UNIT_KILLED').length
        if (killedCount > 0) {
          const usedSoFar = finalState.turnFlags.deathChainKillCount ?? 0
          const cfg = finalState.turnFlags.onKillGainResource
          const cap = Math.max(0, Math.floor(Number(cfg?.perTurnCap ?? DEATH_CHAIN_MAX_KILLS)))
          const perKillAmt = Math.max(0, Math.floor(Number(cfg?.amount ?? 1)))
          const resKey = String(cfg?.resource ?? 'mana')

          const allowedKills = Math.min(killedCount, cap - usedSoFar)
          const totalGain = allowedKills > 0 ? allowedKills * perKillAmt : 0
          if (totalGain > 0) {
            const r = finalState.resources[shootSide]
            const nextR = resKey === 'gold'
              ? { ...r, gold: Math.min(r.gold + totalGain, finalState.limits.goldMax) }
              : { ...r, mana: Math.min(r.mana + totalGain, finalState.limits.manaMax) }
            finalState = {
              ...finalState,
              resources: { ...finalState.resources, [shootSide]: nextR },
              turnFlags: { ...finalState.turnFlags, deathChainKillCount: usedSoFar + killedCount },
            }
            afterEvents.push({
              type: 'RESOURCES_CHANGED',
              side: shootSide,
              gold: finalState.resources[shootSide].gold,
              mana: finalState.resources[shootSide].mana,
              storageMana: finalState.resources[shootSide].storageMana,
            })
          }
        }
      }
      return { ok: true, state: finalState, events: [...prePlanEvents, ...preShotGoldEvents, ...buildEvents, ...execRes.events, ...afterEvents] }
    }

    case 'SACRIFICE': {
      if (state.turn.phase !== 'combat') return { ok: false, error: '需要在戰鬥階段' }

      const src = state.units[action.sourceUnitId]
      const tgt = state.units[action.targetUnitId]
      if (!src || !tgt) return { ok: false, error: '找不到單位' }

      const g = canSacrifice(state, src.id, tgt.id, action.range)
      if (!g.ok) return { ok: false, error: (g as { ok: false; reason: string }).reason }

      const nextState0: GameState = {
        ...state,
        units: { ...state.units },
        corpsesByPos: { ...state.corpsesByPos },
        graveyard: {
          red: [...state.graveyard.red],
          black: [...state.graveyard.black],
        },
      }

      let nextState: GameState = nextState0
      const events: Event[] = []

      const soulId = src.enchant?.soulId ?? null
      const card = soulId ? getSoulCard(soulId) : null
      const selfSacAb = card?.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SELF_APPLY_STATUS')
      if (selfSacAb && src.id === tgt.id) {
        const statusType = String((selfSacAb as any).status ?? '')
        if (statusType === 'KING_INVINCIBLE_UNTIL_NEXT_TURN_START') {
          nextState = {
            ...nextState,
            status: {
              ...nextState.status,
              kingInvincibleSide: src.side,
            },
          }
        }
      }

      if (src.id !== tgt.id && soulId) {
        const ab = card?.abilities.find((a) => String((a as any).type ?? '') === 'SACRIFICE_SHOT_BUFF')
        const buff = (ab as any)?.buff
        if (buff) {
          const nextBuff = {
            ignoreBlockingAll: (buff as any).ignoreBlockingAll ? (true as const) : undefined,
            chainRadius: Number.isFinite((buff as any).chainRadius as any) ? Math.max(0, Math.floor(Number((buff as any).chainRadius))) : undefined,
            chainFixedDamage: Number.isFinite((buff as any).chainFixedDamage as any)
              ? Math.max(0, Math.floor(Number((buff as any).chainFixedDamage)))
              : undefined,
            chainDamageMultiplier: Number.isFinite((buff as any).chainDamageMultiplier as any)
              ? Math.max(0, Number((buff as any).chainDamageMultiplier))
              : undefined,
            damageBonusPerCorpsesCap: Number.isFinite((buff as any).damageBonusPerCorpsesCap as any)
              ? Math.max(0, Math.floor(Number((buff as any).damageBonusPerCorpsesCap)))
              : undefined,
          }

          nextState = {
            ...nextState,
            status: {
              ...nextState.status,
              sacrificeBuffByUnitId: {
                ...nextState.status.sacrificeBuffByUnitId,
                [src.id]: nextBuff,
              },
            },
          }
        }
      }

      nextState = killUnit(nextState, tgt.id, events, src.id)
      // 死亡連鎖：sacrifice 擊殺也觸發
      if (nextState.turnFlags.deathChainActive ?? false) {
        const sacSide = state.turn.side
        const killedCount = events.filter((e) => e.type === 'UNIT_KILLED').length
        const usedSoFar = nextState.turnFlags.deathChainKillCount ?? 0
        const cfg = nextState.turnFlags.onKillGainResource
        const cap = Math.max(0, Math.floor(Number(cfg?.perTurnCap ?? DEATH_CHAIN_MAX_KILLS)))
        const perKillAmt = Math.max(0, Math.floor(Number(cfg?.amount ?? 1)))
        const resKey = String(cfg?.resource ?? 'mana')

        const allowedKills = Math.min(killedCount, cap - usedSoFar)
        const totalGain = allowedKills > 0 ? allowedKills * perKillAmt : 0
        if (totalGain > 0) {
          const r = nextState.resources[sacSide]
          const nextR = resKey === 'gold'
            ? { ...r, gold: Math.min(r.gold + totalGain, nextState.limits.goldMax) }
            : { ...r, mana: Math.min(r.mana + totalGain, nextState.limits.manaMax) }
          nextState = {
            ...nextState,
            resources: { ...nextState.resources, [sacSide]: nextR },
            turnFlags: { ...nextState.turnFlags, deathChainKillCount: usedSoFar + killedCount },
          }
          events.push({
            type: 'RESOURCES_CHANGED',
            side: sacSide,
            gold: nextState.resources[sacSide].gold,
            mana: nextState.resources[sacSide].mana,
            storageMana: nextState.resources[sacSide].storageMana,
          })
        }
      }
      return { ok: true, state: nextState, events }
    }
    case 'ENCHANT': {
      if (state.turn.phase !== 'necro') return { ok: false, error: '需要在死靈術階段' }
      const necroMax = state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0) + (state.turnFlags.itemNecroBonus ?? 0)
      if (state.turnFlags.necroActionsUsed >= necroMax) {
        return { ok: false, error: '本回合死靈術行動已用完' }
      }

      const unit = state.units[action.unitId]
      if (!unit) return { ok: false, error: '找不到單位' }
      if (unit.side !== state.turn.side) return { ok: false, error: '不是你的回合' }
      if (unit.enchant) return { ok: false, error: '單位已有附魔' }

      // 死戰契約：契約復活的單位本回合不可附魔
      if ((state.turnFlags.lastStandNoEnchantUnitIds ?? []).includes(action.unitId)) {
        return { ok: false, error: '此單位本回合不可附魔（死戰契約）' }
      }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: '找不到靈魂卡' }

      const r = state.resources[state.turn.side]
      // 冥魂灌注：附魔成本折扣
      const discount = state.turnFlags.enchantGoldDiscount ?? 0
      const effectiveCost = Math.max(0, card.costGold - discount)
      if (r.gold < effectiveCost) return { ok: false, error: '財力不足' }

      if (card.base !== unit.base) return { ok: false, error: '靈魂卡棋種不符' }

      const hand = state.hands[state.turn.side].souls
      if (!hand.includes(action.soulId)) return { ok: false, error: '靈魂卡不在手牌中' }

      const nextHand = hand.filter((id) => id !== action.soulId)

      const nextResources = {
        ...state.resources,
        [state.turn.side]: {
          ...r,
          gold: r.gold - effectiveCost,
        },
      }

      const nextUnit = {
        ...unit,
        enchant: { soulId: card.id },
        hpCurrent: card.stats.hp,
        atk: { ...card.stats.atk },
        def: card.stats.def.map((d) => ({ ...d })),
      }

      const nextState: GameState = {
        ...state,
        resources: nextResources,
        hands: {
          ...state.hands,
          [state.turn.side]: {
            ...state.hands[state.turn.side],
            souls: nextHand,
          },
        },
        units: {
          ...state.units,
          [unit.id]: nextUnit,
        },
        turnFlags: {
          ...state.turnFlags,
          necroActionsUsed: state.turnFlags.necroActionsUsed + 1,
          enchantGoldDiscount: 0,  // 折扣一次性消耗
        },
      }

      const events: Event[] = [
        { type: 'ENCHANTED', unitId: unit.id, soulId: card.id },
        {
          type: 'RESOURCES_CHANGED',
          side: state.turn.side,
          gold: nextState.resources[state.turn.side].gold,
          mana: nextState.resources[state.turn.side].mana,
          storageMana: nextState.resources[state.turn.side].storageMana,
        },
      ]
      const nextState2 = applyAuraStatHpHealOnceAfterNecroAction(nextState, events)
      return { ok: true, state: nextState2, events: [...events] }
    }
    case 'REVIVE': {
      if (state.turn.phase !== 'necro') return { ok: false, error: '需要在死靈術階段' }

      const side = state.turn.side
      const r = state.resources[side]

      const posKey = `${action.pos.x},${action.pos.y}`
      const stack = state.corpsesByPos[posKey]
      if (!stack || stack.length === 0) return { ok: false, error: '此格無屍骸' }

      const occupied = getUnitAt(state, action.pos)
      if (occupied) return { ok: false, error: '目標位置已有單位' }

      const friendlyIndices = stack
        .map((corpse, index) => ({ corpse, index }))
        .filter(({ corpse }) => corpse.ownerSide === state.turn.side)
      if (friendlyIndices.length === 0) return { ok: false, error: '此格無己方屍骸' }

      const requestedIndex = action.corpseIndex
      const index = requestedIndex ?? friendlyIndices[friendlyIndices.length - 1]!.index
      if (index < 0 || index >= stack.length) return { ok: false, error: '無效的屍骸索引' }

      const corpse = stack[index]
      if (!corpse) return { ok: false, error: '無效的屍骸索引' }
      if (corpse.ownerSide !== state.turn.side) return { ok: false, error: '不是己方屍骸' }

      // 死戰契約 & 後勤（召侍）：可跳過死靈術次數與財力限制
      const usingContract = (state.turnFlags.lastStandContractBonus ?? 0) > 0
      const lrHelper = corpse.base === 'soldier' ? findLogisticsReviveHelper(state) : null
      const usingLogisticsRevive = !!lrHelper

      const necroMax = state.limits.necroActionsPerTurn + (state.turnFlags.necroBonusActions ?? 0) + (state.turnFlags.itemNecroBonus ?? 0)
      if (!usingContract && !usingLogisticsRevive && state.turnFlags.necroActionsUsed >= necroMax) {
        return { ok: false, error: '本回合死靈術行動已用完' }
      }

      const cost = getReviveGoldCost(corpse.base)
      const effectiveGoldCost = (usingLogisticsRevive || usingContract) ? 0 : cost
      if (r.gold < effectiveGoldCost) return { ok: false, error: '財力不足' }

      // Create a deterministic new unit id without relying on time/random.
      let reviveIdx = 0
      while (state.units[`${corpse.ownerSide}:${corpse.base}:revive:${reviveIdx}`]) reviveIdx++
      const unitId = `${corpse.ownerSide}:${corpse.base}:revive:${reviveIdx}`

      const baseStats = BASE_STATS[corpse.base]
      let hpCurrent = baseStats.hp
      let atk = { key: baseStats.atkKey, value: baseStats.atk }
      let def = baseStats.def.map((d) => ({ ...d }))

      const nextStack = [...stack]
      nextStack.splice(index, 1)

      const nextCorpsesByPos = { ...state.corpsesByPos }
      if (nextStack.length === 0) {
        delete nextCorpsesByPos[posKey]
      } else {
        nextCorpsesByPos[posKey] = nextStack
      }

      const prevAbilityUsedRevive = state.turnFlags.abilityUsed ?? {}
      const nextAbilityUsedRevive = lrHelper
        ? { ...prevAbilityUsedRevive, [lrHelper.abilityKey]: (prevAbilityUsedRevive[lrHelper.abilityKey] ?? 0) + 1 }
        : prevAbilityUsedRevive

      const nextState: GameState = {
        ...state,
        corpsesByPos: nextCorpsesByPos,
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - effectiveGoldCost,
          },
        },
        units: {
          ...state.units,
          [unitId]: {
            id: unitId,
            side: corpse.ownerSide,
            base: corpse.base,
            pos: { ...action.pos },
            hpCurrent,
            atk,
            def,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          // 死戰契約：不計入死靈術次數，但該單位本回合不可附魔
          // 後勤：不計入死靈術次數，直接免費
          necroActionsUsed: (usingContract || usingLogisticsRevive) ? state.turnFlags.necroActionsUsed : state.turnFlags.necroActionsUsed + 1,
          lastStandContractBonus: usingContract ? Math.max(0, (state.turnFlags.lastStandContractBonus ?? 0) - 1) : (state.turnFlags.lastStandContractBonus ?? 0),
          lastStandNoEnchantUnitIds: usingContract
            ? [...(state.turnFlags.lastStandNoEnchantUnitIds ?? []), unitId]
            : (state.turnFlags.lastStandNoEnchantUnitIds ?? []),
          abilityUsed: nextAbilityUsedRevive,
        },
      }

      const reviveEvents: Event[] = [
        { type: 'REVIVED', unitId, pos: { ...action.pos } },
        {
          type: 'RESOURCES_CHANGED',
          side,
          gold: nextState.resources[side].gold,
          mana: nextState.resources[side].mana,
          storageMana: nextState.resources[side].storageMana,
        },
      ]
      if (lrHelper) {
        reviveEvents.push({ type: 'ABILITY_TRIGGERED', unitId: lrHelper.allyId, abilityType: 'LOGISTICS_REVIVE', text: '後勤' })
      }

      const nextState2 = applyAuraStatHpHealOnceAfterNecroAction(nextState, reviveEvents)
      return { ok: true, state: nextState2, events: reviveEvents }
    }
    case 'BUY_SOUL_FROM_DECK': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: '本回合購買靈魂次數已用完' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: '本回合已購買過靈魂卡' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `靈魂手牌已滿（${state.limits.soulHandMax}張）` }
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromDeckGoldCost) return { ok: false, error: '財力不足' }

      const deck = state.soulDeckByBase[action.base]
      if (!deck || deck.length === 0) return { ok: false, error: '牌庫已空' }

      const nextDeck = [...deck]
      const soulId = nextDeck.shift()
      if (!soulId) return { ok: false, error: '牌庫已空' }

      const nextState: GameState = {
        ...state,
        soulDeckByBase: {
          ...state.soulDeckByBase,
          [action.base]: nextDeck,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromDeckGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      const deckCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: deckCard?.name ?? soulId, base: action.base, source: 'deck' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }

    case 'RETURN_SOUL_TO_DECK_BOTTOM': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      if (state.turnFlags.soulReturnUsedCount >= state.limits.soulReturnPerTurn) return { ok: false, error: '本回合歸還靈魂次數已用完' }

      const hand = state.hands[side].souls
      if (!hand.includes(action.soulId)) return { ok: false, error: '靈魂卡不在手牌中' }

      const card = getSoulCard(action.soulId)
      if (!card) return { ok: false, error: '找不到靈魂卡' }

      const nextHand = hand.filter((id) => id !== action.soulId)
      const deck = state.soulDeckByBase[card.base] ?? []
      const nextDeck = [...deck, action.soulId]

      const nextState: GameState = {
        ...state,
        soulDeckByBase: {
          ...state.soulDeckByBase,
          [card.base]: nextDeck,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: nextHand,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulReturnUsedCount: state.turnFlags.soulReturnUsedCount + 1,
        },
      }

      // 若展示區空缺，把剛回到牌堆的卡自動翻出攤開
      const nextStateWithDisplay = refillDisplayByBase(nextState, card.base)
      return { ok: true, state: nextStateWithDisplay, events: [] }
    }
    case 'BUY_SOUL_FROM_DISPLAY': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: '本回合購買靈魂次數已用完' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: '本回合已購買過靈魂卡' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `靈魂手牌已滿（${state.limits.soulHandMax}張）` }
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromDisplayGoldCost) return { ok: false, error: '財力不足' }

      const soulId = state.displayByBase[action.base]
      if (!soulId) return { ok: false, error: '展示區無此靈魂卡' }

      let nextState: GameState = {
        ...state,
        displayByBase: {
          ...state.displayByBase,
          [action.base]: null,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromDisplayGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      nextState = refillDisplayByBase(nextState, action.base)

      const displayCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: displayCard?.name ?? soulId, base: action.base, source: 'display' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }
    case 'BUY_SOUL_FROM_ENEMY_GRAVEYARD': {
      if (state.turn.phase !== 'buy') return { ok: false, error: '需要在購買階段' }
      const side = state.turn.side
      if (state.turnFlags.buySoulActionsUsed >= state.limits.buySoulActionsPerTurn) return { ok: false, error: '本回合購買靈魂次數已用完' }
      if (state.turnFlags.soulBuyUsed) return { ok: false, error: '本回合已購買過靈魂卡' }
      if (state.hands[side].souls.length >= state.limits.soulHandMax) return { ok: false, error: `靈魂手牌已滿（${state.limits.soulHandMax}張）` }
      const enemy = side === 'red' ? 'black' : 'red'
      const r = state.resources[side]
      if (r.gold < state.rules.buySoulFromEnemyGraveyardGoldCost) return { ok: false, error: '財力不足' }

      const gy = state.graveyard[enemy]
      if (gy.length === 0) return { ok: false, error: '敵方墳場為空' }

      const soulId = gy[0]!
      if (!soulId) return { ok: false, error: '敵方墳場為空' }
      const nextEnemyGy = gy.slice(1)

      const nextState: GameState = {
        ...state,
        graveyard: {
          ...state.graveyard,
          [enemy]: nextEnemyGy,
        },
        hands: {
          ...state.hands,
          [side]: {
            ...state.hands[side],
            souls: [...state.hands[side].souls, soulId],
          },
        },
        resources: {
          ...state.resources,
          [side]: {
            ...r,
            gold: r.gold - state.rules.buySoulFromEnemyGraveyardGoldCost,
          },
        },
        turnFlags: {
          ...state.turnFlags,
          soulBuyUsed: true,
          buySoulActionsUsed: state.turnFlags.buySoulActionsUsed + 1,
        },
      }

      const gyCard = getSoulCard(soulId)
      return {
        ok: true,
        state: nextState,
        events: [
          { type: 'SOUL_BOUGHT', side, soulId, soulName: gyCard?.name ?? soulId, base: gyCard?.base ?? '', source: 'graveyard' },
          {
            type: 'RESOURCES_CHANGED',
            side,
            gold: nextState.resources[side].gold,
            mana: nextState.resources[side].mana,
            storageMana: nextState.resources[side].storageMana,
          },
        ],
      }
    }
    case 'NEXT_PHASE':
      return reduceNextPhase(state)
    case 'USE_ITEM_FROM_HAND':
      return reduceUseItem(state, action)

    default: {
      const _exhaustive: never = action
      return { ok: false, error: `Unknown action: ${String(_exhaustive)}` }
    }
  }
}
