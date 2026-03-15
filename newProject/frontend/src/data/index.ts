/**
 * data/index.ts — 靜態 JSON 資料載入器
 *
 * 使用 import.meta.glob eager 載入所有 JSON，
 * 組裝成引擎所需的 MonsterRegistry、LootRegistry 等。
 */

import type { MonsterRegistry } from '@engine/dungeon'
import type { MonsterDef, SpawnerDef } from '@engine/spawner'
import type { LootRegistry, ArmorBaseDef } from '@engine/loot'
import type { LootArmorAffix } from '@engine/loot_utils'
import type { ArmorAffixDef } from '@engine/armor'
import type { JobCertDef } from '@engine/player'
import type { DungeonConfig } from '@engine/campaign'
import type { RoomDef, ChunkDef } from '@engine/dungeon'
import type { WeaponBaseData } from '@engine/weapons'

// ── 靜態 glob 引入 ─────────────────────────────────────────────────────────

const monsterDefsRaw = import.meta.glob<{ default: MonsterDef }>(
  '../../../data/monsters/**/*.json',
  { eager: true, import: 'default' }
)
const spawnerDefsRaw = import.meta.glob<{ default: SpawnerDef }>(
  '../../../data/monsters/**/*_spawner.json',
  { eager: true, import: 'default' }
)
const armorBasesRaw = import.meta.glob<{ default: ArmorBaseDef[] }>(
  '../../../data/armor/bases/*.json',
  { eager: true, import: 'default' }
)
const armorAffixesRaw = import.meta.glob<{ default: LootArmorAffix[] }>(
  '../../../data/affixes/armor_affixes.json',
  { eager: true, import: 'default' }
)
const jobCertsRaw = import.meta.glob<{ default: JobCertDef }>(
  '../../../data/job_certs/*.json',
  { eager: true, import: 'default' }
)
const roomDefsRaw = import.meta.glob<{ default: RoomDef }>(
  '../../../data/maps/**/*.json',
  { eager: true, import: 'default' }
)
const chunkDefsRaw = import.meta.glob<{ default: ChunkDef }>(
  '../../../data/maps/chunks/**/*.json',
  { eager: true, import: 'default' }
)
const forestConfigRaw = import.meta.glob<{ default: DungeonConfig }>(
  '../../../data/dungeon/forest_config.json',
  { eager: true, import: 'default' }
)
const weaponBasesRaw = import.meta.glob<{ default: WeaponBaseData[] }>(
  '../../../data/weapons/bases/*.json',
  { eager: true, import: 'default' }
)

// ── MonsterRegistry ────────────────────────────────────────────────────────

function buildMonsterRegistry(): MonsterRegistry {
  const registry: MonsterRegistry = {}

  // 先收集所有非 spawner 的 monster defs
  const defs: Record<string, MonsterDef> = {}
  for (const [path, mod] of Object.entries(monsterDefsRaw)) {
    if (path.includes('_spawner')) continue
    if (path.includes('_skills')) continue
    const def = mod as unknown as MonsterDef
    if (def?.id) defs[def.id] = def
  }

  // 收集 spawner defs（spawnerId = monsterId）
  const spawners: Record<string, SpawnerDef> = {}
  for (const [, mod] of Object.entries(spawnerDefsRaw)) {
    const spawner = mod as unknown as SpawnerDef
    if (spawner?.monsterId) spawners[spawner.monsterId] = spawner
  }

  // 合併
  for (const [id, def] of Object.entries(defs)) {
    if (spawners[id]) {
      registry[id] = { def, spawner: spawners[id] }
    }
  }

  return registry
}

// ── LootRegistry ───────────────────────────────────────────────────────────

function buildLootRegistry(): LootRegistry {
  const armorBases: ArmorBaseDef[] = []
  for (const [, mod] of Object.entries(armorBasesRaw)) {
    const arr = mod as unknown as ArmorBaseDef[]
    if (Array.isArray(arr)) armorBases.push(...arr)
  }

  const armorAffixes: LootArmorAffix[] = []
  for (const [, mod] of Object.entries(armorAffixesRaw)) {
    const arr = mod as unknown as LootArmorAffix[]
    if (Array.isArray(arr)) armorAffixes.push(...arr)
  }

  return { armorBases, armorAffixes }
}

// ── JobCerts ───────────────────────────────────────────────────────────────

function buildJobCerts(): Record<string, JobCertDef> {
  const certs: Record<string, JobCertDef> = {}
  for (const [, mod] of Object.entries(jobCertsRaw)) {
    const cert = mod as unknown as JobCertDef
    if (cert?.id) certs[cert.id] = cert
  }
  return certs
}

// ── RoomDefs ───────────────────────────────────────────────────────────────

function buildRoomDefs(): Record<string, RoomDef> {
  const rooms: Record<string, RoomDef> = {}
  for (const [path, mod] of Object.entries(roomDefsRaw)) {
    if (path.includes('/chunks/')) continue
    const room = mod as unknown as RoomDef
    if (room?.id) rooms[room.id] = room
  }
  return rooms
}

function buildChunkDefs(): Record<string, ChunkDef> {
  const chunks: Record<string, ChunkDef> = {}
  for (const [, mod] of Object.entries(chunkDefsRaw)) {
    const chunk = mod as unknown as ChunkDef
    if (chunk?.id) chunks[chunk.id] = chunk
  }
  return chunks
}

// ── DungeonConfig ─────────────────────────────────────────────────────────

function buildForestConfig(): DungeonConfig | null {
  for (const [, mod] of Object.entries(forestConfigRaw)) {
    const cfg = mod as unknown as DungeonConfig
    if (cfg?.theme) return cfg
  }
  return null
}

// ── WeaponBases ───────────────────────────────────────────────────────────

function buildWeaponBases(): Record<string, WeaponBaseData> {
  const bases: Record<string, WeaponBaseData> = {}
  for (const [, mod] of Object.entries(weaponBasesRaw)) {
    const arr = mod as unknown as WeaponBaseData[]
    if (Array.isArray(arr)) {
      for (const w of arr) {
        if (w?.id) bases[w.id] = w
      }
    }
  }
  return bases
}

// ── 單例導出 ──────────────────────────────────────────────────────────────

export const monsterRegistry: MonsterRegistry = buildMonsterRegistry()
export const lootRegistry: LootRegistry = buildLootRegistry()
/** 完整詞條定義（含 abilities[]），供 resolveArmorStats 使用 */
export const armorAffixDefs: ArmorAffixDef[] = lootRegistry.armorAffixes as unknown as ArmorAffixDef[]
export const jobCerts: Record<string, JobCertDef> = buildJobCerts()
export const roomDefs: Record<string, RoomDef> = buildRoomDefs()
export const chunkDefs: Record<string, ChunkDef> = buildChunkDefs()
export const forestConfig: DungeonConfig | null = buildForestConfig()
export const weaponBases: Record<string, WeaponBaseData> = buildWeaponBases()
