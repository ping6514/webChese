/**
 * atb.ts — ATB 時間軸推進
 *
 * advanceTime(state) → { newState, events }
 *
 * 規則：
 *   - 每個單位有 atb（0–100）+ speed（充能速率）
 *   - 找出「最快到達 100」的單位，推進時間 Δt 讓它剛好到 100
 *   - 同時到達時：player > monster；同類依 unitId sort（確保可重現）
 *   - 設 pendingUnitId = 該單位，發出 ATB_READY event
 *   - 讀條中的單位（castRemaining > 0）：Δt 同步扣減 castRemaining
 *     → 如果讀條在這段 Δt 內結束，額外發出 RESOLVE_CAST_NEEDED event（由 reduce 處理）
 *   - 硬直中的單位（recoveryRemaining > 0）：同步扣減，不參與 ATB 充能
 */

import type { GameState, ATBEntry } from './state'
import type { Event, ATBReadyEvent } from './events'

export type AdvanceTimeResult = {
  newState: GameState
  events: Event[]
}

/**
 * maxDeltaMs：限制本次推進的最大遊戲時間（ms）。
 * 省略 = 瞬間模式（一次跳到下一個 ATB=100 事件）。
 * 傳入 50 = 計時器模式（每次只推進 50ms，ATB 可視化填充）。
 */
export function advanceTime(state: GameState, maxDeltaMs?: number): AdvanceTimeResult {
  const events: Event[] = []
  const entries = state.timeline.entries

  // ── 多單位同時到達 100 時，後續單位等待處理 ──────────────────────────────
  // 若 pendingUnitId 已清除（null），先看有無 atb=100 且不在讀條/硬直中的單位。
  // 這處理「多單位同時到達 100，第一個行動後其他仍在等待」的情境。
  type Candidate = { unitId: string; msNeeded: number; kind: 'player' | 'monster' }
  if (state.timeline.pendingUnitId === null) {
    const readyUnits: Candidate[] = []
    for (const entry of entries) {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) continue
      if (entry.recoveryRemaining > 0) continue
      if (entry.castRemaining > 0) continue  // 讀條中，不算 ready
      if (entry.atb < 100) continue
      readyUnits.push({ unitId: unit.id, msNeeded: 0, kind: unit.kind })
    }
    if (readyUnits.length > 0) {
      readyUnits.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'player' ? -1 : 1
        return a.unitId < b.unitId ? -1 : 1
      })
      const winner = readyUnits[0]
      events.push({ type: 'ATB_READY', unitId: winner.unitId })
      return {
        newState: { ...state, timeline: { ...state.timeline, pendingUnitId: winner.unitId } },
        events,
      }
    }
  }

  // 找出「不在硬直中、atb < 100」的單位，計算各自到達 100 需要多少 ms
  const candidates: Candidate[] = []

  for (const entry of entries) {
    const unit = state.units[entry.unitId]
    if (!unit || unit.isDead) continue
    if (entry.recoveryRemaining > 0) continue  // 硬直中，不充能
    if (entry.atb >= 100) continue             // 已有行動權，等待消費

    const msNeeded = (100 - entry.atb) / unit.speed * 1000  // speed 單位：ATB/秒
    candidates.push({ unitId: unit.id, msNeeded, kind: unit.kind })
  }

  // 若無可充能單位（全在硬直或死亡），嘗試推進時間讓讀條/硬直先完成
  if (candidates.length === 0) {
    // 找最近的讀條/硬直完成時間，推進 tick 讓 step 2（RESOLVE_CAST）得以觸發
    let minWaitMs = Infinity
    for (const entry of entries) {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) continue
      if (entry.castRemaining > 0) minWaitMs = Math.min(minWaitMs, entry.castRemaining)
      if (entry.recoveryRemaining > 0) minWaitMs = Math.min(minWaitMs, entry.recoveryRemaining)
    }
    if (minWaitMs === Infinity) return { newState: state, events }  // 真的卡死（不應發生）

    if (maxDeltaMs !== undefined) minWaitMs = Math.min(minWaitMs, maxDeltaMs)

    const waitEntries: ATBEntry[] = entries.map(entry => {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) return entry
      const ne = { ...entry }
      if (ne.recoveryRemaining > 0) {
        ne.recoveryRemaining = Math.max(0, ne.recoveryRemaining - minWaitMs)
      } else {
        ne.atb = Math.min(100, ne.atb + unit.speed * (minWaitMs / 1000))
      }
      if (ne.castRemaining > 0) ne.castRemaining = Math.max(0, ne.castRemaining - minWaitMs)
      return ne
    })
    return {
      newState: { ...state, timeline: { ...state.timeline, tick: state.timeline.tick + minWaitMs, entries: waitEntries } },
      events,
    }
  }

  // 找最小 msNeeded
  let minMs = Infinity
  for (const c of candidates) {
    if (c.msNeeded < minMs) minMs = c.msNeeded
  }

  // 計時器模式：若 maxDeltaMs 限制住了，只推進 maxDeltaMs（不觸發 ATB_READY）
  if (maxDeltaMs !== undefined && minMs > maxDeltaMs) {
    const cappedEntries: ATBEntry[] = entries.map(entry => {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) return entry
      const ne = { ...entry }
      if (ne.recoveryRemaining > 0) {
        ne.recoveryRemaining = Math.max(0, ne.recoveryRemaining - maxDeltaMs)
      } else {
        ne.atb = Math.min(100, ne.atb + unit.speed * (maxDeltaMs / 1000))
      }
      if (ne.castRemaining > 0) ne.castRemaining = Math.max(0, ne.castRemaining - maxDeltaMs)
      return ne
    })
    return {
      newState: { ...state, timeline: { ...state.timeline, tick: state.timeline.tick + maxDeltaMs, entries: cappedEntries } },
      events,
    }
  }

  // 同時到達：player 優先，同類依 id 字典序
  const simultaneous = candidates.filter(c => Math.abs(c.msNeeded - minMs) < 0.001)
  simultaneous.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'player' ? -1 : 1
    return a.unitId < b.unitId ? -1 : 1
  })
  const winner = simultaneous[0]

  // 推進所有單位 atb，同步扣減讀條/硬直
  const newEntries: ATBEntry[] = entries.map(entry => {
    const unit = state.units[entry.unitId]
    if (!unit || unit.isDead) return entry

    const newEntry = { ...entry }

    // 扣減硬直
    if (newEntry.recoveryRemaining > 0) {
      newEntry.recoveryRemaining = Math.max(0, newEntry.recoveryRemaining - minMs)
    } else {
      // 充能 ATB（硬直結束後才充）
      newEntry.atb = Math.min(100, newEntry.atb + unit.speed * (minMs / 1000))
    }

    // 扣減讀條
    if (newEntry.castRemaining > 0) {
      newEntry.castRemaining = Math.max(0, newEntry.castRemaining - minMs)
    }

    return newEntry
  })

  // winner 的 atb 設為 100（浮點數修正）
  const winnerIdx = newEntries.findIndex(e => e.unitId === winner.unitId)
  if (winnerIdx >= 0) newEntries[winnerIdx] = { ...newEntries[winnerIdx], atb: 100 }

  const atbReadyEvent: ATBReadyEvent = {
    type: 'ATB_READY',
    unitId: winner.unitId,
  }
  events.push(atbReadyEvent)

  const newState: GameState = {
    ...state,
    timeline: {
      ...state.timeline,
      tick: state.timeline.tick + minMs,
      pendingUnitId: winner.unitId,
      entries: newEntries,
    },
  }

  return { newState, events }
}

/**
 * consumeATB — 單位行動後，重置 ATB 為 0，設定硬直
 * 在 reduce 的 MOVE / RESOLVE_CAST 等 case 中呼叫
 *
 * 注意：只有在 unitId === pendingUnitId 時才清除 pendingUnitId，
 * 避免讀條結算（RESOLVE_CAST）覆蓋掉其他單位的行動權。
 */
export function consumeATB(
  state: GameState,
  unitId: string,
  recoveryMs: number
): GameState {
  const newEntries = state.timeline.entries.map(entry => {
    if (entry.unitId !== unitId) return entry
    return { ...entry, atb: 0, recoveryRemaining: recoveryMs }
  })

  // SP 自然回復：行動結束後，依 spRecoveryFlat 補充 SP
  const unit = state.units[unitId]
  const spRecovery = unit?.spRecoveryFlat ?? 0
  const newUnits = spRecovery > 0 && unit
    ? { ...state.units, [unitId]: { ...unit, currentSP: Math.min(unit.maxSP, unit.currentSP + spRecovery) } }
    : state.units

  return {
    ...state,
    units: newUnits,
    timeline: {
      ...state.timeline,
      pendingUnitId: state.timeline.pendingUnitId === unitId ? null : state.timeline.pendingUnitId,
      entries: newEntries,
    },
  }
}

/**
 * startCast — 單位開始讀條，設定 castRemaining（ATB 不重置，讀條結束後才行動）
 */
export function startCast(
  state: GameState,
  unitId: string,
  castMs: number
): GameState {
  const newEntries = state.timeline.entries.map(entry => {
    if (entry.unitId !== unitId) return entry
    return { ...entry, castRemaining: castMs }
  })
  return {
    ...state,
    timeline: { ...state.timeline, entries: newEntries },
  }
}
