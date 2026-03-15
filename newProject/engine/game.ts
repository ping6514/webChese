/**
 * game.ts — GameState 工廠
 *
 * createGameState(params) → GameState
 *
 * 職責：
 *   - 接收 createFloor() 的結果 + 玩家清單 + RunState 初始值
 *   - 將所有 Unit（玩家 + 怪物）放入 units{}
 *   - 初始化 ATB timeline（全員 atb=0，castRemaining=0，recoveryRemaining=0）
 *   - 玩家自動分配到 playerEntryPositions（超出數量則堆疊在第一格）
 *   - 回傳完整可以立即執行 reduce() 的 GameState
 *
 * 注意：純函數，不做 I/O。
 */

import type { GameState, Unit, ATBEntry, TimelineState, RunState, TurnFlags } from './state'
import type { CreateFloorResult } from './dungeon'

// ─── 參數型別 ─────────────────────────────────────────────────────────────────

export type CreateGameStateParams = {
  /** createFloor() 的完整輸出 */
  floorResult: CreateFloorResult
  /** 已建立的玩家 Unit 清單（createPlayerUnit 輸出，位置會被 entry 覆寫）*/
  players: Unit[]
  /** RunState 初始值（floorNumber / difficulty / theme 等）*/
  run: RunState
  /** 起始 tick（預設 0）*/
  initialTick?: number
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * 從樓層資料 + 玩家清單組裝出完整的起始 GameState。
 *
 * 玩家入場位置由 floorResult.playerEntryPositions 決定；
 * 若玩家數 > 入場格數，多出的玩家放在最後一個入場格。
 */
export function createGameState(params: CreateGameStateParams): GameState {
  const { floorResult, players, run, initialTick = 0 } = params
  const { floor, units: monsterUnits, playerEntryPositions } = floorResult

  // ── 放置玩家到入場格 ──────────────────────────────────────────────────────
  const entryFallback = playerEntryPositions[0] ?? { x: 1, y: 1 }
  const positionedPlayers = players.map((p, i) => ({
    ...p,
    pos: playerEntryPositions[i] ?? entryFallback,
    facing: 'down' as const,
  }))

  // ── 合併所有 Unit ─────────────────────────────────────────────────────────
  const units: Record<string, Unit> = { ...monsterUnits }
  for (const p of positionedPlayers) {
    units[p.id] = p
  }

  // ── 初始化 ATB timeline ───────────────────────────────────────────────────
  const entries: ATBEntry[] = Object.values(units).map(u => ({
    unitId: u.id,
    atb: 0,
    castRemaining: 0,
    recoveryRemaining: 0,
  }))

  const timeline: TimelineState = {
    tick: initialTick,
    pendingUnitId: null,
    entries,
  }

  const turnFlags: TurnFlags = {
    actingUnitId: null,
  }

  return {
    floor,
    units,
    timeline,
    turnFlags,
    run,
  }
}

// ─── RunState 工廠（方便快速建立）────────────────────────────────────────────

export type CreateRunParams = {
  floorNumber?: number
  maxFloors?: number
  difficulty?: number
  theme?: 'forest' | 'ruins'
  dungeonQuality?: number
  lootQuality?: number
  runSeed?: string
  /** 玩家人數（影響寶相數量與開箱次數，預設 1）*/
  playerCount?: number
  /** 戰利品分配模式（預設 free_for_all）*/
  lootDistributionMode?: import('./state').LootDistributionMode
  /** 隊長 playerId（captain 模式時必填）*/
  captainPlayerId?: string
}

/** 建立初始 RunState，未指定的欄位使用合理預設值 */
export function createRun(params: CreateRunParams = {}): RunState {
  return {
    runSeed:              params.runSeed              ?? 'default',
    difficulty:           params.difficulty           ?? 1,
    theme:                params.theme                ?? 'forest',
    floorNumber:          params.floorNumber          ?? 1,
    maxFloors:            params.maxFloors            ?? 10,
    pathHistory:          [],
    trialFloorCount:      0,
    dungeonQuality:       params.dungeonQuality       ?? 1.0,
    lootQuality:          params.lootQuality          ?? 1.0,
    status:               'active',
    playerCount:          params.playerCount          ?? 1,
    lootDistributionMode: params.lootDistributionMode ?? 'free_for_all',
    captainPlayerId:      params.captainPlayerId      ?? null,
    lootPhase:            null,
  }
}
