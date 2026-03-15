/**
 * loot_utils.ts — 打寶工具函數與共用型別
 *
 * 兩條打寶路徑（標準/Boss）共用的：
 *   - LootContext：地城環境參數（所有路徑都需要）
 *   - RarityWeight：稀有度加權表格式
 *   - LootArmorAffix：armor_affixes.json 詞條必要欄位
 *   - WishBias：玩家許願偏好（只作用於 standard ticket 產生前）
 *   - rollAffixesForBase()：從詞條池依 rarity + jobTags 過濾並抽取
 *   - makeInstanceId()：確定性 FNV-1a hash
 *   - weightedPick / pickWithoutReplacement / rarityUpTo / clampChance
 */

import type { ArmorSlot } from './item'

// ─── 共用環境型別 ─────────────────────────────────────────────────────────────

/**
 * 地城環境參數：兩條打寶路徑都需要傳入，影響詞條強度與 itemLevel。
 */
export type LootContext = {
  /** 地城品質（影響 valueExpr 計算，如 dungeonQuality*3）*/
  dungeonQuality: number
  /** 當前樓層（→ FrozenItem.itemLevel）*/
  floorNumber: number
  /** 地城主題（未來用於主題詞條過濾）*/
  theme: 'forest' | 'ruins'
  /**
   * 確定性種子字串（由呼叫方從 runSeed + dropSeq 組合，
   * 例如 `${runSeed}:${dropSeq}`），供 makeInstanceId 使用。
   */
  ticketSeed: string
}

// ─── 稀有度加權 ───────────────────────────────────────────────────────────────

export type RarityWeight = {
  rarity: 'common' | 'rare' | 'elite'
  weight: number
}

// ─── 詞條型別 ─────────────────────────────────────────────────────────────────

/** armor_affixes.json 中每條詞條的必要欄位 */
export type LootArmorAffix = {
  id: string
  rarity: 'common' | 'rare' | 'elite'
  /** 此詞條適用的裝甲類型標籤（重甲/輕甲/布甲），用於 playerJobTags 過濾 */
  usedTags: string[]
}

// ─── 許願偏好 ─────────────────────────────────────────────────────────────────

/**
 * WishBias 作用在抽獎券**產生之前**，調整 ticket 的參數分布。
 * 數值範圍建議 −0.20 ~ +0.20，由系統在產生票時 clamp。
 */
export type WishBias = {
  /** 裝備槽偏好：slot → chance 調整值（正值提升掉落率） */
  slotBonus?: Record<string, number>
  /** 稀有度偏好：rarity → weight 調整值（正值提升比重） */
  rarityBonus?: Record<string, number>
  /** 道具類型偏好：'weapon' | 'armor' | 'tool' → weight 調整值 */
  itemTypeBonus?: Record<string, number>
}

// ─── 詞條抽取 ─────────────────────────────────────────────────────────────────

/**
 * 從詞條池中，依稀有度 + playerJobTags 過濾後，抽取 N 個詞條 id。
 *
 * 過濾邏輯：
 *   1. affixPool 中的 id 必須存在於 armorAffixes 中
 *   2. 詞條 rarity ≤ 目標 rarity（由 rarityTable 加權抽一個目標，再允許同級以下）
 *   3. 若提供 playerJobTags：affix.usedTags ∩ playerJobTags 非空才保留
 *
 * @param affixPool  裝備基底的候選詞條 id 清單（來自 ArmorBaseDef.affixPool）
 * @param rarityTable 稀有度加權表（加權抽目標 rarity）
 * @param count      要抽幾個詞條
 * @param armorAffixes 全域詞條定義（armor_affixes.json）
 * @param playerJobTags 玩家職業標籤（省略 = 不過濾）
 * @param rng        可注入亂數
 */
export function rollAffixesForBase(
  affixPool: string[],
  rarityTable: RarityWeight[],
  count: number,
  armorAffixes: LootArmorAffix[],
  playerJobTags: string[] | undefined,
  rng: () => number
): string[] {
  // 1. 決定允許的 rarity 集合
  const targetRarity = weightedPick(rarityTable, rng)?.rarity ?? 'common'
  const allowed = rarityUpTo(targetRarity)

  // 2. 建立詞條索引（id → def）
  const affixMap = new Map(armorAffixes.map(a => [a.id, a]))

  // 3. 過濾
  const filtered = affixPool.filter(id => {
    const def = affixMap.get(id)
    if (!def) return false
    if (!allowed.has(def.rarity)) return false
    if (playerJobTags && playerJobTags.length > 0) {
      return def.usedTags.some(t => playerJobTags.includes(t))
    }
    return true
  })

  // 4. 抽取
  return pickWithoutReplacement(filtered, count, rng)
}

// ─── instanceId ───────────────────────────────────────────────────────────────

/**
 * 確定性 instanceId = FNV-1a 32-bit hash(`ticketSeed:seq:baseId`)。
 * 相同輸入永遠回傳相同 base-36 字串。
 *
 * @param ticketSeed 由呼叫方組合（e.g. `${runSeed}:${dropSeq}`）
 * @param seq        同一次掉落中的第幾件（區分多件掉落）
 * @param baseId     裝備基底 id
 */
export function makeInstanceId(ticketSeed: string, seq: number, baseId: string): string {
  return deterministicHash(`${ticketSeed}:${seq}:${baseId}`)
}

// ─── 加權工具 ─────────────────────────────────────────────────────────────────

/** 加權抽樣，回傳抽中的 entry（pool 為空時回傳 null）*/
export function weightedPick<T extends { weight: number }>(
  entries: T[],
  rng: () => number
): T | null {
  if (entries.length === 0) return null
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let r = rng() * total
  for (const entry of entries) {
    r -= entry.weight
    if (r <= 0) return entry
  }
  return entries[entries.length - 1]!
}

/** 從 pool 中不重複抽取最多 count 個（pool 不足時取全部）*/
export function pickWithoutReplacement(
  pool: string[],
  count: number,
  rng: () => number
): string[] {
  if (pool.length === 0 || count <= 0) return []
  const shuffled = [...pool].sort(() => rng() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

/** 回傳 ≤ targetRarity 的所有 rarity 集合（e.g. 'rare' → { common, rare }）*/
export function rarityUpTo(targetRarity: string): Set<string> {
  const LEVEL: Record<string, number> = { common: 0, rare: 1, elite: 2 }
  const level = LEVEL[targetRarity] ?? 0
  return new Set(Object.entries(LEVEL).filter(([, l]) => l <= level).map(([r]) => r))
}

/** 把掉落機率 clamp 到 [0, 1]，避免 wishBias 超出範圍 */
export function clampChance(c: number): number {
  return Math.max(0, Math.min(1, c))
}

// ─── 內部 hash ────────────────────────────────────────────────────────────────

function deterministicHash(s: string): string {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}
