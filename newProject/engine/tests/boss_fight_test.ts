/**
 * boss_fight_test.ts — 森林守護者 Boss 戰整合測試
 *
 * 驗證 Boss 房完整流程（從 spawnMonster 到 FLOOR_CLEARED）：
 *   1. Boss 生成 — 正確屬性（floorNumber=10 縮放）、ai='boss'、技能池初始化
 *   2. 正常通關 — 玩家擊殺 Boss → kill_boss 目標 → FLOOR_CLEARED
 *   3. 暴怒觸發 — Boss HP < 50% 時 PASSIVE_TRIGGERED（enter_phase: enrage）
 *   4. 時間回血 — on_time 被動每 2000ms 回 8 HP（需 PassiveRegistry）
 *   5. Boss 擊殺玩家 — 玩家 HP=1 vs 強化 Boss → FLOOR_FAILED
 *   6. 可重現性 — 相同 rng seed 相同 Boss 屬性
 *   7. Boss arena 格局 — spawnPoints 格式正確解析（整合 dungeon.ts）
 */

import type { GameState, Unit, ResolvedWeapon } from '../state'
import type { Action } from '../actions'
import type { MonsterDef, SpawnerDef } from '../spawner'
import type { PassiveRegistry } from '../passive'
import { spawnMonster } from '../spawner'
import { reduce, checkObjective } from '../reduce'
import { advanceTime } from '../atb'
import { decideTurn } from '../ai'
import { createGameState, createRun } from '../game'
import { createPlayerUnit } from '../player'
import { createFloor } from '../dungeon'
import { checkPassiveTriggers } from '../passive'
import { WARRIOR_CERT, makeWarrior } from './fixtures'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(condition: boolean, label: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else           { console.error(`  ❌ ${label}`); failed++ }
}

function makeLCG(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const deps = { allAffixDefs: {} }

// ─── 守護者 Def（對應 data/monsters/forest/forest_guardian.json）──────────────

const GUARDIAN_DEF: MonsterDef = {
  id: 'forest_guardian',
  name: '森林守護者',
  theme: 'forest',
  tier: 'boss',
  archetype: 'balanced',
  ai: 'boss',
  stats: {
    str: { base: 25, floorScale: 1.5 },
    agi: { base: 20, floorScale: 1.2 },
    int: { base: 10, floorScale: 0.6 },
    lck: { base: 10, floorScale: 0.6 },
  },
  resources: {
    hp: { base: 180, strMult: 2.5 },
    sp: { base: 60,  agiMult: 2 },
    mp: { base: 15,  intMult: 0.5 },
  },
  moveRange: 4,
  speed: 15,
  weapon: {
    id: 'guardian_claws',
    name: '守護者巨爪',
    actionId: 'single_melee',   // 測試中用 single_melee 確保打擊確定性
    hitMode: { type: 'instant' },
    statScaling: 'STR',
    atkBase: 0.55,
    actionTags: ['物理', '即發'],
    slot1: 'slash',
    castTimeBase: 600,
    recoveryTimeBase: 400,
  },
  passiveAbilities: [
    {
      trigger: 'on_time',
      interval: 2000,
      effect: { type: 'recover_hp', amount: 8 },
    },
    {
      trigger: 'on_below_hp',
      threshold: 0.5,
      once: true,
      effect: {
        type: 'enter_phase',
        phase: 'enrage',
        speedBonus: 4,
        atkMult: 1.4,
        visualFx: 'rage_aura',
      },
    },
  ],
}

const GUARDIAN_SPAWNER: SpawnerDef = {
  monsterId: 'forest_guardian',
  boss: {
    statScaleMult: 1.0,
    qualityMult: 1.5,
    hpMult: 1.0,
    speedBonus: 0,
    weapon: {
      affixCountTable: [{ count: 0, weight: 100 }],  // 測試簡化：不加詞條
      affixRarityTable: [{ rarity: 'common', weight: 100 }],
    },
    skillPool: [{ id: 'pack_call' }, { id: 'howl_aoe_slow' }, { id: 'guardian_charge' }],
  },
}

/** 建立 Boss Unit（floor=10）*/
function makeGuardian(pos = { x: 8, y: 2 }, id = 'boss_guardian'): Unit {
  return spawnMonster({
    monsterDef: GUARDIAN_DEF,
    spawnerDef: GUARDIAN_SPAWNER,
    tier: 'boss',
    pos,
    floorNumber: 10,
    rng: makeLCG(42),
    unitId: id,
  })
}

// ─── 職業定義（戰士，帶強化版本用於通關）────────────────────────────────────

const WARRIOR_JOB_DEF = {
  id: 'warrior', name: '戰士', tier: 'basic' as const,
  tags: ['近戰', '戰士'], allowedArmorTypes: ['重甲'],
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

/** 基礎武器：零費用、instant hit，確保不卡 SP */
const INSTANT_SWORD: ResolvedWeapon = {
  idHash: 'test_sword',
  baseId: 'test_sword',
  name: '測試劍',
  actionId: 'single_melee',
  hitMode: { type: 'instant' },
  actionTags: ['物理', '即發'],
  statScaling: 'STR',
  atkFinal: 2.0,       // 高倍率確保能擊殺 Boss
  spCostFinal: 0,
  mpCostFinal: 0,
  castTimeFinal: 200,
  recoveryTimeFinal: 100,
  cooldownMs: 0,
  element: 'slash',
  attackMode: 'mode_slash',
  enchant: null,
  appliedAffixIds: [],
}

function makeHeroWarrior(id = 'hero_1', pos = { x: 4, y: 13 }): Unit {
  return {
    ...createPlayerUnit({ id, jobCertDef: WARRIOR_JOB_DEF, jobCertInstance: WARRIOR_CERT, pos }),
    weapons: [INSTANT_SWORD, null, null],
    weaponCooldownUntil: [0, 0, 0],
    speed: 12,
    defenses: {},
  }
}

// ─── 地圖：簡化 16×16 Boss 競技場 ────────────────────────────────────────────

function makeBossFloor(bossId: string): GameState['floor'] {
  const W = 16, H = 16
  const cells = Array.from({ length: H }, (_, y) =>
    Array.from({ length: W }, (_, x) => ({
      type: (x === 0 || x === W - 1 || y === 0 || y === H - 1 ? 'wall' : 'floor') as 'wall' | 'floor',
      height: 1,
      passable: !(x === 0 || x === W - 1 || y === 0 || y === H - 1),
      blockLineOfSight: (x === 0 || x === W - 1 || y === 0 || y === H - 1),
      terrain: 'normal' as const,
    }))
  )
  return {
    width: W, height: H,
    cells,
    seed: 'boss_test',
    floorNumber: 10,
    pathType: 'safe',
    theme: 'forest',
    objective: { type: 'kill_boss', bossId },
    hazards: {},
    projectiles: [],
    loot: [],
  }
}

function initTimeline(units: Record<string, Unit>) {
  return {
    tick: 0,
    pendingUnitId: null as string | null,
    entries: Object.values(units).map(u => ({
      unitId: u.id, atb: 0, castRemaining: 0, recoveryRemaining: 0,
    })),
  }
}

function makeBossState(hero: Unit, boss: Unit): GameState {
  const units = { [hero.id]: hero, [boss.id]: boss }
  return {
    floor: makeBossFloor(boss.id),
    units,
    timeline: initTimeline(units),
    turnFlags: { actingUnitId: null },
    run: createRun({ floorNumber: 10 }),
  }
}

// ─── 遊戲循環（含被動系統）──────────────────────────────────────────────────

type RunOutcome = {
  outcome: 'cleared' | 'failed' | 'timeout'
  events: import('../events').Event[]
  finalState: GameState
  steps: number
}

function runBossFight(
  initialState: GameState,
  playerBot: (state: GameState, unitId: string) => Action,
  passiveRegistry: PassiveRegistry = {},
  maxSteps = 2000
): RunOutcome {
  let state = initialState
  const allEvents: import('../events').Event[] = []

  for (let step = 0; step < maxSteps; step++) {
    // 1. 推進時間
    const { newState, events: atbEvents } = advanceTime(state)
    state = newState
    allEvents.push(...atbEvents)

    // 2. 結算讀條完成的單位
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
          state = { ...state, timeline: { ...state.timeline, pendingUnitId: null } }
        } else if (!unit.pendingAction) {
          const action = unit.kind === 'player'
            ? playerBot(state, pendingId)
            : decideTurn(state, pendingId)
          const r = reduce(state, action, deps)
          state = r.state
          allEvents.push(...r.events)

          // 行動後檢查被動
          const monsterId = unit.monsterId
          if (monsterId && passiveRegistry[monsterId]) {
            const pr = checkPassiveTriggers(state, pendingId, passiveRegistry[monsterId]!, state.timeline.tick)
            state = pr.state
            allEvents.push(...pr.events)
          }
        }
      }
    }

    // 4. 勝負判定
    if (allEvents.some(e => e.type === 'FLOOR_CLEARED')) {
      return { outcome: 'cleared', events: allEvents, finalState: state, steps: step }
    }
    if (allEvents.some(e => e.type === 'FLOOR_FAILED')) {
      return { outcome: 'failed', events: allEvents, finalState: state, steps: step }
    }
  }

  return { outcome: 'timeout', events: allEvents, finalState: state, steps: maxSteps }
}

/** 玩家 AI：直接衝向目標攻擊 */
function aggressiveBot(state: GameState, unitId: string): Action {
  const unit = state.units[unitId]!
  const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

  const enemies = Object.values(state.units).filter(u => u.kind === 'monster' && !u.isDead)
  if (enemies.length === 0) return { type: 'END_TURN', unitId }

  const closest = enemies.sort((a, b) => chebyshev(unit.pos, a.pos) - chebyshev(unit.pos, b.pos))[0]!

  if (chebyshev(unit.pos, closest.pos) === 1 && unit.weapons[0]) {
    return { type: 'QUEUE_WEAPON', unitId, weaponSlot: 0, targetPos: closest.pos }
  }

  // 往目標移動一格（8-directional）
  const dx = Math.sign(closest.pos.x - unit.pos.x)
  const dy = Math.sign(closest.pos.y - unit.pos.y)
  const nx = unit.pos.x + dx
  const ny = unit.pos.y + dy
  // 邊界安全
  const targetX = Math.max(1, Math.min(14, nx))
  const targetY = Math.max(1, Math.min(14, ny))
  return { type: 'MOVE', unitId, to: { x: targetX, y: targetY } }
}

// ─── Test 1：Boss 生成 ────────────────────────────────────────────────────────

console.log('\n【Test 1】Boss 生成 — floor=10 屬性正確')

const boss = makeGuardian()

// str = round(25 + 10 × 1.5 × 1.0) = round(40) = 40
const expectedStr = Math.round(25 + 10 * 1.5 * 1.0)
assert(boss.stats.str === expectedStr, `str = ${expectedStr}（got: ${boss.stats.str}）`)

// HP = round((180 + str×2.5) × 1.0)
const expectedHP = Math.round((180 + boss.stats.str * 2.5) * 1.0)
assert(boss.maxHP === expectedHP, `maxHP = ${expectedHP}（got: ${boss.maxHP}）`)
assert(boss.currentHP === boss.maxHP, 'currentHP = maxHP（滿血）')

assert(boss.ai === 'boss', 'ai = boss')
assert(boss.kind === 'monster', 'kind = monster')
assert(boss.monsterId === 'forest_guardian', 'monsterId = forest_guardian')
assert(boss.speed === 15, `speed = 15（got: ${boss.speed}）`)  // speedBonus=0 in test spawner

// 技能冷卻表初始化
assert('pack_call' in (boss.skillCooldownUntil ?? {}),      'skillCooldownUntil 含 pack_call')
assert('howl_aoe_slow' in (boss.skillCooldownUntil ?? {}),  'skillCooldownUntil 含 howl_aoe_slow')
assert('guardian_charge' in (boss.skillCooldownUntil ?? {}), 'skillCooldownUntil 含 guardian_charge')
assert((boss.skillCooldownUntil ?? {})['pack_call'] === 0,  'pack_call 初始 cooldown = 0')

// spRecoveryFlat = 0（怪物不自動回 SP）
assert(boss.spRecoveryFlat === 0, 'monster spRecoveryFlat = 0')

// ─── Test 2：正常通關 — 擊殺 Boss → FLOOR_CLEARED ────────────────────────────

console.log('\n【Test 2】通關 — 擊殺 Boss → kill_boss → FLOOR_CLEARED')

const hero = makeHeroWarrior('hero_1', { x: 4, y: 13 })
const weakBoss = { ...makeGuardian({ x: 5, y: 13 }, 'boss_weak'), currentHP: 1, maxHP: 1 }

const s2 = makeBossState(hero, weakBoss)
const r2 = runBossFight(s2, aggressiveBot)

assert(r2.outcome === 'cleared', `通關結果 = cleared（got: ${r2.outcome}）`)
assert(r2.events.some(e => e.type === 'FLOOR_CLEARED'), 'events 含 FLOOR_CLEARED')
assert(r2.finalState.units['boss_weak']?.isDead === true, 'Boss isDead = true')

// ─── Test 3：暴怒觸發 — HP < 50% → PASSIVE_TRIGGERED ────────────────────────

console.log('\n【Test 3】暴怒觸發 — Boss HP < 50% 時 on_below_hp 觸發')

const guardianWithPassive = makeGuardian({ x: 5, y: 13 }, 'boss_enrage')
// 手動設定 HP 剛好跌破 50%（比閾值低一點）
const hp50Below = Math.floor(guardianWithPassive.maxHP * 0.49)
const bossBelowHalf = { ...guardianWithPassive, currentHP: hp50Below }

const heroVsEnrage = makeHeroWarrior('hero_2', { x: 4, y: 13 })

// 直接呼叫 checkPassiveTriggers 驗證觸發
const passiveDefs = GUARDIAN_DEF.passiveAbilities!
const passiveResult = checkPassiveTriggers(
  { ...makeBossState(heroVsEnrage, bossBelowHalf), units: { hero_2: heroVsEnrage, boss_enrage: bossBelowHalf } },
  'boss_enrage',
  passiveDefs,
  0  // tick=0
)

assert(
  passiveResult.events.some(e => e.type === 'PASSIVE_TRIGGERED'),
  'HP < 50% → PASSIVE_TRIGGERED 發出'
)
assert(
  passiveResult.state.units['boss_enrage']?.triggeredPassiveIds?.some(id => id.includes('passive_1')) === true,
  'on_below_hp 已記入 triggeredPassiveIds'
)
// 不應再次觸發（once=true）
const passiveResult2 = checkPassiveTriggers(
  passiveResult.state,
  'boss_enrage',
  passiveDefs,
  100
)
const newEvents2 = passiveResult2.events.filter(e => e.type === 'PASSIVE_TRIGGERED')
assert(newEvents2.length === 0, '二次呼叫不再觸發（once = true 保護）')

// ─── Test 4：on_time 回血 — 2000ms 後觸發回血 ────────────────────────────────

console.log('\n【Test 4】on_time 回血 — 每 2000ms +8 HP')

const bossForHeal = { ...makeGuardian({ x: 8, y: 2 }, 'boss_heal'), currentHP: 100 }
const heroForHeal = makeHeroWarrior('hero_3', { x: 4, y: 13 })
const stateForHeal = { ...makeBossState(heroForHeal, bossForHeal), units: { hero_3: heroForHeal, boss_heal: bossForHeal } }

// tick=0：初始化 nextTriggerAt（不觸發）
const pr0 = checkPassiveTriggers(stateForHeal, 'boss_heal', GUARDIAN_DEF.passiveAbilities!, 0)
assert(!pr0.events.some(e => e.type === 'HEAL'), 'tick=0：on_time 尚未觸發（初始化 nextTriggerAt）')

// tick=2000：觸發
const pr2000 = checkPassiveTriggers(pr0.state, 'boss_heal', GUARDIAN_DEF.passiveAbilities!, 2000)
const healEvent = pr2000.events.find(e => e.type === 'HEAL') as { amount?: number } | undefined
assert(!!healEvent, 'tick=2000：HEAL 事件發出')
assert(healEvent?.amount === 8, `heal amount = 8（got: ${healEvent?.amount}）`)
const healedHP = pr2000.state.units['boss_heal']?.currentHP ?? 0
assert(healedHP === 108, `HP 100 → 108（got: ${healedHP}）`)

// ─── Test 5：玩家被擊殺 → FLOOR_FAILED ───────────────────────────────────────

console.log('\n【Test 5】Boss 擊殺玩家 → FLOOR_FAILED')

// 玩家 HP=1，Boss 強化攻擊確保必殺
const tinyHero: Unit = { ...makeHeroWarrior('hero_dead', { x: 5, y: 13 }), currentHP: 1, maxHP: 1 }
const strongBoss = makeGuardian({ x: 5, y: 12 }, 'boss_killer')

const s5 = makeBossState(tinyHero, strongBoss)
const r5 = runBossFight(s5, (_state, unitId) => ({ type: 'END_TURN', unitId }))

assert(r5.outcome === 'failed', `defeat 結果 = failed（got: ${r5.outcome}）`)
assert(r5.events.some(e => e.type === 'FLOOR_FAILED'), 'events 含 FLOOR_FAILED')
assert(r5.finalState.units['hero_dead']?.isDead === true, '玩家 isDead = true')

// ─── Test 6：可重現性 — 相同 seed 同屬性 ─────────────────────────────────────

console.log('\n【Test 6】可重現性 — 相同 seed 生成相同 Boss')

const bossA = spawnMonster({
  monsterDef: GUARDIAN_DEF, spawnerDef: GUARDIAN_SPAWNER,
  tier: 'boss', pos: { x: 8, y: 2 }, floorNumber: 10, rng: makeLCG(12345), unitId: 'g_a',
})
const bossB = spawnMonster({
  monsterDef: GUARDIAN_DEF, spawnerDef: GUARDIAN_SPAWNER,
  tier: 'boss', pos: { x: 8, y: 2 }, floorNumber: 10, rng: makeLCG(12345), unitId: 'g_b',
})

assert(bossA.stats.str === bossB.stats.str, '相同 seed → 相同 str')
assert(bossA.maxHP === bossB.maxHP,         '相同 seed → 相同 maxHP')
assert(
  JSON.stringify(bossA.weapons[0]?.appliedAffixIds) === JSON.stringify(bossB.weapons[0]?.appliedAffixIds),
  '相同 seed → 相同武器詞條'
)

// ─── Test 7：dungeon.ts Boss 競技場格式 ──────────────────────────────────────

console.log('\n【Test 7】dungeon.ts Boss 競技場整合 — spawnPoints + kill_boss 目標')

import type { RoomDef, DungeonFloorConfig, MonsterRegistry } from '../dungeon'

const ARENA_ROOM: RoomDef = {
  id: 'forest_guardian_arena',
  name: '守護者祭壇',
  bossId: 'forest_guardian',
  theme: 'forest',
  width: 16, height: 16,
  grid: [
    '################',
    '#TTTT......TTTT#',
    '#TTTT......TTTT#',
    '#TT..........TT#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#TT..........TT#',
    '#TTTT......TTTT#',
    '#TTTT......TTTT#',
    '#U............U#',
    '################',
  ],
  spawnPoints: {
    boss: { x: 8, y: 2 },
    players: [{ x: 2, y: 14 }, { x: 3, y: 14 }, { x: 12, y: 14 }, { x: 13, y: 14 }],
    reinforcementZones: [
      [{ x: 1, y: 5 }, { x: 2, y: 5 }],
      [{ x: 13, y: 5 }, { x: 14, y: 5 }],
    ],
  },
}

const BOSS_FLOOR_CONFIG: DungeonFloorConfig = {
  encounters: [
    { zoneId: 'boss_spawn', spawnerId: 'forest_guardian', tier: 'boss', count: 1 },
  ],
  isBossRoom: true,
}

const MONSTER_REGISTRY: MonsterRegistry = {
  forest_guardian: { def: GUARDIAN_DEF, spawner: GUARDIAN_SPAWNER },
}

const r7 = createFloor({
  roomDef: ARENA_ROOM,
  floorConfig: BOSS_FLOOR_CONFIG,
  monsterRegistry: MONSTER_REGISTRY,
  theme: 'forest',
  floorNumber: 10,
  seed: 'boss_arena_test',
  pathType: 'safe',
  rng: makeLCG(777),
})

const bossUnits = Object.values(r7.units)
assert(bossUnits.length === 1,                              '競技場生成 1 個 Boss 單位')
assert(bossUnits[0]!.ai === 'boss',                         'Boss ai = boss')
assert(bossUnits[0]!.pos.x === 8 && bossUnits[0]!.pos.y === 2, 'Boss 在 spawnPoints.boss 位置 (8,2)')
assert(r7.floor.objective.type === 'kill_boss',             'objective = kill_boss')
assert(r7.playerEntryPositions.length === 4,                '玩家入場格 = 4')
assert(r7.playerEntryPositions.some(p => p.x === 2 && p.y === 14), '玩家入場格含 (2,14)')
// 競技場無出口格（exitPos 為佔位 0,0）
// T 字元在 arena 中是 forest terrain（擋視線）
assert(r7.floor.cells[1]![1]!.terrain === 'forest',         'arena 角落 T → forest terrain')
assert(r7.floor.cells[1]![1]!.blockLineOfSight === true,    'arena forest 擋視線')

// ─── 結果 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`)
console.log(`結果：${passed} 通過 / ${failed} 失敗`)
if (failed > 0) process.exit(1)
