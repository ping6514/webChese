<template>
  <div class="attack-wrapper">
    <div class="attack-toolbar">
      <h2 class="attack-title">攻擊判定測試模組</h2>
      <div class="attack-toolbar__controls">
        <label class="toggle-label">
          <input v-model="showCoords" type="checkbox" />
          顯示座標
        </label>
        <button class="btn-reset" @click="resetScenario">重置案例</button>
        <button class="btn-reset" @click="runActiveCase">執行 testcase</button>
      </div>
    </div>

    <div class="attack-scene">
      <svg :width="svgWidth" :height="svgHeight" class="attack-svg">
        <g v-for="cell in cells" :key="cell.key" class="hex-cell-group">
          <polygon
            :points="HEX_PTS"
            :transform="`translate(${cell.px + PAD}, ${cell.py + PAD})`"
            :class="['hex-cell', cellStateClass(cell)]"
            @click="handleCellClick(cell)"
          />
          <text
            v-if="showCoords"
            :x="cell.px + PAD"
            :y="cell.py + PAD + 5"
            class="hex-coord"
            text-anchor="middle"
          >{{ cell.q }},{{ cell.r }}</text>
        </g>

        <g
          v-for="unit in displayedUnits"
          :key="unit.id"
          :transform="`translate(${unitPx(unit).x + PAD}, ${unitPx(unit).y + PAD})`"
          class="hex-unit-group"
        >
          <polygon
            :points="FACING_TRIANGLE_PTS"
            :transform="facingTransform(unit)"
            :class="['facing-indicator', unit.team === 'player' ? 'facing-indicator--player' : 'facing-indicator--enemy']"
          />
          <circle
            :r="HEX_SIZE * 0.48"
            :class="['unit-circle', unit.team === 'player' ? 'unit-circle--player' : 'unit-circle--enemy']"
          />
          <text
            text-anchor="middle"
            dy="1"
            :font-size="HEX_SIZE * 0.3"
            font-weight="700"
            fill="#fff"
            style="pointer-events:none; user-select:none"
          >{{ unit.name.slice(0, 1) }}</text>
          <rect
            :x="-HEX_SIZE * 0.42"
            :y="HEX_SIZE * 0.4"
            :width="HEX_SIZE * 0.84"
            height="5"
            rx="2"
            fill="rgba(0,0,0,0.3)"
          />
          <rect
            :x="-HEX_SIZE * 0.42"
            :y="HEX_SIZE * 0.4"
            :width="HEX_SIZE * 0.84 * (unit.hp / unit.maxHp)"
            height="5"
            rx="2"
            :class="unit.team === 'player' ? 'hp-bar--player' : 'hp-bar--enemy'"
          />
        </g>

        <g
          v-for="unit in facingWheelUnits"
          :key="`${unit.id}-wheel`"
          :transform="`translate(${unitPx(unit).x + PAD}, ${unitPx(unit).y + PAD})`"
          class="facing-wheel"
        >
          <g
            v-for="dir in facingOptions"
            :key="dir"
            :transform="facingWheelTransform(dir)"
            class="facing-wheel__node"
            @click.stop="applyFacing(dir)"
          >
            <circle
              :r="10"
              :class="['facing-wheel__dot', unit.facing === dir && 'facing-wheel__dot--active']"
            />
            <text
              text-anchor="middle"
              dy="4"
              class="facing-wheel__label"
            >{{ dir }}</text>
          </g>
        </g>
      </svg>

      <div class="attack-info-panel">
        <div class="info-card">
          <h3 class="info-card__name">Test Cases</h3>
          <div class="case-list">
            <button
              v-for="testCase in TEST_CASES"
              :key="testCase.id"
              :class="['case-btn', activeCaseId === testCase.id && 'case-btn--active']"
              @click="loadCase(testCase.id)"
            >
              <strong>{{ testCase.name }}</strong>
              <span>{{ testCase.summary }}</span>
            </button>
          </div>
        </div>

        <div class="info-card">
          <h3 class="info-card__name">案例摘要</h3>
          <div class="stat-row"><span>名稱</span><strong>{{ activeCase.name }}</strong></div>
          <div class="stat-row"><span>操作</span><strong>{{ activeCase.action.type }}</strong></div>
          <div class="stat-row"><span>焦點</span><strong>{{ activeCase.summary }}</strong></div>
          <div class="stat-row"><span>預期</span><strong>{{ activeCase.expectation }}</strong></div>
          <div class="stat-row"><span>步驟</span><strong>{{ moveStepLabel }}</strong></div>
          <div v-if="pendingMoveTo" class="stat-row"><span>目標格</span><strong>{{ pendingMoveTo.q }},{{ pendingMoveTo.r }}</strong></div>
          <div v-if="activeCase.action.type === 'MOVE'" class="step-actions">
            <button v-if="moveStep === 'select_facing'" class="btn-reset" @click="backToTargetStep">返回選位</button>
            <button v-if="moveStep !== 'idle'" class="btn-reset" @click="cancelMoveStep">取消操作</button>
          </div>
        </div>

        <div class="info-card" v-if="lastSummary">
          <h3 class="info-card__name">最近判定摘要</h3>
          <div class="stat-row"><span>結果</span><strong :class="validationResult?.pass ? 'status-pass' : 'status-fail'">{{ validationResult?.pass ? 'PASS' : 'FAIL' }}</strong></div>
          <div class="stat-row"><span>合法性</span><strong>{{ lastSummary.valid ? '合法' : '無效' }}</strong></div>
          <div class="stat-row"><span>facing</span><strong>{{ lastSummary.facingSector }}</strong></div>
          <div class="stat-row"><span>背刺</span><strong>{{ lastSummary.isBackstab ? 'Yes' : 'No' }}</strong></div>
          <div class="stat-row"><span>傷害</span><strong>{{ lastSummary.finalDamage }}</strong></div>
          <div class="stat-row"><span>語言</span><strong>{{ lastSummary.damageLabel }}</strong></div>
          <div v-if="validationResult" class="stat-row"><span>驗證</span><strong>{{ validationResult.message }}</strong></div>
        </div>

        <div class="info-card" v-if="lastAction">
          <h3 class="info-card__name">Action Payload</h3>
          <pre class="event-log">{{ JSON.stringify(lastAction, null, 2) }}</pre>
        </div>

        <div class="info-card" v-if="moveTrace">
          <h3 class="info-card__name">Move Trace</h3>
          <div class="stat-row"><span>起點</span><strong>{{ moveTrace.from.q }},{{ moveTrace.from.r }}</strong></div>
          <div class="stat-row"><span>終點</span><strong>{{ moveTrace.to.q }},{{ moveTrace.to.r }}</strong></div>
          <div class="stat-row"><span>原方向</span><strong>{{ moveTrace.facingBefore }}</strong></div>
          <div class="stat-row"><span>新方向</span><strong>{{ moveTrace.facingAfter }}</strong></div>
        </div>

        <div class="info-card">
          <h3 class="info-card__name">事件輸出</h3>
          <div v-if="lastEvents.length === 0" class="empty-text">尚未執行</div>
          <pre v-else class="event-log">{{ JSON.stringify(lastEvents, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { HEX_DIRECTIONS, axialToPixel, hexKey, hexPoints, offsetToAxial } from '../game/hex'
import { reduce } from '../engine/reduce'
import { getFacingSector } from '../engine/damage'
import { createBuildupData } from '../engine/state'
import type { BattleAction } from '../engine/actions'
import type { Event } from '../engine/events'
import type { BattleCell, CombatUnit, GameState } from '../engine/state'

const COLS = 9
const ROWS = 7
const HEX_SIZE = 38
const PAD = 52
const HEX_PTS = hexPoints(HEX_SIZE)
const FACING_TRIANGLE_PTS = '0,-22 8,-8 -8,-8'

type Cell = {
  key: string
  q: number
  r: number
  px: number
  py: number
}

type Summary = {
  valid: boolean
  facingSector: string
  isBackstab: boolean
  finalDamage: number
  damageLabel: string
}

type ValidationResult = {
  pass: boolean
  message: string
}

type MoveTrace = {
  from: { q: number; r: number }
  to: { q: number; r: number }
  facingBefore: number
  facingAfter: number
}

type TestAssertion =
  | { kind: 'event_includes'; eventType: Event['type'] }
  | { kind: 'event_absent'; eventType: Event['type'] }
  | { kind: 'event_count'; eventType: Event['type']; equals: number }
  | { kind: 'event_exactly_one'; eventType: Event['type'] }
  | { kind: 'summary_valid'; equals: boolean }
  | { kind: 'summary_facing_sector'; equals: string }
  | { kind: 'summary_backstab'; equals: boolean }
  | { kind: 'summary_final_damage'; equals: number }
  | { kind: 'summary_final_damage_lt_base' }
  | { kind: 'unit_hp'; unitId: string; equals: number }
  | { kind: 'unit_pos'; unitId: string; q: number; r: number }
  | { kind: 'unit_facing'; unitId: string; equals: number }
  | { kind: 'unit_dead'; unitId: string; equals: boolean }
  | { kind: 'move_from'; q: number; r: number }
  | { kind: 'move_to'; q: number; r: number }
  | { kind: 'move_facing'; equals: number }
  | { kind: 'move_unchanged' }

type TestCase = {
  id: string
  name: string
  summary: string
  expectation: string
  assertions: TestAssertion[]
  state: GameState
  action: BattleAction
}

type MoveStep = 'idle' | 'select_target' | 'select_facing'

function makeCells(): Record<string, BattleCell> {
  const result: Record<string, BattleCell> = {}
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = offsetToAxial(col, row)
      result[hexKey(pos.q, pos.r)] = {
        pos,
        terrain: 'normal',
        passable: true,
      }
    }
  }
  return result
}

function makeUnit(input: Partial<CombatUnit> & Pick<CombatUnit, 'id' | 'name' | 'team' | 'certId' | 'pos' | 'facing'>): CombatUnit {
  return {
    hp: 100,
    maxHp: 100,
    speed: 30,
    move: 3,
    damage: 30,
    interrupt: 1,
    isDead: false,
    blocksCell: true,
    revivePending: null,
    buildup: createBuildupData(input.certId),
    buildupResist: { burn: 0, poison: 0, paralyze: 0, sleep: 0, freeze: 0 },
    statusEffects: [],
    ...input,
  }
}

function makeState(
  units: CombatUnit[],
  options?: {
    blockedCells?: { q: number; r: number }[]
  },
): GameState {
  const unitRecord: Record<string, CombatUnit> = {}
  for (const unit of units) {
    unitRecord[unit.id] = unit
  }

  const cells = makeCells()
  for (const blocked of options?.blockedCells ?? []) {
    const key = hexKey(blocked.q, blocked.r)
    const cell = cells[key]
    if (!cell) continue
    cells[key] = {
      ...cell,
      passable: false,
    }
  }

  return {
    phase: 'running',
    timeline: {
      tick: 0,
      pendingUnitId: null,
      entries: units.map((unit) => ({ unitId: unit.id, atb: 100, castRemaining: 0, recoveryRemaining: 0, speedMult: 1 })),
    },
    units: unitRecord,
    cells,
  }
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

const frontPlayer = makeUnit({
  id: 'p_attacker',
  name: '狼牙測試',
  team: 'player',
  certId: 'cert_wolf_guard',
  pos: offsetToAxial(2, 3),
  facing: 0,
  move: 3,
  damage: 34,
  interrupt: 2,
})

const frontEnemy = makeUnit({
  id: 'e_target',
  name: '目標哨兵',
  team: 'enemy',
  certId: 'cert_dummy_target',
  pos: offsetToAxial(3, 3),
  facing: 3,
})

const backstabPlayer = makeUnit({
  ...frontPlayer,
  pos: offsetToAxial(2, 3),
})

const backstabEnemy = makeUnit({
  ...frontEnemy,
  id: 'e_back',
  pos: offsetToAxial(3, 3),
  facing: 0,
})

const flankPlayer = makeUnit({
  ...frontPlayer,
  id: 'p_flank',
  pos: { q: frontEnemy.pos.q, r: frontEnemy.pos.r - 1 },
})

const turnPlayer = makeUnit({
  ...frontPlayer,
  id: 'p_turn',
  pos: offsetToAxial(2, 3),
  facing: 0,
})

const comboMovePlayer = makeUnit({
  ...frontPlayer,
  id: 'p_combo',
  pos: offsetToAxial(2, 3),
  facing: 0,
})

const invalidMovePlayer = makeUnit({
  ...frontPlayer,
  id: 'p_invalid',
  pos: offsetToAxial(2, 3),
  facing: 0,
  move: 3,
})

const chargePlayer = makeUnit({
  ...frontPlayer,
  id: 'p_charge',
  pos: offsetToAxial(2, 3),
  facing: 0,
  move: 2,
})

const terrainMovePlayer = makeUnit({
  ...frontPlayer,
  id: 'p_terrain',
  pos: offsetToAxial(2, 3),
  facing: 0,
  move: 2,
})

const phaseMovePlayer = makeUnit({
  ...frontPlayer,
  id: 'p_phase',
  pos: offsetToAxial(2, 3),
  facing: 0,
  move: 2,
})

const blockerEnemy = makeUnit({
  ...frontEnemy,
  id: 'e_blocker',
  pos: offsetToAxial(4, 3),
  facing: 3,
})

const TEST_CASES: TestCase[] = [
  {
    id: 'move_valid',
    name: '合法移動',
    summary: 'MOVE 進入合法空格',
    expectation: '觸發 UNIT_MOVED',
    assertions: [
      { kind: 'event_includes', eventType: 'UNIT_MOVED' },
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_to', q: offsetToAxial(2, 2).q, r: offsetToAxial(2, 2).r },
      { kind: 'unit_pos', unitId: 'p_attacker', q: offsetToAxial(2, 2).q, r: offsetToAxial(2, 2).r },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_attacker',
      to: offsetToAxial(2, 2),
      recoveryMs: 8,
    },
  },
  {
    id: 'front_core',
    name: '正面核心減傷',
    summary: 'front_core 套用最大正面減傷',
    expectation: '傷害小於 baseDamage',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
      { kind: 'summary_facing_sector', equals: 'front_core' },
      { kind: 'summary_final_damage_lt_base' },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 30, damageType: 'slash', elementType: 'none', attackClass: 'melee' },
      defense: { frontCoreDamageReduction: 0.3 },
      recoveryMs: 18,
    },
  },
  {
    id: 'front_flank',
    name: '正面側翼減傷',
    summary: 'front_flank 套用側翼減傷',
    expectation: 'facingSector = front_flank',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
      { kind: 'summary_facing_sector', equals: 'front_flank' },
      { kind: 'summary_final_damage_lt_base' },
    ],
    state: makeState([flankPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_flank',
      targetId: 'e_target',
      profile: { baseDamage: 30, damageType: 'slash', elementType: 'none', attackClass: 'melee' },
      defense: { frontFlankDamageReduction: 0.15 },
      recoveryMs: 18,
    },
  },
  {
    id: 'backstab',
    name: '背刺判定',
    summary: 'rear 方向觸發背刺',
    expectation: 'isBackstab = true',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
      { kind: 'summary_facing_sector', equals: 'rear' },
      { kind: 'summary_backstab', equals: true },
    ],
    state: makeState([backstabPlayer, backstabEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_back',
      profile: { baseDamage: 30, damageType: 'pierce', elementType: 'none', attackClass: 'melee', canBackstab: true },
      recoveryMs: 18,
    },
  },
  {
    id: 'turn_in_place',
    name: '原地轉向',
    summary: 'MOVE(to=self) 只改 facing',
    expectation: '原地不位移但方向改變',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_from', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'move_to', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'move_facing', equals: 2 },
      { kind: 'unit_pos', unitId: 'p_turn', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_turn', equals: 2 },
    ],
    state: makeState([turnPlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_turn',
      to: offsetToAxial(2, 3),
      facing: 2,
      recoveryMs: 8,
    },
  },
  {
    id: 'move_and_face',
    name: '移動後改向',
    summary: 'MOVE 同時變更位置與 facing',
    expectation: 'move_to + move_facing 一起成立',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_from', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'move_to', q: offsetToAxial(2, 2).q, r: offsetToAxial(2, 2).r },
      { kind: 'move_facing', equals: 1 },
      { kind: 'unit_pos', unitId: 'p_combo', q: offsetToAxial(2, 2).q, r: offsetToAxial(2, 2).r },
      { kind: 'unit_facing', unitId: 'p_combo', equals: 1 },
    ],
    state: makeState([comboMovePlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_combo',
      to: offsetToAxial(2, 2),
      facing: 1,
      recoveryMs: 8,
    },
  },
  {
    id: 'invalid_move',
    name: '非法移動',
    summary: 'MOVE 超出移動距離不應生效',
    expectation: '無事件且 state 不變',
    assertions: [
      { kind: 'event_count', eventType: 'UNIT_MOVED', equals: 0 },
      { kind: 'summary_valid', equals: false },
      { kind: 'move_unchanged' },
      { kind: 'unit_pos', unitId: 'p_invalid', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_invalid', equals: 0 },
    ],
    state: makeState([invalidMovePlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_invalid',
      to: offsetToAxial(7, 6),
      recoveryMs: 8,
    },
  },
  {
    id: 'move_charge_straight_line',
    name: '直線衝刺',
    summary: 'straight_line + maxRangeOverride 允許遠距直線移動',
    expectation: '合法直線移動成功',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_from', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'move_to', q: offsetToAxial(5, 3).q, r: offsetToAxial(5, 3).r },
      { kind: 'unit_pos', unitId: 'p_charge', q: offsetToAxial(5, 3).q, r: offsetToAxial(5, 3).r },
      { kind: 'unit_facing', unitId: 'p_charge', equals: 0 },
    ],
    state: makeState([chargePlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_charge',
      to: offsetToAxial(5, 3),
      moveSpec: {
        mode: 'charge',
        routeRule: 'straight_line',
        maxRangeOverride: 4,
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'move_charge_no_range_override',
    name: '直線衝刺缺少距離覆寫',
    summary: '只有 straight_line 不應自動突破原始移動距離',
    expectation: '超出原 move 時仍失敗',
    assertions: [
      { kind: 'event_count', eventType: 'UNIT_MOVED', equals: 0 },
      { kind: 'summary_valid', equals: false },
      { kind: 'move_unchanged' },
      { kind: 'unit_pos', unitId: 'p_charge', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_charge', equals: 0 },
    ],
    state: makeState([chargePlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_charge',
      to: offsetToAxial(5, 3),
      moveSpec: {
        mode: 'charge',
        routeRule: 'straight_line',
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'move_charge_invalid_diagonal',
    name: '直線衝刺非法轉折',
    summary: 'straight_line 不應允許非單一直線的遠距移動',
    expectation: '無事件且 state 不變',
    assertions: [
      { kind: 'event_count', eventType: 'UNIT_MOVED', equals: 0 },
      { kind: 'summary_valid', equals: false },
      { kind: 'move_unchanged' },
      { kind: 'unit_pos', unitId: 'p_charge', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_charge', equals: 0 },
    ],
    state: makeState([chargePlayer, frontEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_charge',
      to: offsetToAxial(4, 2),
      moveSpec: {
        mode: 'charge',
        routeRule: 'straight_line',
        maxRangeOverride: 4,
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'move_blocked_without_ignore_terrain',
    name: '不可通行格阻擋',
    summary: '未開 ignoreTerrain 時不應移入 blocked cell',
    expectation: '無事件且 state 不變',
    assertions: [
      { kind: 'event_count', eventType: 'UNIT_MOVED', equals: 0 },
      { kind: 'summary_valid', equals: false },
      { kind: 'move_unchanged' },
      { kind: 'unit_pos', unitId: 'p_terrain', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_terrain', equals: 0 },
    ],
    state: makeState([terrainMovePlayer], {
      blockedCells: [offsetToAxial(3, 3)],
    }),
    action: {
      type: 'MOVE',
      unitId: 'p_terrain',
      to: offsetToAxial(3, 3),
      recoveryMs: 8,
    },
  },
  {
    id: 'move_ignore_terrain',
    name: '跨地形移動',
    summary: 'ignoreTerrain 允許移入不可通行格',
    expectation: 'blocked cell 仍可進入',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_to', q: offsetToAxial(3, 3).q, r: offsetToAxial(3, 3).r },
      { kind: 'unit_pos', unitId: 'p_terrain', q: offsetToAxial(3, 3).q, r: offsetToAxial(3, 3).r },
    ],
    state: makeState([terrainMovePlayer], {
      blockedCells: [offsetToAxial(3, 3)],
    }),
    action: {
      type: 'MOVE',
      unitId: 'p_terrain',
      to: offsetToAxial(3, 3),
      moveSpec: {
        mode: 'leap',
        ignoreTerrain: true,
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'move_occupied_without_ignore_units',
    name: '佔用格阻擋',
    summary: '未開 ignoreUnits 時不應移入 occupied cell',
    expectation: '無事件且 state 不變',
    assertions: [
      { kind: 'event_count', eventType: 'UNIT_MOVED', equals: 0 },
      { kind: 'summary_valid', equals: false },
      { kind: 'move_unchanged' },
      { kind: 'unit_pos', unitId: 'p_phase', q: offsetToAxial(2, 3).q, r: offsetToAxial(2, 3).r },
      { kind: 'unit_facing', unitId: 'p_phase', equals: 0 },
    ],
    state: makeState([phaseMovePlayer, blockerEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_phase',
      to: offsetToAxial(4, 3),
      moveSpec: {
        mode: 'teleport',
        maxRangeOverride: 3,
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'move_ignore_units',
    name: '穿人位移',
    summary: 'ignoreUnits 允許移入被單位佔據的目標格',
    expectation: 'occupied cell 仍可進入',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'UNIT_MOVED' },
      { kind: 'summary_valid', equals: true },
      { kind: 'move_to', q: offsetToAxial(4, 3).q, r: offsetToAxial(4, 3).r },
      { kind: 'unit_pos', unitId: 'p_phase', q: offsetToAxial(4, 3).q, r: offsetToAxial(4, 3).r },
    ],
    state: makeState([phaseMovePlayer, blockerEnemy]),
    action: {
      type: 'MOVE',
      unitId: 'p_phase',
      to: offsetToAxial(4, 3),
      moveSpec: {
        mode: 'teleport',
        ignoreUnits: true,
        maxRangeOverride: 3,
      },
      recoveryMs: 8,
    },
  },
  {
    id: 'arcane_fire',
    name: 'Arcane + Fire',
    summary: 'arcane 主傷 + fire 附傷',
    expectation: '主傷與元素段都參與傷害',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 26, damageType: 'arcane', elementType: 'fire', attackClass: 'arcane_cast', elementDamageRatio: 0.4 },
      defense: { arcaneResist: 0.1, fireResist: 0.25 },
      recoveryMs: 20,
    },
  },
  {
    id: 'negate',
    name: '一次性無效化',
    summary: 'negateNextDamage 完全取消傷害',
    expectation: '最終傷害 0',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
      { kind: 'summary_final_damage', equals: 0 },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 40, damageType: 'impact', elementType: 'none', attackClass: 'melee' },
      defense: { negateNextDamage: true },
      recoveryMs: 18,
    },
  },
  {
    id: 'evade',
    name: '閃避事件',
    summary: 'evadeNextHit 產生 ATTACK_EVADED，不應有 DAMAGE_DEALT',
    expectation: 'ATTACK_EVADED and no DAMAGE_DEALT',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'ATTACK_EVADED' },
      { kind: 'event_absent', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: false },
      { kind: 'unit_hp', unitId: 'e_target', equals: 100 },
      { kind: 'unit_dead', unitId: 'e_target', equals: false },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 35, damageType: 'slash', elementType: 'none', attackClass: 'melee' },
      defense: { evadeNextHit: true },
      recoveryMs: 18,
    },
  },
  {
    id: 'miss',
    name: '未命中事件',
    summary: 'alwaysMiss 產生 ATTACK_MISSED，不應有 DAMAGE_DEALT',
    expectation: 'ATTACK_MISSED and no DAMAGE_DEALT',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'ATTACK_MISSED' },
      { kind: 'event_absent', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: false },
      { kind: 'unit_hp', unitId: 'e_target', equals: 100 },
      { kind: 'unit_dead', unitId: 'e_target', equals: false },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 35, damageType: 'slash', elementType: 'none', attackClass: 'melee', alwaysMiss: true },
      recoveryMs: 18,
    },
  },
  {
    id: 'no_damage_event',
    name: '無傷害事件',
    summary: 'miss / evade 類情況不應產生 DAMAGE_DEALT',
    expectation: 'no DAMAGE_DEALT',
    assertions: [
      { kind: 'event_absent', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: false },
      { kind: 'unit_hp', unitId: 'e_target', equals: 100 },
      { kind: 'unit_dead', unitId: 'e_target', equals: false },
    ],
    state: makeState([frontPlayer, frontEnemy]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 28, damageType: 'pierce', elementType: 'none', attackClass: 'melee', alwaysMiss: true },
      recoveryMs: 18,
    },
  },
  {
    id: 'kill',
    name: '死亡事件',
    summary: '足夠傷害觸發 UNIT_DIED',
    expectation: '事件中包含 UNIT_DIED',
    assertions: [
      { kind: 'event_exactly_one', eventType: 'DAMAGE_DEALT' },
      { kind: 'summary_valid', equals: true },
      { kind: 'event_includes', eventType: 'UNIT_DIED' },
      { kind: 'event_exactly_one', eventType: 'UNIT_DIED' },
      { kind: 'unit_dead', unitId: 'e_target', equals: true },
      { kind: 'unit_hp', unitId: 'e_target', equals: 0 },
    ],
    state: makeState([frontPlayer, makeUnit({ ...frontEnemy, hp: 24, maxHp: 24 })]),
    action: {
      type: 'ATTACK',
      attackerId: 'p_attacker',
      targetId: 'e_target',
      profile: { baseDamage: 30, damageType: 'slash', elementType: 'wind', attackClass: 'melee', elementDamageRatio: 0.2 },
      recoveryMs: 18,
    },
  },
]

const showCoords = ref(false)
const activeCaseId = ref(TEST_CASES[0]!.id)
const state = ref<GameState>(cloneState(TEST_CASES[0]!.state))
const lastEvents = ref<Event[]>([])
const lastSummary = ref<Summary | null>(null)
const lastAction = ref<BattleAction | null>(null)
const validationResult = ref<ValidationResult | null>(null)
const moveTrace = ref<MoveTrace | null>(null)
const facingOptions = [0, 1, 2, 3, 4, 5] as const
const moveStep = ref<MoveStep>('idle')
const pendingMoveTo = ref<{ q: number; r: number } | null>(null)

const activeCase = computed(() => TEST_CASES.find((item) => item.id === activeCaseId.value) ?? TEST_CASES[0]!)
const cells = computed<Cell[]>(() => {
  const result: Cell[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { q, r } = offsetToAxial(col, row)
      const { x, y } = axialToPixel(q, r, HEX_SIZE)
      result.push({ key: hexKey(q, r), q, r, px: x, py: y })
    }
  }
  return result
})
const aliveUnits = computed(() => Object.values(state.value.units).filter((unit) => !unit.isDead))
const actingPlayerUnit = computed(() => {
  const action = activeCase.value.action
  if (action.type !== 'MOVE') return null
  const unit = state.value.units[action.unitId]
  return unit && !unit.isDead ? unit : null
})
const displayedUnits = computed(() => aliveUnits.value.map((unit) => {
  if (
    moveStep.value === 'select_facing'
    && pendingMoveTo.value
    && actingPlayerUnit.value
    && unit.id === actingPlayerUnit.value.id
  ) {
    return {
      ...unit,
      pos: { ...pendingMoveTo.value },
    }
  }
  return unit
}))
const facingWheelUnits = computed(() => {
  if (moveStep.value !== 'select_facing' || !actingPlayerUnit.value || !pendingMoveTo.value) return []
  return [{
    ...actingPlayerUnit.value,
    pos: { ...pendingMoveTo.value },
  }]
})
const moveStepLabel = computed(() => {
  switch (moveStep.value) {
    case 'select_target':
      return '選擇位置'
    case 'select_facing':
      return '選擇方向'
    default:
      return activeCase.value.action.type === 'MOVE' ? '待開始' : '不適用'
  }
})

const svgWidth = computed(() => {
  const maxX = Math.max(...cells.value.map((cell) => cell.px))
  return maxX + PAD * 2 + HEX_SIZE * Math.sqrt(3) / 2
})

const svgHeight = computed(() => {
  const maxY = Math.max(...cells.value.map((cell) => cell.py))
  return maxY + PAD * 2 + HEX_SIZE
})

function unitPx(unit: CombatUnit): { x: number; y: number } {
  return axialToPixel(unit.pos.q, unit.pos.r, HEX_SIZE)
}

function facingAngleFromDir(dir: number): number {
  const vec = HEX_DIRECTIONS[dir] ?? HEX_DIRECTIONS[0]!
  const { x, y } = axialToPixel(vec.q, vec.r, 1)
  return Math.atan2(y, x) * (180 / Math.PI)
}

function facingTransform(unit: CombatUnit): string {
  const angle = facingAngleFromDir(unit.facing) + 90
  return `rotate(${angle}) translate(0, -2)`
}

function facingWheelTransform(dir: (typeof facingOptions)[number]): string {
  const vec = HEX_DIRECTIONS[dir] ?? HEX_DIRECTIONS[0]!
  const { x, y } = axialToPixel(vec.q * 1.02, vec.r * 1.02, HEX_SIZE)
  return `translate(${x}, ${y})`
}

function cellStateClass(cell: Cell): string {
  const occupant = aliveUnits.value.find((unit) => unit.pos.q === cell.q && unit.pos.r === cell.r)
  if (moveStep.value === 'select_target' && isMoveCellSelectable(cell)) return 'hex-cell--move-target'
  if (occupant?.team === 'player') return 'hex-cell--selected-unit'
  if (occupant?.team === 'enemy') return 'hex-cell--attack'
  return 'hex-cell--default'
}

function loadCase(id: string) {
  activeCaseId.value = id
  resetScenario()
}

function resetScenario() {
  state.value = cloneState(activeCase.value.state)
  lastEvents.value = []
  lastSummary.value = null
  lastAction.value = null
  validationResult.value = null
  moveTrace.value = null
  pendingMoveTo.value = null
  moveStep.value = activeCase.value.action.type === 'MOVE' ? 'select_target' : 'idle'
}

function cancelMoveStep() {
  pendingMoveTo.value = null
  moveStep.value = activeCase.value.action.type === 'MOVE' ? 'select_target' : 'idle'
}

function backToTargetStep() {
  if (activeCase.value.action.type !== 'MOVE') return
  pendingMoveTo.value = null
  moveStep.value = 'select_target'
}

function summarize(action: BattleAction, events: Event[]) {
  if (action.type !== 'ATTACK') {
    lastSummary.value = {
      valid: action.type === 'MOVE' && events.some((event) => event.type === 'UNIT_MOVED'),
      facingSector: 'n/a',
      isBackstab: false,
      finalDamage: 0,
      damageLabel: action.type,
    }
    return
  }

  const attacker = state.value.units[action.attackerId]
  const target = state.value.units[action.targetId]
  const damageEvent = events.find((event) => event.type === 'DAMAGE_DEALT')
  lastSummary.value = {
    valid: !!damageEvent,
    facingSector: attacker && target ? getFacingSector(target.pos, target.facing, attacker.pos) : 'invalid',
    isBackstab: damageEvent?.type === 'DAMAGE_DEALT' ? damageEvent.isBackstab : false,
    finalDamage: damageEvent?.type === 'DAMAGE_DEALT' ? damageEvent.amount : 0,
    damageLabel: `${action.profile.damageType}${action.profile.elementType !== 'none' ? `+${action.profile.elementType}` : ''}`,
  }
}

function validateOutcome(action: BattleAction, events: Event[], summary: Summary | null, trace: MoveTrace | null) {
  const failures: string[] = []

  for (const assertion of activeCase.value.assertions) {
    if (assertion.kind === 'event_includes') {
      const matched = events.some((event) => event.type === assertion.eventType)
      if (!matched) failures.push(`缺少事件 ${assertion.eventType}`)
      continue
    }

    if (assertion.kind === 'event_absent') {
      const matched = events.some((event) => event.type === assertion.eventType)
      if (matched) failures.push(`不應包含事件 ${assertion.eventType}`)
      continue
    }

    if (assertion.kind === 'event_count') {
      const count = events.filter((event) => event.type === assertion.eventType).length
      if (count !== assertion.equals) failures.push(`${assertion.eventType} 次數應為 ${assertion.equals}，目前 ${count}`)
      continue
    }

    if (assertion.kind === 'event_exactly_one') {
      const count = events.filter((event) => event.type === assertion.eventType).length
      if (count !== 1) failures.push(`${assertion.eventType} 次數應為 1，目前 ${count}`)
      continue
    }

    if (assertion.kind === 'summary_valid') {
      if (!summary || summary.valid !== assertion.equals) failures.push(`valid 應為 ${String(assertion.equals)}`)
      continue
    }

    if (assertion.kind === 'summary_facing_sector') {
      if (!summary || summary.facingSector !== assertion.equals) failures.push(`facingSector 應為 ${assertion.equals}`)
      continue
    }

    if (assertion.kind === 'summary_backstab') {
      if (!summary || summary.isBackstab !== assertion.equals) failures.push(`isBackstab 應為 ${String(assertion.equals)}`)
      continue
    }

    if (assertion.kind === 'summary_final_damage') {
      if (!summary || summary.finalDamage !== assertion.equals) failures.push(`finalDamage 應為 ${assertion.equals}`)
      continue
    }

    if (assertion.kind === 'summary_final_damage_lt_base') {
      if (action.type !== 'ATTACK' || !summary || !(summary.finalDamage < action.profile.baseDamage)) {
        failures.push('finalDamage 應小於 baseDamage')
      }
      continue
    }

    if (assertion.kind === 'unit_hp') {
      const unit = state.value.units[assertion.unitId]
      if (!unit || unit.hp !== assertion.equals) failures.push(`${assertion.unitId}.hp 應為 ${assertion.equals}`)
      continue
    }

    if (assertion.kind === 'unit_pos') {
      const unit = state.value.units[assertion.unitId]
      if (!unit || unit.pos.q !== assertion.q || unit.pos.r !== assertion.r) {
        failures.push(`${assertion.unitId}.pos 應為 ${assertion.q},${assertion.r}`)
      }
      continue
    }

    if (assertion.kind === 'unit_facing') {
      const unit = state.value.units[assertion.unitId]
      if (!unit || unit.facing !== assertion.equals) failures.push(`${assertion.unitId}.facing 應為 ${assertion.equals}`)
      continue
    }

    if (assertion.kind === 'unit_dead') {
      const unit = state.value.units[assertion.unitId]
      if (!unit || unit.isDead !== assertion.equals) failures.push(`${assertion.unitId}.isDead 應為 ${String(assertion.equals)}`)
      continue
    }

    if (assertion.kind === 'move_to') {
      if (!trace || trace.to.q !== assertion.q || trace.to.r !== assertion.r) {
        failures.push(`終點應為 ${assertion.q},${assertion.r}`)
      }
      continue
    }

    if (assertion.kind === 'move_facing') {
      if (!trace || trace.facingAfter !== assertion.equals) {
        failures.push(`facing 應為 ${assertion.equals}`)
      }
      continue
    }

    if (assertion.kind === 'move_from') {
      if (!trace || trace.from.q !== assertion.q || trace.from.r !== assertion.r) {
        failures.push(`起點應為 ${assertion.q},${assertion.r}`)
      }
      continue
    }

    if (assertion.kind === 'move_unchanged') {
      if (!trace || trace.from.q !== trace.to.q || trace.from.r !== trace.to.r || trace.facingBefore !== trace.facingAfter) {
        failures.push('move 應維持原地且 facing 不變')
      }
    }
  }

  validationResult.value = failures.length === 0
    ? { pass: true, message: `符合 ${activeCase.value.assertions.length} 項 assertion` }
    : { pass: false, message: failures.join('；') }
}

function runActiveCase() {
  resetScenario()
  const beforeUnit = activeCase.value.action.type === 'MOVE' ? cloneState(activeCase.value.state).units[activeCase.value.action.unitId] : null
  const result = reduce(state.value, activeCase.value.action)
  state.value = result.newState
  lastEvents.value = result.events
  lastAction.value = activeCase.value.action
  summarize(activeCase.value.action, result.events)
  if (activeCase.value.action.type === 'MOVE') {
    const afterUnit = state.value.units[activeCase.value.action.unitId]
    if (beforeUnit && afterUnit) {
      moveTrace.value = {
        from: { ...beforeUnit.pos },
        to: { ...afterUnit.pos },
        facingBefore: beforeUnit.facing,
        facingAfter: afterUnit.facing,
      }
    }
    else if (beforeUnit) {
      moveTrace.value = {
        from: { ...beforeUnit.pos },
        to: { ...beforeUnit.pos },
        facingBefore: beforeUnit.facing,
        facingAfter: beforeUnit.facing,
      }
    }
  }
  validateOutcome(activeCase.value.action, result.events, lastSummary.value, moveTrace.value)
  moveStep.value = 'idle'
  pendingMoveTo.value = null
}

function applyFacing(dir: (typeof facingOptions)[number]) {
  if (moveStep.value !== 'select_facing' || !actingPlayerUnit.value || !pendingMoveTo.value) return
  const beforeUnit = { ...actingPlayerUnit.value, pos: { ...actingPlayerUnit.value.pos } }

  const action: BattleAction = {
    type: 'MOVE',
    unitId: actingPlayerUnit.value.id,
    to: { ...pendingMoveTo.value },
    facing: dir,
    recoveryMs: 8,
  }

  const result = reduce(state.value, action)
  state.value = result.newState
  lastEvents.value = result.events
  lastAction.value = action
  summarize(action, result.events)
  const movedUnit = state.value.units[action.unitId]
  if (movedUnit) {
    moveTrace.value = {
      from: { ...beforeUnit.pos },
      to: { ...movedUnit.pos },
      facingBefore: beforeUnit.facing,
      facingAfter: movedUnit.facing,
    }
  }
  validateOutcome(action, result.events, lastSummary.value, moveTrace.value)
  moveStep.value = 'idle'
  pendingMoveTo.value = null
}

function isMoveCellSelectable(cell: Cell): boolean {
  const unit = actingPlayerUnit.value
  if (!unit || moveStep.value !== 'select_target') return false

  const isOccupied = aliveUnits.value.some((other) =>
    other.id !== unit.id
    && other.pos.q === cell.q
    && other.pos.r === cell.r,
  )
  if (isOccupied) return false

  const distance = Math.abs(unit.pos.q - cell.q) + Math.abs(unit.pos.r - cell.r) + Math.abs((unit.pos.q + unit.pos.r) - (cell.q + cell.r))
  return distance / 2 <= unit.move
}

function handleCellClick(cell: Cell) {
  if (!isMoveCellSelectable(cell)) return
  pendingMoveTo.value = { q: cell.q, r: cell.r }
  moveStep.value = 'select_facing'
}
</script>

<style scoped>
.attack-wrapper { display: flex; flex-direction: column; gap: 16px; }
.attack-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.attack-title { margin: 0; font-size: 22px; }
.attack-toolbar__controls { display: flex; align-items: center; gap: 14px; }
.toggle-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #7d6852; }
.btn-reset { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(154, 108, 61, 0.25); background: rgba(255, 251, 245, 0.9); color: #6b4c2a; font: inherit; font-size: 14px; cursor: pointer; }
.attack-scene { display: flex; align-items: flex-start; gap: 20px; overflow-x: auto; }
.attack-svg { flex-shrink: 0; border-radius: 20px; background: rgba(255, 251, 245, 0.88); border: 1px solid rgba(131, 102, 70, 0.14); box-shadow: 0 8px 28px rgba(125, 99, 71, 0.1); }
.hex-cell { transition: fill 0.12s; stroke: rgba(174, 141, 103, 0.45); stroke-width: 1.2; }
.hex-cell--default { fill: rgba(240, 230, 210, 0.6); }
.hex-cell--attack { fill: rgba(210, 110, 80, 0.18); stroke: rgba(190, 90, 60, 0.45); }
.hex-cell--selected-unit { fill: rgba(100, 160, 210, 0.18); }
.hex-cell--move-target { fill: rgba(120, 176, 220, 0.22); stroke: rgba(80, 133, 196, 0.52); cursor: pointer; }
.hex-coord { fill: rgba(154, 108, 61, 0.55); font-size: 9px; font-family: 'JetBrains Mono', monospace; }
.unit-circle--player { fill: #5085c4; }
.unit-circle--enemy { fill: #c45040; }
.facing-indicator {
  opacity: 0.98;
  stroke: rgba(255, 255, 255, 0.95);
  stroke-width: 1.6;
  paint-order: stroke fill;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.18));
}
.facing-indicator--player { fill: #3a6fa8; }
.facing-indicator--enemy { fill: #a8402e; }
.hp-bar--player { fill: #6bc79a; }
.hp-bar--enemy { fill: #e87c66; }
.attack-info-panel { width: 300px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.info-card { padding: 18px; border-radius: 18px; background: rgba(255, 251, 245, 0.9); border: 1px solid rgba(131, 102, 70, 0.14); box-shadow: 0 6px 20px rgba(125, 99, 71, 0.07); }
.info-card__name { margin: 0 0 12px; font-size: 18px; }
.case-list { display: grid; gap: 8px; }
.case-btn { display: grid; gap: 4px; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(154, 108, 61, 0.18); background: rgba(255,255,255,0.72); cursor: pointer; }
.case-btn--active { border-color: rgba(80, 133, 196, 0.42); background: rgba(80, 133, 196, 0.08); }
.case-btn span { font-size: 12px; color: #8a7763; }
.stat-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 10px; background: rgba(120, 94, 65, 0.06); font-size: 13px; margin-bottom: 8px; }
.stat-row span { color: #8a7763; }
.status-pass { color: #2d8a5f; }
.status-fail { color: #b14a3a; }
.step-actions { display: flex; gap: 8px; margin-top: 8px; }
.event-log { margin: 0; white-space: pre-wrap; word-break: break-word; font-size: 12px; color: #6b5b4b; }
.empty-text { color: #9a8070; font-size: 14px; }
.facing-wheel { pointer-events: none; }
.facing-wheel__node {
  cursor: pointer;
  pointer-events: auto;
}
.facing-wheel__dot {
  fill: rgba(255, 251, 245, 0.98);
  stroke: rgba(154, 108, 61, 0.42);
  stroke-width: 1.4;
  filter: drop-shadow(0 2px 5px rgba(0,0,0,0.16));
}
.facing-wheel__dot--active {
  fill: rgba(80, 133, 196, 0.26);
  stroke: rgba(80, 133, 196, 0.9);
}
.facing-wheel__label {
  font-size: 10px;
  font-weight: 700;
  fill: #7d6852;
  user-select: none;
  pointer-events: none;
}
</style>
