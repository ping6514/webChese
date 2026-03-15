/**
 * loot_boss.ts — Boss 打寶路徑
 *
 * Boss 特定掉落池（類似 WoW 副本王掉落）：
 *   - baseId 由設計師指定（固定，不從主題庫隨機選）
 *   - 詞條滾動與標準路徑共用相同邏輯（rollAffixesForBase）
 *   - dungeonQuality 等地城環境參數共用 LootContext
 *   - WishBias 不影響 baseId（boss 必掉就必掉）
 *   - 可選：允許 WishBias 微調詞條稀有度偏向
 *
 * 輸出格式與 loot.ts 完全相同（FrozenItem）。
 */

import type { FrozenArmor, FrozenWeapon, FrozenItem, LootResult, ArmorSlot } from './item'
import type { LootContext, LootArmorAffix, RarityWeight } from './loot_utils'
import { rollAffixesForBase, makeInstanceId, weightedPick } from './loot_utils'
import type { ArmorBaseDef, LootRegistry } from './loot'

// ─── Boss 掉落池項目 ──────────────────────────────────────────────────────────

/**
 * 設計師手工配置的 Boss 必定掉落項目。
 * 放在 boss spawner 的 dropTable.guaranteedPool 中。
 *
 * 範例：
 * ```json
 * {
 *   "baseId": "guardian_greatshield",
 *   "affixCountRange": { "min": 2, "max": 3 }
 * }
 * ```
 */
export type BossPoolEntry = {
  /** 指定的裝備基底 id（必須存在於 registry 中）*/
  baseId: string
  /** 本件的詞條數量範圍（含兩端）*/
  affixCountRange: { min: number; max: number }
}

// ─── 參數 ─────────────────────────────────────────────────────────────────────

export type BossLootParams = {
  /** 設計師配置的必定掉落清單（全數掉落，不滾點）*/
  guaranteedPool: BossPoolEntry[]
  /**
   * Boss 詞條稀有度分布。
   * WishBias 若存在，可調整此表的 weight，但不影響 baseId 選擇。
   */
  rarityTable: RarityWeight[]
  /** Boss 金幣掉落（預先計算，可 0）*/
  gold: number
  /** 地城環境（dungeonQuality / floorNumber 等）*/
  context: LootContext
  /** 道具庫（需包含 guaranteedPool 所有 baseId 對應的基底）*/
  registry: LootRegistry
  /** 玩家職業標籤（影響詞條過濾，不影響 baseId）*/
  playerJobTags?: string[]
  /** 可注入的隨機函數 */
  rng?: () => number
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * Boss 打寶工廠。
 *
 * 流程（每個 BossPoolEntry）：
 *   1. 查 registry 找 baseId 對應的 ArmorBaseDef
 *   2. 依 affixCountRange 決定詞條數量
 *   3. rollAffixesForBase（共用工具，+ playerJobTags 過濾）
 *   4. 組裝 FrozenArmor
 *
 * 注意：
 *   - Boss 所有池中項目必定全掉（不滾機率）
 *   - baseId 固定，WishBias 不介入基底選擇
 *   - 若 baseId 在 registry 中找不到 → 跳過並 console.warn
 */
export function resolveBossLoot(params: BossLootParams): LootResult {
  const {
    guaranteedPool,
    rarityTable,
    gold,
    context,
    registry,
    playerJobTags,
    rng = Math.random,
  } = params

  const items: FrozenItem[] = []

  for (let seq = 0; seq < guaranteedPool.length; seq++) {
    const entry = guaranteedPool[seq]!
    const base = registry.armorBases.find(b => b.id === entry.baseId)

    if (!base) {
      console.warn(`[resolveBossLoot] registry 中找不到 baseId='${entry.baseId}'，跳過`)
      continue
    }

    // 詞條數量：在 affixCountRange 內均勻滾點
    const count = rollIntRange(entry.affixCountRange.min, entry.affixCountRange.max, rng)

    // 詞條抽取（共用 loot_utils）
    const affixIds = rollAffixesForBase(
      base.affixPool,
      rarityTable,
      count,
      registry.armorAffixes,
      playerJobTags,
      rng
    )

    items.push({
      kind: 'armor',
      instanceId: makeInstanceId(context.ticketSeed, seq, base.id),
      baseId: base.id,
      name: base.name,
      slot: base.slot,
      itemLevel: context.floorNumber,
      dungeonQuality: context.dungeonQuality,
      affixIds,
    } satisfies FrozenArmor)
  }

  return { gold, items }
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function rollIntRange(min: number, max: number, rng: () => number): number {
  if (min === max) return min
  return Math.floor(rng() * (max - min + 1)) + min
}
