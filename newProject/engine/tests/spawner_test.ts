/**
 * spawner_test.ts — spawnMonster 單元測試
 *
 * 驗證：
 *   1. 基礎屬性計算（base + floor × floorScale × statScaleMult）
 *   2. HP 公式（(base + str × strMult) × hpMult）
 *   3. tier=elite 屬性放大
 *   4. tier=boss 速度加成
 *   5. skillCooldownUntil 從 skillPool 初始化為 0
 *   6. 武器 resolve：actionId、statScaling、atkFinal 正確
 *   7. 武器詞條隨機選取（count=1 → appliedAffixIds.length ≤ pool size）
 *   8. seed 相同 → 相同結果（可重現性）
 *   9. 無 spawnerDef tier → fallback 到 normal / default
 */

import type { MonsterDef, SpawnerDef, SpawnParams } from '../spawner'
import { spawnMonster } from '../spawner'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

// ─── 測試資料（對應 wolf.json + wolf_spawner.json）────────────────────────────

const WOLF_DEF: MonsterDef = {
  id: 'forest_wolf',
  name: '灰狼',
  theme: 'forest',
  tier: 'normal',
  archetype: 'agi',
  ai: 'chase',
  stats: {
    str: { base: 8,  floorScale: 0.6 },
    agi: { base: 18, floorScale: 1.2 },
    int: { base: 2,  floorScale: 0.2 },
    lck: { base: 5,  floorScale: 0.4 },
  },
  resources: {
    hp: { base: 40, strMult: 1.5 },
    sp: { base: 30, agiMult: 1 },
    mp: { base: 0 },
  },
  moveRange: 4,
  speed: 16,
  weapon: {
    id: 'wolf_fang',
    name: '野狼利牙',
    actionId: 'single_melee',
    hitMode: { type: 'instant' },
    statScaling: 'AGI',
    atkBase: 0.3,
    actionTags: ['物理', '即發'],
    slot1: 'slash',
    slot2: 'mode_charge',
    slot3Pool: ['trait_swift', 'trait_brute'],
    slot5Pool: ['enchant_slow', 'enchant_bleed'],
  },
}

const WOLF_SPAWNER: SpawnerDef = {
  monsterId: 'forest_wolf',
  normal: {
    statScaleMult: 1.0,
    qualityMult: 1.0,
    hpMult: 1.0,
    weapon: {
      affixCountTable: [
        { count: 1, weight: 40 },
        { count: 2, weight: 60 },
      ],
      affixRarityTable: [
        { rarity: 'common', weight: 85 },
        { rarity: 'rare',   weight: 15 },
      ],
    },
  },
  elite: {
    statScaleMult: 1.5,
    qualityMult: 1.2,
    hpMult: 2.0,
    speedBonus: 2,
    weapon: {
      affixCountTable: [
        { count: 2, weight: 30 },
        { count: 3, weight: 70 },
      ],
      affixRarityTable: [
        { rarity: 'common', weight: 50 },
        { rarity: 'rare',   weight: 40 },
        { rarity: 'elite',  weight: 10 },
      ],
    },
    skillPool: [{ id: 'pack_call' }],
  },
  boss: {
    statScaleMult: 2.5,
    qualityMult: 1.5,
    hpMult: 4.0,
    speedBonus: 4,
    weapon: {
      affixCountTable: [{ count: 3, weight: 100 }],
      affixRarityTable: [
        { rarity: 'common', weight: 20 },
        { rarity: 'rare',   weight: 60 },
        { rarity: 'elite',  weight: 20 },
      ],
    },
    skillPool: [{ id: 'pack_call' }, { id: 'howl_aoe_slow' }],
  },
}

const BASE_PARAMS: Omit<SpawnParams, 'tier'> = {
  monsterDef: WOLF_DEF,
  spawnerDef: WOLF_SPAWNER,
  pos: { x: 3, y: 3 },
  floorNumber: 1,
}

// ─── Test 1：基礎屬性計算（normal, floor=1）──────────────────────────────────

console.log('\n【Test 1】normal tier, floor=1 — 屬性計算')

const u1 = spawnMonster({ ...BASE_PARAMS, tier: 'normal', unitId: 'wolf_test_1' })

// str = round(8 + 1 × 0.6 × 1.0) = round(8.6) = 9
assert(u1.stats.str === 9, `str = 9（got: ${u1.stats.str}）`)
// agi = round(18 + 1 × 1.2 × 1.0) = round(19.2) = 19
assert(u1.stats.agi === 19, `agi = 19（got: ${u1.stats.agi}）`)
// int = round(2 + 1 × 0.2 × 1.0) = round(2.2) = 2
assert(u1.stats.int === 2, `int = 2（got: ${u1.stats.int}）`)

// ─── Test 2：HP 計算（hpMult=1.0）────────────────────────────────────────────

console.log('\n【Test 2】HP 公式驗證')

// hp = round((40 + 9 × 1.5) × 1.0) = round(53.5) = 54
const expectedHP1 = Math.round((40 + u1.stats.str * 1.5) * 1.0)
assert(u1.maxHP === expectedHP1, `maxHP = ${expectedHP1}（got: ${u1.maxHP}）`)
assert(u1.currentHP === u1.maxHP, 'currentHP = maxHP（滿血）')

// SP = round((30 + 19 × 1) × 1.0) = 49
const expectedSP1 = Math.round((30 + u1.stats.agi * 1) * 1.0)
assert(u1.maxSP === expectedSP1, `maxSP = ${expectedSP1}（got: ${u1.maxSP}）`)

// MP = 0（base=0, 無 mult）
assert(u1.maxMP === 0, `maxMP = 0（got: ${u1.maxMP}）`)

// ─── Test 3：elite tier 放大 ──────────────────────────────────────────────────

console.log('\n【Test 3】elite tier — 屬性與 HP 放大')

const u3 = spawnMonster({ ...BASE_PARAMS, tier: 'elite', unitId: 'wolf_elite_1' })

// str = round(8 + 1 × 0.6 × 1.5) = round(8.9) = 9
const expectedStr3 = Math.round(8 + 1 * 0.6 * 1.5)
assert(u3.stats.str === expectedStr3, `elite str = ${expectedStr3}（got: ${u3.stats.str}）`)

// HP × hpMult=2.0
const expectedHP3 = Math.round((40 + u3.stats.str * 1.5) * 2.0)
assert(u3.maxHP === expectedHP3, `elite maxHP = ${expectedHP3}（got: ${u3.maxHP}）`)
assert(u3.maxHP > u1.maxHP, `elite HP > normal HP（${u3.maxHP} > ${u1.maxHP}）`)

// ─── Test 4：boss 速度加成 ────────────────────────────────────────────────────

console.log('\n【Test 4】boss tier — 速度加成')

const u4 = spawnMonster({ ...BASE_PARAMS, tier: 'boss', unitId: 'wolf_boss_1' })
assert(u4.speed === 16 + 4, `boss speed = 20（got: ${u4.speed}）`)

// ─── Test 5：skillCooldownUntil 初始化 ────────────────────────────────────────

console.log('\n【Test 5】skillCooldownUntil 從 skillPool 初始化')

const u5_normal = spawnMonster({ ...BASE_PARAMS, tier: 'normal', unitId: 'wolf_n' })
assert(Object.keys(u5_normal.skillCooldownUntil ?? {}).length === 0, 'normal：無 skillPool → 空 map')

const u5_elite = spawnMonster({ ...BASE_PARAMS, tier: 'elite', unitId: 'wolf_e' })
assert('pack_call' in (u5_elite.skillCooldownUntil ?? {}), 'elite：pack_call 已初始化')
assert((u5_elite.skillCooldownUntil ?? {})['pack_call'] === 0, 'pack_call cooldownUntil = 0')

const u5_boss = spawnMonster({ ...BASE_PARAMS, tier: 'boss', unitId: 'wolf_b' })
assert('howl_aoe_slow' in (u5_boss.skillCooldownUntil ?? {}), 'boss：howl_aoe_slow 已初始化')

// ─── Test 6：武器 resolve ─────────────────────────────────────────────────────

console.log('\n【Test 6】武器 resolve — actionId、element、statScaling')

assert(u1.weapons.length === 1, '有 1 個武器槽')
const w1 = u1.weapons[0]!
assert(w1.actionId === 'single_melee', `actionId = single_melee（got: ${w1.actionId}）`)
assert(w1.statScaling === 'AGI', `statScaling = AGI（got: ${w1.statScaling}）`)
assert(w1.element === 'slash', `element = slash（got: ${w1.element}）`)
assert(w1.atkFinal === 0.3, `atkFinal = 0.3（got: ${w1.atkFinal}）`)
assert(w1.castTimeFinal > 0, `castTimeFinal > 0（got: ${w1.castTimeFinal}）`)
assert(w1.recoveryTimeFinal > 0, `recoveryTimeFinal > 0（got: ${w1.recoveryTimeFinal}）`)

// ─── Test 7：武器詞條隨機選取 ─────────────────────────────────────────────────

console.log('\n【Test 7】武器詞條選取 — appliedAffixIds 在合法範圍內')

// 詞條池：slot3Pool(2) + slot5Pool(2) = 4 個選項，count 1-2
// 多次生成驗證 appliedAffixIds 長度在 [1,2] 範圍
let allInRange = true
for (let i = 0; i < 20; i++) {
  const u = spawnMonster({ ...BASE_PARAMS, tier: 'normal' })
  const len = u.weapons[0]!.appliedAffixIds.length
  if (len < 1 || len > 2) allInRange = false
}
assert(allInRange, '20 次生成：appliedAffixIds.length 均在 [1, 2]')

// 所有選出的詞條 id 都在合法池中
const validPool = ['trait_swift', 'trait_brute', 'enchant_slow', 'enchant_bleed']
const u7 = spawnMonster({ ...BASE_PARAMS, tier: 'normal', unitId: 'wolf_pool_check' })
const allValid = u7.weapons[0]!.appliedAffixIds.every(id => validPool.includes(id))
assert(allValid, `所有詞條 id 在合法池中（got: ${u7.weapons[0]!.appliedAffixIds.join(',')}）`)

// ─── Test 8：可重現性（相同 rng seed 同結果）─────────────────────────────────

console.log('\n【Test 8】可重現性 — 相同 rng → 相同詞條')

// 簡易 seeded rng（LCG）
function makeLCG(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const rng1 = makeLCG(12345)
const rng2 = makeLCG(12345)
const ua = spawnMonster({ ...BASE_PARAMS, tier: 'normal', rng: rng1, unitId: 'wolf_seed_a' })
const ub = spawnMonster({ ...BASE_PARAMS, tier: 'normal', rng: rng2, unitId: 'wolf_seed_b' })

assert(
  JSON.stringify(ua.weapons[0]!.appliedAffixIds) === JSON.stringify(ub.weapons[0]!.appliedAffixIds),
  `相同 seed → 相同詞條（${ua.weapons[0]!.appliedAffixIds.join(',')})`)

// ─── Test 9：被動追蹤初始化 ──────────────────────────────────────────────────

console.log('\n【Test 9】被動追蹤欄位初始化')

assert(Array.isArray(u1.triggeredPassiveIds), 'triggeredPassiveIds 為陣列')
assert(u1.triggeredPassiveIds!.length === 0, 'triggeredPassiveIds 初始為空')
assert(typeof u1.passiveNextTriggerAt === 'object', 'passiveNextTriggerAt 為 object')
assert(Object.keys(u1.passiveNextTriggerAt ?? {}).length === 0, 'passiveNextTriggerAt 初始為空')

// ─── Test 10：floor 縮放（floor=5 屬性更高）──────────────────────────────────

console.log('\n【Test 10】floor=5 — 屬性隨樓層縮放')

const u10 = spawnMonster({ ...BASE_PARAMS, tier: 'normal', floorNumber: 5, unitId: 'wolf_fl5' })
// str = round(8 + 5 × 0.6 × 1.0) = round(11) = 11
assert(u10.stats.str === 11, `floor=5 str = 11（got: ${u10.stats.str}）`)
assert(u10.maxHP > u1.maxHP, `floor=5 HP > floor=1 HP（${u10.maxHP} > ${u1.maxHP}）`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
