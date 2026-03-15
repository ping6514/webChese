/**
 * spawner.ts — 怪物實例生成
 *
 * spawnMonster(params) → Unit
 *
 * 職責：
 *   - 接收預載的 MonsterDef（wolf.json）+ SpawnerDef（wolf_spawner.json）
 *   - 依 tier + floorNumber 計算最終屬性（base + floorScale × statScaleMult）
 *   - 隨機選武器詞條（依 affixCountTable / affixRarityTable 加權抽取）
 *   - 呼叫 resolveMonsterWeapon 產生 ResolvedWeapon
 *   - 組裝並回傳完整 Unit
 *
 * 注意：
 *   - 純函數，不做任何 I/O（呼叫方負責載入 JSON）
 *   - 回傳 Unit 但不加入 ATB timeline（由呼叫方處理）
 *   - 詞條 rarity 過濾使用 MVP1 簡化：直接從 pool 抽，不做 rarity 二次篩選
 */

import type { Unit, Pos } from './state'
import type { AffixDefData } from './weapons'
import { resolveMonsterWeapon } from './weapons'
import type { PassiveAbilityDef } from './passive'

// ─── MonsterDef 型別（對應 wolf.json 等）──────────────────────────────────────

export type StatScaleDef = { base: number; floorScale: number }

export type ResourceDef = {
  base: number
  strMult?: number
  agiMult?: number
  intMult?: number
}

export type MonsterWeaponInlineDef = {
  id: string
  name: string
  actionId: string
  hitMode: import('./state').HitMode
  statScaling: 'STR' | 'AGI' | 'INT'
  atkBase: number
  actionTags?: string[]
  slot1?: string
  slot2?: string
  slot3Pool?: string[]
  slot4?: string | null
  slot5Pool?: string[]
  /** 覆蓋讀條時間（ms），未設定則由 actionId 推算 */
  castTimeBase?: number
  recoveryTimeBase?: number
  cooldownBase?: number
}

export type MonsterDef = {
  id: string
  name: string
  theme: string
  tier: string
  archetype: string
  ai: 'chase' | 'patrol' | 'guard' | 'boss'
  stats: {
    str: StatScaleDef
    agi: StatScaleDef
    int: StatScaleDef
    lck: StatScaleDef
  }
  resources: {
    hp: ResourceDef
    sp: ResourceDef
    mp: ResourceDef
  }
  moveRange: number
  speed: number
  weapon: MonsterWeaponInlineDef
  passiveAbilities?: PassiveAbilityDef[]
}

// ─── SpawnerDef 型別（對應 wolf_spawner.json 等）────────────────────────────

export type WeightEntry<T> = { weight: number } & T

export type AffixTableDef = {
  affixCountTable: WeightEntry<{ count: number }>[]
  affixRarityTable: WeightEntry<{ rarity: string }>[]
}

export type SpawnerTierDef = {
  statScaleMult: number
  qualityMult: number
  hpMult: number
  speedBonus?: number
  weapon: AffixTableDef
  skillPool?: { id: string }[]
  passiveAbilities?: PassiveAbilityDef[]
  dropTable?: Record<string, unknown>
}

export type SpawnerDef = {
  monsterId: string
  normal?: SpawnerTierDef
  elite?: SpawnerTierDef
  boss?: SpawnerTierDef
}

// ─── spawnMonster 參數 ────────────────────────────────────────────────────────

export type SpawnParams = {
  monsterDef: MonsterDef
  spawnerDef: SpawnerDef
  tier: 'normal' | 'elite' | 'boss'
  pos: Pos
  floorNumber: number
  allAffixDefs?: Record<string, AffixDefData>
  dungeonQuality?: number
  rng?: () => number
  /** 指定 unitId（省略時自動生成）*/
  unitId?: string
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * 從 MonsterDef + SpawnerDef + 環境參數，產生一個完整的 Unit。
 * 回傳的 Unit 帶有全部屬性、已 resolve 的武器（含隨機詞條）、技能冷卻表初始化。
 */
export function spawnMonster(params: SpawnParams): Unit {
  const {
    monsterDef: def,
    spawnerDef: spawner,
    tier,
    pos,
    floorNumber,
    allAffixDefs = {},
    dungeonQuality = 1.0,
    rng = Math.random,
    unitId,
  } = params

  const tierDef: SpawnerTierDef = spawner[tier] ?? spawner.normal ?? defaultTierDef()
  const { statScaleMult, qualityMult, hpMult, speedBonus = 0 } = tierDef

  // ── 屬性計算 ──────────────────────────────────────────────────────────────
  const stats = calcStats(def.stats, floorNumber, statScaleMult)

  // ── 資源計算（HP/SP/MP）──────────────────────────────────────────────────
  const maxHP = calcResource(def.resources.hp, stats, hpMult)
  const maxSP = calcResource(def.resources.sp, stats, 1.0)
  const maxMP = calcResource(def.resources.mp, stats, 1.0)

  // ── 武器 resolve ──────────────────────────────────────────────────────────
  const weapon = buildMonsterWeapon(
    def.weapon,
    tierDef.weapon,
    allAffixDefs,
    dungeonQuality,
    qualityMult,
    rng
  )

  // ── 速度 ──────────────────────────────────────────────────────────────────
  const speed = def.speed + speedBonus

  // ── 技能冷卻初始化 ────────────────────────────────────────────────────────
  const skillCooldownUntil: Record<string, number> = {}
  const skillPool = tierDef.skillPool ?? []
  for (const s of skillPool) {
    skillCooldownUntil[s.id] = 0
  }

  // ── 被動：tier spawner 優先，否則用 monsterDef 的 passiveAbilities ───────
  // passiveAbilities 不存入 Unit（由 PassiveRegistry 管理），Unit 只追蹤觸發記錄

  // ── 生成 unitId ───────────────────────────────────────────────────────────
  const id = unitId ?? `${def.id}_${tier}_${Math.floor(rng() * 100000).toString(36)}`

  return {
    id,
    kind: 'monster',
    name: def.name,
    pos,
    facing: 'down',
    stats,
    maxHP,  currentHP: maxHP,
    maxSP,  currentSP: maxSP,
    maxMP,  currentMP: maxMP,
    spRecoveryFlat: 0,  // 怪物不自動回 SP（玩家由 JobCertDef.spRecoveryFlat 定義）
    speed,
    moveRange: def.moveRange,
    weapons: [weapon],
    weaponCooldownUntil: [0],
    resistances: {},
    defenses: {},
    statusEffects: [],
    ai: def.ai,
    monsterId: def.id,
    skillCooldownUntil,
    triggeredPassiveIds: [],
    passiveNextTriggerAt: {},
  }
}

// ─── 屬性計算 ─────────────────────────────────────────────────────────────────

function calcStats(
  defs: MonsterDef['stats'],
  floorNumber: number,
  scaleMult: number
): { str: number; agi: number; int: number; lck: number } {
  return {
    str: Math.round(defs.str.base + floorNumber * defs.str.floorScale * scaleMult),
    agi: Math.round(defs.agi.base + floorNumber * defs.agi.floorScale * scaleMult),
    int: Math.round(defs.int.base + floorNumber * defs.int.floorScale * scaleMult),
    lck: Math.round(defs.lck.base + floorNumber * defs.lck.floorScale * scaleMult),
  }
}

function calcResource(
  def: ResourceDef,
  stats: { str: number; agi: number; int: number; lck: number },
  mult: number
): number {
  let val = def.base
  if (def.strMult) val += stats.str * def.strMult
  if (def.agiMult) val += stats.agi * def.agiMult
  if (def.intMult) val += stats.int * def.intMult
  return Math.max(0, Math.round(val * mult))
}

// ─── 武器 resolve ─────────────────────────────────────────────────────────────

function buildMonsterWeapon(
  weaponDef: MonsterWeaponInlineDef,
  affixTable: AffixTableDef,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality: number,
  qualityMult: number,
  rng: () => number
) {
  // 1. 基礎武器 resolve（slot1/slot2 固定）
  const base = resolveMonsterWeapon({
    id: weaponDef.id,
    name: weaponDef.name,
    actionId: weaponDef.actionId,
    hitMode: weaponDef.hitMode,
    statScaling: weaponDef.statScaling,
    atkBase: weaponDef.atkBase,
    actionTags: weaponDef.actionTags,
    slot1: weaponDef.slot1,
    slot2: weaponDef.slot2,
    cooldownBase: weaponDef.cooldownBase,
  })

  // 填入合理的讀條/硬直時間（monster JSON 通常不定義）
  const castTime = weaponDef.castTimeBase ?? defaultCastTime(weaponDef.actionId)
  const recoveryTime = weaponDef.recoveryTimeBase ?? defaultRecoveryTime(weaponDef.actionId)

  // 2. 抽取詞條（slot3Pool + slot5Pool 合併池）
  const affixPool = buildAffixPool(weaponDef, affixTable.affixRarityTable, allAffixDefs, qualityMult)
  const count = weightedPick(affixTable.affixCountTable, rng)?.count ?? 0
  const pickedIds = pickWithoutReplacement(affixPool, count, rng)

  return {
    ...base,
    castTimeFinal: castTime,
    recoveryTimeFinal: recoveryTime,
    appliedAffixIds: pickedIds,
  }
}

/**
 * 建立可選詞條池：從 slot3Pool、slot4（若有）、slot5Pool 收集，
 * 依 affixRarityTable 過濾（MVP1：直接用 pool，若詞條有 rarity 則過濾）。
 */
function buildAffixPool(
  weaponDef: MonsterWeaponInlineDef,
  rarityTable: WeightEntry<{ rarity: string }>[],
  allAffixDefs: Record<string, AffixDefData>,
  _qualityMult: number
): string[] {
  const allowedRarities = new Set(rarityTable.map(r => r.rarity))

  const candidates: string[] = [
    ...(weaponDef.slot3Pool ?? []),
    ...(weaponDef.slot4 ? [weaponDef.slot4] : []),
    ...(weaponDef.slot5Pool ?? []),
  ]

  // 若 allAffixDefs 有 rarity 欄位，依允許 rarity 過濾；否則全部保留
  return candidates.filter(id => {
    const def = allAffixDefs[id] as (AffixDefData & { rarity?: string }) | undefined
    if (!def) return true  // 未載入的詞條：保留（runtime 時 damage 忽略未知 id）
    if (!def.rarity) return true
    return allowedRarities.has(def.rarity)
  })
}

// ─── 加權隨機工具 ─────────────────────────────────────────────────────────────

/** 加權抽樣（從 entries 中依 weight 抽一個）*/
function weightedPick<T>(entries: WeightEntry<T>[], rng: () => number): T | null {
  if (entries.length === 0) return null
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let r = rng() * total
  for (const entry of entries) {
    r -= entry.weight
    if (r <= 0) return entry
  }
  return entries[entries.length - 1]
}

/** 從 pool 中不重複抽取最多 count 個（pool 不足時取全部）*/
function pickWithoutReplacement(pool: string[], count: number, rng: () => number): string[] {
  if (pool.length === 0 || count <= 0) return []
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

// ─── 讀條時間預設值（依 actionId 推算）──────────────────────────────────────

/** 近戰預設 500ms，遠程/直線 800ms */
function defaultCastTime(actionId: string): number {
  if (actionId.startsWith('ranged') || actionId.startsWith('line')) return 800
  return 500
}

/** 近戰硬直 350ms，遠程 250ms */
function defaultRecoveryTime(actionId: string): number {
  if (actionId.startsWith('ranged') || actionId.startsWith('line')) return 250
  return 350
}

function defaultTierDef(): SpawnerTierDef {
  return {
    statScaleMult: 1.0,
    qualityMult: 1.0,
    hpMult: 1.0,
    weapon: {
      affixCountTable: [{ count: 1, weight: 1 }],
      affixRarityTable: [{ rarity: 'common', weight: 1 }],
    },
  }
}
