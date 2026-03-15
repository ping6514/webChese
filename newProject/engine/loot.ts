/**
 * loot.ts — 標準打寶工廠（抽獎券路徑）
 *
 * 流程：
 *   怪物擊殺 → 外部產生 StandardTicket（含稀有度/類型/槽位機率）
 *             → 可選 WishBias 在票產生前調整參數
 *             → resolveLoot(ticket, registry, opts) → LootResult
 *
 * 與 loot_boss.ts 的關係：
 *   - 兩者共用 loot_utils.ts 工具函數
 *   - 兩者輸出格式相同（FrozenItem）
 *   - 本模組不知道也不關心哪隻怪物觸發了掉落
 *
 * 設計原則：
 *   - 純函數，不做 I/O
 *   - rng 可注入，確保相同 ticket + seed → 相同輸出
 */

import type { ArmorSlot, FrozenArmor, FrozenItem, LootResult } from './item'
import type { LootContext, LootArmorAffix, RarityWeight, WishBias } from './loot_utils'
import {
  rollAffixesForBase,
  makeInstanceId,
  weightedPick,
  pickWithoutReplacement,
  clampChance,
} from './loot_utils'

// ─── 道具類型 ─────────────────────────────────────────────────────────────────

export type ItemType = 'weapon' | 'armor' | 'tool'

// ─── 抽獎券（StandardTicket）─────────────────────────────────────────────────

/**
 * 抽獎券：由怪物 tier 參數 + 地城環境產生。
 * 怪物資料到此為止——工廠只看票，不看是哪隻怪。
 *
 * 產生方式（呼叫方責任）：
 *   - itemTypes：怪物武器若標記「不可被玩家持有」→ 移除 'weapon'
 *   - slotDropChance：來自 spawnerTierDef.equipment.slotDropChance
 *   - rarityTable / affixCountTable：來自 spawnerTierDef.equipment 對應欄位
 *   - gold：呼叫方計算（base_range × goldMult × dungeonQuality）後帶入
 *   - WishBias 在產生票「之前」套用（調整 slotDropChance / rarityTable 等）
 */
export type StandardTicket = {
  /** 本張票能產生哪些類型的道具 */
  itemTypes: ItemType[]
  /** 每個槽位的掉落機率（slot → 0~1），可含 wishBias 調整後的結果 */
  slotDropChance: Record<string, number>
  /** 詞條稀有度分布（加權抽目標 rarity）*/
  rarityTable: RarityWeight[]
  /** 詞條數量分布（加權抽數量）*/
  affixCountTable: Array<{ count: number; weight: number }>
  /** true → 若全部槽位未命中，強制從 slotDropChance 中挑一個掉 */
  guaranteed: boolean
  /** 預先計算好的金幣數量（0 = 不掉金幣）*/
  gold: number
  /** 地城環境（影響 itemLevel / dungeonQuality 等）*/
  context: LootContext
}

// ─── 道具庫（LootRegistry）───────────────────────────────────────────────────

/**
 * 裝備基底定義（對應 armor/bases/heavy.json 等）。
 * 工廠從此庫中選取基底，不再依賴怪物 equipment 欄位。
 */
export type ArmorBaseDef = {
  id: string
  name: string
  armorType: string          // '重甲' | '輕甲' | '布甲'
  slot: ArmorSlot
  /** 穿戴需要的標籤（取交集判斷是否可裝備）*/
  requiredTags: string[]
  /** 需要多少個 requiredTags 匹配（省略 = 全部）*/
  requiredTagCount?: number
  baseStats: Record<string, number>
  affixCount: { min: number; max: number }
  /** 可選詞條池（id → armor_affixes.json）*/
  affixPool: string[]
}

/**
 * 預載的道具庫（theme-based）。
 * 呼叫方負責載入 JSON 並組裝，工廠不做 I/O。
 */
export type LootRegistry = {
  /** 所有甲冑基底（heavy / light / cloth 合併）*/
  armorBases: ArmorBaseDef[]
  /** 全域詞條定義（armor_affixes.json）*/
  armorAffixes: LootArmorAffix[]
  // weaponBases / toolBases 未來擴充
}

// ─── 工廠選項 ─────────────────────────────────────────────────────────────────

export type ResolveLootOpts = {
  /** 玩家職業標籤：過濾可裝備的基底與詞條 */
  playerJobTags?: string[]
  /** 可注入的隨機函數 */
  rng?: () => number
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * 標準打寶工廠。
 *
 * 流程（每個 slot）：
 *   1. 滾點：rng() < slotDropChance[slot]？
 *   2. 選基底：從 registry.armorBases 中找 slot 匹配 + 玩家可裝備的
 *   3. 抽詞條：rollAffixesForBase（依 rarityTable + jobTags 過濾）
 *   4. 組裝 FrozenArmor（instanceId = makeInstanceId）
 */
export function resolveLoot(
  ticket: StandardTicket,
  registry: LootRegistry,
  opts: ResolveLootOpts = {}
): LootResult {
  const { playerJobTags, rng = Math.random } = opts
  const { context, slotDropChance, rarityTable, affixCountTable, guaranteed } = ticket

  const items: FrozenItem[] = []
  let anyDropped = false

  for (const [slotKey, chance] of Object.entries(slotDropChance)) {
    if (rng() < clampChance(chance)) {
      const item = tryRollArmorItem(
        slotKey as ArmorSlot,
        ticket,
        registry,
        playerJobTags,
        items.length,  // seq（同一次掉落中的第幾件）
        rng
      )
      if (item) { items.push(item); anyDropped = true }
    }
  }

  // guaranteed：全部 miss → 強制從有效槽選一件
  if (guaranteed && !anyDropped) {
    const slots = Object.keys(slotDropChance)
    const slot = slots[Math.floor(rng() * slots.length)] as ArmorSlot
    const item = tryRollArmorItem(slot, ticket, registry, playerJobTags, 0, rng)
    if (item) items.push(item)
  }

  return { gold: ticket.gold, items }
}

// ─── 內部：選基底 + 組 FrozenArmor ───────────────────────────────────────────

function tryRollArmorItem(
  slot: ArmorSlot,
  ticket: StandardTicket,
  registry: LootRegistry,
  playerJobTags: string[] | undefined,
  seq: number,
  rng: () => number
): FrozenArmor | null {
  const { context, rarityTable, affixCountTable } = ticket

  // 1. 選基底
  const candidates = registry.armorBases.filter(b => {
    if (b.slot !== slot) return false
    if (playerJobTags && playerJobTags.length > 0) {
      return isEquippable(b, playerJobTags)
    }
    return true
  })
  if (candidates.length === 0) return null

  const base = candidates[Math.floor(rng() * candidates.length)]!

  // 2. 詞條數量
  const count = weightedPick(affixCountTable, rng)?.count ?? 1

  // 3. 抽詞條
  const affixIds = rollAffixesForBase(
    base.affixPool,
    rarityTable,
    count,
    registry.armorAffixes,
    playerJobTags,
    rng
  )

  // 4. 組裝
  return {
    kind: 'armor',
    instanceId: makeInstanceId(context.ticketSeed, seq, base.id),
    baseId: base.id,
    name: base.name,
    slot,
    itemLevel: context.floorNumber,
    dungeonQuality: context.dungeonQuality,
    affixIds,
  }
}

/** 判斷玩家是否可裝備此基底（requiredTagCount 個 requiredTags 匹配）*/
function isEquippable(base: ArmorBaseDef, playerJobTags: string[]): boolean {
  const needed = base.requiredTagCount ?? base.requiredTags.length
  const matches = base.requiredTags.filter(t => playerJobTags.includes(t)).length
  return matches >= needed
}

// ─── 重新匯出供外部使用 ───────────────────────────────────────────────────────

export type { LootContext, LootArmorAffix, RarityWeight, WishBias } from './loot_utils'
