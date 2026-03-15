/**
 * campaign.ts — 多層地城編排
 *
 * 職責：
 *   - 解析 DungeonConfig（forest_config.json 格式）
 *   - selectFloorPlan()：依 floorNumber + pathType 選出 roomId + DungeonFloorConfig
 *   - buildFloorFromConfig()：組合 selectFloorPlan + createFloor，一步產生 CreateFloorResult
 *   - advanceRun()：一層通關後更新 RunState（pathHistory、trialFloorCount、lootQuality）
 *
 * 設計原則：
 *   - 純函數，不做 I/O（呼叫方負責載入所有 JSON）
 *   - rng 可注入，確保地城序列可重現
 *   - Floor 10 強制為 boss 路線，忽略傳入的 pathType
 */

import type { RunState } from './state'
import type { RoomDef, ChunkDef, DungeonFloorConfig, MonsterRegistry, CreateFloorResult, EncounterDef } from './dungeon'
import { createFloor } from './dungeon'

// ─── DungeonConfig 型別（對應 forest_config.json）────────────────────────────

export type PathConfig = {
  roomPool: string[]
  encounters: EncounterDef[]
  isBossRoom?: boolean
}

export type FloorConfigEntry = {
  floor: number
  safe?: PathConfig
  trial?: PathConfig
  /** Boss 層（floor=10）專用欄位，優先於 safe/trial */
  boss?: PathConfig
}

export type DungeonConfig = {
  theme: string
  bossPool: string[]
  totalFloors: number
  floorConfigs: FloorConfigEntry[]
}

// ─── FloorPlan：selectFloorPlan 的回傳值 ─────────────────────────────────────

export type FloorPlan = {
  /** 選出的房間 id（來自 roomPool 隨機抽取）*/
  roomId: string
  /** 傳入 createFloor 的 DungeonFloorConfig */
  floorConfig: DungeonFloorConfig
  /** 實際使用的路徑（boss 層固定回傳 'trial'）*/
  pathType: 'safe' | 'trial'
  /** 是否為 Boss 層 */
  isBossRoom: boolean
}

// ─── selectFloorPlan ──────────────────────────────────────────────────────────

/**
 * 從 DungeonConfig 中選出指定樓層的房間 + 遭遇設定。
 *
 * 規則：
 *   - 若 entry 有 boss 欄位（通常為 floor=10）→ 強制使用 boss 路線
 *   - 否則依 pathType 選 safe 或 trial
 *   - 從 roomPool 中隨機選出一個 roomId
 *
 * @throws 若 floorNumber 不在 floorConfigs 中，或 pathConfig 不存在
 */
export function selectFloorPlan(
  dungeonConfig: DungeonConfig,
  floorNumber: number,
  pathType: 'safe' | 'trial',
  rng: () => number = Math.random
): FloorPlan {
  const entry = dungeonConfig.floorConfigs.find(e => e.floor === floorNumber)
  if (!entry) {
    throw new Error(`DungeonConfig 中找不到 floor=${floorNumber} 的設定`)
  }

  // Boss 層優先
  const isBossRoom = !!entry.boss
  const pathConfig: PathConfig | undefined = entry.boss ?? entry[pathType]

  if (!pathConfig) {
    throw new Error(`floor=${floorNumber} 沒有 '${pathType}' 路線設定`)
  }

  // 從 roomPool 隨機選一個 roomId
  if (pathConfig.roomPool.length === 0) {
    throw new Error(`floor=${floorNumber} roomPool 為空`)
  }
  const roomId = pathConfig.roomPool[Math.floor(rng() * pathConfig.roomPool.length)]!

  const floorConfig: DungeonFloorConfig = {
    encounters: pathConfig.encounters,
    isBossRoom: isBossRoom || !!pathConfig.isBossRoom,
  }

  return {
    roomId,
    floorConfig,
    pathType: isBossRoom ? 'trial' : pathType,
    isBossRoom,
  }
}

// ─── buildFloorFromConfig ─────────────────────────────────────────────────────

export type BuildFloorParams = {
  dungeonConfig: DungeonConfig
  /** 預載的 RoomDef map（roomId → RoomDef）*/
  roomDefs: Record<string, RoomDef>
  /** 預載的 ChunkDef map（chunkId → ChunkDef，可省略）*/
  chunkDefs?: Record<string, ChunkDef>
  /** 預載的怪物 Registry */
  monsterRegistry: MonsterRegistry
  floorNumber: number
  pathType: 'safe' | 'trial'
  seed: string
  dungeonQuality?: number
  rng?: () => number
}

/**
 * 一步完成：selectFloorPlan → 查找 RoomDef → createFloor。
 *
 * @returns CreateFloorResult（同 createFloor）+ 額外的 floorPlan 資訊
 */
export function buildFloorFromConfig(params: BuildFloorParams): CreateFloorResult & { floorPlan: FloorPlan } {
  const {
    dungeonConfig,
    roomDefs,
    chunkDefs = {},
    monsterRegistry,
    floorNumber,
    pathType,
    seed,
    dungeonQuality = 1.0,
    rng = Math.random,
  } = params

  const floorPlan = selectFloorPlan(dungeonConfig, floorNumber, pathType, rng)

  const roomDef = roomDefs[floorPlan.roomId]
  if (!roomDef) {
    throw new Error(`roomDefs 中找不到 '${floorPlan.roomId}'（floor=${floorNumber}）`)
  }

  const result = createFloor({
    roomDef,
    chunkDefs,
    floorConfig: floorPlan.floorConfig,
    monsterRegistry,
    theme: dungeonConfig.theme as 'forest' | 'ruins',
    floorNumber,
    seed,
    pathType: floorPlan.pathType,
    dungeonQuality,
    rng,
  })

  return { ...result, floorPlan }
}

// ─── advanceRun ───────────────────────────────────────────────────────────────

/**
 * 一層通關後更新 RunState：
 *   - pathHistory 追加本層路線
 *   - trialFloorCount 累計試煉層數
 *   - floorNumber +1
 *   - lootQuality 依試煉比例重算（DESIGN.md §1.3）
 *
 * 公式：lootQuality = difficulty × (1 + trialRatio × 0.5)
 */
export function advanceRun(run: RunState, pathType: 'safe' | 'trial'): RunState {
  const newPathHistory = [...run.pathHistory, pathType]
  const newTrialCount = run.trialFloorCount + (pathType === 'trial' ? 1 : 0)
  const newFloorNumber = run.floorNumber + 1

  const trialRatio = newPathHistory.length > 0
    ? newTrialCount / newPathHistory.length
    : 0

  const newLootQuality = run.difficulty * (1 + trialRatio * 0.5)

  return {
    ...run,
    floorNumber: newFloorNumber,
    pathHistory: newPathHistory,
    trialFloorCount: newTrialCount,
    lootQuality: newLootQuality,
  }
}

// ─── 整合查詢輔助 ─────────────────────────────────────────────────────────────

/**
 * 取得完整 10 層的路徑計劃（用於預覽或 UI 顯示）。
 * 回傳每層可選的 roomPool 與 pathType，不生成實際 FloorState。
 */
export type FloorPreview = {
  floorNumber: number
  pathType: 'safe' | 'trial' | 'boss'
  roomPool: string[]
  encounterSummary: { spawnerId: string; tier: string; count: number }[]
}

export function previewCampaign(
  dungeonConfig: DungeonConfig,
  chosenPaths: ('safe' | 'trial')[]
): FloorPreview[] {
  return dungeonConfig.floorConfigs.map(entry => {
    const isBoss = !!entry.boss
    const chosenPath = isBoss ? 'boss' : (chosenPaths[entry.floor - 1] ?? 'safe')
    const pathConfig: PathConfig | undefined = isBoss
      ? entry.boss
      : (chosenPath === 'trial' ? entry.trial : entry.safe)

    return {
      floorNumber: entry.floor,
      pathType: chosenPath as 'safe' | 'trial' | 'boss',
      roomPool: pathConfig?.roomPool ?? [],
      encounterSummary: (pathConfig?.encounters ?? []).map(e => ({
        spawnerId: e.spawnerId,
        tier: e.tier,
        count: e.count,
      })),
    }
  })
}
