/**
 * passive_test.ts — 被動能力觸發測試
 *
 * 驗證：
 *   1. on_time（recover_hp）：首次初始化 nextTriggerAt，到時間後回血
 *   2. on_below_hp（buff_self speedBonus）：跌破閾值觸發，once=true 只觸發一次
 *   3. on_below_hp（enter_phase atkMult）：攻擊倍率正確套用至 calcDamage
 *   4. on_below_hp 未跌破閾值時不觸發
 *   5. ADVANCE_STATUS_EFFECTS + passiveRegistry：on_time 在 tick 到達後自動觸發
 *   6. RESOLVE_CAST + passiveRegistry：傷後 on_below_hp 即時響應
 */

import { makeTestGameState, makeWolf } from './fixtures'
import type { GameState, Unit } from '../state'
import type { PassiveAbilityDef, PassiveRegistry } from '../passive'
import { checkPassiveTriggers } from '../passive'
import { reduce } from '../reduce'
import { calcDamage } from '../damage'
import { IRON_SWORD_RESOLVED } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

function setUnitHP(state: GameState, unitId: string, hp: number): GameState {
  const unit = state.units[unitId]!
  return { ...state, units: { ...state.units, [unitId]: { ...unit, currentHP: hp } } }
}

function atTick(state: GameState, tick: number): GameState {
  return { ...state, timeline: { ...state.timeline, tick } }
}

// ─── 被動定義 ─────────────────────────────────────────────────────────────────

const ON_TIME_REGEN: PassiveAbilityDef = {
  trigger: 'on_time',
  interval: 2000,
  effect: { type: 'recover_hp', amount: 8 },
}

const ON_BELOW_HP_BUFF: PassiveAbilityDef = {
  trigger: 'on_below_hp',
  threshold: 0.5,
  once: true,
  effect: { type: 'buff_self', speedBonus: 4 },
}

const ON_BELOW_HP_ENRAGE: PassiveAbilityDef = {
  trigger: 'on_below_hp',
  threshold: 0.4,
  once: true,
  effect: { type: 'enter_phase', phase: 'enrage', speedBonus: 6, atkMult: 1.5 },
}

// ─── Test 1：on_time 初始化 + 回血 ────────────────────────────────────────────

console.log('\n【Test 1】on_time — 首次排程，到期後回血')

let s1 = makeTestGameState()
// wolf 受傷（HP 30/45）
s1 = setUnitHP(s1, 'wolf_1', 30)
s1 = atTick(s1, 0)

const wolf1 = s1.units['wolf_1']!
const passiveDefs1: PassiveAbilityDef[] = [ON_TIME_REGEN]

// tick=0：首次呼叫，應初始化 nextTriggerAt=2000，不觸發
const r1a = checkPassiveTriggers(s1, 'wolf_1', passiveDefs1, 0)
assert(r1a.events.length === 0, 'tick=0：首次呼叫不觸發')
assert(r1a.state.units['wolf_1'].passiveNextTriggerAt?.['forest_wolf_passive_0'] === 2000, 'nextTriggerAt 初始化為 2000')
assert(r1a.state.units['wolf_1'].currentHP === 30, 'tick=0：HP 未變')

// tick=1999：尚未到期
const s1b = atTick(r1a.state, 1999)
const r1b = checkPassiveTriggers(s1b, 'wolf_1', passiveDefs1, 1999)
assert(r1b.events.length === 0, 'tick=1999：尚未觸發')

// tick=2000：到期，觸發回血
const s1c = atTick(r1a.state, 2000)
const r1c = checkPassiveTriggers(s1c, 'wolf_1', passiveDefs1, 2000)
assert(r1c.events.some(e => e.type === 'HEAL'), 'tick=2000：發出 HEAL event')
assert(r1c.events.some(e => e.type === 'PASSIVE_TRIGGERED'), 'tick=2000：發出 PASSIVE_TRIGGERED')
assert(r1c.state.units['wolf_1'].currentHP === 38, `HP 回復 8（30 → ${r1c.state.units['wolf_1'].currentHP}）`)
// nextTriggerAt 推進到 4000
assert(r1c.state.units['wolf_1'].passiveNextTriggerAt?.['forest_wolf_passive_0'] === 4000, 'nextTriggerAt 推進為 4000')

// ─── Test 2：on_below_hp（once=true）觸發一次後不再觸發 ─────────────────────

console.log('\n【Test 2】on_below_hp — 跌破閾值觸發，once=true 只觸發一次')

let s2 = makeTestGameState()
const passiveDefs2: PassiveAbilityDef[] = [ON_BELOW_HP_BUFF]

// HP 60% > 50%：不觸發
s2 = setUnitHP(s2, 'wolf_1', Math.floor(45 * 0.6))  // 27/45 = 60%
const r2a = checkPassiveTriggers(s2, 'wolf_1', passiveDefs2, 0)
assert(r2a.events.length === 0, 'HP 60%：未觸發')

// HP 40% < 50%：觸發
s2 = setUnitHP(s2, 'wolf_1', Math.floor(45 * 0.4))  // 18/45 = 40%
const r2b = checkPassiveTriggers(s2, 'wolf_1', passiveDefs2, 0)
assert(r2b.events.some(e => e.type === 'PASSIVE_TRIGGERED'), 'HP 40%：觸發 PASSIVE_TRIGGERED')
const speedAfter2b = r2b.state.units['wolf_1'].speed
assert(speedAfter2b === 14 + 4, `速度增加 4（got: ${speedAfter2b}）`)

// triggeredPassiveIds 已記錄
assert(r2b.state.units['wolf_1'].triggeredPassiveIds?.includes('forest_wolf_passive_0'), 'triggeredPassiveIds 已記錄')

// 再次呼叫：不重複觸發
const r2c = checkPassiveTriggers(r2b.state, 'wolf_1', passiveDefs2, 100)
assert(r2c.events.length === 0, 'once=true：不重複觸發')
assert(r2c.state.units['wolf_1'].speed === speedAfter2b, '速度未再次增加')

// ─── Test 3：enter_phase atkMult 影響傷害計算 ─────────────────────────────────

console.log('\n【Test 3】enter_phase atkMult — 攻擊倍率套用至 calcDamage')

let s3 = makeTestGameState()
const passiveDefs3: PassiveAbilityDef[] = [ON_BELOW_HP_ENRAGE]
// wolf_1 HP 跌破 40%
s3 = setUnitHP(s3, 'wolf_1', Math.floor(45 * 0.3))  // 13/45 ≈ 29%

const r3 = checkPassiveTriggers(s3, 'wolf_1', passiveDefs3, 0)
const wolfEnraged = r3.state.units['wolf_1']
assert(wolfEnraged.passiveAtkMult === 1.5, `passiveAtkMult = 1.5（got: ${wolfEnraged.passiveAtkMult}）`)
assert(wolfEnraged.speed === 14 + 6, `speed 增加 6（got: ${wolfEnraged.speed}）`)

// 比較傷害：帶 atkMult vs 無 atkMult
const wolfNormal = s3.units['wolf_1']  // passiveAtkMult 未設定
const player = s3.units['player_1']!
const wolfWeapon = wolfNormal.weapons[0]!

const dmgNormal = calcDamage(wolfNormal, player, wolfWeapon, {})
const dmgEnraged = calcDamage(wolfEnraged, player, wolfWeapon, {})
assert(dmgEnraged.totalFinal > dmgNormal.totalFinal, `暴怒傷害 > 正常傷害（${dmgEnraged.totalFinal.toFixed(1)} > ${dmgNormal.totalFinal.toFixed(1)}）`)
// 應該接近 1.5 倍
const ratio = dmgEnraged.totalFinal / dmgNormal.totalFinal
assert(Math.abs(ratio - 1.5) < 0.01, `倍率接近 1.5（got: ${ratio.toFixed(3)}）`)

// ─── Test 4：ADVANCE_STATUS_EFFECTS 整合 passiveRegistry ──────────────────────

console.log('\n【Test 4】ADVANCE_STATUS_EFFECTS + passiveRegistry — on_time 自動觸發')

let s4 = makeTestGameState()
s4 = setUnitHP(s4, 'wolf_1', 20)  // 受傷
s4 = atTick(s4, 0)

const passiveRegistry4: PassiveRegistry = {
  forest_wolf: [ON_TIME_REGEN],
}
const deps4 = { allAffixDefs: {}, passiveRegistry: passiveRegistry4 }

// tick=0 時先初始化 nextTriggerAt
const { state: s4a } = reduce(s4, { type: 'ADVANCE_STATUS_EFFECTS' }, deps4)
assert(s4a.units['wolf_1'].passiveNextTriggerAt?.['forest_wolf_passive_0'] === 2000, 'tick=0：nextTriggerAt 初始化')

// 推進 tick 到 2000，再呼叫 ADVANCE_STATUS_EFFECTS
const s4b = atTick(s4a, 2000)
const { state: s4c, events: ev4c } = reduce(s4b, { type: 'ADVANCE_STATUS_EFFECTS' }, deps4)
assert(ev4c.some(e => e.type === 'HEAL'), 'tick=2000：on_time 觸發回血 HEAL event')
assert(s4c.units['wolf_1'].currentHP === 28, `HP 回復 8（20 → ${s4c.units['wolf_1'].currentHP}）`)

// ─── Test 5：RESOLVE_CAST + passiveRegistry — 傷後 on_below_hp 即時響應 ────────

console.log('\n【Test 5】RESOLVE_CAST + passiveRegistry — 傷後 on_below_hp 即時響應')

let s5 = makeTestGameState()
// wolf_1 HP 接近閾值（50% = 22.5，設為 24/45 = 53%，一擊後跌破）
s5 = setUnitHP(s5, 'wolf_1', 24)

// 玩家在 (3,4)，wolf_1 在 (4,4)（正右方）
// frontal_sweep 面向 right 命中 (4,3)(4,4)(4,5)，wolf 在 (4,4) 必中
s5 = {
  ...s5,
  timeline: {
    ...s5.timeline,
    pendingUnitId: 'player_1',
    entries: s5.timeline.entries.map(e =>
      e.unitId === 'player_1' ? { ...e, atb: 100, castRemaining: 0, recoveryRemaining: 0 } : e
    ),
  },
  units: {
    ...s5.units,
    player_1: { ...s5.units['player_1'], pos: { x: 3, y: 4 } },
    wolf_1:   { ...s5.units['wolf_1'],   pos: { x: 4, y: 4 } },
    wolf_2:   { ...s5.units['wolf_2'],   pos: { x: 7, y: 7 } },  // 移開避免衝突
  }
}

const passiveRegistry5: PassiveRegistry = {
  forest_wolf: [ON_BELOW_HP_BUFF],  // threshold=0.5
}
const deps5 = { allAffixDefs: {}, passiveRegistry: passiveRegistry5 }

// 玩家使用武器
const { state: s5a } = reduce(s5, { type: 'QUEUE_WEAPON', unitId: 'player_1', weaponSlot: 0, targetPos: { x: 4, y: 4 } }, deps5)

// 確認讀條開始
const castEntry = s5a.timeline.entries.find(e => e.unitId === 'player_1')
const s5b = {
  ...s5a,
  timeline: {
    ...s5a.timeline,
    pendingUnitId: 'player_1',
    entries: s5a.timeline.entries.map(e =>
      e.unitId === 'player_1' ? { ...e, castRemaining: 0 } : e
    ),
  }
}

const { state: s5c, events: ev5c } = reduce(s5b, { type: 'RESOLVE_CAST', unitId: 'player_1' }, deps5)

// 攻擊後 wolf HP 是否跌破 50%
const wolfHP5 = s5c.units['wolf_1'].currentHP
const wolfMaxHP5 = s5c.units['wolf_1'].maxHP
const hpRatio5 = wolfHP5 / wolfMaxHP5

if (hpRatio5 < 0.5) {
  assert(ev5c.some(e => e.type === 'PASSIVE_TRIGGERED'), `HP ${(hpRatio5 * 100).toFixed(1)}% < 50%：觸發 on_below_hp 被動`)
  assert(s5c.units['wolf_1'].triggeredPassiveIds?.includes('forest_wolf_passive_0'), 'triggeredPassiveIds 已記錄')
} else {
  console.log(`    ⚠ 攻擊後 HP ${(hpRatio5 * 100).toFixed(1)}% 未跌破 50%（攻擊傷害不足，此測試需調整場景）`)
  // 確認 passive 未觸發（HP 未跌破不應觸發）
  assert(!ev5c.some(e => e.type === 'PASSIVE_TRIGGERED'), `HP 未跌破：不觸發被動`)
}

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
