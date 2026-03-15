/**
 * loot_flow_test.ts — 層間打寶完整流程整合測試
 *
 *  1. armor.ts：resolveArmorStats 基本屬性加成（str/agi/hp）
 *  2. armor.ts：resolveArmorStats 抗性 + 防禦 flat（dungeonQuality bake）
 *  3. armor.ts：resolveArmorStats passiveKeys（crit_chance_add, stealth_in_forest）
 *  4. armor.ts：resolveArmorStats 空 affixIds → 全零 delta
 *  5. reduce START_LOOT_PHASE → lootPhase 建立，LOOT_PHASE_STARTED 事件
 *  6. reduce START_LOOT_PHASE 無 lootRegistry → 忽略（不 crash）
 *  7. reduce OPEN_OPTION free_for_all → item 分配給 p1，picks-1
 *  8. reduce OPEN_OPTION picks=0 → 無效
 *  9. reduce OPEN_OPTION need_greed → phase=voting，OPTION_OPENED.pendingVote=true
 * 10. reduce SUBMIT_VOTE 單人 → 自動解析，VOTE_RESOLVED 事件
 * 11. reduce SUBMIT_VOTE 兩人，全投完 → 自動解析
 * 12. reduce SUBMIT_VOTE 只有一人投 → 不解析（等待第二人）
 * 13. reduce SELECT_PATH lootPhase=null → PATH_SELECTED，advanceRun
 * 14. reduce SELECT_PATH lootPhase.phase=done → PATH_SELECTED
 * 15. reduce SELECT_PATH lootPhase.phase=selecting → 被阻擋
 */

import { resolveArmorStats, emptyDelta } from '../armor'
import { reduce } from '../reduce'
import { createGameState, createRun } from '../game'
import { createPlayerUnit } from '../player'
import type { GameState } from '../state'
import type { FrozenArmor } from '../item'
import type { ArmorAffixDef } from '../armor'
import type { LootRegistry } from '../loot'
import { WARRIOR_CERT, IRON_SWORD_RESOLVED } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

// ─── 測試資料 ─────────────────────────────────────────────────────────────────

const AFFIXES: ArmorAffixDef[] = [
  { id: 'ar-str-01',   name: '力量的',   rarity: 'common', slot: 'any',   usedTags: ['重甲'], abilities: [{ key: 'str_plus', value: 8 }] },
  { id: 'ar-agi-01',   name: '敏捷的',   rarity: 'common', slot: 'any',   usedTags: ['輕甲'], abilities: [{ key: 'agi_plus', value: 8 }] },
  { id: 'ar-hp-01',    name: '耐久的',   rarity: 'common', slot: 'chest', usedTags: ['重甲'], abilities: [{ key: 'hp_plus',  value: 40 }] },
  { id: 'ar-resist-slash', name: '抗劈', rarity: 'common', slot: 'head',  usedTags: ['重甲'], abilities: [{ key: 'slash_resist_plus', value: 0.10 }] },
  { id: 'ar-def-fire', name: '防火',     rarity: 'rare',   slot: 'chest', usedTags: ['重甲'], abilities: [{ key: 'fire_defense_flat', valueExpr: 'dungeonQuality*3' }] },
  { id: 'ar-crit',     name: '暴擊',     rarity: 'rare',   slot: 'any',   usedTags: ['輕甲'], abilities: [{ key: 'crit_chance_add', value: 0.06 }] },
  { id: 'ar-stealth',  name: '隱匿',     rarity: 'elite',  slot: 'body',  usedTags: ['輕甲'], abilities: [{ key: 'stealth_in_forest', value: 1 }] },
]

const REGISTRY: LootRegistry = {
  armorBases: [
    {
      id: 'heavy_chest', name: '重甲胸甲', armorType: '重甲', slot: 'chest',
      requiredTags: ['重甲'], baseStats: {}, affixCount: { min: 1, max: 3 },
      affixPool: ['ar-str-01', 'ar-hp-01', 'ar-def-fire', 'ar-resist-slash'],
    },
  ],
  armorAffixes: AFFIXES as any,
}

function makeArmor(id: string, affixIds: string[]): FrozenArmor {
  return {
    kind: 'armor', instanceId: id, baseId: 'heavy_chest',
    name: '重甲胸甲', slot: 'chest', itemLevel: 3,
    dungeonQuality: 1.5, affixIds,
  }
}

// ─── 基本 GameState（用於 reduce 測試）───────────────────────────────────────

const WARRIOR_DEF = {
  id: 'warrior', name: '戰士', tier: 'basic' as const,
  tags: ['近戰', '重甲'], allowedArmorTypes: ['重甲'],
  stats: {
    str: { base: 20, randomBonus: { min: 0, max: 0 } },
    int: { base: 5,  randomBonus: { min: 0, max: 0 } },
    agi: { base: 10, randomBonus: { min: 0, max: 0 } },
    lck: { base: 8,  randomBonus: { min: 0, max: 0 } },
  },
  resources: {
    hp: { base: 80, strMult: 2 },
    sp: { base: 40, agiMult: 1 },
    mp: { base: 10, intMult: 0.5 },
  },
  moveRange: 3,
  spRecoveryFlat: 20,
}

function makeBaseState(playerIds: string[] = ['p1'], playerCount = 1): GameState {
  const units: Record<string, import('../state').Unit> = {}
  for (const id of playerIds) {
    units[id] = {
      ...createPlayerUnit({ id, jobCertDef: WARRIOR_DEF, jobCertInstance: WARRIOR_CERT, pos: { x: 1, y: 1 } }),
      weapons: [IRON_SWORD_RESOLVED, null, null],
      weaponCooldownUntil: [0, 0, 0],
    }
  }
  return {
    floor: {
      width: 5, height: 5,
      cells: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({
        type: 'floor' as const, height: 1 as const,
        passable: true, blockLineOfSight: false, terrain: 'normal' as const,
      }))),
      seed: 'test', floorNumber: 3, pathType: 'safe', theme: 'forest',
      objective: { type: 'clear_all' }, hazards: {}, projectiles: [], loot: [],
    },
    units,
    timeline: {
      tick: 0, pendingUnitId: null,
      entries: Object.values(units).map(u => ({ unitId: u.id, atb: 0, castRemaining: 0, recoveryRemaining: 0 })),
    },
    turnFlags: { actingUnitId: null },
    run: createRun({ floorNumber: 3, playerCount, lootDistributionMode: 'free_for_all' }),
  }
}

const ITEMS = [
  makeArmor('item-a', ['ar-str-01', 'ar-hp-01']),
  makeArmor('item-b', ['ar-agi-01']),
  makeArmor('item-c', ['ar-def-fire']),
]

const DEPS_WITH_REGISTRY = { allAffixDefs: {}, lootRegistry: REGISTRY }
const DEPS_NO_REGISTRY   = { allAffixDefs: {} }

// ══════════════════════════════════════════════════════════════════
// armor.ts — resolveArmorStats
// ══════════════════════════════════════════════════════════════════

console.log('\n=== resolveArmorStats ===\n')

console.log('【Test 1】基本屬性：str+8, hp+40')
const d1 = resolveArmorStats(['ar-str-01', 'ar-hp-01'], AFFIXES, 1.0)
assert(d1.str === 8,    `str=8（got: ${d1.str}）`)
assert(d1.maxHP === 40, `maxHP=40（got: ${d1.maxHP}）`)
assert(d1.agi === 0,    `agi=0（got: ${d1.agi}）`)

console.log('\n【Test 2】抗性 + 防禦 flat（dungeonQuality=2）')
const d2 = resolveArmorStats(['ar-resist-slash', 'ar-def-fire'], AFFIXES, 2.0)
assert(Math.abs((d2.resistances['slash'] ?? 0) - 0.10) < 0.001,   `slash_resist=0.10`)
assert(Math.abs((d2.defenses['fire'] ?? 0) - 6.0) < 0.001,        `fire_defense=6.0（2.0*3）`)

console.log('\n【Test 3】passiveKeys：crit_chance_add, stealth_in_forest')
const d3 = resolveArmorStats(['ar-crit', 'ar-stealth'], AFFIXES, 1.0)
assert(d3.passiveKeys.some(k => k.startsWith('crit_chance_add')), `crit_chance_add 在 passiveKeys`)
assert(d3.passiveKeys.includes('stealth_in_forest'),               `stealth_in_forest 在 passiveKeys`)

console.log('\n【Test 4】空 affixIds → 全零 delta')
const d4 = resolveArmorStats([], AFFIXES, 1.0)
const e4  = emptyDelta()
assert(d4.str === e4.str && d4.maxHP === e4.maxHP && d4.passiveKeys.length === 0, `全零 delta`)

// ══════════════════════════════════════════════════════════════════
// reduce — START_LOOT_PHASE
// ══════════════════════════════════════════════════════════════════

console.log('\n=== START_LOOT_PHASE ===\n')

console.log('【Test 5】lootPhase 建立，LOOT_PHASE_STARTED 事件')
const r5 = reduce(
  makeBaseState(['p1']),
  { type: 'START_LOOT_PHASE', items: ITEMS, bonusGold: 30, playerIds: ['p1'] },
  DEPS_WITH_REGISTRY
)
assert(r5.state.run.lootPhase !== null,                            `lootPhase 已建立`)
assert(r5.state.run.lootPhase!.options.length === 3,               `options=3`)
assert(r5.events.some(e => e.type === 'LOOT_PHASE_STARTED'),       `LOOT_PHASE_STARTED 事件`)
assert(r5.state.run.lootPhase!.bonusGold === 30,                   `bonusGold=30`)

console.log('\n【Test 6】無 lootRegistry → 忽略（不 crash）')
const r6 = reduce(
  makeBaseState(['p1']),
  { type: 'START_LOOT_PHASE', items: ITEMS, bonusGold: 0, playerIds: ['p1'] },
  DEPS_NO_REGISTRY
)
assert(r6.state.run.lootPhase === null, `lootPhase 仍 null（無 registry）`)
assert(r6.events.length === 0,          `無事件`)

// ══════════════════════════════════════════════════════════════════
// reduce — OPEN_OPTION
// ══════════════════════════════════════════════════════════════════

console.log('\n=== OPEN_OPTION ===\n')

function stateWithLoot(playerIds = ['p1'], distributionMode: 'free_for_all' | 'need_greed' = 'free_for_all') {
  const base = makeBaseState(playerIds, playerIds.length)
  const started = reduce(
    { ...base, run: { ...base.run, lootDistributionMode: distributionMode } },
    { type: 'START_LOOT_PHASE', items: ITEMS, bonusGold: 0, playerIds },
    DEPS_WITH_REGISTRY
  )
  return started.state
}

console.log('【Test 7】free_for_all → item 分配給 p1，picks-1')
const r7 = reduce(stateWithLoot(['p1']), { type: 'OPEN_OPTION', instanceId: 'item-a', playerId: 'p1' }, DEPS_NO_REGISTRY)
assert(r7.state.run.lootPhase!.awarded['p1']?.length === 1,              `p1 awarded 1件`)
assert(r7.state.run.lootPhase!.picksRemaining === 0,                     `picks=0`)
assert(r7.events.some(e => e.type === 'OPTION_OPENED'),                  `OPTION_OPENED 事件`)

console.log('\n【Test 8】picks=0 → 無效')
const zeroPickState = { ...stateWithLoot(['p1']), run: { ...stateWithLoot(['p1']).run, lootPhase: { ...stateWithLoot(['p1']).run.lootPhase!, picksRemaining: 0 } } }
const r8 = reduce(zeroPickState, { type: 'OPEN_OPTION', instanceId: 'item-a', playerId: 'p1' }, DEPS_NO_REGISTRY)
assert(r8.state.run.lootPhase!.picksRemaining === 0, `picks 仍 0`)
assert(!r8.state.run.lootPhase!.options.find(o => o.instanceId === 'item-a')?.isOpened, `item-a 未開`)

console.log('\n【Test 9】need_greed → phase=voting，pendingVote=true')
const r9 = reduce(stateWithLoot(['p1'], 'need_greed'), { type: 'OPEN_OPTION', instanceId: 'item-a', playerId: 'p1' }, DEPS_NO_REGISTRY)
assert(r9.state.run.lootPhase!.phase === 'voting',                       `phase=voting`)
assert(r9.state.run.lootPhase!.currentVote?.instanceId === 'item-a',     `currentVote.instanceId=item-a`)
assert((r9.events.find(e => e.type === 'OPTION_OPENED') as any)?.pendingVote === true, `pendingVote=true`)

// ══════════════════════════════════════════════════════════════════
// reduce — SUBMIT_VOTE
// ══════════════════════════════════════════════════════════════════

console.log('\n=== SUBMIT_VOTE ===\n')

console.log('【Test 10】單人投票 → 立即自動解析，VOTE_RESOLVED')
const votingState1 = r9.state  // p1 need_greed，已開箱 item-a
const r10 = reduce(votingState1, { type: 'SUBMIT_VOTE', instanceId: 'item-a', playerId: 'p1', vote: 'need' }, DEPS_NO_REGISTRY)
assert(r10.events.some(e => e.type === 'VOTE_RESOLVED'),                 `VOTE_RESOLVED 事件`)
assert(r10.state.run.lootPhase!.currentVote?.isResolved === true,        `isResolved=true`)
assert(r10.state.run.lootPhase!.currentVote?.winnerId === 'p1',          `winner=p1`)

console.log('\n【Test 11】兩人投票，全部投完 → 自動解析')
const twoPlayerVotingState = (() => {
  const s = stateWithLoot(['p1', 'p2'], 'need_greed')
  // 更新 run.playerCount
  const s2 = { ...s, run: { ...s.run, playerCount: 2 } }
  return reduce(s2, { type: 'OPEN_OPTION', instanceId: 'item-a', playerId: 'p1' }, DEPS_NO_REGISTRY).state
})()
const r11a = reduce(twoPlayerVotingState, { type: 'SUBMIT_VOTE', instanceId: 'item-a', playerId: 'p1', vote: 'greed' }, DEPS_NO_REGISTRY)
assert(!r11a.events.some(e => e.type === 'VOTE_RESOLVED'), `p1 投完後尚未解析（p2 未投）`)
const r11b = reduce(r11a.state, { type: 'SUBMIT_VOTE', instanceId: 'item-a', playerId: 'p2', vote: 'need' }, DEPS_NO_REGISTRY)
assert(r11b.events.some(e => e.type === 'VOTE_RESOLVED'),  `p1+p2 都投完 → VOTE_RESOLVED`)
assert(r11b.state.run.lootPhase!.currentVote?.winnerId === 'p2', `need 勝出 winner=p2`)

console.log('\n【Test 12】只有一人投（兩人房）→ 不解析')
const r12 = reduce(twoPlayerVotingState, { type: 'SUBMIT_VOTE', instanceId: 'item-a', playerId: 'p1', vote: 'need' }, DEPS_NO_REGISTRY)
assert(!r12.events.some(e => e.type === 'VOTE_RESOLVED'),         `尚未解析`)
assert(r12.state.run.lootPhase!.currentVote?.isResolved === false, `isResolved=false`)

// ══════════════════════════════════════════════════════════════════
// reduce — SELECT_PATH
// ══════════════════════════════════════════════════════════════════

console.log('\n=== SELECT_PATH ===\n')

console.log('【Test 13】lootPhase=null → PATH_SELECTED，floorNumber+1')
const s13 = makeBaseState(['p1'])  // lootPhase=null
const r13 = reduce(s13, { type: 'SELECT_PATH', pathType: 'trial' }, DEPS_NO_REGISTRY)
assert(r13.events.some(e => e.type === 'PATH_SELECTED'),      `PATH_SELECTED 事件`)
const pe13 = r13.events.find(e => e.type === 'PATH_SELECTED') as any
assert(pe13?.pathType === 'trial',                             `pathType=trial`)
assert(pe13?.nextFloor === 4,                                  `nextFloor=4（3+1）`)
assert(r13.state.run.floorNumber === 4,                        `run.floorNumber=4`)
assert(r13.state.run.lootPhase === null,                       `lootPhase 清除`)

console.log('\n【Test 14】lootPhase.phase=done → PATH_SELECTED')
const s14base = stateWithLoot(['p1'])
// 把 lootPhase 強制設為 done
const s14 = { ...s14base, run: { ...s14base.run, lootPhase: { ...s14base.run.lootPhase!, phase: 'done' as const } } }
const r14 = reduce(s14, { type: 'SELECT_PATH', pathType: 'safe' }, DEPS_NO_REGISTRY)
assert(r14.events.some(e => e.type === 'PATH_SELECTED'), `phase=done → 允許選路`)

console.log('\n【Test 15】lootPhase.phase=selecting → 被阻擋')
const s15 = stateWithLoot(['p1'])  // phase=selecting
assert(s15.run.lootPhase?.phase === 'selecting', `確認 phase=selecting`)
const r15 = reduce(s15, { type: 'SELECT_PATH', pathType: 'safe' }, DEPS_NO_REGISTRY)
assert(!r15.events.some(e => e.type === 'PATH_SELECTED'), `phase=selecting → 不允許選路`)
assert(r15.state.run.lootPhase !== null,                   `lootPhase 未清除`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
