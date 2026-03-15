/**
 * status_test.ts — 狀態效果池測試
 *
 * 驗證：
 *   1. ADVANCE_STATUS_EFFECTS：到期 status 被移除，發出 STATUS_EXPIRED
 *   2. DoT（poison）每次 tick 扣血，發出 DOT_TICK
 *   3. DoT 到期時不再 tick，同回合到期+tick 邊界行為
 *   4. slow 存在時 speedMult 可被 canAct-related logic 讀取（結構驗證）
 *   5. ADVANCE_STATUS_EFFECTS 殺死單位（DoT 耗盡 HP）→ UNIT_DIED 事件
 */

import { makeTestGameState } from './fixtures'
import type { GameState, StatusEffect } from '../state'
import { reduce } from '../reduce'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

/** 設定 timeline.tick 並觸發 ADVANCE_STATUS_EFFECTS */
function advanceStatusAt(state: GameState, tick: number) {
  const s = { ...state, timeline: { ...state.timeline, tick } }
  return reduce(s, { type: 'ADVANCE_STATUS_EFFECTS' })
}

/** 直接將 status 塞入指定單位 */
function withStatus(state: GameState, unitId: string, effects: StatusEffect[]): GameState {
  const unit = state.units[unitId]!
  return { ...state, units: { ...state.units, [unitId]: { ...unit, statusEffects: effects } } }
}

// ─── Test 1：status 到期移除 ──────────────────────────────────────────────────

console.log('\n【Test 1】status 到期 → STATUS_EXPIRED + 從 statusEffects 移除')

let s1 = makeTestGameState()
const slowEffect: StatusEffect = {
  id: 'slow',
  expiresAt: 3000,       // 在 tick=3000 時到期
  speedMult: 0.5,
  moveRangeMult: 0.5,
}
s1 = withStatus(s1, 'player_1', [slowEffect])

// tick=2999：尚未到期
const { state: s1a, events: ev1a } = advanceStatusAt(s1, 2999)
assert(!ev1a.some(e => e.type === 'STATUS_EXPIRED'), 'tick=2999：slow 尚未到期')
assert(s1a.units['player_1'].statusEffects.length === 1, 'tick=2999：slow 仍在 statusEffects')

// tick=3000：到期
const { state: s1b, events: ev1b } = advanceStatusAt(s1, 3000)
assert(ev1b.some(e => e.type === 'STATUS_EXPIRED'), 'tick=3000：發出 STATUS_EXPIRED')
assert(s1b.units['player_1'].statusEffects.length === 0, 'tick=3000：slow 已從 statusEffects 移除')

// ─── Test 2：DoT tick 扣血 ────────────────────────────────────────────────────

console.log('\n【Test 2】poison DoT tick → DOT_TICK event + 扣血')

let s2 = makeTestGameState()
const poisonEffect: StatusEffect = {
  id: 'poison',
  expiresAt: 5000,
  dotDamagePerTick: 2,
  dotTickMs: 1000,
  dotElement: 'dark',
  nextTickAt: 1000,      // 下次 tick 在 1000ms
}
s2 = withStatus(s2, 'player_1', [poisonEffect])
const hpBefore2 = s2.units['player_1'].currentHP  // 120

// tick=999：尚未到達 nextTickAt
const { state: s2a, events: ev2a } = advanceStatusAt(s2, 999)
assert(!ev2a.some(e => e.type === 'DOT_TICK'), 'tick=999：尚未 tick')
assert(s2a.units['player_1'].currentHP === hpBefore2, 'tick=999：HP 未扣')

// tick=1000：觸發 tick
const { state: s2b, events: ev2b } = advanceStatusAt(s2, 1000)
assert(ev2b.some(e => e.type === 'DOT_TICK'), 'tick=1000：發出 DOT_TICK')
assert(s2b.units['player_1'].currentHP === hpBefore2 - 2, `tick=1000：HP 扣 2（${hpBefore2} → ${s2b.units['player_1'].currentHP}）`)

// nextTickAt 應更新為 2000
const poisonAfter = s2b.units['player_1'].statusEffects.find(s => s.id === 'poison')
assert(poisonAfter?.nextTickAt === 2000, `nextTickAt 更新為 2000（got: ${poisonAfter?.nextTickAt}）`)

// ─── Test 3：DoT 到期後不再 tick ──────────────────────────────────────────────

console.log('\n【Test 3】DoT 到期後不再 tick')

let s3 = makeTestGameState()
const poisonShort: StatusEffect = {
  id: 'poison',
  expiresAt: 1500,       // 在 1500ms 到期
  dotDamagePerTick: 5,
  dotTickMs: 1000,
  dotElement: 'dark',
  nextTickAt: 2000,      // 下次 tick 在 2000ms（但已超過 expiresAt）
}
s3 = withStatus(s3, 'player_1', [poisonShort])
const hpBefore3 = s3.units['player_1'].currentHP

// tick=2000：到期先移除，不 tick
const { state: s3b, events: ev3b } = advanceStatusAt(s3, 2000)
assert(ev3b.some(e => e.type === 'STATUS_EXPIRED'), 'tick=2000：到期發出 STATUS_EXPIRED')
assert(!ev3b.some(e => e.type === 'DOT_TICK'), 'tick=2000：到期後不觸發 DOT_TICK')
assert(s3b.units['player_1'].currentHP === hpBefore3, 'HP 未因過期的 DoT 扣血')

// ─── Test 4：多個 status，各自獨立到期 ────────────────────────────────────────

console.log('\n【Test 4】多個 status 共存，各自到期')

let s4 = makeTestGameState()
const slow4: StatusEffect = { id: 'slow', expiresAt: 2000, speedMult: 0.5, moveRangeMult: 0.5 }
const webbed4: StatusEffect = { id: 'webbed', expiresAt: 4000, speedMult: 0.6, moveRangeMult: 0.5 }
s4 = withStatus(s4, 'player_1', [slow4, webbed4])

// tick=2000：slow 到期，webbed 仍在
const { state: s4b } = advanceStatusAt(s4, 2000)
const effects4b = s4b.units['player_1'].statusEffects
assert(!effects4b.some(s => s.id === 'slow'), 'tick=2000：slow 已移除')
assert(effects4b.some(s => s.id === 'webbed'), 'tick=2000：webbed 仍在')

// tick=4000：webbed 到期
const { state: s4c } = advanceStatusAt(s4b, 4000)
assert(s4c.units['player_1'].statusEffects.length === 0, 'tick=4000：所有 status 清除')

// ─── Test 5：DoT 致死 → UNIT_DIED ────────────────────────────────────────────

console.log('\n【Test 5】DoT 致死 → 發出 UNIT_DIED，isDead = true')

let s5 = makeTestGameState()
const lethalDot: StatusEffect = {
  id: 'poison',
  expiresAt: 5000,
  dotDamagePerTick: 500,  // 一擊致命
  dotTickMs: 1000,
  dotElement: 'dark',
  nextTickAt: 1000,
}
// 給 wolf_1 一個致命 DoT（不是玩家，避免影響其他 test）
s5 = withStatus(s5, 'wolf_1', [lethalDot])

const { state: s5b, events: ev5 } = advanceStatusAt(s5, 1000)
assert(ev5.some(e => e.type === 'DOT_TICK'), '致命 DoT：發出 DOT_TICK')
assert(ev5.some(e => e.type === 'UNIT_DIED'), '致命 DoT：發出 UNIT_DIED')
assert(s5b.units['wolf_1'].isDead === true, 'wolf_1 isDead = true')
assert(s5b.units['wolf_1'].currentHP === 0, 'wolf_1 HP = 0')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
