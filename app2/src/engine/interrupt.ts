/**
 * engine/interrupt.ts — 打斷系統
 * 
 * 打斷機制：
 * - 單位讀條期間（castRemaining > 0）受到足夠的打斷值會中斷施法
 * - 打斷值累積超過閾值時觸發
 * - 不同技能有不同的打斷抗性（InterruptTag）
 */

import type { GameState } from './state'
import type { Event, InterruptEvent } from './events'
import type { InterruptTag } from '../game/schema'

export type InterruptResult = {
  interrupted: boolean
  reason: string
  newState: GameState
  events: Event[]
}

/**
 * 打斷閾值配置
 * 不同類型的施法有不同的打斷難度
 */
const INTERRUPT_THRESHOLDS: Record<InterruptTag, number> = {
  light_cast: 1,        // 輕量施法：1 點打斷值即可中斷
  heavy_cast: 3,        // 重型施法：需要 3 點
  projectile_cast: 2,   // 投射物施法：需要 2 點
  zone_cast: 4,         // 區域施法：需要 4 點（最難打斷）
  guard_cast: 5,        // 防禦姿態：需要 5 點（幾乎不可打斷）
}

/**
 * 基礎打斷閾值（當沒有指定 InterruptTag 時）
 */
const DEFAULT_INTERRUPT_THRESHOLD = 2

/**
 * 嘗試打斷目標單位的施法
 * 
 * @param state 當前遊戲狀態
 * @param sourceId 攻擊者 ID
 * @param targetId 被打斷的目標單位 ID
 * @param interruptValue 打斷值（來自攻擊者的 interrupt 屬性）
 * @param targetCastTag 目標施法的類型標籤（決定打斷難度）
 * @returns 打斷結果
 */
export function attemptInterrupt(
  state: GameState,
  sourceId: string,
  targetId: string,
  interruptValue: number,
  targetCastTag?: InterruptTag,
): InterruptResult {
  const target = state.units[targetId]
  
  if (!target || target.isDead) {
    return {
      interrupted: false,
      reason: 'target_invalid',
      newState: state,
      events: [],
    }
  }

  // 目標不在讀條中
  const entry = state.timeline.entries.find(e => e.unitId === targetId)
  if (!entry || entry.castRemaining <= 0) {
    return {
      interrupted: false,
      reason: 'not_casting',
      newState: state,
      events: [],
    }
  }

  // 計算打斷閾值
  const threshold = targetCastTag 
    ? INTERRUPT_THRESHOLDS[targetCastTag] 
    : DEFAULT_INTERRUPT_THRESHOLD

  // 打斷值不足
  if (interruptValue < threshold) {
    return {
      interrupted: false,
      reason: 'insufficient_interrupt',
      newState: state,
      events: [],
    }
  }

  // 成功打斷
  const newEntries = state.timeline.entries.map(e => {
    if (e.unitId !== targetId) return e
    return {
      ...e,
      castRemaining: 0,
      // 打斷懲罰：損失部分 ATB
      atb: Math.max(0, e.atb - 30),
    }
  })

  const interruptEvent: InterruptEvent = {
    type: 'INTERRUPT',
    sourceId,
    targetId,
    interruptedCastType: targetCastTag ?? 'unknown',
    pos: target.pos,
  }

  return {
    interrupted: true,
    reason: 'success',
    newState: {
      ...state,
      timeline: {
        ...state.timeline,
        entries: newEntries,
      },
    },
    events: [interruptEvent],
  }
}

/**
 * 檢查單位是否可被打斷
 */
export function canBeInterrupted(
  state: GameState,
  targetId: string,
  interruptValue: number,
  targetCastTag?: InterruptTag,
): boolean {
  const target = state.units[targetId]
  if (!target || target.isDead) return false

  const entry = state.timeline.entries.find(e => e.unitId === targetId)
  if (!entry || entry.castRemaining <= 0) return false

  const threshold = targetCastTag 
    ? INTERRUPT_THRESHOLDS[targetCastTag] 
    : DEFAULT_INTERRUPT_THRESHOLD

  return interruptValue >= threshold
}

/**
 * 計算打斷加成
 * 某些職業對特定類型的施法有打斷加成
 */
export function calculateInterruptBonus(
  targetCastTag: InterruptTag,
  bonusVsTags?: InterruptTag[],
): number {
  if (!bonusVsTags || bonusVsTags.length === 0) return 0
  
  // 如果攻擊者專精打斷此類型，+1 打斷值
  return bonusVsTags.includes(targetCastTag) ? 1 : 0
}
