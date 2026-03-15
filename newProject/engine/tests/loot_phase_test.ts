/**
 * loot_phase_test.ts — 層間打寶階段測試
 *
 *  1. generateLootPhase：options 數量 = items 數量
 *  2. generateLootPhase：picksRemaining = playerCount + bonusPicks
 *  3. generateLootPhase：所有 isOpened=false, takenByPlayerId=null
 *  4. generateLootPhase：awarded 初始各 playerId 為空陣列
 *  5. generateLootPhase：captainId 在 captain 模式下設定
 *  6. generateLootPhase：round_robin 模式 currentPickerId = 第一位玩家
 *  7. computeHint：armor → itemType=armor, slot, rarity, usableTags
 *  8. computeHint：rarity 為最高詞條稀有度（rare > common）
 *  9. computeHint：無詞條 → rarity=common
 * 10. applyOpenOption：free_for_all → isOpened, takenBy, awarded, picksRemaining-1
 * 11. applyOpenOption：picks=0 時無效（不改變狀態）
 * 12. applyOpenOption：已 opened 選項無效（不重複開）
 * 13. applyOpenOption：round_robin → currentPickerId 輪到下一位
 * 14. applyOpenOption：need_greed → 進入 voting 狀態，建立 currentVote
 * 15. applyOpenOption：picks 用完 → phase='done'
 * 16. resolveVote：有 Need → Need 池中的玩家獲勝
 * 17. resolveVote：無 Need 有 Greed → Greed 池中的玩家獲勝
 * 18. resolveVote：全 Pass → winnerId=null，awarded 不變
 * 19. resolveVote：獲勝者物品進入 awarded[winnerId]
 * 20. resolveVote：解析後 isResolved=true
 * 21. createRun：新欄位正確預設（playerCount=1, free_for_all, lootPhase=null）
 * 22. createRun：多人設定正確傳入（playerCount=3, need_greed, captainPlayerId）
 */

import { generateLootPhase, computeHint, applyOpenOption, resolveVote } from '../loot_phase'
import { createRun } from '../game'
import type { LootPhaseState } from '../state'
import type { FrozenArmor } from '../item'
import type { LootRegistry } from '../loot'
import type { LootArmorAffix } from '../loot_utils'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

const AFFIXES: LootArmorAffix[] = [
  { id: 'ar-str-01', rarity: 'common', usedTags: ['重甲', '輕甲'] },
  { id: 'ar-hp-01',  rarity: 'common', usedTags: ['重甲', '輕甲'] },
  { id: 'ar-rare-01',rarity: 'rare',   usedTags: ['重甲'] },
]

const REGISTRY: LootRegistry = {
  armorBases: [
    {
      id: 'heavy_chest', name: '重甲胸甲', armorType: '重甲', slot: 'chest',
      requiredTags: ['重甲'], baseStats: {}, affixCount: { min: 1, max: 2 },
      affixPool: ['ar-str-01', 'ar-hp-01', 'ar-rare-01'],
    },
    {
      id: 'heavy_gloves', name: '重甲手甲', armorType: '重甲', slot: 'gloves',
      requiredTags: ['重甲'], baseStats: {}, affixCount: { min: 1, max: 1 },
      affixPool: ['ar-str-01'],
    },
  ],
  armorAffixes: AFFIXES,
}

function makeArmor(id: string, baseId: string, slot: string, affixIds: string[]): FrozenArmor {
  return {
    kind: 'armor',
    instanceId: id,
    baseId,
    name: baseId,
    slot: slot as any,
    itemLevel: 3,
    dungeonQuality: 1.0,
    affixIds,
  }
}

const ITEM_A = makeArmor('item-a', 'heavy_chest',  'chest',  ['ar-str-01', 'ar-rare-01'])
const ITEM_B = makeArmor('item-b', 'heavy_gloves', 'gloves', ['ar-str-01'])
const ITEM_C = makeArmor('item-c', 'heavy_chest',  'chest',  ['ar-hp-01'])

const PLAYER_IDS = ['p1', 'p2']

function makePhase(overrides: Partial<Parameters<typeof generateLootPhase>[0]> = {}) {
  return generateLootPhase({
    items: [ITEM_A, ITEM_B, ITEM_C],
    playerCount: 2,
    playerIds: PLAYER_IDS,
    bonusGold: 50,
    distributionMode: 'free_for_all',
    registry: REGISTRY,
    ...overrides,
  })
}

// ══════════════════════════════════════════════════════════════════
// generateLootPhase
// ══════════════════════════════════════════════════════════════════

console.log('\n=== generateLootPhase ===\n')

console.log('【Test 1】options 數量 = items 數量')
const t1 = makePhase()
assert(t1.options.length === 3, `options.length=3（got: ${t1.options.length}）`)

console.log('\n【Test 2】picksRemaining = playerCount + bonusPicks')
const t2 = makePhase({ bonusPicks: 1 })
assert(t2.picksRemaining === 3, `picksRemaining=3（got: ${t2.picksRemaining}）`)

console.log('\n【Test 3】所有 isOpened=false, takenByPlayerId=null')
const t3 = makePhase()
assert(t3.options.every(o => !o.isOpened && o.takenByPlayerId === null),
  `全未開箱`)

console.log('\n【Test 4】awarded 初始各 playerId 為空陣列')
const t4 = makePhase()
assert(Array.isArray(t4.awarded['p1']) && t4.awarded['p1']!.length === 0, `p1=[]`)
assert(Array.isArray(t4.awarded['p2']) && t4.awarded['p2']!.length === 0, `p2=[]`)

console.log('\n【Test 5】captain 模式下 captainId 設定')
const t5 = makePhase({ distributionMode: 'captain', captainId: 'p1' })
assert(t5.captainId === 'p1', `captainId=p1（got: ${t5.captainId}）`)

console.log('\n【Test 6】round_robin currentPickerId = 第一位玩家')
const t6 = makePhase({ distributionMode: 'round_robin' })
assert(t6.currentPickerId === 'p1', `currentPickerId=p1（got: ${t6.currentPickerId}）`)

// ══════════════════════════════════════════════════════════════════
// computeHint
// ══════════════════════════════════════════════════════════════════

console.log('\n=== computeHint ===\n')

console.log('【Test 7】armor → itemType=armor, slot, rarity, usableTags')
const h7 = computeHint(ITEM_A, REGISTRY)
assert(h7.itemType === 'armor', `itemType=armor`)
assert(h7.slot === 'chest', `slot=chest`)
assert(Array.isArray(h7.usableTags), `usableTags 為陣列`)
assert(h7.usableTags.includes('重甲'), `usableTags 含重甲`)

console.log('\n【Test 8】rarity = 最高詞條稀有度（ar-rare-01 是 rare）')
const h8 = computeHint(ITEM_A, REGISTRY)  // has ar-str-01(common) + ar-rare-01(rare)
assert(h8.rarity === 'rare', `rarity=rare（got: ${h8.rarity}）`)

console.log('\n【Test 9】無詞條 → rarity=common')
const itemNoAffix = makeArmor('no-affix', 'heavy_chest', 'chest', [])
const h9 = computeHint(itemNoAffix, REGISTRY)
assert(h9.rarity === 'common', `rarity=common（got: ${h9.rarity}）`)

// ══════════════════════════════════════════════════════════════════
// applyOpenOption
// ══════════════════════════════════════════════════════════════════

console.log('\n=== applyOpenOption ===\n')

console.log('【Test 10】free_for_all → isOpened, takenBy, awarded, picks-1')
const s10 = applyOpenOption(makePhase(), 'item-a', 'p1', 'free_for_all', PLAYER_IDS)
assert(s10.options.find(o => o.instanceId === 'item-a')?.isOpened === true, `item-a opened`)
assert(s10.options.find(o => o.instanceId === 'item-a')?.takenByPlayerId === 'p1', `takenBy=p1`)
assert(s10.awarded['p1']?.length === 1, `p1 awarded 1件`)
assert(s10.picksRemaining === 1, `picks=1（got: ${s10.picksRemaining}）`)

console.log('\n【Test 11】picks=0 → 無效')
const zeroPickState: LootPhaseState = { ...makePhase(), picksRemaining: 0 }
const s11 = applyOpenOption(zeroPickState, 'item-a', 'p1', 'free_for_all', PLAYER_IDS)
assert(s11.picksRemaining === 0 && !s11.options.find(o => o.instanceId === 'item-a')?.isOpened,
  `picks=0 時不變`)

console.log('\n【Test 12】已 opened 選項 → 無效（不重複開）')
const s12base = applyOpenOption(makePhase(), 'item-a', 'p1', 'free_for_all', PLAYER_IDS)
const s12 = applyOpenOption(s12base, 'item-a', 'p2', 'free_for_all', PLAYER_IDS)
assert(s12.awarded['p2']?.length === 0, `p2 拿不到已開的 item-a`)

console.log('\n【Test 13】round_robin → currentPickerId 輪到下一位')
const s13 = applyOpenOption(
  makePhase({ distributionMode: 'round_robin' }),
  'item-a', 'p1', 'round_robin', PLAYER_IDS
)
assert(s13.currentPickerId === 'p2', `currentPickerId=p2（got: ${s13.currentPickerId}）`)

console.log('\n【Test 14】need_greed → phase=voting, currentVote 建立')
const s14 = applyOpenOption(makePhase(), 'item-a', 'p1', 'need_greed', PLAYER_IDS)
assert(s14.phase === 'voting', `phase=voting（got: ${s14.phase}）`)
assert(s14.currentVote?.instanceId === 'item-a', `currentVote.instanceId=item-a`)
assert(s14.currentVote?.isResolved === false, `isResolved=false`)

console.log('\n【Test 15】picks 用完 → phase=done')
const s15base = applyOpenOption(makePhase({ playerCount: 1 }), 'item-a', 'p1', 'free_for_all', ['p1'])
assert(s15base.phase === 'done', `phase=done（picksRemaining=${s15base.picksRemaining}）`)

// ══════════════════════════════════════════════════════════════════
// resolveVote
// ══════════════════════════════════════════════════════════════════

console.log('\n=== resolveVote ===\n')

function makeVotingState(votes: Record<string, 'need' | 'greed' | 'pass'>): LootPhaseState {
  const base = applyOpenOption(makePhase(), 'item-a', 'p1', 'need_greed', PLAYER_IDS)
  return {
    ...base,
    currentVote: {
      instanceId: 'item-a',
      votes,
      winnerId: null,
      isResolved: false,
    },
  }
}

console.log('【Test 16】有 Need → Need 池獲勝')
const s16 = resolveVote(makeVotingState({ p1: 'need', p2: 'greed' }), () => 0)
assert(s16.currentVote?.winnerId === 'p1', `winner=p1（got: ${s16.currentVote?.winnerId}）`)

console.log('\n【Test 17】無 Need 有 Greed → Greed 池獲勝')
const s17 = resolveVote(makeVotingState({ p1: 'pass', p2: 'greed' }), () => 0)
assert(s17.currentVote?.winnerId === 'p2', `winner=p2（got: ${s17.currentVote?.winnerId}）`)

console.log('\n【Test 18】全 Pass → winnerId=null，awarded 不變')
const s18 = resolveVote(makeVotingState({ p1: 'pass', p2: 'pass' }))
assert(s18.currentVote?.winnerId === null, `winnerId=null`)
assert(s18.awarded['p1']?.length === 0, `p1 awarded 不變`)
assert(s18.awarded['p2']?.length === 0, `p2 awarded 不變`)

console.log('\n【Test 19】獲勝者物品進入 awarded[winnerId]')
const s19 = resolveVote(makeVotingState({ p1: 'need', p2: 'pass' }), () => 0)
assert(s19.awarded['p1']?.length === 1, `p1 awarded 1件`)
assert(s19.awarded['p1']?.[0]?.instanceId === 'item-a', `item-a 進入 p1 awarded`)

console.log('\n【Test 20】解析後 isResolved=true')
const s20 = resolveVote(makeVotingState({ p1: 'greed', p2: 'pass' }))
assert(s20.currentVote?.isResolved === true, `isResolved=true`)

// ══════════════════════════════════════════════════════════════════
// createRun 新欄位
// ══════════════════════════════════════════════════════════════════

console.log('\n=== createRun 新欄位 ===\n')

console.log('【Test 21】預設值：playerCount=1, free_for_all, lootPhase=null')
const run21 = createRun()
assert(run21.playerCount === 1, `playerCount=1（got: ${run21.playerCount}）`)
assert(run21.lootDistributionMode === 'free_for_all', `mode=free_for_all`)
assert(run21.lootPhase === null, `lootPhase=null`)
assert(run21.captainPlayerId === null, `captainPlayerId=null`)

console.log('\n【Test 22】多人設定：playerCount=3, need_greed, captainPlayerId')
const run22 = createRun({ playerCount: 3, lootDistributionMode: 'need_greed', captainPlayerId: 'host' })
assert(run22.playerCount === 3, `playerCount=3（got: ${run22.playerCount}）`)
assert(run22.lootDistributionMode === 'need_greed', `mode=need_greed`)
assert(run22.captainPlayerId === 'host', `captainPlayerId=host`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
