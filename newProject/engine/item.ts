/**
 * item.ts — 物品型別定義
 *
 * FrozenItem：掉落時所有屬性已確定（instanceId + affixIds 永不改變）。
 * 實際效果在裝備時由 armorAffixes 註冊表計算。
 */

// ─── 裝備槽 ────────────────────────────────────────────────────────────────────

export type ArmorSlot = 'head' | 'chest' | 'gloves' | 'legs' | 'boots'

// ─── 凍結防具 ─────────────────────────────────────────────────────────────────

/**
 * 防具掉落後的凍結快照。
 * - `baseId`：對應 MonsterDef.equipment[slot].id 或玩家甲冑 base id
 * - `affixIds`：從 armor_affixes.json 隨機抽取的詞條 id 清單（順序即優先序）
 * - `dungeonQuality`：掉落當時的地城品質，供後續效果計算使用
 */
export type FrozenArmor = {
  kind: 'armor'
  instanceId: string      // hash(runSeed + dropSeq + baseId) — 唯一識別
  baseId: string          // 裝備基底 id
  name: string            // 顯示名稱
  slot: ArmorSlot
  itemLevel: number       // 掉落樓層（=floorNumber）
  dungeonQuality: number  // 掉落當下品質（baked-in）
  affixIds: string[]      // 詞條 id 清單（來自 armor_affixes.json）
}

// ─── 凍結武器（預留，MVP 怪物武器不掉落給玩家）────────────────────────────────

export type FrozenWeapon = {
  kind: 'weapon'
  instanceId: string
  baseId: string
  name: string
  itemLevel: number
  dungeonQuality: number
  affixIds: string[]
}

// ─── 聯合型別 ─────────────────────────────────────────────────────────────────

export type FrozenItem = FrozenArmor | FrozenWeapon

// ─── 打寶結果 ─────────────────────────────────────────────────────────────────

export type LootResult = {
  gold: number
  items: FrozenItem[]
}
