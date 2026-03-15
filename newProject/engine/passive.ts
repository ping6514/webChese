/**
 * passive.ts — 怪物被動能力定義 + 觸發檢查
 *
 * PassiveAbilityDef：對應 data/monsters/forest/*.json 中的 passiveAbilities[]
 *
 * checkPassiveTriggers(state, unitId, passiveDefs, nowMs) → { state, events }
 *
 * MVP1 支援的 trigger：
 *   on_time       → 固定間隔觸發（HP regen）
 *   on_below_hp   → HP 跌破閾值觸發（enrage / buff_self）
 *
 * MVP1 跳過的 trigger（結構保留）：
 *   on_interval_aura  → 群體光環（需迭代附近單位）
 *   on_ambush_hit     → 首擊獎勵（需戰鬥狀態機）
 */

import type { GameState, Unit } from './state'
import type { Event, PassiveTriggeredEvent, HealEvent } from './events'

// ─── PassiveAbilityDef 型別（對應 JSON）──────────────────────────────────────

export type PassiveEffect =
  | { type: 'recover_hp'; amount: number }
  | { type: 'buff_self'; speedBonus?: number; atkMult?: number; key?: string; value?: number }
  | { type: 'enter_phase'; phase: string; speedBonus?: number; atkMult?: number; visualFx?: string }
  | { type: 'buff_allies'; key: string; value: number }          // MVP1 skip
  | { type: 'bonus_damage_mult'; mult: number; duration: string } // MVP1 skip

export type PassiveAbilityDef =
  | { trigger: 'on_time'; interval: number; effect: PassiveEffect }
  | { trigger: 'on_below_hp'; threshold: number; once: boolean; effect: PassiveEffect }
  | { trigger: 'on_interval_aura'; interval: number; radius: number; effect: PassiveEffect }
  | { trigger: 'on_ambush_hit'; once: boolean; effect: PassiveEffect }

/** monsterId → 被動定義列表 */
export type PassiveRegistry = Record<string, PassiveAbilityDef[]>

export type PassiveCheckResult = {
  state: GameState
  events: Event[]
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * 檢查指定單位的所有被動觸發條件，依序套用滿足的效果。
 *
 * @param state       當前 GameState
 * @param unitId      被檢查的單位 id
 * @param passiveDefs 該單位的被動列表（來自 PassiveRegistry[monsterId]）
 * @param nowMs       當前戰鬥時間（state.timeline.tick）
 */
export function checkPassiveTriggers(
  state: GameState,
  unitId: string,
  passiveDefs: PassiveAbilityDef[],
  nowMs: number
): PassiveCheckResult {
  const events: Event[] = []
  let currentState = state

  const unit = currentState.units[unitId]
  if (!unit || unit.isDead) return { state: currentState, events }

  const passiveBase = unit.monsterId ?? unitId

  passiveDefs.forEach((def, i) => {
    const passiveKey = `${passiveBase}_passive_${i}`
    // Re-read unit after each trigger (stats may have changed)
    const u = currentState.units[unitId]!

    switch (def.trigger) {

      // ── on_time（固定間隔）─────────────────────────────────────────────────
      case 'on_time': {
        const nextTriggerMap = u.passiveNextTriggerAt ?? {}
        const nextAt = nextTriggerMap[passiveKey]

        if (nextAt === undefined) {
          // 初次見到：排程下次觸發時間，本次不觸發
          const newMap = { ...nextTriggerMap, [passiveKey]: nowMs + def.interval }
          currentState = setUnit(currentState, { ...u, passiveNextTriggerAt: newMap })
          break
        }

        if (nextAt > nowMs) break // 尚未到觸發時間

        // 觸發
        const result = applyPassiveEffect(currentState, unitId, def.effect, passiveKey)
        currentState = result.state
        events.push(...result.events)

        // 推進下次觸發時間
        const newMap = { ...(currentState.units[unitId]!.passiveNextTriggerAt ?? {}), [passiveKey]: nowMs + def.interval }
        currentState = setUnit(currentState, { ...currentState.units[unitId]!, passiveNextTriggerAt: newMap })
        break
      }

      // ── on_below_hp（低血量觸發）─────────────────────────────────────────
      case 'on_below_hp': {
        // 已觸發過（once = true）→ 跳過
        if (def.once && u.triggeredPassiveIds?.includes(passiveKey)) break

        // 血量未達閾值 → 跳過
        if (u.currentHP / u.maxHP >= def.threshold) break

        // 觸發
        const result = applyPassiveEffect(currentState, unitId, def.effect, passiveKey)
        currentState = result.state
        events.push(...result.events)

        if (def.once) {
          const newTriggered = [...(currentState.units[unitId]!.triggeredPassiveIds ?? []), passiveKey]
          currentState = setUnit(currentState, { ...currentState.units[unitId]!, triggeredPassiveIds: newTriggered })
        }
        break
      }

      // ── on_interval_aura / on_ambush_hit：MVP1 跳過 ─────────────────────
      case 'on_interval_aura':
      case 'on_ambush_hit':
        break
    }
  })

  return { state: currentState, events }
}

// ─── 效果套用 ─────────────────────────────────────────────────────────────────

function applyPassiveEffect(
  state: GameState,
  unitId: string,
  effect: PassiveEffect,
  passiveKey: string
): PassiveCheckResult {
  const events: Event[] = []
  const unit = state.units[unitId]!

  const passiveEvent: PassiveTriggeredEvent = {
    type: 'PASSIVE_TRIGGERED',
    unitId,
    passiveId: passiveKey,
    effectType: effect.type,
    pos: unit.pos,
  }

  switch (effect.type) {

    // ── HP 回復 ─────────────────────────────────────────────────────────────
    case 'recover_hp': {
      const healAmt = Math.min(effect.amount, unit.maxHP - unit.currentHP)
      if (healAmt <= 0) break  // 已滿血

      const newUnit: Unit = { ...unit, currentHP: unit.currentHP + healAmt }
      const healEvent: HealEvent = {
        type: 'HEAL',
        unitId,
        amount: healAmt,
        resource: 'hp',
        pos: unit.pos,
      }
      events.push(healEvent, passiveEvent)
      return { state: setUnit(state, newUnit), events }
    }

    // ── 自身 buff（速度 + 攻擊倍率）─────────────────────────────────────────
    case 'buff_self': {
      let newUnit = { ...unit }
      if (effect.speedBonus) {
        newUnit = { ...newUnit, speed: newUnit.speed + effect.speedBonus }
      }
      if (effect.atkMult) {
        newUnit = { ...newUnit, passiveAtkMult: effect.atkMult }
      }
      events.push(passiveEvent)
      return { state: setUnit(state, newUnit), events }
    }

    // ── 進入特殊相（enrage 等）──────────────────────────────────────────────
    case 'enter_phase': {
      let newUnit = { ...unit }
      if (effect.speedBonus) {
        newUnit = { ...newUnit, speed: newUnit.speed + effect.speedBonus }
      }
      if (effect.atkMult) {
        newUnit = { ...newUnit, passiveAtkMult: effect.atkMult }
      }
      events.push(passiveEvent)
      return { state: setUnit(state, newUnit), events }
    }

    // ── MVP1 跳過 ────────────────────────────────────────────────────────────
    case 'buff_allies':
    case 'bonus_damage_mult':
      break
  }

  return { state, events }
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function setUnit(state: GameState, unit: Unit): GameState {
  return { ...state, units: { ...state.units, [unit.id]: unit } }
}
