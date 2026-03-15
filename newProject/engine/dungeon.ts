/**
 * dungeon.ts — 地城樓層初始化
 *
 * createFloor(params) → CreateFloorResult
 *
 * 職責：
 *   - 接收預載的 RoomDef（room JSON）+ DungeonFloorConfig（forest_config.json 單層資料）
 *   - 解析 grid 字元 → Cell[][]
 *   - 套用 chunkZones（隨機地形嵌入）
 *   - 套用 propZones（道具/恢復格隨機放置）
 *   - 依 encounters 生成怪物 Unit（呼叫 spawnMonster）
 *   - 同時處理標準房間（spawnZones）與 Boss 競技場（spawnPoints）兩種格式
 *   - 回傳完整的 FloorState + units + 玩家入場位置 + 出口座標
 *
 * 設計原則：
 *   - 純函數，不做任何 I/O（呼叫方負責載入 JSON）
 *   - rng 可注入，確保地城生成可重現
 */

import type { FloorState, Cell, CellType, FloorObjective, Pos, Unit } from './state'
import type { MonsterDef, SpawnerDef } from './spawner'
import { spawnMonster } from './spawner'

// ─── 房間 JSON 型別（對應 forest_room_*.json）────────────────────────────────

export type SpawnZoneDef = {
  id: string
  cells: Pos[]
}

export type ChunkZoneDef = {
  id: string
  topLeft: Pos
  size: { width: number; height: number }
  allowedChunks: string[]
  pickCount: number
}

export type PropZoneDef = {
  cells: Pos[]
  props: { type: string; weight: number }[]
  maxPlacements: number
}

/** 一般房間或 Boss 競技場的 JSON 型別 */
export type RoomDef = {
  id: string
  name: string
  theme: string
  width: number
  height: number
  grid: string[]
  chunkZones?: ChunkZoneDef[]
  propZones?: PropZoneDef[]
  /** 標準房間：spawnZones（含 player_entry / enemy_zone_* / exit）*/
  spawnZones?: SpawnZoneDef[]
  /** Boss 競技場：spawnPoints（forest_guardian_arena.json 格式）*/
  spawnPoints?: {
    boss: Pos
    players: Pos[]
    reinforcementZones?: Pos[][]
  }
  bossId?: string
}

export type ChunkDef = {
  id: string
  size: { width: number; height: number }
  grid: string[]
}

// ─── 地城樓層設定（對應 forest_config.json 的 floorConfigs[].safe/.trial）──────

export type EncounterDef = {
  zoneId: string
  spawnerId: string
  tier: 'normal' | 'elite' | 'boss'
  count: number
}

export type DungeonFloorConfig = {
  encounters: EncounterDef[]
  isBossRoom?: boolean
}

// ─── 怪物資料 Registry ────────────────────────────────────────────────────────

export type MonsterEntry = {
  def: MonsterDef
  spawner: SpawnerDef
}

/** monsterId（即 spawnerId）→ { def, spawner } */
export type MonsterRegistry = Record<string, MonsterEntry>

// ─── createFloor 參數 / 回傳 ──────────────────────────────────────────────────

export type CreateFloorParams = {
  roomDef: RoomDef
  chunkDefs?: Record<string, ChunkDef>
  floorConfig: DungeonFloorConfig
  monsterRegistry: MonsterRegistry
  theme: 'forest' | 'ruins'
  floorNumber: number
  seed: string
  pathType: 'safe' | 'trial'
  dungeonQuality?: number
  rng?: () => number
}

export type CreateFloorResult = {
  floor: FloorState
  units: Record<string, Unit>
  playerEntryPositions: Pos[]
  exitPos: Pos
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

export function createFloor(params: CreateFloorParams): CreateFloorResult {
  const {
    roomDef,
    chunkDefs = {},
    floorConfig,
    monsterRegistry,
    theme,
    floorNumber,
    seed,
    pathType,
    dungeonQuality = 1.0,
    rng = Math.random,
  } = params

  // 1. 從 grid 字元建立 Cell[][]
  const cells: Cell[][] = buildGrid(roomDef)

  // 2. 套用 chunk 覆蓋（隨機地形嵌入）
  applyChunks(cells, roomDef.chunkZones ?? [], chunkDefs, rng)

  // 3. 解析 spawnZone/spawnPoints 為統一格式
  const { spawnZoneMap, playerEntryPositions, exitPos, isBossArena } =
    resolveSpawnInfo(roomDef, rng)

  // 4. 出口格設為 stairs_down
  if (!isBossArena) {
    const exitCells = spawnZoneMap['exit'] ?? [exitPos]
    for (const pos of exitCells) {
      setCell(cells, pos, { ...getCell(cells, pos), type: 'stairs_down' })
    }
  }

  // 5. 套用 propZones（放置回復格/寶箱）
  applyPropZones(cells, roomDef.propZones ?? [], rng)

  // 6. 依 encounters 生成怪物 Unit
  const units: Record<string, Unit> = {}
  let unitSeq = 0

  for (const enc of floorConfig.encounters) {
    const entry = monsterRegistry[enc.spawnerId]
    if (!entry) continue

    const zoneCells =
      isBossArena && enc.zoneId === 'boss_spawn' && roomDef.spawnPoints
        ? [roomDef.spawnPoints.boss]
        : (spawnZoneMap[enc.zoneId] ?? [])

    const positions = pickWithoutReplacement(zoneCells, enc.count, rng)
    for (const pos of positions) {
      const unitId = `${enc.spawnerId}_${enc.tier}_f${floorNumber}_${unitSeq++}`
      const unit = spawnMonster({
        monsterDef: entry.def,
        spawnerDef: entry.spawner,
        tier: enc.tier,
        pos,
        floorNumber,
        dungeonQuality,
        rng,
        unitId,
      })
      units[unitId] = unit
    }
  }

  // 7. 推導樓層目標
  const objective = deriveObjective(floorConfig, units, exitPos)

  // 8. 組裝 FloorState
  const floor: FloorState = {
    width: roomDef.width,
    height: roomDef.height,
    cells,
    seed,
    floorNumber,
    pathType,
    theme,
    objective,
    hazards: {},
    projectiles: [],
    loot: [],
  }

  return { floor, units, playerEntryPositions, exitPos }
}

// ─── Grid 解析 ────────────────────────────────────────────────────────────────

function buildGrid(roomDef: RoomDef): Cell[][] {
  const cells: Cell[][] = []
  for (let y = 0; y < roomDef.height; y++) {
    const row: Cell[] = []
    const rowStr = roomDef.grid[y] ?? ''
    for (let x = 0; x < roomDef.width; x++) {
      row.push(charToCell(rowStr[x] ?? '#'))
    }
    cells.push(row)
  }
  return cells
}

/**
 * Grid 字元對應規則：
 *   #  → wall（不可通行，擋視線）
 *   T  → forest 地形（可通行，擋視線 — 樹木）
 *   W  → water 地形（可通行，不擋視線）
 *   S  → 樓梯標記（暫作 floor，由 spawnZone 處理覆蓋為 stairs_down）
 *   U  → 玩家入場標記（floor）
 *   .  → 普通地板
 */
function charToCell(ch: string): Cell {
  switch (ch) {
    case '#':
      return { type: 'wall',  height: 1, passable: false, blockLineOfSight: true,  terrain: 'normal' }
    case 'T':
      return { type: 'floor', height: 1, passable: true,  blockLineOfSight: true,  terrain: 'forest' }
    case 'W':
      return { type: 'floor', height: 1, passable: true,  blockLineOfSight: false, terrain: 'water'  }
    case 'S':
    case 'U':
    case '.':
    default:
      return { type: 'floor', height: 1, passable: true,  blockLineOfSight: false, terrain: 'normal' }
  }
}

function applyChunks(
  cells: Cell[][],
  zones: ChunkZoneDef[],
  chunkDefs: Record<string, ChunkDef>,
  rng: () => number
) {
  for (const zone of zones) {
    const chunkId = pickOne(zone.allowedChunks, rng)
    if (!chunkId || chunkId === 'empty_placeholder') continue
    const chunk = chunkDefs[chunkId]
    if (!chunk) continue

    for (let dy = 0; dy < zone.size.height; dy++) {
      const rowStr = chunk.grid[dy] ?? ''
      for (let dx = 0; dx < zone.size.width; dx++) {
        const x = zone.topLeft.x + dx
        const y = zone.topLeft.y + dy
        if (cells[y] && cells[y][x] !== undefined) {
          cells[y][x] = charToCell(rowStr[dx] ?? '.')
        }
      }
    }
  }
}

function applyPropZones(cells: Cell[][], zones: PropZoneDef[], rng: () => number) {
  for (const zone of zones) {
    let placed = 0
    const shuffled = [...zone.cells].sort(() => rng() - 0.5)
    for (const pos of shuffled) {
      if (placed >= zone.maxPlacements) break
      const propType = weightedPick(zone.props, rng)?.type
      if (propType && propType !== 'empty') {
        setCell(cells, pos, { ...getCell(cells, pos), type: propType as CellType })
        placed++
      }
    }
  }
}

// ─── Spawn 資訊統一化 ──────────────────────────────────────────────────────────

type SpawnInfo = {
  spawnZoneMap: Record<string, Pos[]>
  playerEntryPositions: Pos[]
  exitPos: Pos
  isBossArena: boolean
}

function resolveSpawnInfo(roomDef: RoomDef, rng: () => number): SpawnInfo {
  // Boss 競技場格式（spawnPoints）
  if (roomDef.spawnPoints) {
    return {
      spawnZoneMap: { boss_spawn: [roomDef.spawnPoints.boss] },
      playerEntryPositions: roomDef.spawnPoints.players,
      exitPos: { x: 0, y: 0 },  // boss 房間無出口
      isBossArena: true,
    }
  }

  // 標準房間格式（spawnZones）
  const spawnZoneMap: Record<string, Pos[]> = {}
  for (const zone of roomDef.spawnZones ?? []) {
    spawnZoneMap[zone.id] = zone.cells
  }

  const playerEntryPositions = spawnZoneMap['player_entry'] ?? []
  const exitCells = spawnZoneMap['exit'] ?? []
  const exitPos = pickOne(exitCells, rng) ?? { x: roomDef.width - 2, y: 1 }

  return { spawnZoneMap, playerEntryPositions, exitPos, isBossArena: false }
}

// ─── 目標推導 ─────────────────────────────────────────────────────────────────

function deriveObjective(
  floorConfig: DungeonFloorConfig,
  units: Record<string, Unit>,
  exitPos: Pos
): FloorObjective {
  if (floorConfig.isBossRoom) {
    const bossEntry = Object.entries(units).find(([, u]) => u.ai === 'boss')
    if (bossEntry) return { type: 'kill_boss', bossId: bossEntry[0] }
  }
  return { type: 'reach_exit', exitPos }
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

function getCell(cells: Cell[][], pos: Pos): Cell {
  return (
    cells[pos.y]?.[pos.x] ??
    { type: 'wall', height: 1, passable: false, blockLineOfSight: true, terrain: 'normal' }
  )
}

function setCell(cells: Cell[][], pos: Pos, cell: Cell) {
  if (cells[pos.y] && cells[pos.y][pos.x] !== undefined) {
    cells[pos.y][pos.x] = cell
  }
}

function pickOne<T>(arr: T[], rng: () => number): T | undefined {
  if (arr.length === 0) return undefined
  return arr[Math.floor(rng() * arr.length)]
}

function pickWithoutReplacement<T>(pool: T[], count: number, rng: () => number): T[] {
  if (pool.length === 0 || count <= 0) return []
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function weightedPick<T extends { weight: number }>(entries: T[], rng: () => number): T | null {
  if (entries.length === 0) return null
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let r = rng() * total
  for (const e of entries) {
    r -= e.weight
    if (r <= 0) return e
  }
  return entries[entries.length - 1]!
}
