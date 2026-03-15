/**
 * combat_loop_test.ts — 單層完整戰鬥流程測試
 *
 * 場景：戰士（鐵劍）vs 2 隻野狼，任務 clear_all
 *
 * 驗證：
 *   1. MOVE：玩家移動，位置更新，ATB 重置
 *   2. QUEUE_WEAPON → RESOLVE_CAST：攻擊讀條 + 傷害結算
 *   3. 怪物 AI：自動追擊並攻擊玩家
 *   4. UNIT_DIED：怪物死亡後 isDead = true，掉落金幣
 *   5. checkObjective：全怪死亡 → FLOOR_CLEARED
 *   6. reach_exit 任務變體：玩家走到出口 → FLOOR_CLEARED
 *   7. guard AI：玩家超出感知範圍時怪物不動
 */

import { makeTestGameState, makeWarrior, makeWolf, IRON_SWORD_RESOLVED, makeTestFloor } from './fixtures'
import type { GameState, Unit } from '../state'
import { reduce, checkObjective } from '../reduce'
import { advanceTime } from '../atb'
import { decideTurn } from '../ai'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const events: string[] = []

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

/** 讓特定單位獲得行動權（直接設 pendingUnitId + atb = 100）*/
function giveAction(state: GameState, unitId: string): GameState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      pendingUnitId: unitId,
      entries: state.timeline.entries.map(e =>
        e.unitId === unitId
          ? { ...e, atb: 100, castRemaining: 0, recoveryRemaining: 0 }
          : e
      ),
    },
  }
}

/** 快速讓某單位讀條結束（castRemaining → 0）*/
function finishCast(state: GameState, unitId: string): GameState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      entries: state.timeline.entries.map(e =>
        e.unitId === unitId ? { ...e, castRemaining: 0 } : e
      ),
    },
  }
}

const deps = { allAffixDefs: {} }

// ─── Test 1：MOVE 動作 ────────────────────────────────────────────────────────

console.log('\n【Test 1】MOVE — 玩家移動')

let s = makeTestGameState()
s = giveAction(s, 'player_1')

const { state: s1, events: ev1 } = reduce(s, { type: 'MOVE', unitId: 'player_1', to: { x: 2, y: 6 } }, deps)
assert(s1.units['player_1'].pos.x === 2 && s1.units['player_1'].pos.y === 6, '玩家移動到 (2,6)')
assert(ev1.some(e => e.type === 'UNIT_MOVED'), '發出 UNIT_MOVED event')
assert(s1.timeline.pendingUnitId === null, '行動後 pendingUnitId 清空')

// 嘗試移動到牆壁（應失敗）
s = giveAction(s, 'player_1')
const { state: sWall } = reduce(s, { type: 'MOVE', unitId: 'player_1', to: { x: 0, y: 0 } }, deps)
assert(sWall.units['player_1'].pos.x === 1 && sWall.units['player_1'].pos.y === 6, '移動到牆壁被擋（位置不變）')

// 嘗試超出 moveRange（moveRange=3，從(1,6)到(5,6) = 4格，應失敗）
s = giveAction(s, 'player_1')
const { state: sFar } = reduce(s, { type: 'MOVE', unitId: 'player_1', to: { x: 5, y: 6 } }, deps)
assert(sFar.units['player_1'].pos.x === 1, '超出 moveRange 被擋（位置不變）')

// ─── Test 2：QUEUE_WEAPON + RESOLVE_CAST ─────────────────────────────────────

console.log('\n【Test 2】QUEUE_WEAPON + RESOLVE_CAST — 攻擊讀條與傷害結算')

// 戰士位置 (1,6)，野狼在 (3,2)，太遠。
// 把玩家移到 (2,3)，野狼在 (3,2)，相鄰
let s2 = makeTestGameState()
s2 = {
  ...s2,
  units: {
    ...s2.units,
    player_1: { ...s2.units['player_1'], pos: { x: 2, y: 3 }, facing: 'up' },
    wolf_1:   { ...s2.units['wolf_1'],   pos: { x: 2, y: 2 } },
    wolf_2:   { ...s2.units['wolf_2'],   pos: { x: 5, y: 5 } },
  },
}

s2 = giveAction(s2, 'player_1')
const wolfHPBefore = s2.units['wolf_1'].currentHP

// 開始讀條
const { state: s2a, events: ev2a } = reduce(
  s2,
  { type: 'QUEUE_WEAPON', unitId: 'player_1', weaponSlot: 0, targetPos: { x: 2, y: 2 } },
  deps
)
assert(ev2a.some(e => e.type === 'CAST_STARTED'), '發出 CAST_STARTED event')
assert(s2a.units['player_1'].currentSP === 60 - 10, 'SP 扣除 10（spCost）')
assert(s2a.units['player_1'].pendingAction?.kind === 'weapon', 'pendingAction 設為 weapon')

// 強制讀條結束，結算
const s2b = finishCast(s2a, 'player_1')
const { state: s2c, events: ev2c } = reduce(s2b, { type: 'RESOLVE_CAST', unitId: 'player_1' }, deps)
assert(ev2c.some(e => e.type === 'DAMAGE_DEALT'), '發出 DAMAGE_DEALT event')
assert(s2c.units['wolf_1'].currentHP < wolfHPBefore, `野狼扣血（${wolfHPBefore} → ${s2c.units['wolf_1'].currentHP.toFixed(1)}）`)
assert(s2c.units['player_1'].pendingAction === undefined, 'pendingAction 清空')

// ─── Test 3：怪物死亡 + 掉落 + clear_all ─────────────────────────────────────

console.log('\n【Test 3】怪物死亡 + 掉落金幣 + FLOOR_CLEARED')

// 把野狼血量設為 1，一擊必殺
let s3 = makeTestGameState()
s3 = {
  ...s3,
  units: {
    ...s3.units,
    player_1: { ...s3.units['player_1'], pos: { x: 2, y: 3 }, facing: 'up' },
    wolf_1:   { ...s3.units['wolf_1'],   pos: { x: 2, y: 2 }, currentHP: 1 },
    wolf_2:   { ...s3.units['wolf_2'],   pos: { x: 2, y: 4 }, currentHP: 1 },  // 也在攻擊範圍（frontal_sweep）
  },
}
s3 = giveAction(s3, 'player_1')

// 戰士使用鐵劍（frontal_sweep 覆蓋前方 3 格：(1,2)(2,2)(3,2) + (1,3)(3,3)
// 野狼 wolf_1 在 (2,2) 正前方，wolf_2 在 (2,4) 正後方，frontal_sweep 打不到 wolf_2
const { state: s3a } = reduce(
  s3,
  { type: 'QUEUE_WEAPON', unitId: 'player_1', weaponSlot: 0, targetPos: { x: 2, y: 2 } },
  deps
)
const s3b = finishCast(s3a, 'player_1')
const { state: s3c, events: ev3 } = reduce(s3b, { type: 'RESOLVE_CAST', unitId: 'player_1' }, deps)

assert(s3c.units['wolf_1'].isDead === true, 'wolf_1 死亡（isDead = true）')
assert(ev3.some(e => e.type === 'UNIT_DIED'), '發出 UNIT_DIED event')
assert(ev3.some(e => e.type === 'LOOT_DROPPED'), '發出 LOOT_DROPPED event（金幣）')
assert(s3c.floor.loot.length > 0, '地圖上有掉落物')

// wolf_2 仍活著，尚未清層
assert(!ev3.some(e => e.type === 'FLOOR_CLEARED'), 'wolf_2 還活著，尚未 FLOOR_CLEARED')

// 殺掉 wolf_2
let s3d = { ...s3c, units: { ...s3c.units, wolf_2: { ...s3c.units['wolf_2'], currentHP: 1 } } }
s3d = giveAction(s3d, 'player_1')
const { state: s3e } = reduce(
  s3d,
  { type: 'QUEUE_WEAPON', unitId: 'player_1', weaponSlot: 0, targetPos: { x: 2, y: 4 } },
  deps
)
const s3f = finishCast(s3e, 'player_1')
const { events: ev3f } = reduce(s3f, { type: 'RESOLVE_CAST', unitId: 'player_1' }, deps)
assert(ev3f.some(e => e.type === 'FLOOR_CLEARED'), '全部怪物消滅 → FLOOR_CLEARED')

// ─── Test 4：怪物 AI — chase 追擊與攻擊 ─────────────────────────────────────

console.log('\n【Test 4】怪物 AI — chase 追擊 + 攻擊')

let s4 = makeTestGameState()
// 玩家在 (1,6)，wolf_1 在 (6,6)（距離 5，超出 wolf 攻擊範圍 1），wolf 應移動靠近
s4 = {
  ...s4,
  units: {
    ...s4.units,
    player_1: { ...s4.units['player_1'], pos: { x: 1, y: 6 } },
    wolf_1:   { ...s4.units['wolf_1'],   pos: { x: 6, y: 6 } },
    wolf_2:   { ...s4.units['wolf_2'],   pos: { x: 6, y: 1 } },  // 遠離玩家
  },
}
s4 = giveAction(s4, 'wolf_1')
const wolfAction = decideTurn(s4, 'wolf_1')
assert(wolfAction.type === 'MOVE', `wolf_1 選擇移動靠近玩家（action: ${wolfAction.type}）`)

const { state: s4a, events: ev4a } = reduce(s4, wolfAction, deps)
assert(ev4a.some(e => e.type === 'UNIT_MOVED'), 'wolf_1 移動了')
const wolfNewPos = s4a.units['wolf_1'].pos
const distAfter = Math.abs(wolfNewPos.x - 1) + Math.abs(wolfNewPos.y - 6)
const distBefore = Math.abs(6 - 1) + Math.abs(6 - 6)
assert(distAfter < distBefore, `wolf_1 靠近了玩家（距離 ${distBefore} → ${distAfter}）`)

// wolf 進入攻擊範圍後應使用武器
let s4b = { ...s4, units: { ...s4.units, wolf_1: { ...s4.units['wolf_1'], pos: { x: 2, y: 6 } } } }
s4b = giveAction(s4b, 'wolf_1')
const wolfAction2 = decideTurn(s4b, 'wolf_1')
assert(wolfAction2.type === 'QUEUE_WEAPON', `wolf_1 進入攻擊範圍後使用武器（action: ${wolfAction2.type}）`)

// ─── Test 5：guard AI — 超出感知範圍不移動 ───────────────────────────────────

console.log('\n【Test 5】guard AI — 超出感知範圍原地待機')

let s5 = makeTestGameState()
s5 = {
  ...s5,
  units: {
    ...s5.units,
    player_1: { ...s5.units['player_1'], pos: { x: 1, y: 1 } },
    wolf_1: {
      ...s5.units['wolf_1'],
      pos: { x: 6, y: 6 },
      ai: 'guard' as const,
    },
  },
}
s5 = giveAction(s5, 'wolf_1')
const guardAction = decideTurn(s5, 'wolf_1')
assert(guardAction.type === 'END_TURN', `guard AI 超出感知範圍(${5})，選擇待機（action: ${guardAction.type}）`)

// 玩家進入感知範圍（距離 4 ≤ 5）
s5 = {
  ...s5,
  units: {
    ...s5.units,
    player_1: { ...s5.units['player_1'], pos: { x: 3, y: 4 } },
  },
}
s5 = giveAction(s5, 'wolf_1')
const guardAction2 = decideTurn(s5, 'wolf_1')
assert(guardAction2.type !== 'END_TURN', `guard AI 感知到玩家，開始追擊（action: ${guardAction2.type}）`)

// ─── Test 6：reach_exit 任務 ──────────────────────────────────────────────────

console.log('\n【Test 6】reach_exit 任務 — 到達出口')

const exitPos = { x: 6, y: 1 }
let s6 = makeTestGameState()
s6 = {
  ...s6,
  floor: {
    ...s6.floor,
    objective: { type: 'reach_exit', exitPos },
  },
  units: {
    ...s6.units,
    player_1: { ...s6.units['player_1'], pos: { x: 5, y: 1 } },  // 出口旁邊
  },
}
s6 = giveAction(s6, 'player_1')

const { state: s6a, events: ev6 } = reduce(s6, { type: 'MOVE', unitId: 'player_1', to: exitPos }, deps)
assert(s6a.units['player_1'].pos.x === exitPos.x, '玩家到達出口')
assert(ev6.some(e => e.type === 'FLOOR_CLEARED'), 'reach_exit → FLOOR_CLEARED')

// ─── Test 7：ATB 完整推進一輪 ─────────────────────────────────────────────────

console.log('\n【Test 7】ATB 完整推進一輪')

let s7 = makeTestGameState()

// 推進到第一個單位獲得行動權
const { newState: s7a, events: atbEv } = advanceTime(s7)
assert(s7a.timeline.pendingUnitId !== null, 'ATB 推進後有單位獲得行動權')
assert(atbEv.some(e => e.type === 'ATB_READY'), 'ATB_READY event 發出')

// 該單位執行 AI 決策並行動
const actingId = s7a.timeline.pendingUnitId!
const actingUnit = s7a.units[actingId]!

if (actingUnit.kind === 'monster') {
  const action = decideTurn(s7a, actingId)
  const { state: s7b } = reduce(s7a, action, deps)
  assert(s7b.timeline.pendingUnitId === null || actingId !== s7b.timeline.pendingUnitId, '怪物行動後 ATB 消耗')
  console.log(`    怪物 ${actingId} 執行 ${action.type}`)
}

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
