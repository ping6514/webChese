/**
 * fixtures.ts — 測試場景固定資料
 *
 * 提供：
 *   - makeTestFloor()   固定 seed 的 8×8 小地圖
 *   - makeWarrior()     戰士玩家（鐵劍，無詞條）
 *   - makeWolf()        普通野狼
 *   - makeTestGameState() 完整 GameState（戰士 + 2 隻野狼）
 */

import type {
  GameState, FloorState, Unit, Cell, ResolvedWeapon,
  TimelineState, ATBEntry, RunState, TurnFlags
} from '../state'
import type { JobCertInstance } from '../player'

// ─── 地圖 ─────────────────────────────────────────────────────────────────────

function makeCell(passable = true): Cell {
  return {
    type: 'floor',
    height: 1,
    passable,
    blockLineOfSight: !passable,
    terrain: 'normal',
  }
}

function makeWall(): Cell {
  return { type: 'wall', height: 1, passable: false, blockLineOfSight: true, terrain: 'normal' }
}

/**
 * 固定 8×8 地圖：
 *   ########
 *   #......#
 *   #......#
 *   #......#
 *   #......#
 *   #......#
 *   #......#
 *   ########
 */
export function makeTestFloor(): FloorState {
  const W = 8
  const H = 8
  const cells: Cell[][] = []
  for (let y = 0; y < H; y++) {
    cells[y] = []
    for (let x = 0; x < W; x++) {
      const isEdge = x === 0 || x === W - 1 || y === 0 || y === H - 1
      cells[y][x] = isEdge ? makeWall() : makeCell()
    }
  }
  return {
    width: W,
    height: H,
    cells,
    seed: 'TEST_SEED_001',
    floorNumber: 1,
    pathType: 'safe',
    theme: 'forest',
    objective: { type: 'clear_all' },
    hazards: {},
    projectiles: [],
    loot: [],
  }
}

// ─── 鐵劍（無詞條）────────────────────────────────────────────────────────────

export const IRON_SWORD_RESOLVED: ResolvedWeapon = {
  idHash: 'iron_sword-test-001',
  baseId: 'iron_sword',
  name: '鐵劍',
  actionId: 'frontal_sweep',
  hitMode: { type: 'instant' },
  actionTags: ['物理', '即發'],
  statScaling: 'STR',
  atkFinal: 1.0,        // atkBase 無詞條加成
  spCostFinal: 10,
  mpCostFinal: 0,
  castTimeFinal: 500,
  recoveryTimeFinal: 300,
  cooldownMs: 0,
  element: 'slash',
  attackMode: 'mode_slash',
  enchant: null,
  appliedAffixIds: [],
}

// ─── 預設職業證個體（凍結，用於測試）────────────────────────────────────────
//
// 使用 base + randomBonus.min（最低值），確保數值穩定、可手算驗證。
// warrior: str=20 agi=10 int=5 lck=8  → HP=80+20*2=120, SP=40+10*1=50
// mage:    str=5  agi=10 int=24 lck=10 → MP=50+24*3=122
// ranger:  str=10 agi=22 int=8  lck=12 → SP=60+22*2=104

export const WARRIOR_CERT: JobCertInstance = {
  instanceId: 'cert_warrior_base',
  defId: 'warrior',
  rolledStats: { str: 20, agi: 10, int: 5, lck: 8 },
}

export const MAGE_CERT: JobCertInstance = {
  instanceId: 'cert_mage_base',
  defId: 'mage',
  rolledStats: { str: 5, agi: 10, int: 24, lck: 10 },
}

export const RANGER_CERT: JobCertInstance = {
  instanceId: 'cert_ranger_base',
  defId: 'ranger',
  rolledStats: { str: 10, agi: 22, int: 8, lck: 12 },
}

// ─── 玩家（戰士）────────────────────────────────────────────────────────────

export function makeWarrior(id = 'player_1'): Unit {
  return {
    id,
    kind: 'player',
    name: '戰士',
    pos: { x: 1, y: 6 },
    facing: 'up',
    stats: { str: 15, agi: 8, int: 4, lck: 6 },
    maxHP: 120, currentHP: 120,
    maxSP: 60,  currentSP: 60,
    maxMP: 0,   currentMP: 0,
    spRecoveryFlat: 20,
    speed: 12,
    moveRange: 3,
    weapons: [IRON_SWORD_RESOLVED, null, null],
    weaponCooldownUntil: [0, 0, 0],
    resistances: {},
    defenses: { slash: 3, crush: 3, pierce: 3 },
    statusEffects: [],
  }
}

// ─── 野狼武器 ─────────────────────────────────────────────────────────────────

const WOLF_FANG_RESOLVED: ResolvedWeapon = {
  idHash: null,
  baseId: 'wolf_fang',
  name: '狼牙',
  actionId: 'single_melee',
  hitMode: { type: 'instant' },
  actionTags: ['物理', '即發'],
  statScaling: 'STR',
  atkFinal: 0.45,
  spCostFinal: 0,
  mpCostFinal: 0,
  castTimeFinal: 600,
  recoveryTimeFinal: 400,
  cooldownMs: 0,
  element: 'slash',
  attackMode: 'mode_slash',
  enchant: null,
  appliedAffixIds: [],
}

// ─── 野狼 ─────────────────────────────────────────────────────────────────────

export function makeWolf(id: string, pos: { x: number; y: number }): Unit {
  return {
    id,
    kind: 'monster',
    name: '森林野狼',
    pos,
    facing: 'down',
    stats: { str: 8, agi: 10, int: 2, lck: 4 },
    maxHP: 45, currentHP: 45,
    maxSP: 20, currentSP: 20,
    maxMP: 0,  currentMP: 0,
    spRecoveryFlat: 0,
    speed: 14,
    moveRange: 3,
    weapons: [WOLF_FANG_RESOLVED],
    weaponCooldownUntil: [0],
    resistances: {},
    defenses: {},
    statusEffects: [],
    ai: 'chase',
    monsterId: 'forest_wolf',
    skillCooldownUntil: {},
  }
}

// ─── 完整 GameState ────────────────────────────────────────────────────────────

export function makeTestGameState(): GameState {
  const warrior = makeWarrior('player_1')
  const wolf1   = makeWolf('wolf_1', { x: 3, y: 2 })
  const wolf2   = makeWolf('wolf_2', { x: 5, y: 2 })

  const units: Record<string, Unit> = {
    player_1: warrior,
    wolf_1:   wolf1,
    wolf_2:   wolf2,
  }

  const entries: ATBEntry[] = Object.values(units).map(u => ({
    unitId: u.id,
    atb: 0,
    castRemaining: 0,
    recoveryRemaining: 0,
  }))

  const timeline: TimelineState = {
    tick: 0,
    pendingUnitId: null,
    entries,
  }

  const run: RunState = {
    runSeed: 'TEST_SEED_001',
    difficulty: 1.0,
    theme: 'forest',
    floorNumber: 1,
    maxFloors: 10,
    pathHistory: [],
    trialFloorCount: 0,
    dungeonQuality: 1.0,
    lootQuality: 1.0,
    status: 'active',
  }

  const turnFlags: TurnFlags = { actingUnitId: null }

  return {
    floor: makeTestFloor(),
    units,
    timeline,
    turnFlags,
    run,
  }
}
