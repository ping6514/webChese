/**
 * hazard_test.ts — ADVANCE_HAZARDS + step_on 觸發測試
 *
 * 驗證：
 *   1. 到期的 HazardObject 被移除並發出 HAZARD_EXPIRED
 *   2. step_on：玩家移動到危害物格 → HAZARD_TRIGGERED + 效果套用（entangle slow）
 *   3. step_on maxTriggers：達到上限後 HazardObject 自動移除
 *   4. interval：ADVANCE_HAZARDS 到達 nextTriggerAt → 觸發效果
 *   5. 未到期、無 interval 的 hazard → 不觸發
 */

import { reduce } from '../reduce'
import type { GameState, HazardObject, Unit } from '../state'
import type { SkillDef, SkillRegistry } from '../skills'
import { makeWarrior, makeWolf } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

// ─── 基礎 GameState 工廠 ──────────────────────────────────────────────────────

function makeMinimalState(overrides?: Partial<GameState>): GameState {
  const playerBase = makeWarrior('player_1')
  const player = { ...playerBase, pos: { x: 3, y: 3 } }
  const wolf   = makeWolf('wolf_1',     { x: 5, y: 3 })

  const base: GameState = {
    floor: {
      width: 10, height: 10,
      cells: Array.from({ length: 10 }, () =>
        Array.from({ length: 10 }, () => ({
          type: 'floor' as const,
          height: 1,
          passable: true,
          blockLineOfSight: false,
          terrain: 'normal' as const,
        }))
      ),
      seed: 'test',
      floorNumber: 1,
      pathType: 'safe',
      theme: 'forest',
      objective: { type: 'reach_exit', exitPos: { x: 9, y: 9 } },
      hazards: {},
      projectiles: [],
      loot: [],
    },
    units: { player_1: player, wolf_1: wolf },
    timeline: {
      tick: 1000,
      pendingUnitId: 'player_1',
      entries: [
        { unitId: 'player_1', atb: 100, castRemaining: 0, recoveryRemaining: 0 },
        { unitId: 'wolf_1',   atb: 50,  castRemaining: 0, recoveryRemaining: 0 },
      ],
    },
    turnFlags: { actingUnitId: null },
    run: {
      runSeed: 'test', difficulty: 1, theme: 'forest',
      floorNumber: 1, maxFloors: 10, pathHistory: [],
      trialFloorCount: 0, dungeonQuality: 1.0, lootQuality: 1.0,
      status: 'active',
    },
  }
  return { ...base, ...overrides }
}

function makeHazard(overrides: Partial<HazardObject> & { id: string }): HazardObject {
  return {
    ownerId: 'wolf_1',
    pos: { x: 4, y: 3 },
    expiresAt: 99999,
    triggerOn: 'step_on',
    triggersUsed: 0,
    effectId: 'vine_entangle',
    ...overrides,
  }
}

// vine_entangle debuff 技能（簡化版）
const VINE_ENTANGLE_SKILL: SkillDef = {
  id: 'vine_entangle',
  name: '藤蔓纏繞',
  castTime: 1200,
  cooldown: 8000,
  actionId: 'single_melee',
  hitMode: { type: 'persistent_zone', duration: 5000, triggerOn: 'step_on', maxTriggers: 2 },
  actionTags: ['陷阱'],
  effect: { type: 'apply_debuff', debuff: 'entangle', duration: 2500 },
}

const SKILL_REGISTRY: SkillRegistry = {
  vine_entangle: VINE_ENTANGLE_SKILL,
}

const DEPS = { allAffixDefs: {}, skillRegistry: SKILL_REGISTRY }

// ─── Test 1：到期移除 ─────────────────────────────────────────────────────────

console.log('\n【Test 1】到期 hazard → HAZARD_EXPIRED + 從 floor.hazards 移除')

const h1 = makeHazard({ id: 'h1', expiresAt: 500 })  // 500 < nowMs(1000)
const s1 = makeMinimalState()
s1.floor.hazards['h1'] = h1

const r1 = reduce(s1, { type: 'ADVANCE_HAZARDS', deltaMs: 100 }, DEPS)

assert(!r1.state.floor.hazards['h1'],                  'h1 從 floor.hazards 移除')
assert(r1.events.some(e => e.type === 'HAZARD_EXPIRED'), '發出 HAZARD_EXPIRED')

// ─── Test 2：step_on 觸發 → HAZARD_TRIGGERED + entangle 效果 ─────────────────

console.log('\n【Test 2】step_on — 玩家踩上危害物格 → HAZARD_TRIGGERED')

const h2 = makeHazard({ id: 'h2', pos: { x: 4, y: 3 }, maxTriggers: 3 })
const s2 = makeMinimalState()
s2.floor.hazards['h2'] = h2
// 玩家在 (3,3) → 移到 (4,3)，踩上 hazard
const r2 = reduce(s2, { type: 'MOVE', unitId: 'player_1', to: { x: 4, y: 3 } }, DEPS)

assert(r2.events.some(e => e.type === 'HAZARD_TRIGGERED'), 'HAZARD_TRIGGERED 發出')
// entangle → player 應有 statusEffect
const player2 = r2.state.units['player_1']!
assert(
  player2.statusEffects.some(se => se.id === 'entangle'),
  `player 獲得 entangle 狀態（got: [${player2.statusEffects.map(s => s.id).join(',')}]）`
)
// triggersUsed +1
assert(r2.state.floor.hazards['h2']?.triggersUsed === 1, 'triggersUsed = 1')

// ─── Test 3：step_on maxTriggers — 達到上限後移除 ─────────────────────────────

console.log('\n【Test 3】step_on maxTriggers=1 → 觸發後移除')

const h3 = makeHazard({ id: 'h3', pos: { x: 4, y: 3 }, maxTriggers: 1 })
const s3 = makeMinimalState()
s3.floor.hazards['h3'] = h3

const r3 = reduce(s3, { type: 'MOVE', unitId: 'player_1', to: { x: 4, y: 3 } }, DEPS)

assert(!r3.state.floor.hazards['h3'],                    'h3 達上限後移除')
assert(r3.events.some(e => e.type === 'HAZARD_EXPIRED'), '同時發出 HAZARD_EXPIRED')

// ─── Test 4：interval 觸發 ────────────────────────────────────────────────────

console.log('\n【Test 4】interval — ADVANCE_HAZARDS 到 nextTriggerAt → 觸發')

// wolf_1 在 (5,3)，hazard 在 (5,3)，triggerOn=interval，nextTriggerAt=800（< tick=1000）
const h4 = makeHazard({
  id: 'h4',
  pos: { x: 5, y: 3 },  // wolf_1 的位置
  ownerId: 'player_1',   // 讓玩家放置，wolf 是目標（不同 kind）
  triggerOn: 'interval',
  intervalMs: 1000,
  nextTriggerAt: 800,    // 800 < nowMs(1000) → 應觸發
})
const s4 = makeMinimalState()
s4.floor.hazards['h4'] = h4

const r4 = reduce(s4, { type: 'ADVANCE_HAZARDS', deltaMs: 100 }, DEPS)

assert(r4.events.some(e => e.type === 'HAZARD_TRIGGERED'), 'interval hazard 觸發')
// nextTriggerAt 更新為 1000 + 1000 = 2000
assert(r4.state.floor.hazards['h4']?.nextTriggerAt === 2000, `nextTriggerAt 更新為 2000（got: ${r4.state.floor.hazards['h4']?.nextTriggerAt}）`)

// ─── Test 5：未到期且 interval 未到 → 不觸發 ─────────────────────────────────

console.log('\n【Test 5】未到期 + nextTriggerAt 未到 → 靜止')

const h5 = makeHazard({
  id: 'h5',
  expiresAt: 99999,
  triggerOn: 'interval',
  intervalMs: 1000,
  nextTriggerAt: 5000,   // 5000 > nowMs(1000) → 不觸發
})
const s5 = makeMinimalState()
s5.floor.hazards['h5'] = h5

const r5 = reduce(s5, { type: 'ADVANCE_HAZARDS', deltaMs: 100 }, DEPS)

assert(r5.state.floor.hazards['h5'] !== undefined, 'h5 仍在 floor.hazards')
assert(!r5.events.some(e => e.type === 'HAZARD_TRIGGERED'), '未觸發')
assert(r5.state.floor.hazards['h5']?.triggersUsed === 0, 'triggersUsed = 0')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
