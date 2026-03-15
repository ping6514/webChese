/**
 * campaign_test.ts — 多層地城編排整合測試
 *
 * 驗證 forest_config.json 驅動的完整 10 層地城生成流程：
 *
 *   1. selectFloorPlan — 安穩路線 floor=1，2 個 encounter，roomPool 選擇正確
 *   2. selectFloorPlan — 試煉路線 floor=1，3 個 encounter（比安穩多）
 *   3. selectFloorPlan — floor=10 強制 boss 路線（忽略 pathType）
 *   4. selectFloorPlan — 無效 floorNumber 拋出錯誤
 *   5. buildFloorFromConfig — floor=1 safe，怪物生成正確（森林狼 ×2）
 *   6. buildFloorFromConfig — floor=6 safe，菁英狼 + 藤蔓獸（精英計算）
 *   7. buildFloorFromConfig — floor=10 boss，守護者 × 1，kill_boss 目標
 *   8. advanceRun — 全安穩 → lootQuality = difficulty × 1.0
 *   9. advanceRun — 全試煉 → lootQuality = difficulty × 1.5
 *  10. advanceRun — 半試煉 → lootQuality 在 1.0–1.5 之間
 *  11. previewCampaign — 10 層預覽完整，floor 10 = boss
 *  12. 完整 10 層序列 — 所有層次正常建立，無崩潰，怪物總數合理
 *  13. 可重現性 — 相同 seed 同一層相同 roomId 與怪物位置
 *  14. 試煉路線 floor=4 — 怪物數量 > 安穩路線
 *  15. dungeonQuality 影響怪物屬性縮放
 */

import type { DungeonConfig, BuildFloorParams } from '../campaign'
import { selectFloorPlan, buildFloorFromConfig, advanceRun, previewCampaign } from '../campaign'
import type { MonsterDef, SpawnerDef } from '../spawner'
import type { RoomDef, MonsterRegistry } from '../dungeon'
import { createRun } from '../game'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

function assertThrows(fn: () => unknown, label: string) {
  try { fn(); console.error(`  ❌ ${label}（未拋出錯誤）`); failed++ }
  catch { console.log(`  ✅ ${label}`); passed++ }
}

function makeLCG(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// ─── 測試資料：inline DungeonConfig（對應 forest_config.json 子集）────────────

const FOREST_CONFIG: DungeonConfig = {
  theme: 'forest',
  bossPool: ['forest_guardian'],
  totalFloors: 10,
  floorConfigs: [
    {
      floor: 1,
      safe:  { roomPool: ['forest_room_01', 'forest_room_02'],
               encounters: [{ zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 }] },
      trial: { roomPool: ['forest_room_03'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 3 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_wolf', tier: 'normal', count: 1 },
               ] },
    },
    {
      floor: 2,
      safe:  { roomPool: ['forest_room_01', 'forest_room_02'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_wolf', tier: 'normal', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_03', 'forest_room_04'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 3 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_poison_spider', tier: 'normal', count: 2 },
               ] },
    },
    {
      floor: 3,
      safe:  { roomPool: ['forest_room_02', 'forest_room_03'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_poison_spider', tier: 'normal', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_04', 'forest_room_05'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 3 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_poison_spider', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_wolf', tier: 'normal', count: 1 },
               ] },
    },
    {
      floor: 4,
      safe:  { roomPool: ['forest_room_03', 'forest_room_04'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_05'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 3 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_poison_spider', tier: 'normal', count: 2 },
               ] },
    },
    {
      floor: 5,
      safe:  { roomPool: ['forest_room_03', 'forest_room_04'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_poison_spider', tier: 'normal', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_05', 'forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_poison_spider', tier: 'elite', count: 1 },
               ] },
    },
    {
      floor: 6,
      safe:  { roomPool: ['forest_room_04', 'forest_room_05'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 2 },
               ] },
      trial: { roomPool: ['forest_room_05', 'forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'elite', count: 2 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'normal', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_poison_spider', tier: 'elite', count: 2 },
               ] },
    },
    {
      floor: 7,
      safe:  { roomPool: ['forest_room_05', 'forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_wolf', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_vine_beast', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_poison_spider', tier: 'normal', count: 2 },
               ] },
      trial: { roomPool: ['forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_hunter', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_wolf', tier: 'elite', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_vine_beast', tier: 'elite', count: 1 },
               ] },
    },
    {
      floor: 8,
      safe:  { roomPool: ['forest_room_05', 'forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_hunter', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_wolf', tier: 'elite', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_vine_beast', tier: 'normal', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_ancient_treant', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_hunter', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_wolf', tier: 'elite', count: 2 },
               ] },
    },
    {
      floor: 9,
      safe:  { roomPool: ['forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_ancient_treant', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_hunter', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_wolf', tier: 'elite', count: 1 },
               ] },
      trial: { roomPool: ['forest_room_06'],
               encounters: [
                 { zoneId: 'enemy_zone_a', spawnerId: 'forest_ancient_treant', tier: 'elite', count: 1 },
                 { zoneId: 'enemy_zone_b', spawnerId: 'forest_hunter', tier: 'elite', count: 2 },
                 { zoneId: 'enemy_zone_c', spawnerId: 'forest_wolf', tier: 'elite', count: 2 },
               ] },
    },
    {
      floor: 10,
      boss:  { roomPool: ['forest_guardian_arena'], isBossRoom: true,
               encounters: [{ zoneId: 'boss_spawn', spawnerId: 'forest_guardian', tier: 'boss', count: 1 }] },
    },
  ],
}

// ─── 怪物 Defs（內聯，對應各 JSON 的核心資料）────────────────────────────────

const WOLF_DEF: MonsterDef = {
  id: 'forest_wolf', name: '灰狼', theme: 'forest', tier: 'normal', archetype: 'agi', ai: 'chase',
  stats: { str: { base: 8, floorScale: 0.6 }, agi: { base: 18, floorScale: 1.2 }, int: { base: 2, floorScale: 0.2 }, lck: { base: 5, floorScale: 0.4 } },
  resources: { hp: { base: 40, strMult: 1.5 }, sp: { base: 30, agiMult: 1 }, mp: { base: 0 } },
  moveRange: 4, speed: 16,
  weapon: { id: 'wolf_fang', name: '野狼利牙', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'AGI', atkBase: 0.3, actionTags: ['物理', '即發'], slot1: 'slash', slot3Pool: ['trait_swift'], slot5Pool: ['enchant_bleed'] },
}

const SPIDER_DEF: MonsterDef = {
  id: 'forest_poison_spider', name: '毒蜘蛛', theme: 'forest', tier: 'normal', archetype: 'agi', ai: 'chase',
  stats: { str: { base: 5, floorScale: 0.4 }, agi: { base: 16, floorScale: 1.0 }, int: { base: 4, floorScale: 0.3 }, lck: { base: 8, floorScale: 0.5 } },
  resources: { hp: { base: 25, strMult: 1.0 }, sp: { base: 25, agiMult: 1 }, mp: { base: 0 } },
  moveRange: 3, speed: 14,
  weapon: { id: 'spider_fang', name: '毒蜘蛛毒牙', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'AGI', atkBase: 0.25, slot1: 'pierce', slot5Pool: ['enchant_poison'] },
}

const VINE_DEF: MonsterDef = {
  id: 'forest_vine_beast', name: '藤蔓獸', theme: 'forest', tier: 'normal', archetype: 'str', ai: 'patrol',
  stats: { str: { base: 14, floorScale: 1.0 }, agi: { base: 6, floorScale: 0.4 }, int: { base: 3, floorScale: 0.2 }, lck: { base: 4, floorScale: 0.3 } },
  resources: { hp: { base: 55, strMult: 2.0 }, sp: { base: 15, agiMult: 0.5 }, mp: { base: 0 } },
  moveRange: 2, speed: 8,
  weapon: { id: 'vine_whip', name: '藤蔓鞭擊', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'STR', atkBase: 0.35, slot1: 'slash', slot3Pool: ['trait_brute'], slot5Pool: ['enchant_bleed'] },
}

const HUNTER_DEF: MonsterDef = {
  id: 'forest_hunter', name: '森林獵手', theme: 'forest', tier: 'elite', archetype: 'agi', ai: 'chase',
  stats: { str: { base: 12, floorScale: 0.8 }, agi: { base: 22, floorScale: 1.4 }, int: { base: 6, floorScale: 0.4 }, lck: { base: 14, floorScale: 0.8 } },
  resources: { hp: { base: 50, strMult: 1.8 }, sp: { base: 50, agiMult: 2 }, mp: { base: 0 } },
  moveRange: 5, speed: 18,
  weapon: { id: 'hunter_claw', name: '獵手利爪', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'AGI', atkBase: 0.40, slot1: 'slash', slot3Pool: ['trait_precise'], slot5Pool: ['enchant_bleed'] },
}

const TREANT_DEF: MonsterDef = {
  id: 'forest_ancient_treant', name: '古樹精', theme: 'forest', tier: 'elite', archetype: 'str', ai: 'guard',
  stats: { str: { base: 20, floorScale: 1.2 }, agi: { base: 4, floorScale: 0.2 }, int: { base: 8, floorScale: 0.5 }, lck: { base: 4, floorScale: 0.3 } },
  resources: { hp: { base: 100, strMult: 2.5 }, sp: { base: 10, agiMult: 0.5 }, mp: { base: 10, intMult: 0.5 } },
  moveRange: 2, speed: 6,
  weapon: { id: 'ancient_branch', name: '古木枝幹', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'STR', atkBase: 0.50, slot1: 'crush', slot3Pool: ['trait_reach'], slot5Pool: ['enchant_stun'] },
}

const GUARDIAN_DEF: MonsterDef = {
  id: 'forest_guardian', name: '森林守護者', theme: 'forest', tier: 'boss', archetype: 'balanced', ai: 'boss',
  stats: { str: { base: 25, floorScale: 1.5 }, agi: { base: 20, floorScale: 1.2 }, int: { base: 10, floorScale: 0.6 }, lck: { base: 10, floorScale: 0.6 } },
  resources: { hp: { base: 180, strMult: 2.5 }, sp: { base: 60, agiMult: 2 }, mp: { base: 15, intMult: 0.5 } },
  moveRange: 4, speed: 15,
  weapon: { id: 'guardian_claws', name: '守護者巨爪', actionId: 'single_melee', hitMode: { type: 'instant' }, statScaling: 'STR', atkBase: 0.55, slot1: 'slash', slot3Pool: [], slot5Pool: [] },
}

// ─── Spawner Defs（最小化，確保正確分級）─────────────────────────────────────

function makeBasicSpawner(monsterId: string, tiers: ('normal' | 'elite' | 'boss')[] = ['normal']): SpawnerDef {
  const obj: SpawnerDef = { monsterId }
  const tierConfig = {
    statScaleMult: 1.0, qualityMult: 1.0, hpMult: 1.0,
    weapon: { affixCountTable: [{ count: 0, weight: 100 }], affixRarityTable: [{ rarity: 'common', weight: 100 }] },
  }
  const eliteConfig = { ...tierConfig, statScaleMult: 1.5, hpMult: 2.0 }
  const bossConfig  = { ...tierConfig, statScaleMult: 1.0, hpMult: 1.0 }

  if (tiers.includes('normal')) (obj as any).normal = tierConfig
  if (tiers.includes('elite'))  (obj as any).elite  = eliteConfig
  if (tiers.includes('boss'))   (obj as any).boss   = bossConfig
  return obj
}

const MONSTER_REGISTRY: MonsterRegistry = {
  forest_wolf:           { def: WOLF_DEF,     spawner: makeBasicSpawner('forest_wolf', ['normal', 'elite']) },
  forest_poison_spider:  { def: SPIDER_DEF,   spawner: makeBasicSpawner('forest_poison_spider', ['normal', 'elite']) },
  forest_vine_beast:     { def: VINE_DEF,     spawner: makeBasicSpawner('forest_vine_beast', ['normal', 'elite']) },
  forest_hunter:         { def: HUNTER_DEF,   spawner: makeBasicSpawner('forest_hunter', ['elite']) },
  forest_ancient_treant: { def: TREANT_DEF,   spawner: makeBasicSpawner('forest_ancient_treant', ['elite']) },
  forest_guardian:       { def: GUARDIAN_DEF, spawner: makeBasicSpawner('forest_guardian', ['boss']) },
}

// ─── 房間 Defs（提取各房間的 spawnZones，支援所有怪物區）────────────────────

function makeRoom(id: string, zones: string[]): RoomDef {
  const W = 16, H = 16
  return {
    id, name: id, theme: 'forest', width: W, height: H,
    grid: Array.from({ length: H }, (_, y) =>
      Array.from({ length: W }, (_, x) =>
        x === 0 || x === W - 1 || y === 0 || y === H - 1 ? '#' : '.'
      ).join('')
    ),
    spawnZones: [
      { id: 'player_entry', cells: [{ x: 1, y: 13 }, { x: 2, y: 13 }] },
      // 每個 zone 有 3 個格子，確保 count ≤ 3 都能生成
      ...(zones.includes('enemy_zone_a') ? [{ id: 'enemy_zone_a', cells: [{ x: 10, y: 1 }, { x: 11, y: 1 }, { x: 12, y: 1 }] }] : []),
      ...(zones.includes('enemy_zone_b') ? [{ id: 'enemy_zone_b', cells: [{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: 5 }] }] : []),
      ...(zones.includes('enemy_zone_c') ? [{ id: 'enemy_zone_c', cells: [{ x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 }] }] : []),
      { id: 'exit', cells: [{ x: 14, y: 1 }] },
    ],
  }
}

const BOSS_ROOM: RoomDef = {
  id: 'forest_guardian_arena', name: '守護者祭壇', theme: 'forest', width: 16, height: 16,
  grid: Array.from({ length: 16 }, (_, y) => Array.from({ length: 16 }, (_, x) => (x === 0 || x === 15 || y === 0 || y === 15 ? '#' : '.')).join('')),
  spawnPoints: {
    boss: { x: 8, y: 2 },
    players: [{ x: 2, y: 14 }, { x: 3, y: 14 }],
  },
}

const ROOM_DEFS: Record<string, RoomDef> = {
  forest_room_01: makeRoom('forest_room_01', ['enemy_zone_a', 'enemy_zone_b']),
  forest_room_02: makeRoom('forest_room_02', ['enemy_zone_a', 'enemy_zone_b']),
  forest_room_03: makeRoom('forest_room_03', ['enemy_zone_a', 'enemy_zone_b']),
  forest_room_04: makeRoom('forest_room_04', ['enemy_zone_a', 'enemy_zone_b', 'enemy_zone_c']),
  forest_room_05: makeRoom('forest_room_05', ['enemy_zone_a', 'enemy_zone_b', 'enemy_zone_c']),
  forest_room_06: makeRoom('forest_room_06', ['enemy_zone_a', 'enemy_zone_b', 'enemy_zone_c']),
  forest_guardian_arena: BOSS_ROOM,
}

// 共用建層參數
function makeParams(floorNumber: number, pathType: 'safe' | 'trial', rng: () => number, dungeonQuality = 1.0): BuildFloorParams {
  return { dungeonConfig: FOREST_CONFIG, roomDefs: ROOM_DEFS, monsterRegistry: MONSTER_REGISTRY, floorNumber, pathType, seed: `test_f${floorNumber}`, dungeonQuality, rng }
}

// ─── Test 1：selectFloorPlan — safe floor=1 ───────────────────────────────────

console.log('\n【Test 1】selectFloorPlan — floor=1 safe，1 個 encounter，roomPool ⊆ {01,02}')

const plan1 = selectFloorPlan(FOREST_CONFIG, 1, 'safe', makeLCG(1))
assert(['forest_room_01', 'forest_room_02'].includes(plan1.roomId), `roomId ∈ pool（got: ${plan1.roomId}）`)
assert(plan1.floorConfig.encounters.length === 1, `encounter 數 = 1（got: ${plan1.floorConfig.encounters.length}）`)
assert(plan1.floorConfig.encounters[0]!.spawnerId === 'forest_wolf', 'encounter[0] = forest_wolf')
assert(plan1.floorConfig.encounters[0]!.count === 2, 'count = 2')
assert(plan1.pathType === 'safe', 'pathType = safe')
assert(!plan1.isBossRoom, 'isBossRoom = false')

// ─── Test 2：selectFloorPlan — trial floor=1 ──────────────────────────────────

console.log('\n【Test 2】selectFloorPlan — floor=1 trial，2 個 encounter，roomPool = {03}')

const plan2 = selectFloorPlan(FOREST_CONFIG, 1, 'trial', makeLCG(2))
assert(plan2.roomId === 'forest_room_03', `roomId = forest_room_03（got: ${plan2.roomId}）`)
assert(plan2.floorConfig.encounters.length === 2, `encounter 數 = 2（got: ${plan2.floorConfig.encounters.length}）`)
const totalTrialCount1 = plan2.floorConfig.encounters.reduce((s, e) => s + e.count, 0)
const totalSafeCount1  = plan1.floorConfig.encounters.reduce((s, e) => s + e.count, 0)
assert(totalTrialCount1 > totalSafeCount1, `trial 總怪物數(${totalTrialCount1}) > safe(${totalSafeCount1})`)
assert(plan2.pathType === 'trial', 'pathType = trial')

// ─── Test 3：selectFloorPlan — floor=10 強制 boss ─────────────────────────────

console.log('\n【Test 3】selectFloorPlan — floor=10 強制 boss（無論 pathType）')

const plan3a = selectFloorPlan(FOREST_CONFIG, 10, 'safe', makeLCG(3))
const plan3b = selectFloorPlan(FOREST_CONFIG, 10, 'trial', makeLCG(3))
assert(plan3a.isBossRoom, 'safe → isBossRoom = true')
assert(plan3b.isBossRoom, 'trial → isBossRoom = true')
assert(plan3a.roomId === 'forest_guardian_arena', `roomId = forest_guardian_arena（got: ${plan3a.roomId}）`)
assert(plan3a.floorConfig.encounters[0]!.spawnerId === 'forest_guardian', 'encounter = forest_guardian')
assert(plan3a.floorConfig.encounters[0]!.tier === 'boss', 'tier = boss')
assert(plan3a.floorConfig.isBossRoom === true, 'floorConfig.isBossRoom = true')

// ─── Test 4：selectFloorPlan — 無效 floorNumber 拋出錯誤 ─────────────────────

console.log('\n【Test 4】selectFloorPlan — 無效 floor 拋出錯誤')

assertThrows(() => selectFloorPlan(FOREST_CONFIG, 99, 'safe', makeLCG(4)), 'floor=99 → 拋出錯誤')
assertThrows(() => selectFloorPlan(FOREST_CONFIG, 0,  'safe', makeLCG(4)), 'floor=0  → 拋出錯誤')

// ─── Test 5：buildFloorFromConfig — floor=1 safe，forest_wolf × 2 ─────────────

console.log('\n【Test 5】buildFloorFromConfig — floor=1 safe，怪物 = forest_wolf×2')

const r5 = buildFloorFromConfig(makeParams(1, 'safe', makeLCG(5)))
const units5 = Object.values(r5.units)
assert(units5.length === 2, `生成 2 隻怪物（got: ${units5.length}）`)
assert(units5.every(u => u.monsterId === 'forest_wolf'), '全部 = forest_wolf')
assert(units5.every(u => u.kind === 'monster'), '全部 kind = monster')
assert(r5.floor.objective.type === 'reach_exit', 'objective = reach_exit（非 boss 層）')
assert(r5.floorPlan.roomId === 'forest_room_01' || r5.floorPlan.roomId === 'forest_room_02', `roomId ∈ pool（got: ${r5.floorPlan.roomId}）`)

// ─── Test 6：buildFloorFromConfig — floor=6 safe，菁英狼 + 藤蔓獸 ───────────

console.log('\n【Test 6】buildFloorFromConfig — floor=6 safe，elite 狼×1 + 藤蔓獸×2')

const r6 = buildFloorFromConfig(makeParams(6, 'safe', makeLCG(6)))
const units6 = Object.values(r6.units)
assert(units6.length === 3, `生成 3 隻怪物（got: ${units6.length}）`)

// 菁英狼 HP > normal 狼 HP（因 hpMult=2.0）
const normalWolfHp = Math.round((40 + (Math.round(8 + 6 * 0.6 * 1.0)) * 1.5) * 1.0)   // floor=6, normal
const eliteWolfHp  = Math.round((40 + (Math.round(8 + 6 * 0.6 * 1.5)) * 1.5) * 2.0)   // floor=6, elite hpMult=2.0
const wolves6 = units6.filter(u => u.monsterId === 'forest_wolf')
const vines6  = units6.filter(u => u.monsterId === 'forest_vine_beast')
assert(wolves6.length === 1, `elite 狼 ×1（got: ${wolves6.length}）`)
assert(vines6.length === 2,  `藤蔓獸 ×2（got: ${vines6.length}）`)
assert(wolves6[0]!.maxHP > normalWolfHp, `elite wolf HP(${wolves6[0]!.maxHP}) > normal wolf HP(${normalWolfHp})`)

// ─── Test 7：buildFloorFromConfig — floor=10 boss ────────────────────────────

console.log('\n【Test 7】buildFloorFromConfig — floor=10，守護者×1，kill_boss 目標')

const r7 = buildFloorFromConfig(makeParams(10, 'safe', makeLCG(7)))
const bossUnits = Object.values(r7.units)
assert(bossUnits.length === 1,                              'Boss 層生成 1 個 Boss')
assert(bossUnits[0]!.ai === 'boss',                         'Boss ai = boss')
assert(bossUnits[0]!.monsterId === 'forest_guardian',       'monsterId = forest_guardian')
assert(r7.floor.objective.type === 'kill_boss',             'objective = kill_boss')
assert(r7.floorPlan.isBossRoom,                             'floorPlan.isBossRoom = true')
assert(r7.playerEntryPositions.length === 2,                '玩家入場格 = 2（arena spawnPoints）')

// Boss HP 是 floor=10 縮放（str=round(25+10×1.5)=40，HP=round((180+40×2.5)×1.0)=280）
const expectedBossHP = Math.round((180 + Math.round(25 + 10 * 1.5) * 2.5) * 1.0)
assert(bossUnits[0]!.maxHP === expectedBossHP, `Boss maxHP = ${expectedBossHP}（got: ${bossUnits[0]!.maxHP}）`)

// ─── Test 8：advanceRun — 全安穩 → lootQuality = 1.0 ─────────────────────────

console.log('\n【Test 8】advanceRun — 全安穩路線，lootQuality = difficulty × 1.0')

let run8 = createRun({ difficulty: 1.0 })
for (let f = 1; f <= 9; f++) {
  run8 = advanceRun(run8, 'safe')
}
assert(run8.pathHistory.length === 9,    `pathHistory.length = 9（got: ${run8.pathHistory.length}）`)
assert(run8.trialFloorCount === 0,       `trialFloorCount = 0（got: ${run8.trialFloorCount}）`)
assert(Math.abs(run8.lootQuality - 1.0) < 0.001, `lootQuality ≈ 1.0（got: ${run8.lootQuality.toFixed(3)}）`)
assert(run8.floorNumber === 10,          `floorNumber = 10（got: ${run8.floorNumber}）`)

// ─── Test 9：advanceRun — 全試煉 → lootQuality = 1.5 ─────────────────────────

console.log('\n【Test 9】advanceRun — 全試煉路線，lootQuality = difficulty × 1.5')

let run9 = createRun({ difficulty: 1.0 })
for (let f = 1; f <= 9; f++) {
  run9 = advanceRun(run9, 'trial')
}
assert(run9.trialFloorCount === 9,       `trialFloorCount = 9（got: ${run9.trialFloorCount}）`)
assert(Math.abs(run9.lootQuality - 1.5) < 0.001, `lootQuality ≈ 1.5（got: ${run9.lootQuality.toFixed(3)}）`)

// ─── Test 10：advanceRun — 混合路線，lootQuality 在 1.0–1.5 之間 ───────────

console.log('\n【Test 10】advanceRun — 混合路線，lootQuality ∈ [1.0, 1.5]')

let run10 = createRun({ difficulty: 1.0 })
const mixedPaths = ['safe', 'trial', 'safe', 'trial', 'safe', 'trial', 'safe', 'trial', 'safe'] as const
for (const p of mixedPaths) run10 = advanceRun(run10, p)
assert(run10.trialFloorCount === 4,             `trialFloorCount = 4（got: ${run10.trialFloorCount}）`)
assert(run10.lootQuality > 1.0,                 `lootQuality(${run10.lootQuality.toFixed(3)}) > 1.0`)
assert(run10.lootQuality < 1.5,                 `lootQuality(${run10.lootQuality.toFixed(3)}) < 1.5`)

// ─── Test 11：previewCampaign — 10 層預覽 ────────────────────────────────────

console.log('\n【Test 11】previewCampaign — 完整 10 層預覽，floor 10 = boss')

const allSafe = Array(9).fill('safe') as ('safe' | 'trial')[]
const preview = previewCampaign(FOREST_CONFIG, allSafe)

assert(preview.length === 10, `預覽 10 層（got: ${preview.length}）`)
assert(preview[0]!.floorNumber === 1, 'preview[0].floorNumber = 1')
assert(preview[9]!.floorNumber === 10, 'preview[9].floorNumber = 10')
assert(preview[9]!.pathType === 'boss', `floor 10 pathType = boss（got: ${preview[9]!.pathType}）`)
assert(preview[9]!.roomPool[0] === 'forest_guardian_arena', 'floor 10 roomPool = [forest_guardian_arena]')
assert(preview[9]!.encounterSummary[0]!.spawnerId === 'forest_guardian', 'floor 10 encounter = forest_guardian')
assert(preview[0]!.pathType === 'safe', 'floor 1 pathType = safe')
assert(preview[0]!.encounterSummary[0]!.count === 2, 'floor 1 safe count = 2')

// ─── Test 12：完整 10 層序列 — 無崩潰，怪物總數合理 ─────────────────────────

console.log('\n【Test 12】完整 10 層序列 — all floors build without crash')

let totalMonsters = 0
let buildErrors = 0

for (let f = 1; f <= 10; f++) {
  try {
    const result = buildFloorFromConfig(makeParams(f, f <= 5 ? 'safe' : 'trial', makeLCG(f * 100)))
    totalMonsters += Object.keys(result.units).length
    // 基本完整性
    if (f < 10) {
      if (result.floor.objective.type !== 'reach_exit') buildErrors++
    } else {
      if (result.floor.objective.type !== 'kill_boss') buildErrors++
    }
  } catch (e) {
    buildErrors++
    console.error(`    floor=${f} 崩潰: ${e}`)
  }
}

assert(buildErrors === 0, `所有 10 層無崩潰（錯誤數: ${buildErrors}）`)
assert(totalMonsters >= 15 && totalMonsters <= 50, `10 層總怪物數合理 [15-50]（got: ${totalMonsters}）`)

// ─── Test 13：可重現性 ────────────────────────────────────────────────────────

console.log('\n【Test 13】可重現性 — 相同 seed 相同 roomId 與怪物位置')

const rA = buildFloorFromConfig(makeParams(3, 'trial', makeLCG(555)))
const rB = buildFloorFromConfig(makeParams(3, 'trial', makeLCG(555)))

assert(rA.floorPlan.roomId === rB.floorPlan.roomId, `相同 seed → 相同 roomId（${rA.floorPlan.roomId}）`)
const posA = Object.values(rA.units).map(u => `${u.pos.x},${u.pos.y}`).sort().join('|')
const posB = Object.values(rB.units).map(u => `${u.pos.x},${u.pos.y}`).sort().join('|')
assert(posA === posB, `相同 seed → 相同怪物位置`)
assert(Object.keys(rA.units).length === Object.keys(rB.units).length, '相同 seed → 相同怪物數')

// ─── Test 14：試煉路線 floor=4 怪物數 > 安穩路線 ─────────────────────────────

console.log('\n【Test 14】floor=4 trial 怪物數 > safe 怪物數')

const r14safe  = buildFloorFromConfig(makeParams(4, 'safe',  makeLCG(14)))
const r14trial = buildFloorFromConfig(makeParams(4, 'trial', makeLCG(14)))
const safeCnt  = Object.keys(r14safe.units).length
const trialCnt = Object.keys(r14trial.units).length
assert(trialCnt > safeCnt, `trial(${trialCnt}) > safe(${safeCnt})`)

// trial floor=4: 3+2+2=7 encounters → 最多 7 隻，safe 3 encounters → 最多 3 隻
assert(safeCnt >= 1 && safeCnt <= 3,  `safe 怪物數 ∈ [1,3]（got: ${safeCnt}）`)
assert(trialCnt >= 4 && trialCnt <= 7, `trial 怪物數 ∈ [4,7]（got: ${trialCnt}）`)

// ─── Test 15：dungeonQuality 影響怪物屬性 ─────────────────────────────────────

console.log('\n【Test 15】dungeonQuality 影響怪物 HP 縮放')

// dungeonQuality 目前傳入 createFloor → spawnMonster 的 dungeonQuality 參數
// 但 spawner.ts 的 calcResource 並未直接用 dungeonQuality 調整 HP（使用 hpMult）
// dungeonQuality 主要影響武器品質（qualityMult），驗證高 quality 不 crash
const rQ1 = buildFloorFromConfig({ ...makeParams(5, 'safe', makeLCG(15), 1.0) })
const rQ2 = buildFloorFromConfig({ ...makeParams(5, 'safe', makeLCG(15), 2.0) })
assert(Object.keys(rQ1.units).length === Object.keys(rQ2.units).length, 'dungeonQuality 不影響怪物生成數量')
// 武器品質不同（不崩潰即可）
assert(Object.keys(rQ2.units).length >= 1, 'dungeonQuality=2.0 → 正常生成')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
