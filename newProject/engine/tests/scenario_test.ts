/**
 * scenario_test.ts — 固定場景測試
 *
 * 目標：
 *   1. 固定 seed → 驗證 GameState 建立一致（可重現性）
 *   2. 玩家戰士（鐵劍）vs 2 隻野狼 → 驗證傷害計算基本正確
 *   3. ATB 推進 → 驗證最快單位先獲得行動權
 *
 * 執行方式（Node 直接跑，不需要測試框架）：
 *   npx ts-node newProject/engine/tests/scenario_test.ts
 *   或：
 *   npx tsx newProject/engine/tests/scenario_test.ts
 */

import { makeTestGameState, makeWarrior, makeWolf, IRON_SWORD_RESOLVED } from './fixtures'
import { calcDamage } from '../damage'
import { advanceTime } from '../atb'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}`)
    failed++
  }
}

function assertApprox(actual: number, expected: number, label: string, tol = 0.01) {
  assert(Math.abs(actual - expected) <= tol, `${label} (got ${actual.toFixed(4)}, expected ${expected.toFixed(4)})`)
}

// ─── Test 1：固定 seed，GameState 建立一致 ────────────────────────────────────

console.log('\n【Test 1】固定 seed — GameState 建立一致性')

const state1 = makeTestGameState()
const state2 = makeTestGameState()

assert(
  JSON.stringify(state1) === JSON.stringify(state2),
  '兩次 makeTestGameState() 結果完全相同'
)
assert(state1.run.runSeed === 'TEST_SEED_001', 'runSeed 正確')
assert(state1.floor.seed   === 'TEST_SEED_001', 'floorSeed 正確')
assert(state1.floor.width  === 8 && state1.floor.height === 8, '地圖尺寸 8×8')
assert(Object.keys(state1.units).length === 3, '3 個單位（1 玩家 + 2 野狼）')

// 驗證玩家起始位置
const p = state1.units['player_1']
assert(p.pos.x === 1 && p.pos.y === 6, '玩家起始位置 (1,6)')

// 驗證地圖格子：邊緣為牆，內部可通行
assert(!state1.floor.cells[0][0].passable, '(0,0) 是牆')
assert( state1.floor.cells[1][1].passable, '(1,1) 是地板')
assert(!state1.floor.cells[7][7].passable, '(7,7) 是牆')

// ─── Test 2：傷害計算驗證 ─────────────────────────────────────────────────────

console.log('\n【Test 2】傷害計算 — 戰士鐵劍 vs 野狼')

const warrior = makeWarrior('p')
const wolf    = makeWolf('w', { x: 2, y: 2 })
const affixDefs = {}  // 無詞條

// 固定隨機種子（覆蓋 Math.random，讓測試可重現）
// 設為 0 → 爆擊率 0% 時不爆擊
const originalRandom = Math.random
Math.random = () => 0.99  // 大於任何爆擊率 → 不爆擊

const result = calcDamage(warrior, wolf, IRON_SWORD_RESOLVED, affixDefs, 1.0)

// atkFinal = 1.0, stat(STR) = 15, baseMultiplier = 1.0 → rawAmount = 15.0
// 野狼無防禦 → finalAmount = max(1, 15 × (1−0) − 0) = 15
assertApprox(result.components[0].rawAmount,   15.0, '主組件 rawAmount = 15')
assertApprox(result.components[0].finalAmount, 15.0, '主組件 finalAmount = 15（野狼無防禦）')
assert(!result.isCrit, '不爆擊（Math.random = 0.99）')
assert(result.components.length === 1, '無附加組件（無詞條）')

// 有防禦時：finalAmount = max(1, 15 × (1−0) − 5) = 10
const wolfWithDef = { ...wolf, defenses: { slash: 5 } }
const result2 = calcDamage(warrior, wolfWithDef, IRON_SWORD_RESOLVED, affixDefs, 1.0)
assertApprox(result2.components[0].finalAmount, 10.0, '有 5 slash 防禦 → finalAmount = 10')

// 有抗性時：finalAmount = max(1, 15 × (1−0.3) − 0) = 10.5
const wolfWithResist = { ...wolf, resistances: { slash: 0.3 }, defenses: {} }
const result3 = calcDamage(warrior, wolfWithResist, IRON_SWORD_RESOLVED, affixDefs, 1.0)
assertApprox(result3.components[0].finalAmount, 10.5, 'slash 抗性 30% → finalAmount = 10.5')

Math.random = originalRandom  // 還原

// ─── Test 3：ATB 推進 ─────────────────────────────────────────────────────────

console.log('\n【Test 3】ATB 推進 — 最快單位先獲得行動權')

const state3 = makeTestGameState()
// 速度：wolf = 14, player = 12
// 到達 100：wolf = 100/14 ≈ 7.14 tick, player = 100/12 ≈ 8.33 tick
// 所以野狼應先獲得行動權

const { newState, events } = advanceTime(state3)

const atbReadyEvent = events.find(e => e.type === 'ATB_READY')
assert(!!atbReadyEvent, 'ADVANCE_TIME 發出 ATB_READY event')
if (atbReadyEvent?.type === 'ATB_READY') {
  assert(
    atbReadyEvent.unitId === 'wolf_1' || atbReadyEvent.unitId === 'wolf_2',
    `速度較快的野狼先獲得行動權（got: ${atbReadyEvent.unitId}）`
  )
}
assert(newState.timeline.pendingUnitId !== null, 'pendingUnitId 已設定')
assert(newState.timeline.tick > 0, `時間推進了（tick = ${newState.timeline.tick}）`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) {
  process.exit(1)
}
