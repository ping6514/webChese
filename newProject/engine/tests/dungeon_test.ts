/**
 * dungeon_test.ts — createFloor 單元測試
 *
 * 驗證：
 *   1. Grid 解析：wall / floor / forest terrain / stairs_down
 *   2. 怪物數量與位置正確生成
 *   3. 玩家入場座標從 spawnZones[player_entry] 取出
 *   4. 出口格設為 stairs_down
 *   5. FloorObjective：reach_exit（普通層）/ kill_boss（Boss 層）
 *   6. Chunk 覆蓋：tree_cluster 使格子變 forest terrain
 *   7. PropZone：非 empty prop 使格子類型改變
 *   8. Boss 競技場格式（spawnPoints）
 *   9. 無對應 spawnerId → 跳過（不 crash）
 *  10. 相同 rng seed → 相同生成結果（可重現性）
 */

import type { RoomDef, ChunkDef, DungeonFloorConfig, MonsterRegistry, CreateFloorResult } from '../dungeon'
import { createFloor } from '../dungeon'
import type { MonsterDef, SpawnerDef } from '../spawner'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

function makeLCG(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

/** 最小 8×8 房間（仿照 forest_room_01 格式）*/
const SIMPLE_ROOM: RoomDef = {
  id: 'test_room',
  name: '測試房間',
  theme: 'forest',
  width: 8,
  height: 8,
  grid: [
    '########',
    '#......#',
    '#..TT..#',
    '#..TT..#',
    '#......#',
    '#......#',
    '#.....S#',
    '########',
  ],
  spawnZones: [
    { id: 'player_entry', cells: [{ x: 1, y: 5 }, { x: 2, y: 5 }] },
    { id: 'enemy_zone_a', cells: [{ x: 5, y: 1 }, { x: 6, y: 1 }] },
    { id: 'exit',         cells: [{ x: 6, y: 6 }] },
  ],
}

const WOLF_DEF: MonsterDef = {
  id: 'forest_wolf',
  name: '灰狼',
  theme: 'forest',
  tier: 'normal',
  archetype: 'agi',
  ai: 'chase',
  stats: {
    str: { base: 8,  floorScale: 0.6 },
    agi: { base: 18, floorScale: 1.2 },
    int: { base: 2,  floorScale: 0.2 },
    lck: { base: 5,  floorScale: 0.4 },
  },
  resources: {
    hp: { base: 40, strMult: 1.5 },
    sp: { base: 30, agiMult: 1 },
    mp: { base: 0 },
  },
  moveRange: 4,
  speed: 16,
  weapon: {
    id: 'wolf_fang',
    name: '野狼利牙',
    actionId: 'single_melee',
    hitMode: { type: 'instant' },
    statScaling: 'AGI',
    atkBase: 0.3,
    slot1: 'slash',
    slot2: 'mode_charge',
    slot3Pool: ['trait_swift', 'trait_brute'],
    slot5Pool: ['enchant_slow', 'enchant_bleed'],
  },
}

const WOLF_SPAWNER: SpawnerDef = {
  monsterId: 'forest_wolf',
  normal: {
    statScaleMult: 1.0,
    qualityMult: 1.0,
    hpMult: 1.0,
    weapon: {
      affixCountTable: [{ count: 1, weight: 100 }],
      affixRarityTable: [{ rarity: 'common', weight: 100 }],
    },
  },
}

const MONSTER_REGISTRY: MonsterRegistry = {
  forest_wolf: { def: WOLF_DEF, spawner: WOLF_SPAWNER },
}

const NORMAL_FLOOR_CONFIG: DungeonFloorConfig = {
  encounters: [
    { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 },
  ],
}

// ─── Test 1：Grid 解析 ────────────────────────────────────────────────────────

console.log('\n【Test 1】Grid 解析 — wall / floor / forest / stairs_down')

const r1 = createFloor({
  roomDef: SIMPLE_ROOM,
  floorConfig: NORMAL_FLOOR_CONFIG,
  monsterRegistry: MONSTER_REGISTRY,
  theme: 'forest',
  floorNumber: 1,
  seed: 'test',
  pathType: 'safe',
  rng: makeLCG(1),
})

// 邊角是牆
assert(r1.floor.cells[0][0].type === 'wall',        '(0,0) = wall')
assert(!r1.floor.cells[0][0].passable,              '(0,0) 不可通行')
// 內部是地板
assert(r1.floor.cells[1][1].type === 'floor',       '(1,1) = floor')
assert(r1.floor.cells[1][1].passable,               '(1,1) 可通行')
// T 字元 → forest terrain，擋視線
assert(r1.floor.cells[2][3].terrain === 'forest',   '(3,2) terrain = forest')
assert(r1.floor.cells[2][3].blockLineOfSight,       '(3,2) 擋視線')
// 出口格 (6,6) → stairs_down（由 spawnZone exit 覆蓋）
assert(r1.floor.cells[6][6].type === 'stairs_down', '(6,6) = stairs_down')

// ─── Test 2：怪物數量 ─────────────────────────────────────────────────────────

console.log('\n【Test 2】怪物生成數量')

const unitList = Object.values(r1.units)
// enemy_zone_a 只有 2 格，要求 count=2
assert(unitList.length === 2,               `生成 2 隻怪物（got: ${unitList.length}）`)
assert(unitList.every(u => u.kind === 'monster'), '全部 kind = monster')
assert(unitList.every(u => u.monsterId === 'forest_wolf'), '全部 monsterId = forest_wolf')

// ─── Test 3：玩家入場位置 ─────────────────────────────────────────────────────

console.log('\n【Test 3】玩家入場座標')

assert(r1.playerEntryPositions.length === 2,          '玩家入場格數 = 2')
assert(r1.playerEntryPositions.some(p => p.x === 1 && p.y === 5), '包含 (1,5)')

// ─── Test 4：出口座標 ─────────────────────────────────────────────────────────

console.log('\n【Test 4】出口座標（exitPos）')

assert(r1.exitPos.x === 6 && r1.exitPos.y === 6, `exitPos = (6,6)（got: (${r1.exitPos.x},${r1.exitPos.y})）`)

// ─── Test 5：FloorObjective — reach_exit ─────────────────────────────────────

console.log('\n【Test 5】FloorObjective = reach_exit')

assert(r1.floor.objective.type === 'reach_exit', 'objective = reach_exit')
if (r1.floor.objective.type === 'reach_exit') {
  assert(r1.floor.objective.exitPos.x === 6, `exitPos.x = 6（got: ${r1.floor.objective.exitPos.x}）`)
}

// ─── Test 6：Chunk 覆蓋 ───────────────────────────────────────────────────────

console.log('\n【Test 6】Chunk 覆蓋 — tree_cluster 覆蓋後 terrain = forest')

const ROOM_WITH_CHUNK: RoomDef = {
  ...SIMPLE_ROOM,
  grid: [
    '########',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#.....S#',
    '########',
  ],
  chunkZones: [
    {
      id: 'zone_a',
      topLeft: { x: 2, y: 2 },
      size: { width: 3, height: 3 },
      allowedChunks: ['tree_cluster'],
      pickCount: 1,
    },
  ],
}

const TREE_CHUNK: ChunkDef = {
  id: 'tree_cluster',
  size: { width: 3, height: 3 },
  grid: ['TTT', 'T.T', 'TTT'],
}

const r6 = createFloor({
  roomDef: ROOM_WITH_CHUNK,
  chunkDefs: { tree_cluster: TREE_CHUNK },
  floorConfig: { encounters: [] },
  monsterRegistry: {},
  theme: 'forest',
  floorNumber: 1,
  seed: 'chunk_test',
  pathType: 'safe',
  rng: makeLCG(42),
})

// chunk topLeft=(2,2)，第一列全是 T
assert(r6.floor.cells[2][2].terrain === 'forest', 'chunk (2,2) → forest terrain')
assert(r6.floor.cells[2][3].terrain === 'forest', 'chunk (3,2) → forest terrain')
// 中心 (3,3) 是 . → normal
assert(r6.floor.cells[3][3].terrain === 'normal', 'chunk center (3,3) → normal（. 格）')

// ─── Test 7：PropZone 放置 ────────────────────────────────────────────────────

console.log('\n【Test 7】PropZone — 非 empty prop 改變格子類型')

const ROOM_WITH_PROP: RoomDef = {
  ...SIMPLE_ROOM,
  propZones: [
    {
      cells: [{ x: 3, y: 4 }],
      props: [{ type: 'recovery', weight: 100 }],  // 必放 recovery
      maxPlacements: 1,
    },
  ],
}

const r7 = createFloor({
  roomDef: ROOM_WITH_PROP,
  floorConfig: { encounters: [] },
  monsterRegistry: {},
  theme: 'forest',
  floorNumber: 1,
  seed: 'prop_test',
  pathType: 'safe',
  rng: makeLCG(7),
})

assert(r7.floor.cells[4][3].type === 'recovery', `(3,4) = recovery（got: ${r7.floor.cells[4][3].type}）`)

// ─── Test 8：Boss 競技場格式（spawnPoints）────────────────────────────────────

console.log('\n【Test 8】Boss 競技場格式')

const GUARDIAN_DEF: MonsterDef = {
  ...WOLF_DEF,
  id: 'forest_guardian',
  name: '守護者',
  ai: 'boss',
}

const GUARDIAN_SPAWNER: SpawnerDef = {
  monsterId: 'forest_guardian',
  boss: {
    statScaleMult: 2.5,
    qualityMult: 1.5,
    hpMult: 4.0,
    speedBonus: 4,
    weapon: {
      affixCountTable: [{ count: 2, weight: 100 }],
      affixRarityTable: [{ rarity: 'common', weight: 100 }],
    },
    skillPool: [{ id: 'pack_call' }],
  },
}

const BOSS_ROOM: RoomDef = {
  id: 'boss_arena',
  name: '競技場',
  theme: 'forest',
  width: 8,
  height: 8,
  grid: [
    '########',
    '#TTTTTT#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '#......#',
    '########',
  ],
  spawnPoints: {
    boss: { x: 4, y: 2 },
    players: [{ x: 2, y: 6 }, { x: 3, y: 6 }],
  },
}

const BOSS_FLOOR_CONFIG: DungeonFloorConfig = {
  encounters: [
    { zoneId: 'boss_spawn', spawnerId: 'forest_guardian', tier: 'boss', count: 1 },
  ],
  isBossRoom: true,
}

const r8 = createFloor({
  roomDef: BOSS_ROOM,
  floorConfig: BOSS_FLOOR_CONFIG,
  monsterRegistry: {
    forest_guardian: { def: GUARDIAN_DEF, spawner: GUARDIAN_SPAWNER },
  },
  theme: 'forest',
  floorNumber: 10,
  seed: 'boss_test',
  pathType: 'safe',
  rng: makeLCG(99),
})

const bossUnits = Object.values(r8.units)
assert(bossUnits.length === 1,                            'boss 房生成 1 個單位')
assert(bossUnits[0]!.ai === 'boss',                       'boss unit ai = boss')
assert(bossUnits[0]!.pos.x === 4 && bossUnits[0]!.pos.y === 2, 'boss 在 spawnPoints.boss 位置')
assert(r8.floor.objective.type === 'kill_boss',           'objective = kill_boss')
assert(r8.playerEntryPositions.length === 2,              '玩家入場格 = 2')

// ─── Test 9：未知 spawnerId 跳過 ──────────────────────────────────────────────

console.log('\n【Test 9】未知 spawnerId 不 crash、跳過生成')

const r9 = createFloor({
  roomDef: SIMPLE_ROOM,
  floorConfig: {
    encounters: [
      { zoneId: 'enemy_zone_a', spawnerId: 'unknown_monster', tier: 'normal', count: 2 },
    ],
  },
  monsterRegistry: {},
  theme: 'forest',
  floorNumber: 1,
  seed: 'skip_test',
  pathType: 'safe',
})

assert(Object.keys(r9.units).length === 0, '未知 spawnerId → units 為空')

// ─── Test 10：可重現性 ────────────────────────────────────────────────────────

console.log('\n【Test 10】可重現性 — 相同 seed 相同生成結果')

const rA = createFloor({
  roomDef: SIMPLE_ROOM,
  floorConfig: NORMAL_FLOOR_CONFIG,
  monsterRegistry: MONSTER_REGISTRY,
  theme: 'forest',
  floorNumber: 1,
  seed: 'repro',
  pathType: 'safe',
  rng: makeLCG(12345),
})

const rB = createFloor({
  roomDef: SIMPLE_ROOM,
  floorConfig: NORMAL_FLOOR_CONFIG,
  monsterRegistry: MONSTER_REGISTRY,
  theme: 'forest',
  floorNumber: 1,
  seed: 'repro',
  pathType: 'safe',
  rng: makeLCG(12345),
})

const posA = Object.values(rA.units).map(u => `${u.pos.x},${u.pos.y}`).sort().join('|')
const posB = Object.values(rB.units).map(u => `${u.pos.x},${u.pos.y}`).sort().join('|')
assert(posA === posB, `相同 seed → 相同怪物位置（${posA}）`)

const affixA = JSON.stringify(Object.values(rA.units).map(u => u.weapons[0]?.appliedAffixIds).sort())
const affixB = JSON.stringify(Object.values(rB.units).map(u => u.weapons[0]?.appliedAffixIds).sort())
assert(affixA === affixB, '相同 seed → 相同武器詞條')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
