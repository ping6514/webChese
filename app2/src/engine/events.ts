/**
 * engine/events.ts — 引擎事件 union type
 *
 * reduce() 回傳的 events[] 供 UI 讀取做動畫/浮字/音效。
 * Events 不影響 state（state 已在 reduce 內直接更新）。
 */

import type { HexPos } from './state'
import type { StatusId } from './state'

// ─── ATB / 時間 ───────────────────────────────────────────────────────────────

export type ATBReadyEvent = {
  type: 'ATB_READY'
  unitId: string
}

// ─── 移動 ─────────────────────────────────────────────────────────────────────

export type UnitMovedEvent = {
  type: 'UNIT_MOVED'
  unitId: string
  from: HexPos
  to: HexPos
  /** 完整移動路徑（供 UI 沿格動畫）*/
  path: HexPos[]
}

// ─── 讀條 ─────────────────────────────────────────────────────────────────────

export type CastStartedEvent = {
  type: 'CAST_STARTED'
  unitId: string
  castTimeMs: number
  /** 預警格子（供 UI 顯示危險區）*/
  warningCells: HexPos[]
}

// ─── 傷害 / 治療 ──────────────────────────────────────────────────────────────

export type DamageDealtEvent = {
  type: 'DAMAGE_DEALT'
  sourceId: string
  targetId: string
  amount: number
  damageType: string  // 'slash'/'pierce'/'impact'/'fire'…
  isBackstab: boolean
  pos: HexPos
}

export type HealEvent = {
  type: 'HEAL'
  unitId: string
  amount: number
  pos: HexPos
}

export type DotTickEvent = {
  type: 'DOT_TICK'
  statusId: StatusId
  targetId: string
  amount: number
  pos: HexPos
}

// ─── 打斷 ─────────────────────────────────────────────────────────────────────

export type InterruptEvent = {
  type: 'INTERRUPT'
  sourceId: string
  targetId: string
  /** 被打斷的施法類型 */
  interruptedCastType: string
  pos: HexPos
}

// ─── 異常積蓄 ─────────────────────────────────────────────────────────────────

/** 每次攻擊附加積蓄量時發出（供 UI 顯示積蓄條變化）*/
export type BuildupAddedEvent = {
  type: 'BUILDUP_ADDED'
  targetId: string
  statusId: StatusId
  /** 實際增加量（已扣抗性）*/
  addedAmount: number
  /** 目前積蓄量 */
  currentAccum: number
  /** 激活閾值 */
  threshold: number
  pos: HexPos
}

/** 積蓄滿觸發異常狀態 */
export type StatusTriggeredEvent = {
  type: 'STATUS_TRIGGERED'
  targetId: string
  statusId: StatusId
  /** 本次閾值（下一輪會更高）*/
  threshold: number
  /** 下一輪的閾值（顯示給玩家耐性上升提示）*/
  nextThreshold: number
  pos: HexPos
}

/** 異常狀態自然到期或被外力解除 */
export type StatusRemovedEvent = {
  type: 'STATUS_REMOVED'
  targetId: string
  statusId: StatusId
  reason: 'expired' | 'hit_wake' | 'cleansed'
  pos: HexPos
}

/** 睡眠被首擊喚醒（追加傷害倍率提示）*/
export type SleepWakeEvent = {
  type: 'SLEEP_WAKE'
  targetId: string
  amplifiedDamage: number  // 實際造成的 ×1.5 傷害
  pos: HexPos
}

// ─── 單位死亡 ─────────────────────────────────────────────────────────────────

export type UnitDiedEvent = {
  type: 'UNIT_DIED'
  unitId: string
  killedById: string | null
  pos: HexPos
}

// ─── 戰鬥結果 ─────────────────────────────────────────────────────────────────

export type BattleEndEvent = {
  type: 'BATTLE_END'
  winner: 'player' | 'enemy'
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type Event =
  | ATBReadyEvent
  | UnitMovedEvent
  | CastStartedEvent
  | DamageDealtEvent
  | HealEvent
  | DotTickEvent
  | InterruptEvent
  | BuildupAddedEvent
  | StatusTriggeredEvent
  | StatusRemovedEvent
  | SleepWakeEvent
  | UnitDiedEvent
  | BattleEndEvent
