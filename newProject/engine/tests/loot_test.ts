/**
 * loot_test.ts — 打寶工廠測試（重構後）
 *
 * === 標準路徑 resolveLoot ===
 *  1. gold 從 ticket.gold 直接輸出
 *  2. slotDropChance=1.0 → 必掉該槽
 *  3. slotDropChance=0.0 → 不掉
 *  4. guaranteed=true + 所有 chance=0 → 至少掉一件
 *  5. 選出的 baseId 必須是對應 slot 的基底
 *  6. playerJobTags 過濾：只選玩家可裝備的基底
 *  7. 無可裝備基底時 → items 為空
 *  8. 詞條數量符合 affixCountTable
 *  9. 目標 rarity=common → 不含 rare/elite 詞條
 * 10. 目標 rarity=rare → 可含 common+rare
 * 11. playerJobTags 過濾詞條：重甲玩家不拿到輕甲/布甲 only 詞條
 * 12. playerJobTags 無匹配詞條 → affixIds=[]
 * 13. instanceId 確定性：相同 ticketSeed+seq+baseId → 相同 id
 * 14. 不同 ticketSeed → 不同 instanceId
 * 15. 同一次掉落 2 件 → 兩件 instanceId 不同（seq 遞增）
 * 16. dungeonQuality / itemLevel 正確存入 FrozenArmor
 * 17. 兩槽 chance=1 → 掉兩件，slot 各異
 * 18. affixIds 不重複
 *
 * === Boss 路徑 resolveBossLoot ===
 * 19. guaranteedPool 全數掉落（3 件都掉）
 * 20. baseId 固定（不受隨機影響）
 * 21. affixCountRange min=max=2 → 每件 2 個詞條
 * 22. registry 找不到 baseId → 跳過（items 少一件）
 * 23. boss gold 直接輸出
 * 24. boss instanceId 確定性
 * 25. boss playerJobTags 過濾詞條（與標準路徑共用邏輯）
 */

import { resolveLoot } from '../loot'
import { resolveBossLoot } from '../loot_boss'
import type { StandardTicket, ArmorBaseDef, LootRegistry } from '../loot'
import type { BossLootParams } from '../loot_boss'
import type { LootArmorAffix, RarityWeight } from '../loot_utils'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

function constRng(v: number): () => number { return () => v }

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

const ARMOR_AFFIXES: LootArmorAffix[] = [
  { id: 'ar-str-01',          rarity: 'common', usedTags: ['重甲', '輕甲', '布甲'] },
  { id: 'ar-hp-01',           rarity: 'common', usedTags: ['重甲', '輕甲', '布甲'] },
  { id: 'ar-resist-slash-01', rarity: 'common', usedTags: ['重甲', '輕甲', '布甲'] },
  { id: 'ar-glove-slash-01',  rarity: 'rare',   usedTags: ['重甲'] },
  { id: 'ar-glove-crit-01',   rarity: 'rare',   usedTags: ['輕甲', '布甲'] },  // 非重甲
  { id: 'ar-boot-terrain-01', rarity: 'elite',  usedTags: ['輕甲', '布甲'] },
]

const ARMOR_BASES: ArmorBaseDef[] = [
  {
    id: 'heavy_chest', name: '重甲胸甲', armorType: '重甲', slot: 'chest',
    requiredTags: ['重甲'], requiredTagCount: 1,
    baseStats: { slash_defense_flat: 8 },
    affixCount: { min: 1, max: 2 },
    affixPool: ['ar-str-01', 'ar-hp-01', 'ar-resist-slash-01'],
  },
  {
    id: 'light_chest', name: '輕甲胸甲', armorType: '輕甲', slot: 'chest',
    requiredTags: ['輕甲'], requiredTagCount: 1,
    baseStats: { slash_defense_flat: 4 },
    affixCount: { min: 1, max: 2 },
    affixPool: ['ar-str-01', 'ar-hp-01', 'ar-glove-crit-01'],
  },
  {
    id: 'heavy_gloves', name: '重甲手甲', armorType: '重甲', slot: 'gloves',
    requiredTags: ['重甲'], requiredTagCount: 1,
    baseStats: { slash_defense_flat: 2 },
    affixCount: { min: 1, max: 2 },
    affixPool: ['ar-glove-slash-01', 'ar-str-01'],
  },
  {
    id: 'heavy_boots', name: '重甲鐵靴', armorType: '重甲', slot: 'boots',
    requiredTags: ['重甲'], requiredTagCount: 1,
    baseStats: { slash_defense_flat: 2 },
    affixCount: { min: 1, max: 1 },
    affixPool: ['ar-str-01', 'ar-hp-01'],
  },
]

const REGISTRY: LootRegistry = {
  armorBases: ARMOR_BASES,
  armorAffixes: ARMOR_AFFIXES,
}

const COMMON_RARITY: RarityWeight[] = [{ rarity: 'common', weight: 1 }]
const RARE_RARITY:   RarityWeight[] = [{ rarity: 'rare',   weight: 1 }]

function makeTicket(overrides: Partial<StandardTicket> = {}): StandardTicket {
  return {
    itemTypes: ['armor'],
    slotDropChance: { chest: 1.0 },
    rarityTable: COMMON_RARITY,
    affixCountTable: [{ count: 1, weight: 1 }],
    guaranteed: false,
    gold: 10,
    context: {
      dungeonQuality: 1.0,
      floorNumber: 3,
      theme: 'forest',
      ticketSeed: 'seed:0',
    },
    ...overrides,
  }
}

// ══════════════════════════════════════════════════════════════════
// 標準路徑
// ══════════════════════════════════════════════════════════════════

console.log('\n=== 標準路徑 resolveLoot ===\n')

// ─── Test 1：gold 直接輸出 ────────────────────────────────────────────────────

console.log('【Test 1】gold 從 ticket.gold 輸出')
const t1 = resolveLoot(makeTicket({ gold: 42, slotDropChance: {} }), REGISTRY, { rng: constRng(0.5) })
assert(t1.gold === 42, `gold=42（got: ${t1.gold}）`)

// ─── Test 2：chance=1 → 必掉 ─────────────────────────────────────────────────

console.log('\n【Test 2】slotDropChance=1.0 → 必掉')
const t2 = resolveLoot(makeTicket({ slotDropChance: { chest: 1.0 } }), REGISTRY, {
  playerJobTags: ['重甲'], rng: constRng(0.01),
})
assert(t2.items.length === 1, `掉一件（got: ${t2.items.length}）`)
assert(t2.items[0]?.slot === 'chest', `slot=chest（got: ${t2.items[0]?.slot}）`)

// ─── Test 3：chance=0 → 不掉 ─────────────────────────────────────────────────

console.log('\n【Test 3】slotDropChance=0.0 → 不掉')
const t3 = resolveLoot(makeTicket({ slotDropChance: { chest: 0.0 } }), REGISTRY, { rng: constRng(0.5) })
assert(t3.items.length === 0, `不掉（got: ${t3.items.length}）`)

// ─── Test 4：guaranteed=true + chance=0 → 至少掉一件 ─────────────────────────

console.log('\n【Test 4】guaranteed=true + chance=0 → 至少掉一件')
const t4 = resolveLoot(makeTicket({
  slotDropChance: { chest: 0.0 },
  guaranteed: true,
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.99) })
assert(t4.items.length >= 1, `至少一件（got: ${t4.items.length}）`)

// ─── Test 5：baseId 屬於對應 slot ─────────────────────────────────────────────

console.log('\n【Test 5】選出的 baseId 對應正確 slot')
const t5 = resolveLoot(makeTicket({ slotDropChance: { gloves: 1.0 } }), REGISTRY, {
  playerJobTags: ['重甲'], rng: constRng(0.01),
})
assert(t5.items[0]?.baseId === 'heavy_gloves', `baseId=heavy_gloves（got: ${t5.items[0]?.baseId}）`)
assert(t5.items[0]?.slot === 'gloves', `slot=gloves（got: ${t5.items[0]?.slot}）`)

// ─── Test 6：playerJobTags 過濾基底 ──────────────────────────────────────────

console.log('\n【Test 6】playerJobTags=輕甲 → 選 light_chest，不選 heavy_chest')
const t6 = resolveLoot(makeTicket({ slotDropChance: { chest: 1.0 } }), REGISTRY, {
  playerJobTags: ['輕甲'], rng: constRng(0.01),
})
assert(t6.items[0]?.baseId === 'light_chest', `baseId=light_chest（got: ${t6.items[0]?.baseId}）`)

// ─── Test 7：無可裝備基底 → items 為空 ───────────────────────────────────────

console.log('\n【Test 7】playerJobTags=布甲 → 無匹配基底 → items=[]')
const t7 = resolveLoot(makeTicket({ slotDropChance: { chest: 1.0 } }), REGISTRY, {
  playerJobTags: ['布甲'], rng: constRng(0.01),
})
assert(t7.items.length === 0, `items=[]（got: ${t7.items.length}）`)

// ─── Test 8：affixCountTable count=2 → 2 個詞條 ──────────────────────────────

console.log('\n【Test 8】affixCountTable count=2 → affixIds.length=2')
const t8 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  affixCountTable: [{ count: 2, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t8.items[0]?.affixIds.length === 2, `affixIds.length=2（got: ${t8.items[0]?.affixIds.length}）`)

// ─── Test 9：rarity=common → 不含 rare/elite ──────────────────────────────────

console.log('\n【Test 9】rarityTable=common → 所有詞條 rarity=common')
const t9 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  rarityTable: COMMON_RARITY,
  affixCountTable: [{ count: 3, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
const t9AllCommon = (t9.items[0]?.affixIds ?? []).every(id => {
  const a = ARMOR_AFFIXES.find(x => x.id === id)
  return a?.rarity === 'common'
})
assert(t9AllCommon, `全 common（ids: ${t9.items[0]?.affixIds?.join(',')}）`)

// ─── Test 10：rarity=rare → 可含 common+rare ─────────────────────────────────

console.log('\n【Test 10】rarityTable=rare → 可含 common+rare，不含 elite')
const t10 = resolveLoot(makeTicket({
  slotDropChance: { gloves: 1.0 },
  rarityTable: RARE_RARITY,
  affixCountTable: [{ count: 2, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
const t10Ids = t10.items[0]?.affixIds ?? []
const t10NoElite = t10Ids.every(id => {
  const a = ARMOR_AFFIXES.find(x => x.id === id)
  return a?.rarity !== 'elite'
})
assert(t10NoElite, `不含 elite（ids: ${t10Ids.join(',')}）`)

// ─── Test 11：playerJobTags 過濾詞條 ─────────────────────────────────────────

console.log('\n【Test 11】重甲玩家 → 不拿到輕甲/布甲 only 詞條（ar-glove-crit-01）')
const t11 = resolveLoot(makeTicket({
  slotDropChance: { gloves: 1.0 },
  rarityTable: RARE_RARITY,
  affixCountTable: [{ count: 2, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(!(t11.items[0]?.affixIds ?? []).includes('ar-glove-crit-01'),
  `不含 ar-glove-crit-01（got: ${t11.items[0]?.affixIds}）`)

// ─── Test 12：playerJobTags 無匹配詞條 → affixIds=[] ─────────────────────────

console.log('\n【Test 12】playerJobTags 無詞條匹配 → affixIds=[]')
const t12 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  affixCountTable: [{ count: 2, weight: 1 }],
}), REGISTRY, { playerJobTags: ['不存在tag'], rng: constRng(0.01) })
// 注意：playerJobTags=['不存在tag'] 下基底也無法選（Test 7），所以 items=[]
// 這裡改用不過濾基底但過濾詞條的情境：無 playerJobTags 讓基底通過，用 tag 過濾詞條
const REGISTRY_NO_REQUIRED: LootRegistry = {
  armorBases: [{
    ...ARMOR_BASES[0]!,
    requiredTags: [],   // 無需求 tag，任何玩家都能穿
    affixPool: ['ar-glove-crit-01'],  // 只有輕甲/布甲詞條
  }],
  armorAffixes: ARMOR_AFFIXES,
}
const t12b = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  affixCountTable: [{ count: 1, weight: 1 }],
}), REGISTRY_NO_REQUIRED, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert((t12b.items[0]?.affixIds ?? []).length === 0,
  `affixIds=[]（got: ${t12b.items[0]?.affixIds}）`)

// ─── Test 13：instanceId 確定性 ───────────────────────────────────────────────

console.log('\n【Test 13】相同 ticketSeed → 相同 instanceId')
const t13Ticket = makeTicket({ slotDropChance: { chest: 1.0 } })
const t13a = resolveLoot(t13Ticket, REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
const t13b = resolveLoot(t13Ticket, REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t13a.items[0]?.instanceId === t13b.items[0]?.instanceId,
  `相同（${t13a.items[0]?.instanceId}）`)

// ─── Test 14：不同 ticketSeed → 不同 instanceId ──────────────────────────────

console.log('\n【Test 14】不同 ticketSeed → 不同 instanceId')
const t14a = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  context: { dungeonQuality: 1, floorNumber: 1, theme: 'forest', ticketSeed: 'seed:0' },
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
const t14b = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  context: { dungeonQuality: 1, floorNumber: 1, theme: 'forest', ticketSeed: 'seed:1' },
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t14a.items[0]?.instanceId !== t14b.items[0]?.instanceId,
  `不同（${t14a.items[0]?.instanceId} vs ${t14b.items[0]?.instanceId}）`)

// ─── Test 15：同一次 2 件 → seq 遞增 → instanceId 各異 ───────────────────────

console.log('\n【Test 15】同一次掉 2 件 → instanceId 各異')
const t15 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0, gloves: 1.0 },
  affixCountTable: [{ count: 0, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t15.items.length === 2, `掉兩件（got: ${t15.items.length}）`)
assert(t15.items[0]!.instanceId !== t15.items[1]!.instanceId,
  `instanceId 各異（${t15.items[0]!.instanceId} vs ${t15.items[1]!.instanceId}）`)

// ─── Test 16：dungeonQuality / itemLevel ─────────────────────────────────────

console.log('\n【Test 16】dungeonQuality=1.8, floorNumber=7 → 正確存入')
const t16 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  context: { dungeonQuality: 1.8, floorNumber: 7, theme: 'forest', ticketSeed: 'seed:0' },
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t16.items[0]?.dungeonQuality === 1.8, `dungeonQuality=1.8（got: ${t16.items[0]?.dungeonQuality}）`)
assert(t16.items[0]?.itemLevel === 7, `itemLevel=7（got: ${t16.items[0]?.itemLevel}）`)

// ─── Test 17：兩槽 chance=1 → 掉兩件，slot 各異 ──────────────────────────────

console.log('\n【Test 17】chest=1 + gloves=1 → 掉兩件，slot 各異')
const t17 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0, gloves: 1.0 },
  affixCountTable: [{ count: 1, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
assert(t17.items.length === 2, `兩件（got: ${t17.items.length}）`)
assert(t17.items.map(i => i.slot).includes('chest'), `含 chest`)
assert(t17.items.map(i => i.slot).includes('gloves'), `含 gloves`)

// ─── Test 18：affixIds 不重複 ─────────────────────────────────────────────────

console.log('\n【Test 18】affixIds 無重複')
const t18 = resolveLoot(makeTicket({
  slotDropChance: { chest: 1.0 },
  affixCountTable: [{ count: 3, weight: 1 }],
}), REGISTRY, { playerJobTags: ['重甲'], rng: constRng(0.01) })
const t18Ids = t18.items[0]?.affixIds ?? []
assert(new Set(t18Ids).size === t18Ids.length, `無重複（${t18Ids.join(',')}）`)

// ══════════════════════════════════════════════════════════════════
// Boss 路徑
// ══════════════════════════════════════════════════════════════════

console.log('\n=== Boss 路徑 resolveBossLoot ===\n')

function makeBossParams(overrides: Partial<BossLootParams> = {}): BossLootParams {
  return {
    guaranteedPool: [
      { baseId: 'heavy_chest',  affixCountRange: { min: 2, max: 2 } },
      { baseId: 'heavy_gloves', affixCountRange: { min: 1, max: 2 } },
    ],
    rarityTable: [{ rarity: 'rare', weight: 1 }],
    gold: 200,
    context: { dungeonQuality: 1.5, floorNumber: 10, theme: 'forest', ticketSeed: 'boss:0' },
    registry: REGISTRY,
    playerJobTags: ['重甲'],
    rng: constRng(0.01),
    ...overrides,
  }
}

// ─── Test 19：全部掉落 ────────────────────────────────────────────────────────

console.log('【Test 19】guaranteedPool 2 件 → 全掉')
const t19 = resolveBossLoot(makeBossParams())
assert(t19.items.length === 2, `掉兩件（got: ${t19.items.length}）`)

// ─── Test 20：baseId 固定 ─────────────────────────────────────────────────────

console.log('\n【Test 20】baseId 固定，不受亂數影響')
const t20 = resolveBossLoot(makeBossParams({ rng: constRng(0.99) }))
assert(t20.items[0]?.baseId === 'heavy_chest',  `[0] heavy_chest（got: ${t20.items[0]?.baseId}）`)
assert(t20.items[1]?.baseId === 'heavy_gloves', `[1] heavy_gloves（got: ${t20.items[1]?.baseId}）`)

// ─── Test 21：affixCountRange min=max=2 → 每件 2 個詞條 ──────────────────────

console.log('\n【Test 21】affixCountRange min=max=2 → 2 個詞條')
const t21 = resolveBossLoot(makeBossParams({
  guaranteedPool: [{ baseId: 'heavy_chest', affixCountRange: { min: 2, max: 2 } }],
  rng: constRng(0.01),
}))
assert(t21.items[0]?.affixIds.length === 2, `affixIds.length=2（got: ${t21.items[0]?.affixIds.length}）`)

// ─── Test 22：找不到 baseId → 跳過 ───────────────────────────────────────────

console.log('\n【Test 22】找不到 baseId → 跳過，items 少一件')
const t22 = resolveBossLoot(makeBossParams({
  guaranteedPool: [
    { baseId: 'heavy_chest',   affixCountRange: { min: 1, max: 1 } },
    { baseId: '不存在的baseId', affixCountRange: { min: 1, max: 1 } },
  ],
}))
assert(t22.items.length === 1, `只掉一件（got: ${t22.items.length}）`)

// ─── Test 23：boss gold 直接輸出 ──────────────────────────────────────────────

console.log('\n【Test 23】boss gold=200 直接輸出')
assert(t19.gold === 200, `gold=200（got: ${t19.gold}）`)

// ─── Test 24：boss instanceId 確定性 ─────────────────────────────────────────

console.log('\n【Test 24】相同 params → 相同 instanceId')
const t24a = resolveBossLoot(makeBossParams())
const t24b = resolveBossLoot(makeBossParams())
assert(t24a.items[0]?.instanceId === t24b.items[0]?.instanceId,
  `相同（${t24a.items[0]?.instanceId}）`)

// ─── Test 25：boss playerJobTags 過濾詞條 ────────────────────────────────────

console.log('\n【Test 25】boss playerJobTags=重甲 → 不拿到 ar-glove-crit-01（輕甲/布甲 only）')
// heavy_gloves.affixPool = ['ar-glove-slash-01'(重甲), 'ar-str-01']
// ar-glove-crit-01 不在 heavy_gloves.affixPool 中，所以改用含有它的 pool 來測
const bossRegistry: LootRegistry = {
  armorBases: [{
    id: 'test_gloves', name: '測試手套', armorType: '輕甲', slot: 'gloves',
    requiredTags: [], requiredTagCount: 0,  // 無需求，任何玩家可穿
    baseStats: {},
    affixCount: { min: 1, max: 1 },
    affixPool: ['ar-glove-slash-01', 'ar-glove-crit-01', 'ar-str-01'],
  }],
  armorAffixes: ARMOR_AFFIXES,
}
const t25 = resolveBossLoot({
  guaranteedPool: [{ baseId: 'test_gloves', affixCountRange: { min: 3, max: 3 } }],
  rarityTable: [{ rarity: 'rare', weight: 1 }],
  gold: 0,
  context: { dungeonQuality: 1.0, floorNumber: 10, theme: 'forest', ticketSeed: 'boss:0' },
  registry: bossRegistry,
  playerJobTags: ['重甲'],
  rng: constRng(0.01),
})
assert(!(t25.items[0]?.affixIds ?? []).includes('ar-glove-crit-01'),
  `不含 ar-glove-crit-01（got: ${t25.items[0]?.affixIds}）`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
