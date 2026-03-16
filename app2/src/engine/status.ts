/**
 * engine/status.ts — MH 風格異常積蓄值系統
 *
 * 核心機制：
 *   1. 攻擊附加積蓄量 → applyBuildup()
 *   2. 積蓄 >= 閾值 → triggerStatus()（激活異常）
 *   3. 激活後閾值 × 1.5（最多 × 3）→ MH 耐性遞增效果
 *   4. 職業基礎抗性降低每次積蓄輸入量
 *
 * 異常效果：
 *   burn     — 短期高 DoT（4 tick × 10 = 40 傷害，3.2 秒）
 *   poison   — 長期低 DoT（8 tick × 5 = 40 傷害，9.6 秒）
 *   paralyze — 暫時無法行動（3 秒）
 *   sleep    — 無法行動直到被攻擊，首擊傷害 × 1.5
 *   freeze   — ATB 充能速率降至 40%（4 秒）
 */

import type { GameState, CombatUnit, ActiveStatus, StatusId } from './state'
import type { Event } from './events'
import {
  STATUS_THRESHOLD_SCALE,
  STATUS_THRESHOLD_MAX_MULT,
  BURN_DOT_PER_TICK,
  BURN_DOT_TICK_MS,
  BURN_DURATION_MS,
  POISON_DOT_PCT_PER_TICK,
  POISON_DOT_TOTAL_CAP_PCT,
  POISON_DOT_TICK_MS,
  POISON_DURATION_MS,
  PARALYZE_DURATION_MS,
  SLEEP_DURATION_MS,
  FREEZE_SPEED_MULT,
  FREEZE_DURATION_MS,
} from './state'
import { applyFreeze, clearFreeze } from './atb'

// ─── 積蓄輸入 ─────────────────────────────────────────────────────────────────

export type BuildupInput = {
  statusId: StatusId
  /** 原始積蓄量（武器 / 技能決定）*/
  rawAmount: number
}

/**
 * applyBuildup — 對目標施加異常積蓄值
 *
 * 若積蓄值超過閾值，立即觸發異常狀態。
 * 支援同一次呼叫觸發多種積蓄（武器可同時附帶 burn + freeze 等）。
 */
export function applyBuildup(
  state: GameState,
  targetId: string,
  inputs: BuildupInput[],
): { newState: GameState; events: Event[] } {
  let current = state
  const allEvents: Event[] = []

  const unit = current.units[targetId]
  if (!unit || unit.isDead) return { newState: current, events: allEvents }

  for (const input of inputs) {
    const { sid, amount, events, nextState } = processSingleBuildup(current, unit, input)
    void sid
    void amount
    current = nextState
    allEvents.push(...events)
  }

  return { newState: current, events: allEvents }
}

// ─── DoT tick 推進 ────────────────────────────────────────────────────────────

/**
 * tickStatusEffects — 在 advanceTime 後呼叫，處理到期的 DoT tick 與異常過期
 *
 * 應在每次 tick 推進後呼叫一次。
 */
export function tickStatusEffects(
  state: GameState,
): { newState: GameState; events: Event[] } {
  let current = state
  const allEvents: Event[] = []

  for (const unit of Object.values(state.units)) {
    if (unit.isDead) continue

    const tick = current.timeline.tick
    const remaining: ActiveStatus[] = []
    const newUnits = { ...current.units }

    for (const effect of unit.statusEffects) {
      // ── 到期檢查 ──
      if (effect.expiresAt !== Infinity && tick >= effect.expiresAt) {
        // 冰凍到期 → 恢復 speed
        if (effect.id === 'freeze') {
          current = clearFreeze(current, unit.id)
        }
        allEvents.push({
          type: 'STATUS_REMOVED',
          targetId: unit.id,
          statusId: effect.id,
          reason: 'expired',
          pos: unit.pos,
        })
        continue  // 不保留
      }

      // ── DoT tick（burn / poison）──
      if ((effect.id === 'burn' || effect.id === 'poison') &&
          effect.dotTickMs !== undefined &&
          effect.nextTickAt !== undefined &&
          effect.dotDamagePerTick !== undefined) {

        // 中毒：若已達上限，提前結束效果
        if (effect.id === 'poison' &&
            effect.dotTotalCap !== undefined &&
            effect.dotTotalDealt !== undefined &&
            effect.dotTotalDealt >= effect.dotTotalCap) {
          allEvents.push({ type: 'STATUS_REMOVED', targetId: unit.id, statusId: 'poison', reason: 'expired', pos: unit.pos })
          continue  // 不保留此 effect
        }

        if (tick >= effect.nextTickAt) {
          let dmg = effect.dotDamagePerTick

          // 中毒：實際傷害不超過剩餘上限
          let updatedEffect: typeof effect = effect
          if (effect.id === 'poison' &&
              effect.dotTotalCap !== undefined &&
              effect.dotTotalDealt !== undefined) {
            const remaining_cap = effect.dotTotalCap - effect.dotTotalDealt
            dmg = Math.min(dmg, remaining_cap)
            const newDealt = effect.dotTotalDealt + dmg
            updatedEffect = { ...effect, dotTotalDealt: newDealt, nextTickAt: effect.nextTickAt + effect.dotTickMs }

            // 達上限後效果結束（下一輪迴圈移除）
            if (newDealt >= effect.dotTotalCap) {
              remaining.push(updatedEffect)  // 保留一輪，下次迭代時移除
              // 提前發出 STATUS_REMOVED（上限到期）
            } else {
              remaining.push(updatedEffect)
            }
          } else {
            remaining.push({ ...effect, nextTickAt: effect.nextTickAt + effect.dotTickMs })
          }

          const src = (newUnits[unit.id] ?? unit) as CombatUnit
          const newHp = Math.max(0, src.hp - dmg)
          const updatedUnit: CombatUnit = { ...src, hp: newHp, isDead: newHp <= 0 }
          if (newHp <= 0 && !src.isDead) {
            allEvents.push({ type: 'UNIT_DIED', unitId: unit.id, killedById: null, pos: unit.pos })
          }
          newUnits[unit.id] = updatedUnit

          allEvents.push({
            type: 'DOT_TICK',
            statusId: effect.id,
            targetId: unit.id,
            amount: dmg,
            pos: unit.pos,
          })
          continue
        }
      }

      remaining.push(effect)
    }

    if (remaining.length !== unit.statusEffects.length) {
      const src = (newUnits[unit.id] ?? unit) as CombatUnit
      newUnits[unit.id] = { ...src, statusEffects: remaining }
      current = { ...current, units: { ...newUnits } as Record<string, CombatUnit> }
    }
  }

  return { newState: current, events: allEvents }
}

// ─── 睡眠被攻擊喚醒 ────────────────────────────────────────────────────────────

/**
 * checkSleepWake — 在命中目標前呼叫
 *
 * 若目標處於睡眠中：
 *   - 解除睡眠
 *   - 回傳 amplifyMult = 1.5（傷害乘以此倍率）
 *   - 發出 SLEEP_WAKE event
 * 否則回傳 amplifyMult = 1.0
 */
export function checkSleepWake(
  state: GameState,
  targetId: string,
  incomingDamage: number,
): { newState: GameState; amplifyMult: number; events: Event[] } {
  const unit = state.units[targetId]
  if (!unit) return { newState: state, amplifyMult: 1.0, events: [] }

  const sleepIdx = unit.statusEffects.findIndex(s => s.id === 'sleep')
  if (sleepIdx === -1) return { newState: state, amplifyMult: 1.0, events: [] }

  const amplified = Math.ceil(incomingDamage * 1.5)
  const newEffects = unit.statusEffects.filter((_, i) => i !== sleepIdx)
  const newUnit = { ...unit, statusEffects: newEffects }
  const newState = { ...state, units: { ...state.units, [targetId]: newUnit } }

  return {
    newState,
    amplifyMult: 1.5,
    events: [
      {
        type: 'SLEEP_WAKE',
        targetId,
        amplifiedDamage: amplified,
        pos: unit.pos,
      },
      {
        type: 'STATUS_REMOVED',
        targetId,
        statusId: 'sleep' as StatusId,
        reason: 'hit_wake',
        pos: unit.pos,
      },
    ],
  }
}

// ─── 清除異常（工具/技能用）──────────────────────────────────────────────────

export function cleanseStatus(
  state: GameState,
  targetId: string,
  statusId: StatusId,
): { newState: GameState; events: Event[] } {
  const unit = state.units[targetId]
  if (!unit) return { newState: state, events: [] }

  const had = unit.statusEffects.some(s => s.id === statusId)
  if (!had) return { newState: state, events: [] }

  let newState = state
  if (statusId === 'freeze') newState = clearFreeze(state, targetId)

  const targetUnit = newState.units[targetId]!
  const newUnit: CombatUnit = {
    ...targetUnit,
    statusEffects: targetUnit.statusEffects.filter(s => s.id !== statusId),
  }

  return {
    newState: { ...newState, units: { ...newState.units, [targetId]: newUnit } as Record<string, CombatUnit> },
    events: [{
      type: 'STATUS_REMOVED',
      targetId,
      statusId,
      reason: 'cleansed',
      pos: unit.pos,
    }],
  }
}

// ─── 工具：取得單位目前激活的異常 id 清單 ────────────────────────────────────

export function getActiveStatusIds(unit: CombatUnit): StatusId[] {
  return unit.statusEffects.map(s => s.id)
}

export function hasStatus(unit: CombatUnit, id: StatusId): boolean {
  return unit.statusEffects.some(s => s.id === id)
}

// ─── 內部實作 ─────────────────────────────────────────────────────────────────

function processSingleBuildup(
  state: GameState,
  unit: CombatUnit,
  input: BuildupInput,
): { sid: StatusId; amount: number; events: Event[]; nextState: GameState } {
  const { statusId, rawAmount } = input
  const events: Event[] = []

  const resist = unit.buildupResist[statusId] ?? 0
  const effectiveAmount = rawAmount * (1 - resist)
  if (effectiveAmount <= 0) return { sid: statusId, amount: 0, events, nextState: state }

  const buildupData = { ...unit.buildup[statusId] }
  buildupData.accum += effectiveAmount

  events.push({
    type: 'BUILDUP_ADDED',
    targetId: unit.id,
    statusId,
    addedAmount: effectiveAmount,
    currentAccum: buildupData.accum,
    threshold: buildupData.threshold,
    pos: unit.pos,
  })

  let nextState = state

  // ── 積蓄滿，觸發異常 ──
  if (buildupData.accum >= buildupData.threshold) {
    buildupData.accum = 0

    // 閾值遞增（最多 × STATUS_THRESHOLD_MAX_MULT）
    const maxThreshold = buildupData.baseThreshold * STATUS_THRESHOLD_MAX_MULT
    const newThreshold = Math.min(maxThreshold, buildupData.threshold * STATUS_THRESHOLD_SCALE)

    events.push({
      type: 'STATUS_TRIGGERED',
      targetId: unit.id,
      statusId,
      threshold: buildupData.threshold,
      nextThreshold: newThreshold,
      pos: unit.pos,
    })

    buildupData.threshold = newThreshold

    // 激活異常效果
    const { state: stateAfterActivate, events: activateEvents } = activateStatus(
      nextState,
      unit.id,
      statusId,
    )
    nextState = stateAfterActivate
    events.push(...activateEvents)
  }

  // 更新 unit.buildup
  const latestUnit = nextState.units[unit.id]!
  const updatedUnit: CombatUnit = {
    ...latestUnit,
    buildup: { ...latestUnit.buildup, [statusId]: buildupData },
  }
  nextState = { ...nextState, units: { ...nextState.units, [unit.id]: updatedUnit } as Record<string, CombatUnit> }

  return { sid: statusId, amount: effectiveAmount, events, nextState }
}

function activateStatus(
  state: GameState,
  unitId: string,
  statusId: StatusId,
): { state: GameState; events: Event[] } {
  const unit = state.units[unitId]
  if (!unit) return { state, events: [] }

  const tick = state.timeline.tick
  const events: Event[] = []

  // 移除舊的同類異常（重置計時）
  const filteredEffects = unit.statusEffects.filter(s => s.id !== statusId)

  let newEffect: ActiveStatus
  let nextState = state

  switch (statusId) {
    case 'burn':
      newEffect = {
        id: 'burn',
        expiresAt: tick + BURN_DURATION_MS,
        dotDamagePerTick: BURN_DOT_PER_TICK,
        dotTickMs: BURN_DOT_TICK_MS,
        nextTickAt: tick + BURN_DOT_TICK_MS,
      }
      break

    case 'poison': {
      // 百分比制：每跳 = ceil(maxHp × 3%)，上限 = ceil(maxHp × 25%)
      const targetMaxHp = (state.units[unitId]?.maxHp ?? 100)
      const perTick = Math.ceil(targetMaxHp * POISON_DOT_PCT_PER_TICK)
      const totalCap = Math.ceil(targetMaxHp * POISON_DOT_TOTAL_CAP_PCT)
      newEffect = {
        id: 'poison',
        expiresAt: tick + POISON_DURATION_MS,
        dotDamagePerTick: perTick,
        dotTickMs: POISON_DOT_TICK_MS,
        nextTickAt: tick + POISON_DOT_TICK_MS,
        dotTotalCap: totalCap,
        dotTotalDealt: 0,
      }
      break
    }

    case 'paralyze':
      newEffect = {
        id: 'paralyze',
        expiresAt: tick + PARALYZE_DURATION_MS,
      }
      break

    case 'sleep':
      newEffect = {
        id: 'sleep',
        expiresAt: SLEEP_DURATION_MS,  // Infinity — 靠攻擊解除
        sleepAmplifyOnWake: true,
      }
      break

    case 'freeze':
      newEffect = {
        id: 'freeze',
        expiresAt: tick + FREEZE_DURATION_MS,
      }
      // 同時修改 ATBEntry.speedMult
      nextState = applyFreeze(nextState, unitId, FREEZE_SPEED_MULT)
      break
  }

  const baseUnit = nextState.units[unitId]!
  const updatedUnit: CombatUnit = {
    ...baseUnit,
    statusEffects: [...filteredEffects, newEffect!],
  }
  nextState = { ...nextState, units: { ...nextState.units, [unitId]: updatedUnit } as Record<string, CombatUnit> }

  return { state: nextState, events }
}
