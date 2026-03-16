/**
 * player.ts — 玩家角色生成
 *
 * 兩層結構：
 *   JobCertDef（模板 JSON）→ rollJobCert() → JobCertInstance（凍結個體）
 *   JobCertDef + JobCertInstance → createPlayerUnit() → Unit
 *
 * JobCertInstance 是玩家實際持有的資產——同一種 warrior 證書可以有多個，
 * 每個的 rolledStats 不同（個體差異在取得時就確定，之後不再改變）。
 *
 * 注意：
 *   - 純函數，不做任何 I/O（呼叫方負責載入 JSON）
 *   - 被動（passives）由 PassiveRegistry 管理，Unit 只追蹤觸發記錄
 *   - 武器/裝備由上層（village 準備、dungeon 入場）另行 applyLoadout
 */

import type { Unit, Pos } from './state'
import type { ResourceDef } from './spawner'
import { resolveWeapon } from './weapons'
import type { WeaponBaseData, AffixDefData, AppliedAffixInput } from './weapons'
import type { FrozenArmor } from './item'
import type { ArmorAffixDef } from './armor'
import { resolveArmorStats } from './armor'
import { resolveLoadout } from './resolveLoadout'
import type {
  CertDef,
  GeneDef,
  LoadoutResolution,
  ToolDef,
  WeaponDef,
} from './schema'

// ─── JobCertDef 型別（對應 job_certs/*.json）─────────────────────────────────

export type JobStatDef = {
  base: number
  randomBonus: { min: number; max: number }
}

export type JobPassiveDef = Record<string, unknown>  // 由 PassiveRegistry 解析

export type JobCertDef = {
  id: string
  name: string
  tier: 'basic' | 'advanced' | 'master'
  tags: string[]
  allowedArmorTypes: string[]
  stats: {
    str: JobStatDef
    int: JobStatDef
    agi: JobStatDef
    lck: JobStatDef
  }
  resources: {
    hp: ResourceDef
    sp: ResourceDef
    mp: ResourceDef
  }
  moveRange: number
  /**
   * 每次行動後（consumeATB）自動回復的 SP 量。
   * 預設 20；職業可調整。職業特性額外回復（AGI 加成、受擊回 SP 等）由 passives[] 處理。
   */
  spRecoveryFlat?: number
  passives?: JobPassiveDef[]
}

// ─── JobCertInstance — 凍結後的個體職業證 ────────────────────────────────────

export type RolledStats = {
  str: number
  agi: number
  int: number
  lck: number
}

/**
 * 玩家持有的職業證個體。
 * rolledStats 在取得時由 rollJobCert() 確定，之後永遠不變。
 * 同一個 defId 的多個 instance 之間僅 rolledStats / instanceId 不同。
 */
export type JobCertInstance = {
  instanceId: string   // 唯一識別（玩家資產 ID）
  defId: string        // 對應 JobCertDef.id（e.g. 'warrior'）
  rolledStats: RolledStats
}

// ─── rollJobCert：從模板產生一個凍結個體 ─────────────────────────────────────

/**
 * 骰出一個 JobCertInstance（個體差異確定、之後 immutable）。
 * @param def       職業證模板 JSON
 * @param instanceId  此個體的唯一 ID（由外部指定或自動生成）
 * @param rng       可種子化的隨機函數（省略時用 Math.random）
 */
export function rollJobCert(
  def: JobCertDef,
  instanceId: string,
  rng: () => number = Math.random
): JobCertInstance {
  return {
    instanceId,
    defId: def.id,
    rolledStats: {
      str: rollStat(def.stats.str, rng),
      agi: rollStat(def.stats.agi, rng),
      int: rollStat(def.stats.int, rng),
      lck: rollStat(def.stats.lck, rng),
    },
  }
}

// ─── 玩家武器欄位（帶入 resolveWeapon 所需資料）─────────────────────────────

/**
 * 玩家持有的武器欄位定義。
 * 對應 state.Unit.weapons[0~2]，呼叫 resolveWeapon 後掛進 Unit。
 */
export type PlayerWeaponSlot = {
  base: WeaponBaseData
  applied: AppliedAffixInput[]
  /** 武器實例 hash（玩家物品欄 ID，null = 無 hash）*/
  idHash?: string | null
}

// ─── createPlayerUnit 參數 ────────────────────────────────────────────────────

export type CreatePlayerParams = {
  id: string
  jobCertDef: JobCertDef
  pos: Pos
  /**
   * 若提供 instance：使用其凍結的 rolledStats（完全 deterministic，忽略 rng）
   * 若省略：立即骰值（適合一次性快速建立）
   */
  jobCertInstance?: JobCertInstance
  /** 無 instance 時使用的隨機函數（省略時用 Math.random）*/
  rng?: () => number
  /**
   * 武器欄位（最多 3 格）。null = 空欄位，省略 = 全空。
   * 每個非 null 欄位會呼叫 resolveWeapon() 產生 ResolvedWeapon。
   */
  weaponSlots?: (PlayerWeaponSlot | null)[]
  /** resolveWeapon 所需的詞條定義表（省略時使用空表，詞條不生效）*/
  allAffixDefs?: Record<string, AffixDefData>
  /** 地城品質（影響詞條係數，預設 1.0）*/
  dungeonQuality?: number
  /** 初始裝備（FrozenArmor 清單，每個 slot 取第一個）*/
  initialArmor?: FrozenArmor[]
  /** 解析防具詞條用的定義表（initialArmor 有效時必須提供）*/
  armorAffixDefs?: ArmorAffixDef[]
  /** 新版職業證資料（可與舊 jobCertDef 並存，逐步遷移）*/
  certDef?: CertDef
  /** 新版武器資料（供 resolveLoadout 使用）*/
  loadoutWeapons?: WeaponDef[]
  /** 新版基因資料（供 resolveLoadout 使用）*/
  loadoutGenes?: GeneDef[]
  /** 新版工具資料（供 resolveLoadout 使用）*/
  loadoutTools?: ToolDef[]
  /** 已裝備基因 id（只做記錄與 resolvedLoadout 輔助）*/
  equippedGeneIds?: string[]
  /** 已裝備工具 id（只做記錄與 resolvedLoadout 輔助）*/
  equippedToolIds?: string[]
  /** 外部已先 resolve 完成的 loadout；若提供則優先使用 */
  resolvedLoadout?: LoadoutResolution
}

// ─── createPlayerUnit：從模板 + 個體建立 Unit ─────────────────────────────────

/**
 * 建立一個裸玩家 Unit（無武器、無裝備詞條）。
 * - 提供 jobCertInstance → 使用已凍結的 rolledStats（deterministic）
 * - 僅提供 jobCertDef → 當場骰值（rng 可選）
 */
export function createPlayerUnit(params: CreatePlayerParams): Unit {
  const {
    id, jobCertDef: def, pos, jobCertInstance, rng = Math.random,
    weaponSlots, allAffixDefs = {}, dungeonQuality = 1.0,
    initialArmor = [], armorAffixDefs = [],
    certDef,
    loadoutWeapons = [],
    loadoutGenes = [],
    loadoutTools = [],
    equippedGeneIds = [],
    equippedToolIds = [],
    resolvedLoadout,
  } = params

  const stats: RolledStats = jobCertInstance
    ? jobCertInstance.rolledStats
    : {
        str: rollStat(def.stats.str, rng),
        agi: rollStat(def.stats.agi, rng),
        int: rollStat(def.stats.int, rng),
        lck: rollStat(def.stats.lck, rng),
      }

  // ── 累加所有裝備的 delta ───────────────────────────────────────────────
  const resistances: Record<string, number> = {}
  const defenses: Record<string, number> = {}
  let bonusHP = 0, bonusSP = 0, bonusMP = 0
  let bonusStr = 0, bonusAgi = 0, bonusInt = 0, bonusLck = 0
  let bonusMoveRange = 0

  if (initialArmor.length > 0 && armorAffixDefs.length > 0) {
    for (const armor of initialArmor) {
      const delta = resolveArmorStats(armor.affixIds, armorAffixDefs, armor.dungeonQuality)
      bonusHP        += delta.maxHP
      bonusSP        += delta.maxSP
      bonusMP        += delta.maxMP
      bonusStr       += delta.str
      bonusAgi       += delta.agi
      bonusInt       += delta.int
      bonusLck       += delta.lck
      bonusMoveRange += delta.moveRange
      for (const [el, v] of Object.entries(delta.resistances)) {
        resistances[el] = (resistances[el] ?? 0) + v
      }
      for (const [el, v] of Object.entries(delta.defenses)) {
        defenses[el] = (defenses[el] ?? 0) + v
      }
    }
  }

  // 套用 bonus 到 stats
  const finalStats = {
    str: stats.str + bonusStr,
    agi: stats.agi + bonusAgi,
    int: stats.int + bonusInt,
    lck: stats.lck + bonusLck,
  }

  const maxHP = calcResource(def.resources.hp, finalStats) + bonusHP
  const maxSP = calcResource(def.resources.sp, finalStats) + bonusSP
  const maxMP = calcResource(def.resources.mp, finalStats) + bonusMP

  // 速度：agi 驅動（基礎 10 + agi * 0.5，最小 6）
  const speed = Math.max(6, Math.round(10 + finalStats.agi * 0.5))

  // 武器欄位（最多 3 格）
  const slots = weaponSlots ?? [null, null, null]
  const weapons = [
    slots[0] ? resolveWeapon(slots[0].base, allAffixDefs, slots[0].applied, slots[0].idHash ?? null, dungeonQuality) : null,
    slots[1] ? resolveWeapon(slots[1].base, allAffixDefs, slots[1].applied, slots[1].idHash ?? null, dungeonQuality) : null,
    slots[2] ? resolveWeapon(slots[2].base, allAffixDefs, slots[2].applied, slots[2].idHash ?? null, dungeonQuality) : null,
  ] as [import('./state').ResolvedWeapon | null, import('./state').ResolvedWeapon | null, import('./state').ResolvedWeapon | null]

  const nextResolvedLoadout = resolvedLoadout
    ?? (certDef
      ? resolveLoadout(
          {
            cert: certDef,
            equippedGeneIds,
            equippedToolIds,
          },
          loadoutWeapons,
          loadoutGenes,
          loadoutTools,
        )
      : undefined)

  return {
    id,
    kind: 'player',
    name: def.name,
    pos,
    facing: 'down',
    stats: finalStats,
    maxHP,  currentHP: maxHP,
    maxSP,  currentSP: maxSP,
    maxMP,  currentMP: maxMP,
    spRecoveryFlat: def.spRecoveryFlat ?? 20,
    speed,
    moveRange: def.moveRange + bonusMoveRange,
    weapons,
    weaponCooldownUntil: [0, 0, 0],
    resistances,
    defenses,
    statusEffects: [],
    jobId: def.id,
    jobCertInstanceId: jobCertInstance?.instanceId,
    certId: certDef?.id,
    equippedGeneIds,
    equippedToolIds,
    resolvedLoadout: nextResolvedLoadout,
  }
}

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

function rollStat(def: JobStatDef, rng: () => number): number {
  const { min, max } = def.randomBonus
  const bonus = min === max ? min : Math.floor(rng() * (max - min + 1)) + min
  return def.base + bonus
}

function calcResource(
  def: ResourceDef,
  stats: RolledStats
): number {
  let val = def.base
  if (def.strMult) val += stats.str * def.strMult
  if (def.agiMult) val += stats.agi * def.agiMult
  if (def.intMult) val += stats.int * def.intMult
  return Math.max(0, Math.round(val))
}
