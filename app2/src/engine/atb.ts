/**
 * engine/atb.ts — ATB 時間軸推進（移植自 newProject/engine/atb.ts）
 *
 * 修改項目：
 *   - GameState / ATBEntry 改用 app2 的型別
 *   - ATBEntry 新增 speedMult（冰凍效果用）
 *   - UnitKind 改為 UnitTeam（'player'/'enemy'）
 *   - 麻痺/睡眠的 stun 狀態：advanceTime 跳過被 stun 的單位充能
 */

import type { GameState, ATBEntry } from './state'
import type { Event, ATBReadyEvent } from './events'

export type AdvanceTimeResult = {
  newState: GameState
  events: Event[]
}

/**
 * advanceTime — 推進時間軸，找出下一個獲得行動權的單位
 *
 * maxDeltaMs：限制本次推進的最大遊戲時間（ms）。
 * 省略 = 瞬間模式（直接跳到下一個 ATB=100 事件）。
 * 傳入 50 = 計時器模式（每幀推進 50ms，ATB 可視化填充）。
 */
export function advanceTime(state: GameState, maxDeltaMs?: number): AdvanceTimeResult {
  const events: Event[] = []
  const entries = state.timeline.entries

  // ── 若 pending 為 null，先檢查有無 atb=100 且不在讀條/硬直/stun 的單位 ──
  if (state.timeline.pendingUnitId === null) {
    type Candidate = { unitId: string; msNeeded: number; isPlayer: boolean }
    const readyUnits: Candidate[] = []
    for (const entry of entries) {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) continue
      if (entry.recoveryRemaining > 0) continue
      if (entry.castRemaining > 0) continue
      if (entry.atb < 100) continue
      if (isStunned(unit)) continue  // 麻痺/睡眠中，跳過
      readyUnits.push({ unitId: unit.id, msNeeded: 0, isPlayer: unit.team === 'player' })
    }
    if (readyUnits.length > 0) {
      readyUnits.sort((a, b) => {
        if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1
        return a.unitId < b.unitId ? -1 : 1
      })
      const winner = readyUnits[0]!
      const atbEvent: ATBReadyEvent = { type: 'ATB_READY', unitId: winner.unitId }
      events.push(atbEvent)
      return {
        newState: { ...state, timeline: { ...state.timeline, pendingUnitId: winner.unitId } },
        events,
      }
    }
  }

  type Candidate = { unitId: string; msNeeded: number; isPlayer: boolean }
  const candidates: Candidate[] = []
  for (const entry of entries) {
    const unit = state.units[entry.unitId]
    if (!unit || unit.isDead) continue
    if (entry.recoveryRemaining > 0) continue
    if (entry.atb >= 100) continue
    if (isStunned(unit)) continue  // stun 中不充能

    const effectiveSpeed = unit.speed * entry.speedMult
    if (effectiveSpeed <= 0) continue
    const msNeeded = (100 - entry.atb) / effectiveSpeed * 1000
    candidates.push({ unitId: unit.id, msNeeded, isPlayer: unit.team === 'player' })
  }

  // 若無可充能單位（全在硬直或 stun），推進讀條/硬直
  if (candidates.length === 0) {
    let minWaitMs = Infinity
    for (const entry of entries) {
      const unit = state.units[entry.unitId]
      if (!unit || unit.isDead) continue
      if (entry.castRemaining > 0) minWaitMs = Math.min(minWaitMs, entry.castRemaining)
      if (entry.recoveryRemaining > 0) minWaitMs = Math.min(minWaitMs, entry.recoveryRemaining)
    }
    // 也考慮 stun 到期時間
    for (const unit of Object.values(state.units)) {
      if (unit.isDead) continue
      const stunEffect = unit.statusEffects.find(s => s.id === 'paralyze' || s.id === 'sleep')
      if (stunEffect && stunEffect.expiresAt !== Infinity) {
        const remaining = stunEffect.expiresAt - state.timeline.tick
        if (remaining > 0) minWaitMs = Math.min(minWaitMs, remaining)
      }
    }
    if (minWaitMs === Infinity) return { newState: state, events }
    if (maxDeltaMs !== undefined) minWaitMs = Math.min(minWaitMs, maxDeltaMs)
    return { newState: tickForward(state, minWaitMs), events }
  }

  // 找最小 msNeeded
  let minMs = candidates.reduce((min, c) => Math.min(min, c.msNeeded), Infinity)

  // 計時器模式：若 maxDeltaMs 限制住了
  if (maxDeltaMs !== undefined && minMs > maxDeltaMs) {
    return { newState: tickForward(state, maxDeltaMs), events }
  }

  // 同時到達：player 優先，同類依 id 字典序
  const simultaneous = candidates.filter(c => Math.abs(c.msNeeded - minMs) < 0.001)
  simultaneous.sort((a, b) => {
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1
    return a.unitId < b.unitId ? -1 : 1
  })
  const winner = simultaneous[0]!

  const newEntries = tickEntries(entries, state, minMs)

  // winner 的 atb 設為 100（浮點修正）
  const winnerIdx = newEntries.findIndex(e => e.unitId === winner.unitId)
  if (winnerIdx >= 0) {
    const existing = newEntries[winnerIdx]!
    newEntries[winnerIdx] = { ...existing, atb: 100 }
  }

  const atbEvent: ATBReadyEvent = { type: 'ATB_READY', unitId: winner.unitId }
  events.push(atbEvent)

  return {
    newState: {
      ...state,
      timeline: {
        ...state.timeline,
        tick: state.timeline.tick + minMs,
        pendingUnitId: winner.unitId,
        entries: newEntries,
      },
    },
    events,
  }
}

/**
 * consumeATB — 單位行動後，ATB 歸零，設定後搖硬直
 */
export function consumeATB(
  state: GameState,
  unitId: string,
  recoveryMs: number,
): GameState {
  const newEntries = state.timeline.entries.map(entry => {
    if (entry.unitId !== unitId) return entry
    return { ...entry, atb: 0, recoveryRemaining: recoveryMs }
  })
  return {
    ...state,
    timeline: {
      ...state.timeline,
      pendingUnitId: state.timeline.pendingUnitId === unitId ? null : state.timeline.pendingUnitId,
      entries: newEntries,
    },
  }
}

/**
 * startCast — 單位開始讀條，設定 castRemaining（ATB 不重置）
 */
export function startCast(
  state: GameState,
  unitId: string,
  castMs: number,
  warningCells: import('./state').HexPos[] = [],
): { newState: GameState; events: import('./events').Event[] } {
  const newEntries = state.timeline.entries.map(entry => {
    if (entry.unitId !== unitId) return entry
    return { ...entry, castRemaining: castMs }
  })
  const castEvent: import('./events').CastStartedEvent = {
    type: 'CAST_STARTED',
    unitId,
    castTimeMs: castMs,
    warningCells,
  }
  return {
    newState: { ...state, timeline: { ...state.timeline, entries: newEntries } },
    events: [castEvent],
  }
}

/**
 * applyFreeze — 設定單位的 ATBEntry.speedMult（冰凍效果）
 */
export function applyFreeze(
  state: GameState,
  unitId: string,
  speedMult: number,
): GameState {
  const newEntries = state.timeline.entries.map(entry => {
    if (entry.unitId !== unitId) return entry
    return { ...entry, speedMult }
  })
  return { ...state, timeline: { ...state.timeline, entries: newEntries } }
}

/**
 * clearFreeze — 移除冰凍後，恢復 speedMult=1
 */
export function clearFreeze(state: GameState, unitId: string): GameState {
  return applyFreeze(state, unitId, 1.0)
}

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

function isStunned(unit: import('./state').CombatUnit): boolean {
  return unit.statusEffects.some(s => s.id === 'paralyze' || s.id === 'sleep')
}

function tickEntries(
  entries: ATBEntry[],
  state: GameState,
  deltaMs: number,
): ATBEntry[] {
  return entries.map(entry => {
    const unit = state.units[entry.unitId]
    if (!unit || unit.isDead) return entry
    const ne = { ...entry }
    if (ne.recoveryRemaining > 0) {
      ne.recoveryRemaining = Math.max(0, ne.recoveryRemaining - deltaMs)
    } else if (!isStunned(unit)) {
      const effectiveSpeed = unit.speed * ne.speedMult
      ne.atb = Math.min(100, ne.atb + effectiveSpeed * (deltaMs / 1000))
    }
    if (ne.castRemaining > 0) {
      ne.castRemaining = Math.max(0, ne.castRemaining - deltaMs)
    }
    return ne
  })
}

function tickForward(state: GameState, deltaMs: number): GameState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tick: state.timeline.tick + deltaMs,
      entries: tickEntries(state.timeline.entries, state, deltaMs),
    },
  }
}
