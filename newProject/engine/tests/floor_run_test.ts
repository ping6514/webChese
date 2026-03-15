/**
 * floor_run_test.ts — 單層完整冒險整合測試
 *
 * 驗證從 createGameState → 遊戲循環 → 勝負判定的完整流程：
 *   1. clear_all  — 消滅全部怪物 → FLOOR_CLEARED
 *   2. reach_exit — 玩家走到出口 → FLOOR_CLEARED
 *   3. survive    — 存活至 tick 門檻 → FLOOR_CLEARED
 *   4. kill_targets — 消滅特定目標 → FLOOR_CLEARED
 *   5. defeat     — 全員陣亡 → FLOOR_FAILED
 *
 * 遊戲循環設計：
 *   advanceTime → 若有 castRemaining=0 + pendingAction → RESOLVE_CAST
 *               → pendingUnitId 是怪物 → decideTurn
 *               → pendingUnitId 是玩家 → playerBot
 */

import type { GameState, Unit } from '../state'
import type { Action } from '../actions'
import { reduce, checkObjective } from '../reduce'
import { advanceTime } from '../atb'
import { decideTurn } from '../ai'
import { createGameState, createRun } from '../game'
import { createPlayerUnit } from '../player'
import { WARRIOR_CERT, IRON_SWORD_RESOLVED, makeWolf } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

const deps = { allAffixDefs: {} }

// ─── JobCertDef（warrior，使用 WARRIOR_CERT 固定數值）────────────────────────

const WARRIOR_DEF = {
  id: 'warrior', name: '戰士', tier: 'basic' as const,
  tags: ['近戰', '戰士', '重甲'], allowedArmorTypes: ['重甲'],
  stats: {
    str: { base: 20, randomBonus: { min: 0, max: 8 } },
    int: { base: 5,  randomBonus: { min: 0, max: 3 } },
    agi: { base: 10, randomBonus: { min: 0, max: 5 } },
    lck: { base: 8,  randomBonus: { min: 0, max: 4 } },
  },
  resources: {
    hp: { base: 80, strMult: 2 },
    sp: { base: 40, agiMult: 1 },
    mp: { base: 10, intMult: 0.5 },
  },
  moveRange: 3,
  spRecoveryFlat: 20,  // 每次行動後回復 20 SP
}

/**
 * 整合測試用短劍：single_melee（精確打目標格）+ 真實 SP 消耗
 * frontal_sweep 在對角目標時可能 miss（面向計算後掃弧方向偏移），
 * 整合測試只驗證循環流程，使用 single_melee 確保打擊確定性。
 * SP 消耗恢復為真實值（10），依賴 spRecoveryFlat 自然回復。
 */
const TEST_SWORD_RESOLVED: import('../state').ResolvedWeapon = {
  ...IRON_SWORD_RESOLVED,
  actionId: 'single_melee',
  name: '測試短劍',
  spCostFinal: 10,
}

/** 建立戰士玩家（使用 WARRIOR_CERT 固定屬性 + 測試短劍）*/
function makePlayerWarrior(id = 'p1', pos = { x: 1, y: 1 }): Unit {
  return {
    ...createPlayerUnit({
      id, jobCertDef: WARRIOR_DEF, jobCertInstance: WARRIOR_CERT, pos,
    }),
    weapons: [TEST_SWORD_RESOLVED, null, null],
    weaponCooldownUntil: [0, 0, 0],
    defenses: { slash: 3, crush: 3, pierce: 3 },
    speed: 12,
  }
}

/** 建立地板（8x8）*/
function makeFloor(objective: GameState['floor']['objective']): GameState['floor'] {
  return {
    width: 8, height: 8,
    cells: Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => ({
        type: (x === 0 || x === 7 || y === 0 || y === 7 ? 'wall' : 'floor') as 'wall' | 'floor',
        height: 1,
        passable: !(x === 0 || x === 7 || y === 0 || y === 7),
        blockLineOfSight: (x === 0 || x === 7 || y === 0 || y === 7),
        terrain: 'normal' as const,
      }))
    ),
    seed: 'test', floorNumber: 1, pathType: 'safe', theme: 'forest',
    objective, hazards: {}, projectiles: [], loot: [],
  }
}

/** 初始化 ATB entries */
function initTimeline(units: Record<string, Unit>) {
  return {
    tick: 0,
    pendingUnitId: null as string | null,
    entries: Object.values(units).map(u => ({
      unitId: u.id, atb: 0, castRemaining: 0, recoveryRemaining: 0,
    })),
  }
}

function makeState(
  objective: GameState['floor']['objective'],
  units: Record<string, Unit>
): GameState {
  return {
    floor: makeFloor(objective),
    units,
    timeline: initTimeline(units),
    turnFlags: { actingUnitId: null },
    run: createRun({ floorNumber: 1 }),
  }
}

// ─── 遊戲循環驅動器 ───────────────────────────────────────────────────────────

type RunOutcome = {
  outcome: 'cleared' | 'failed' | 'timeout'
  events: import('../events').Event[]
  finalState: GameState
  steps: number
}

/**
 * 驅動遊戲循環直到 FLOOR_CLEARED / FLOOR_FAILED，或達到 maxSteps。
 * playerBot：提供玩家 AI（預設簡單追殺 + 走到出口）。
 */
function runFloor(
  initialState: GameState,
  playerBot: (state: GameState, unitId: string) => Action,
  maxSteps = 800
): RunOutcome {
  let state = initialState
  const allEvents: import('../events').Event[] = []

  for (let step = 0; step < maxSteps; step++) {
    // 1. 推進時間
    const { newState, events: atbEvents } = advanceTime(state)
    state = newState
    allEvents.push(...atbEvents)

    // 2. 優先結算讀條完成的單位（castRemaining 剛歸零）
    for (const unit of Object.values(state.units)) {
      if (unit.isDead || !unit.pendingAction) continue
      const entry = state.timeline.entries.find(e => e.unitId === unit.id)
      if (!entry || entry.castRemaining > 0) continue

      const actionType = unit.pendingAction.kind === 'skill' ? 'RESOLVE_SKILL_CAST' : 'RESOLVE_CAST'
      const r = reduce(state, { type: actionType, unitId: unit.id }, deps)
      state = r.state
      allEvents.push(...r.events)
    }

    // 3. 處理 pendingUnitId 的行動
    const pendingId = state.timeline.pendingUnitId
    if (pendingId) {
      const unit = state.units[pendingId]
      if (!unit || unit.isDead) {
        state = { ...state, timeline: { ...state.timeline, pendingUnitId: null } }
      } else {
        const entry = state.timeline.entries.find(e => e.unitId === pendingId)!
        if (unit.pendingAction && entry.castRemaining > 0) {
          // 仍在讀條中，清除 pending 讓其他單位先行動
          state = { ...state, timeline: { ...state.timeline, pendingUnitId: null } }
        } else if (!unit.pendingAction) {
          // 正常出手
          const action = unit.kind === 'player'
            ? playerBot(state, pendingId)
            : decideTurn(state, pendingId)
          const r = reduce(state, action, deps)
          state = r.state
          allEvents.push(...r.events)
        }
        // 若有 pendingAction 但 castRemaining=0，第 2 步已處理
      }
    }

    // 4. 檢查勝負
    if (allEvents.some(e => e.type === 'FLOOR_CLEARED')) {
      return { outcome: 'cleared', events: allEvents, finalState: state, steps: step }
    }
    if (allEvents.some(e => e.type === 'FLOOR_FAILED')) {
      return { outcome: 'failed', events: allEvents, finalState: state, steps: step }
    }
  }

  return { outcome: 'timeout', events: allEvents, finalState: state, steps: maxSteps }
}

/** 簡單玩家 AI：追殺最近敵人，無敵時走向出口 */
function aggressiveBot(exitPos?: { x: number; y: number }) {
  return (state: GameState, unitId: string): Action => {
    const unit = state.units[unitId]!
    const monsters = Object.values(state.units).filter(u => u.kind === 'monster' && !u.isDead)

    // 無怪物 → 走向出口（reach_exit 目標用）
    if (monsters.length === 0 && exitPos) {
      const dx = Math.sign(exitPos.x - unit.pos.x)
      const dy = Math.sign(exitPos.y - unit.pos.y)
      const to = { x: unit.pos.x + dx, y: unit.pos.y + dy }
      return { type: 'MOVE', unitId, to }
    }
    if (monsters.length === 0) {
      return { type: 'END_TURN', unitId }
    }

    // 找最近敵人
    const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
    const closest = monsters.sort((a, b) => chebyshev(unit.pos, a.pos) - chebyshev(unit.pos, b.pos))[0]

    // 相鄰 → 攻擊
    if (chebyshev(unit.pos, closest.pos) === 1 && unit.weapons[0]) {
      return { type: 'QUEUE_WEAPON', unitId, weaponSlot: 0, targetPos: closest.pos }
    }

    // 移動接近
    const dx = Math.sign(closest.pos.x - unit.pos.x)
    const dy = Math.sign(closest.pos.y - unit.pos.y)
    const nx = unit.pos.x + (Math.abs(dx) >= Math.abs(dy) ? dx : 0)
    const ny = unit.pos.y + (Math.abs(dy) > Math.abs(dx) ? dy : 0)
    const to = { x: nx !== unit.pos.x || ny !== unit.pos.y ? nx : unit.pos.x + dx, y: ny }
    return { type: 'MOVE', unitId, to: { x: nx, y: ny } }
  }
}

// ─── Test 1：clear_all — 消滅全部怪物 ────────────────────────────────────────

console.log('\n【Test 1】clear_all — 消滅所有怪物 → FLOOR_CLEARED')

const wolf1 = makeWolf('wolf_1', { x: 3, y: 3 })
const wolf1Weak = { ...wolf1, currentHP: 1, maxHP: 1 }  // 一擊必殺
const wolf2Weak = { ...makeWolf('wolf_2', { x: 5, y: 3 }), currentHP: 1, maxHP: 1 }

const s1 = makeState(
  { type: 'clear_all' },
  {
    p1: makePlayerWarrior('p1', { x: 2, y: 3 }),
    wolf_1: wolf1Weak,
    wolf_2: wolf2Weak,
  }
)

const r1 = runFloor(s1, aggressiveBot())

assert(r1.outcome === 'cleared',                              'clear_all → FLOOR_CLEARED')
assert(r1.events.some(e => e.type === 'FLOOR_CLEARED'),       '事件中有 FLOOR_CLEARED')
assert(r1.events.some(e => e.type === 'UNIT_DIED'),           '有 UNIT_DIED 事件')
assert(!r1.finalState.units['wolf_1']?.isDead === false || r1.finalState.units['wolf_1']?.isDead, 'wolf_1 isDead')
assert(r1.steps < 800,                                        `在 ${r1.steps} 步內完成`)

// ─── Test 2：reach_exit — 玩家走到出口 ───────────────────────────────────────

console.log('\n【Test 2】reach_exit — 玩家走到出口 → FLOOR_CLEARED')

const exitPos = { x: 6, y: 6 }
const s2State: GameState = {
  ...makeState(
    { type: 'reach_exit', exitPos },
    { p1: makePlayerWarrior('p1', { x: 1, y: 1 }) }
  ),
  floor: {
    ...makeFloor({ type: 'reach_exit', exitPos }),
    cells: Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => ({
        type: (x === 0 || x === 7 || y === 0 || y === 7 ? 'wall' : 'floor') as 'wall' | 'floor',
        height: 1,
        passable: !(x === 0 || x === 7 || y === 0 || y === 7),
        blockLineOfSight: (x === 0 || x === 7 || y === 0 || y === 7),
        terrain: 'normal' as const,
      }))
    ),
  }
}

// Bot：直接往出口走
const exitBot = (state: GameState, unitId: string): Action => {
  const unit = state.units[unitId]!
  const dx = Math.sign(exitPos.x - unit.pos.x)
  const dy = Math.sign(exitPos.y - unit.pos.y)
  if (unit.pos.x === exitPos.x && unit.pos.y === exitPos.y) return { type: 'END_TURN', unitId }
  if (Math.abs(dx) >= Math.abs(dy)) return { type: 'MOVE', unitId, to: { x: unit.pos.x + dx, y: unit.pos.y } }
  return { type: 'MOVE', unitId, to: { x: unit.pos.x, y: unit.pos.y + dy } }
}

const r2 = runFloor(s2State, exitBot)

assert(r2.outcome === 'cleared',                        'reach_exit → FLOOR_CLEARED')
assert(r2.events.some(e => e.type === 'FLOOR_CLEARED'), '事件中有 FLOOR_CLEARED')
assert(r2.steps < 200,                                  `在 ${r2.steps} 步內抵達出口`)

// ─── Test 3：survive — 存活至 tick 門檻 ──────────────────────────────────────

console.log('\n【Test 3】survive — 存活至 tick 5000 → FLOOR_CLEARED')

// survive 由 ADVANCE_STATUS_EFFECTS 或其他推進觸發 checkObjective？
// 不，checkObjective 在 MOVE / RESOLVE_CAST / RESOLVE_SKILL_CAST 後觸發。
// 改用 END_TURN 連續推進 ATB 時間直到 tick >= 5000
const surviveDone = { type: 'survive' as const, untilTick: 5000 }
const s3 = makeState(surviveDone, { p1: makePlayerWarrior('p1', { x: 3, y: 3 }) })

// Bot：只做 END_TURN，讓時間流逝（survive 靠 tick 判斷）
// checkObjective 在每次 MOVE 後觸發 — 改讓 bot 不斷 MOVE 來觸發檢查
const surviveBot = (_state: GameState, unitId: string): Action => ({
  type: 'MOVE', unitId, to: { x: 3, y: 3 }  // 原地踏步（guard 會失敗，改 END_TURN）
})
const surviveBot2 = (state: GameState, unitId: string): Action => {
  const unit = state.units[unitId]!
  // 來回移動以觸發 checkObjective（同時讓 tick 推進）
  const toX = unit.pos.x === 3 ? 4 : 3
  return { type: 'MOVE', unitId, to: { x: toX, y: unit.pos.y } }
}

// survive 需要 tick 推進 + checkObjective 觸發
// 在 runFloor 內，每步 advanceTime 都會推進 tick
// 但 checkObjective 只在 MOVE/RESOLVE_CAST 後觸發，need ADVANCE_STATUS_EFFECTS or custom
// 最簡單：讓 survive 在 ADVANCE_HAZARDS 裡也觸發（但我們沒改）
// 所以改讓 bot 移動來觸發：玩家不斷來回移動讓 tick 累積 + checkObjective 執行

const r3 = runFloor(s3, surviveBot2, 2000)

assert(r3.outcome === 'cleared',                        `survive tick=${s3.run.dungeonQuality} → FLOOR_CLEARED`)
assert(r3.events.some(e => e.type === 'FLOOR_CLEARED'), '事件中有 FLOOR_CLEARED')
assert(r3.finalState.timeline.tick >= 5000,             `最終 tick=${r3.finalState.timeline.tick} ≥ 5000`)

// ─── Test 4：kill_targets — 消滅特定目標 ──────────────────────────────────────

console.log('\n【Test 4】kill_targets — 消滅 wolf_A，不管 wolf_B → FLOOR_CLEARED')

const wolfA = { ...makeWolf('wolf_A', { x: 3, y: 3 }), currentHP: 1, maxHP: 1 }
const wolfB = makeWolf('wolf_B', { x: 6, y: 1 })  // 遠角落，血量正常

const s4 = makeState(
  { type: 'kill_targets', targetIds: ['wolf_A'] },
  {
    p1: makePlayerWarrior('p1', { x: 2, y: 3 }),
    wolf_A: wolfA,
    wolf_B: wolfB,
  }
)

const r4 = runFloor(s4, aggressiveBot())

assert(r4.outcome === 'cleared',                        'kill_targets → FLOOR_CLEARED（消滅 wolf_A）')
assert(r4.finalState.units['wolf_A']?.isDead === true,  'wolf_A isDead')
assert(!r4.finalState.units['wolf_B']?.isDead,          'wolf_B 仍存活（不必消滅）')

// ─── Test 5：defeat — 全員陣亡 → FLOOR_FAILED ─────────────────────────────────

console.log('\n【Test 5】defeat — 玩家 1 HP 被秒殺 → FLOOR_FAILED')

const fragilePlayer: Unit = {
  ...makePlayerWarrior('p1', { x: 2, y: 3 }),
  currentHP: 1, maxHP: 1,
}
const strongWolf = makeWolf('wolf_strong', { x: 3, y: 3 })

const s5 = makeState(
  { type: 'clear_all' },
  { p1: fragilePlayer, wolf_strong: strongWolf }
)

// Bot：逃跑（最終還是被打死）
const fleeBot = (state: GameState, unitId: string): Action => {
  const unit = state.units[unitId]!
  return { type: 'MOVE', unitId, to: { x: Math.max(1, unit.pos.x - 1), y: unit.pos.y } }
}

const r5 = runFloor(s5, fleeBot)

assert(r5.outcome === 'failed',                         'defeat → FLOOR_FAILED')
assert(r5.events.some(e => e.type === 'FLOOR_FAILED'),  '事件中有 FLOOR_FAILED')
assert(r5.finalState.units['p1']?.isDead === true,      '玩家 isDead = true')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
