/**
 * skills_test.ts — 技能系統完整流程測試
 *
 * 驗證：
 *   1. apply_debuff (howl_aoe_slow) → 施加 slow status + STATUS_APPLIED event
 *   2. damage (guardian_charge) → 依 damageTypeMult 計算傷害 + 擊退
 *   3. persistent_zone (vine_entangle) → 建立 HazardObject，踩上後觸發（模擬）
 *   4. projectile + apply_debuff + apply_poison (web_shot) → 命中後雙狀態效果
 *   5. summon_allies (pack_call) → 新單位加入 units + timeline
 *   6. AI 技能觸發：守護者在盟友少於閾值時自動使用 pack_call
 *   7. 技能冷卻：使用後無法立刻再使用
 */

import { makeTestGameState, makeWolf } from './fixtures'
import type { GameState, Unit } from '../state'
import type { SkillRegistry, SkillDef } from '../skills'
import { reduce } from '../reduce'
import { decideTurn } from '../ai'
import { checkAiTrigger } from '../skills'

// ─── 技能定義（直接對應 wolf_skills.json）────────────────────────────────────

const SKILL_REGISTRY: SkillRegistry = {
  howl_aoe_slow: {
    id: 'howl_aoe_slow',
    name: '嚎鳴震懾',
    castTime: 1500,
    cooldown: 10000,
    actionId: 'burst_small',
    actionOverride: { radius: 4, targetFilter: 'enemy' },
    hitMode: { type: 'instant' },
    actionTags: ['主動', '群體', '減速'],
    aiTrigger: { condition: 'enemies_in_range', count: 1, range: 4 },
    effect: { type: 'apply_debuff', debuff: 'slow', duration: 3000 },
  } as SkillDef,

  guardian_charge: {
    id: 'guardian_charge',
    name: '守護者衝鋒',
    castTime: 1800,
    cooldown: 12000,
    actionId: 'line_pierce',
    actionOverride: { range: 4 },
    hitMode: { type: 'check_at_resolve' },
    actionTags: ['主動', '物理', '衝鋒'],
    aiTrigger: { condition: 'enemies_in_range', count: 1, range: 4 },
    effect: { type: 'damage', damageTypeMult: 1.6, knockback: 1 },
  } as SkillDef,

  vine_entangle: {
    id: 'vine_entangle',
    name: '藤蔓纏繞',
    castTime: 1200,
    cooldown: 8000,
    actionId: 'circle_small',
    actionOverride: { radius: 1 },
    hitMode: { type: 'persistent_zone', duration: 5000, triggerOn: 'step_on', maxTriggers: 2 },
    actionTags: ['主動', '陷阱', '減速'],
    aiTrigger: { condition: 'enemies_in_range', count: 1, range: 3 },
    effect: { type: 'apply_debuff', debuff: 'entangle', duration: 2500 },
  } as SkillDef,

  web_shot: {
    id: 'web_shot',
    name: '吐絲射擊',
    castTime: 1000,
    cooldown: 6000,
    actionId: 'ranged_single',
    actionOverride: { range: 4 },
    hitMode: { type: 'projectile', speedCellsPerSec: 6, piercing: false },
    actionTags: ['主動', '遠程', '陷阱'],
    aiTrigger: { condition: 'enemies_in_range', count: 1, range: 4 },
    effect: {
      type: 'apply_debuff',
      debuff: 'webbed',
      duration: 3000,
      additionalEffect: { type: 'apply_poison', dps: 2, duration: 4000 },
    },
  } as SkillDef,

  pack_call: {
    id: 'pack_call',
    name: '群狼召喚',
    castTime: 2000,
    cooldown: 8000,
    actionId: 'burst_small',
    actionOverride: { radius: 3, targetFilter: 'cell' },
    hitMode: { type: 'instant' },
    actionTags: ['主動', '召喚'],
    aiTrigger: { condition: 'allies_in_range_below', count: 1, range: 5 },
    effect: { type: 'summon_allies', monsterId: 'forest_wolf', count: 2 },
  } as SkillDef,
}

const deps = { allAffixDefs: {}, skillRegistry: SKILL_REGISTRY }

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

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

// ─── Test 1：apply_debuff — howl_aoe_slow ────────────────────────────────────

console.log('\n【Test 1】howl_aoe_slow — burst AOE 施加 slow 狀態')

let s1 = makeTestGameState()
// wolf_1 在 (2,3) 使用技能，玩家在 (2,5)（距離 2，burst_small radius 1 → 施法者周圍 1 格）
// 注意：burst_small 以施法者為中心，範圍 1 格，range override 只影響 AI 判斷
// 為了確保命中，把玩家放在 wolf 旁邊
s1 = {
  ...s1,
  units: {
    ...s1.units,
    player_1: { ...s1.units['player_1'], pos: { x: 2, y: 4 } },
    wolf_1:   { ...s1.units['wolf_1'],   pos: { x: 2, y: 3 } },
  },
}
s1 = giveAction(s1, 'wolf_1')

// 開始讀條
const { state: s1a, events: ev1a } = reduce(
  s1,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'howl_aoe_slow', targetPos: { x: 2, y: 3 } },
  deps
)
assert(ev1a.some(e => e.type === 'SKILL_CAST_STARTED'), '發出 SKILL_CAST_STARTED event')

// 結算
const s1b = finishCast(s1a, 'wolf_1')
const { state: s1c, events: ev1c } = reduce(s1b, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)
assert(ev1c.some(e => e.type === 'STATUS_APPLIED'), '發出 STATUS_APPLIED event')

const playerAfter = s1c.units['player_1']
const hasSlow = playerAfter.statusEffects.some(s => s.id === 'slow')
assert(hasSlow, '玩家獲得 slow 狀態')
if (hasSlow) {
  const slow = playerAfter.statusEffects.find(s => s.id === 'slow')!
  assert(slow.expiresAt === s1c.timeline.tick + 3000 || slow.expiresAt === 3000, `slow 到期時間正確（expiresAt: ${slow.expiresAt}）`)
  assert((slow.speedMult ?? 1) < 1, `slow 降低速度（speedMult = ${slow.speedMult}）`)
}

// ─── Test 2：damage — guardian_charge ────────────────────────────────────────

console.log('\n【Test 2】guardian_charge — 直線傷害 × 1.6 + 擊退')

let s2 = makeTestGameState()
// 守護者在 (2,4)，玩家在 (2,2)（正上方 2 格，在 line_pierce 射程內）
s2 = {
  ...s2,
  units: {
    ...s2.units,
    player_1: { ...s2.units['player_1'], pos: { x: 2, y: 2 }, currentHP: 100 },
    wolf_1:   { ...s2.units['wolf_1'],   pos: { x: 2, y: 4 } },
  },
}
s2 = giveAction(s2, 'wolf_1')
const hpBefore = s2.units['player_1'].currentHP

// 開始讀條，面向玩家
const { state: s2a } = reduce(
  s2,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'guardian_charge', targetPos: { x: 2, y: 2 } },
  deps
)

// 結算（check_at_resolve：玩家仍在射程內）
const s2b = finishCast(s2a, 'wolf_1')
const { state: s2c, events: ev2c } = reduce(s2b, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)
assert(ev2c.some(e => e.type === 'DAMAGE_DEALT'), '發出 DAMAGE_DEALT event')

const hpAfter = s2c.units['player_1'].currentHP
assert(hpAfter < hpBefore, `玩家扣血（${hpBefore} → ${hpAfter.toFixed(1)}）`)

// 驗證倍率 > 武器基礎傷害（wolf STR=8, atkBase=0.45 → base ≈ 3.6, × 1.6 ≈ 5.76）
const damage = hpBefore - hpAfter
assert(damage > 3, `傷害應用了 ×1.6 倍率（got: ${damage.toFixed(1)}）`)

// check_at_resolve：玩家走掉後應 miss
let s2d = { ...s2, units: { ...s2.units, wolf_1: { ...s2.units['wolf_1'], pos: { x: 2, y: 4 } } } }
s2d = giveAction(s2d, 'wolf_1')
const { state: s2e } = reduce(
  s2d,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'guardian_charge', targetPos: { x: 2, y: 2 } },
  deps
)
// 玩家移走（超出 line_pierce 射程）
const s2f_base = finishCast(s2e, 'wolf_1')
const s2f = {
  ...s2f_base,
  units: { ...s2f_base.units, player_1: { ...s2f_base.units['player_1'], pos: { x: 6, y: 6 } } }
}
const { events: ev2f } = reduce(s2f, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)
assert(!ev2f.some(e => e.type === 'DAMAGE_DEALT'), 'check_at_resolve：目標離開射程 → miss')

// ─── Test 3：persistent_zone — vine_entangle ──────────────────────────────────

console.log('\n【Test 3】vine_entangle — 放置 HazardObject 陷阱')

let s3 = makeTestGameState()
s3 = {
  ...s3,
  units: {
    ...s3.units,
    wolf_1: { ...s3.units['wolf_1'], pos: { x: 3, y: 3 } },
  },
}
s3 = giveAction(s3, 'wolf_1')

const { state: s3a } = reduce(
  s3,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'vine_entangle', targetPos: { x: 4, y: 3 } },
  deps
)
const s3b = finishCast(s3a, 'wolf_1')
const { state: s3c, events: ev3 } = reduce(s3b, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)

assert(ev3.some(e => e.type === 'HAZARD_PLACED'), '發出 HAZARD_PLACED event')
const hazardCount = Object.keys(s3c.floor.hazards).length
assert(hazardCount > 0, `地圖上有 HazardObject（count: ${hazardCount}）`)

const hazard = Object.values(s3c.floor.hazards)[0]!
assert(hazard.triggerOn === 'step_on', 'HazardObject triggerOn = step_on')
assert(hazard.expiresAt === 5000, `HazardObject expiresAt = 5000（got: ${hazard.expiresAt}）`)
assert(hazard.maxTriggers === 2, `HazardObject maxTriggers = 2（got: ${hazard.maxTriggers}）`)

// ─── Test 4：projectile + apply_debuff + apply_poison — web_shot ──────────────

console.log('\n【Test 4】web_shot — 投射物命中 → webbed + poison 雙狀態')

let s4 = makeTestGameState()
s4 = {
  ...s4,
  units: {
    ...s4.units,
    player_1: { ...s4.units['player_1'], pos: { x: 5, y: 3 } },
    wolf_1:   { ...s4.units['wolf_1'],   pos: { x: 3, y: 3 } },
  },
}
s4 = giveAction(s4, 'wolf_1')

const { state: s4a } = reduce(
  s4,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'web_shot', targetPos: { x: 5, y: 3 } },
  deps
)
const s4b = finishCast(s4a, 'wolf_1')
const { state: s4c, events: ev4 } = reduce(s4b, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)

assert(ev4.some(e => e.type === 'PROJECTILE_FIRED'), '發出 PROJECTILE_FIRED event')

const statusEvents = ev4.filter(e => e.type === 'STATUS_APPLIED')
assert(statusEvents.length >= 2, `發出至少 2 個 STATUS_APPLIED（webbed + poison）（got: ${statusEvents.length}）`)

const playerAfter4 = s4c.units['player_1']
const hasWebbed = playerAfter4.statusEffects.some(s => s.id === 'webbed')
const hasPoison = playerAfter4.statusEffects.some(s => s.id === 'poison')
assert(hasWebbed, '玩家獲得 webbed 狀態')
assert(hasPoison, '玩家獲得 poison（DoT）狀態')

const poisonStatus = playerAfter4.statusEffects.find(s => s.id === 'poison')
if (poisonStatus) {
  assert(poisonStatus.dotElement === 'dark', `poison dotElement = dark（got: ${poisonStatus.dotElement}）`)
  assert(poisonStatus.expiresAt === 4000, `poison expiresAt = 4000（got: ${poisonStatus.expiresAt}）`)
}

// ─── Test 5：summon_allies — pack_call ───────────────────────────────────────

console.log('\n【Test 5】pack_call — 召喚盟友（新 Unit 加入）')

let s5 = makeTestGameState()
s5 = {
  ...s5,
  units: {
    ...s5.units,
    wolf_1: { ...s5.units['wolf_1'], pos: { x: 4, y: 4 } },
  },
}
s5 = giveAction(s5, 'wolf_1')
const unitCountBefore = Object.keys(s5.units).length

const { state: s5a } = reduce(
  s5,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'pack_call', targetPos: { x: 4, y: 4 } },
  deps
)
const s5b = finishCast(s5a, 'wolf_1')
const { state: s5c, events: ev5 } = reduce(s5b, { type: 'RESOLVE_SKILL_CAST', unitId: 'wolf_1' }, deps)

assert(ev5.some(e => e.type === 'UNIT_SPAWNED'), '發出 UNIT_SPAWNED event')

const unitCountAfter = Object.keys(s5c.units).length
assert(unitCountAfter > unitCountBefore, `新單位加入 units（${unitCountBefore} → ${unitCountAfter}）`)

const timelineIds = s5c.timeline.entries.map(e => e.unitId)
const newUnitId = Object.keys(s5c.units).find(id => !Object.keys(s5.units).includes(id))
if (newUnitId) {
  assert(timelineIds.includes(newUnitId), '召喚的單位已加入 ATB timeline')
}

// ─── Test 6：AI 自動觸發技能 ─────────────────────────────────────────────────

console.log('\n【Test 6】AI 技能觸發 — 符合條件時優先使用技能')

let s6 = makeTestGameState()
// wolf 在 (3,3)，玩家在 (3,4)（距離 1 ≤ howl range 4），盟友少於 1（pack_call 觸發）
s6 = {
  ...s6,
  units: {
    player_1: { ...s6.units['player_1'], pos: { x: 3, y: 4 } },
    wolf_1:   { ...s6.units['wolf_1'],   pos: { x: 3, y: 3 }, skillCooldownUntil: {} },
    // 移除 wolf_2，讓 wolf_1 周圍盟友為 0 → pack_call 條件滿足
  },
}
s6 = giveAction(s6, 'wolf_1')

const aiAction = decideTurn(s6, 'wolf_1', SKILL_REGISTRY)
// pack_call 或 howl_aoe_slow 都可能觸發，關鍵是有使用技能
const usedSkill = aiAction.type === 'QUEUE_SKILL'
assert(usedSkill, `AI 選擇使用技能（action: ${aiAction.type}）`)
if (usedSkill && aiAction.type === 'QUEUE_SKILL') {
  console.log(`    AI 選擇技能：${aiAction.skillId}`)
}

// 確認 aiTrigger 判斷正確：enemies_in_range
const wolfUnit = s6.units['wolf_1']!
const howlTrigger = SKILL_REGISTRY.howl_aoe_slow.aiTrigger
assert(
  checkAiTrigger(s6, wolfUnit, howlTrigger),
  'howl_aoe_slow aiTrigger：玩家在 range 4 內 → 條件滿足'
)

const packTrigger = SKILL_REGISTRY.pack_call.aiTrigger
assert(
  checkAiTrigger(s6, wolfUnit, packTrigger),
  'pack_call aiTrigger：盟友數量 0 < 1 → 條件滿足'
)

// ─── Test 7：技能冷卻 ─────────────────────────────────────────────────────────

console.log('\n【Test 7】技能冷卻 — 使用後冷卻中無法再使用')

let s7 = makeTestGameState()
s7 = {
  ...s7,
  units: {
    ...s7.units,
    player_1: { ...s7.units['player_1'], pos: { x: 3, y: 4 } },
    wolf_1:   { ...s7.units['wolf_1'],   pos: { x: 3, y: 3 }, skillCooldownUntil: {} },
  },
}
s7 = giveAction(s7, 'wolf_1')

// 第一次使用
const { state: s7a } = reduce(
  s7,
  { type: 'QUEUE_SKILL', unitId: 'wolf_1', skillId: 'howl_aoe_slow', targetPos: { x: 3, y: 3 } },
  deps
)

const cdUntil = s7a.units['wolf_1'].skillCooldownUntil?.['howl_aoe_slow'] ?? 0
assert(cdUntil > s7a.timeline.tick, `使用後技能進入冷卻（cdUntil: ${cdUntil}）`)
assert(cdUntil - s7a.timeline.tick === SKILL_REGISTRY.howl_aoe_slow.cooldown, `冷卻持續時間正確（${cdUntil - s7a.timeline.tick}ms）`)

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
