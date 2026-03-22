<template>
  <div class="battle-wrapper">
    <div class="battle-toolbar">
      <h2 class="battle-title">最小可玩戰鬥頁</h2>
      <div class="battle-toolbar__controls">
        <label class="toggle-label">
          <input v-model="showCoords" type="checkbox" />
          顯示座標
        </label>
        <button
          class="btn-reset"
          :class="actionMode === 'move' && selectedPlayerUnit && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginMoveMode"
        >MOVE</button>
        <button
          class="btn-reset"
          :class="actionMode === 'attack' && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginAttackMode"
        >ATTACK</button>
        <button
          class="btn-reset"
          :class="actionMode === 'hazard' && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginHazardMode"
        >HAZARD</button>
        <button
          class="btn-reset"
          :class="actionMode === 'combo' && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginComboMode"
        >COMBO</button>
        <button
          class="btn-reset"
          :class="specialMoveMode === 'charge' && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginChargeMode"
        >CHARGE</button>
        <button
          class="btn-reset"
          :class="specialMoveMode === 'leap' && moveStep !== 'attack_windup' ? 'btn-reset--active' : ''"
          :disabled="!selectedPlayerUnit || moveStep === 'attack_windup'"
          @click="beginLeapMode"
        >LEAP</button>
        <button class="btn-reset" @click="resetBattle">重置戰場</button>
        <button class="btn-reset" :disabled="!selectedPlayerUnit" @click="passTurn">PASS</button>
      </div>
    </div>

    <div class="battle-scene">
      <svg :width="svgWidth" :height="svgHeight" class="battle-svg">
        <g v-for="cell in cells" :key="cell.key" class="hex-cell-group">
          <polygon
            :points="HEX_PTS"
            :transform="`translate(${cell.px + PAD}, ${cell.py + PAD})`"
            :class="['hex-cell', cellStateClass(cell)]"
            @mouseenter="handleCellHover(cell)"
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
          @click.stop="handleUnitClick(unit)"
        >
          <circle
            v-if="selectedUnitId === unit.id"
            :r="HEX_SIZE * 0.58"
            class="unit-select-ring"
          />
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
            @mouseenter="handleFacingWheelHover(dir)"
            @click.stop="handleFacingWheelClick(dir)"
          >
            <circle
              :r="10"
              :class="['facing-wheel__dot', isFacingWheelDirActive(unit, dir) && 'facing-wheel__dot--active']"
            />
            <text text-anchor="middle" dy="4" class="facing-wheel__label">{{ dir }}</text>
          </g>
        </g>
      </svg>

      <div class="battle-info-panel">
        <div class="info-card">
          <h3 class="info-card__name">操作說明</h3>
          <div class="stat-row"><span>1</span><strong>點我方單位選取</strong></div>
          <div class="stat-row"><span>2</span><strong>點空格移動</strong></div>
          <div class="stat-row"><span>3</span><strong>MOVE 才需選方向，COMBO 會直接接攻擊預覽</strong></div>
          <div class="stat-row"><span>4</span><strong>ATTACK 用方向輪盤，HAZARD 用地板落點</strong></div>
          <div class="stat-row"><span>5</span><strong>可預覽範圍後直接確認施放</strong></div>
        </div>

        <div class="info-card">
          <h3 class="info-card__name">目前狀態</h3>
          <div class="stat-row"><span>選中單位</span><strong>{{ selectedUnit?.name ?? '無' }}</strong></div>
          <div class="stat-row"><span>步驟</span><strong>{{ moveStepLabel }}</strong></div>
          <div class="stat-row"><span>模式</span><strong>{{ actionModeLabel }}</strong></div>
          <div v-if="specialMoveMode" class="stat-row"><span>特殊移動</span><strong>{{ specialMoveMode }}</strong></div>
          <div v-if="actionMode === 'attack' || actionMode === 'hazard'" class="stat-row"><span>攻擊類型</span><strong>{{ attackModeKind }}</strong></div>
          <div v-if="actionMode === 'combo'" class="stat-row"><span>連段階段</span><strong>{{ moveStep === 'select_target' ? '先移動' : moveStep === 'select_attack' ? '接續攻擊' : '待命' }}</strong></div>
          <div v-if="actionMode === 'attack'" class="stat-row"><span>可攻擊數</span><strong>{{ attackableEnemies.length }}</strong></div>
          <div v-if="moveStep === 'select_attack'" class="stat-row"><span>預覽命中數</span><strong>{{ attackPreviewVictims.length }}</strong></div>
          <div v-if="pendingAttack" class="stat-row"><span>讀條剩餘</span><strong>{{ pendingAttackRemainingMs }} ms</strong></div>
          <div v-if="pendingAttackTarget" class="stat-row"><span>生效目標</span><strong>{{ pendingAttackTarget.name }}</strong></div>
          <div v-if="pendingAttack" class="stat-row"><span>範圍命中數</span><strong>{{ pendingAttackVictims.length }}</strong></div>
          <div v-if="currentAttackPreviewFacing !== null" class="stat-row"><span>預覽方向</span><strong>{{ currentAttackPreviewFacing }}</strong></div>
          <div v-if="currentHazardPreviewCenterLabel" class="stat-row"><span>預覽中心</span><strong>{{ currentHazardPreviewCenterLabel }}</strong></div>
          <div v-if="pendingAttack" class="stat-row"><span>傷害區域</span><strong>{{ pendingAttack.area.kind }} / {{ pendingAttack.area.pattern }}</strong></div>
          <div v-if="pendingMoveTo" class="stat-row"><span>目標格</span><strong>{{ pendingMoveTo.q }},{{ pendingMoveTo.r }}</strong></div>
          <div class="step-actions">
            <button v-if="moveStep === 'select_facing'" class="btn-reset" @click="backToTargetStep">返回選位</button>
            <button v-if="moveStep !== 'idle'" class="btn-reset" @click="cancelMoveStep">取消操作</button>
          </div>
        </div>

        <div class="info-card">
          <h3 class="info-card__name">玩家單位</h3>
          <div class="unit-list">
            <button
              v-for="unit in playerUnits"
              :key="unit.id"
              :class="['unit-chip', selectedUnitId === unit.id && 'unit-chip--active']"
              @click="handleUnitClick(unit)"
            >
              <strong>{{ unit.name }}</strong>
              <span>{{ unit.hp }}/{{ unit.maxHp }} HP</span>
            </button>
          </div>
        </div>

        <div v-if="selectedPlayerUnit && actionMode === 'attack' && attackableEnemies.length > 0" class="info-card">
          <h3 class="info-card__name">鄰接敵人（快捷預覽）</h3>
          <div class="unit-list">
            <button
              v-for="unit in attackableEnemies"
              :key="unit.id"
              class="unit-chip unit-chip--enemy"
              @mouseenter="previewAttackTowardsUnit(unit)"
              @click="beginAttackModeFromUnit(unit)"
            >
              <strong>{{ unit.name }}</strong>
              <span>{{ unit.hp }}/{{ unit.maxHp }} HP</span>
            </button>
          </div>
        </div>

        <div class="info-card" v-if="selectedUnit">
          <h3 class="info-card__name">單位資訊</h3>
          <div class="stat-row"><span>名稱</span><strong>{{ selectedUnit.name }}</strong></div>
          <div class="stat-row"><span>陣營</span><strong>{{ selectedUnit.team }}</strong></div>
          <div class="stat-row"><span>HP</span><strong>{{ selectedUnit.hp }} / {{ selectedUnit.maxHp }}</strong></div>
          <div class="stat-row"><span>位置</span><strong>{{ selectedUnit.pos.q }},{{ selectedUnit.pos.r }}</strong></div>
          <div class="stat-row"><span>方向</span><strong>{{ selectedUnit.facing }}</strong></div>
          <div class="stat-row"><span>Move</span><strong>{{ selectedUnit.move }}</strong></div>
          <div class="stat-row"><span>Damage</span><strong>{{ selectedUnit.damage }}</strong></div>
        </div>

        <div class="info-card" v-if="lastAction">
          <h3 class="info-card__name">最後 Action</h3>
          <pre class="event-log">{{ JSON.stringify(lastAction, null, 2) }}</pre>
        </div>

        <div class="info-card">
          <h3 class="info-card__name">事件輸出</h3>
          <div v-if="lastEvents.length === 0" class="empty-text">尚未執行 action</div>
          <pre v-else class="event-log">{{ JSON.stringify(lastEvents, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { BattleAction, MoveSpec } from '../engine/actions'
import type { Event } from '../engine/events'
import type { BattleCell, CombatUnit, FacingDir, GameState } from '../engine/state'
import { createBuildupData } from '../engine/state'
import { reduce } from '../engine/reduce'
import type { DamageArea, DirectedAttackArea, GroundHazardArea } from '../game/schema'
import { axialToPixel, HEX_DIRECTIONS, hexDistance, hexKey, hexPoints, offsetToAxial } from '../game/hex'

type Cell = {
  key: string
  q: number
  r: number
  px: number
  py: number
}

type MoveStep = 'idle' | 'select_target' | 'select_facing' | 'select_attack' | 'attack_windup'
type ActionMode = 'move' | 'attack' | 'hazard' | 'combo'
type PendingAttack = {
  attackerId: string
  targetId: string | null
  readyAtMs: number
  area: DamageArea
}
type SpecialMoveMode = 'charge' | 'leap' | null

const COLS = 9
const ROWS = 7
const HEX_SIZE = 38
const PAD = 52
const HEX_PTS = hexPoints(HEX_SIZE)
const FACING_TRIANGLE_PTS = '0,-22 8,-8 -8,-8'
const ATTACK_WINDUP_MS = 900

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

function makeBattleState(): GameState {
  const units = [
    makeUnit({ id: 'p_wolf', name: '狼牙', team: 'player', certId: 'cert_wolf_guard', pos: offsetToAxial(2, 2), facing: 0, move: 3, damage: 34 }),
    makeUnit({ id: 'p_weave', name: '妖織', team: 'player', certId: 'cert_weave_wind', pos: offsetToAxial(2, 4), facing: 0, move: 4, damage: 24 }),
    makeUnit({ id: 'e_guard_a', name: '哨兵甲', team: 'enemy', certId: 'cert_dummy_target', pos: offsetToAxial(6, 2), facing: 3, move: 3, damage: 26 }),
    makeUnit({ id: 'e_guard_b', name: '哨兵乙', team: 'enemy', certId: 'cert_dummy_target', pos: offsetToAxial(6, 4), facing: 3, move: 3, damage: 26 }),
  ]

  const unitRecord: Record<string, CombatUnit> = {}
  for (const unit of units) {
    unitRecord[unit.id] = unit
  }

  return {
    phase: 'running',
    timeline: {
      tick: 0,
      pendingUnitId: null,
      entries: units.map((unit) => ({ unitId: unit.id, atb: 100, castRemaining: 0, recoveryRemaining: 0, speedMult: 1 })),
    },
    units: unitRecord,
    cells: makeCells(),
  }
}

const showCoords = ref(false)
const state = ref<GameState>(makeBattleState())
const selectedUnitId = ref<string | null>(null)
const moveStep = ref<MoveStep>('idle')
const actionMode = ref<ActionMode>('move')
const pendingMoveTo = ref<{ q: number; r: number } | null>(null)
const pendingAttack = ref<PendingAttack | null>(null)
const attackPreviewDir = ref<FacingDir | null>(null)
const hazardPreviewCenter = ref<{ q: number; r: number } | null>(null)
const queuedFollowup = ref<'attack' | null>(null)
const specialMoveMode = ref<SpecialMoveMode>(null)
const lastEvents = ref<Event[]>([])
const lastAction = ref<BattleAction | null>(null)
const facingOptions = [0, 1, 2, 3, 4, 5] as const
const nowMs = ref(Date.now())
let attackTimerId: number | null = null
let clockTimerId: number | null = null

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

const svgWidth = computed(() => {
  const maxX = Math.max(...cells.value.map((cell) => cell.px))
  return maxX + PAD * 2 + HEX_SIZE * Math.sqrt(3) / 2
})

const svgHeight = computed(() => {
  const maxY = Math.max(...cells.value.map((cell) => cell.py))
  return maxY + PAD * 2 + HEX_SIZE
})

const aliveUnits = computed(() => Object.values(state.value.units).filter((unit) => !unit.isDead))
const playerUnits = computed(() => aliveUnits.value.filter((unit) => unit.team === 'player'))
const selectedUnit = computed(() => selectedUnitId.value ? state.value.units[selectedUnitId.value] ?? null : null)
const selectedPlayerUnit = computed(() => selectedUnit.value?.team === 'player' ? selectedUnit.value : null)
const attackableEnemies = computed(() => {
  if (!selectedPlayerUnit.value || moveStep.value !== 'idle') return []
  return aliveUnits.value.filter((unit) =>
    unit.team === 'enemy' && hexDistance(selectedPlayerUnit.value!.pos, unit.pos) === 1,
  )
})
const pendingAttackRemainingMs = computed(() =>
  pendingAttack.value ? Math.max(0, pendingAttack.value.readyAtMs - nowMs.value) : 0,
)
const pendingAttackTarget = computed(() =>
  pendingAttack.value && pendingAttack.value.targetId ? state.value.units[pendingAttack.value.targetId] ?? null : null,
)
const pendingAttackVictims = computed(() => {
  const pending = pendingAttack.value
  if (!pending) return []
  return findEnemyVictimsInArea(pending.area)
})
const attackPreviewVictims = computed(() => findEnemyVictimsInArea(currentPreviewArea()))
const currentAttackPreviewFacing = computed(() => {
  const area = currentPreviewArea()
  return area?.kind === 'directed_attack' ? area.facing : null
})
const currentHazardPreviewCenterLabel = computed(() => {
  const area = currentPreviewArea()
  return area?.kind === 'ground_hazard' ? `${area.center.q},${area.center.r}` : ''
})
const attackModeKind = computed(() => {
  if (actionMode.value === 'hazard') return 'ground_hazard'
  if (actionMode.value === 'attack') return 'directed_attack'
  return '-'
})
const reachableMoveKeys = computed(() => {
  const unit = selectedPlayerUnit.value
  if (!unit || moveStep.value !== 'select_target') return new Set<string>()

  const moveSpec = currentMoveSpec()
  const maxSteps = currentMoveRange()
  const visited = new Set<string>([hexKey(unit.pos.q, unit.pos.r)])
  const reachable = new Set<string>()
  const queue: Array<{ q: number; r: number; steps: number }> = [{ q: unit.pos.q, r: unit.pos.r, steps: 0 }]

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current.steps >= maxSteps) continue

    for (const dir of HEX_DIRECTIONS) {
      const next = { q: current.q + dir.q, r: current.r + dir.r }
      const key = hexKey(next.q, next.r)
      if (visited.has(key)) continue
      visited.add(key)

      const destination = state.value.cells[key]
      if (!destination) continue
      if (!moveSpec?.ignoreTerrain && !destination.passable) continue
      if (isCellOccupied(next.q, next.r, unit.id) && !moveSpec?.ignoreUnits) continue
      if (moveSpec?.routeRule === 'straight_line' && !isStraightLineReach(unit.pos, next)) continue

      reachable.add(key)
      queue.push({ q: next.q, r: next.r, steps: current.steps + 1 })
    }
  }

  return reachable
})
const displayedUnits = computed(() => aliveUnits.value.map((unit) => {
  if (moveStep.value === 'select_facing' && pendingMoveTo.value && selectedPlayerUnit.value?.id === unit.id) {
    return { ...unit, pos: { ...pendingMoveTo.value } }
  }
  return unit
}))
const facingWheelUnits = computed(() => {
  if (!selectedPlayerUnit.value) return []
  if (moveStep.value === 'select_facing' && pendingMoveTo.value) {
    return [{ ...selectedPlayerUnit.value, pos: { ...pendingMoveTo.value } }]
  }
  if (moveStep.value === 'select_attack') {
    return [{ ...selectedPlayerUnit.value }]
  }
  return []
})
const moveStepLabel = computed(() => {
  switch (moveStep.value) {
    case 'select_target':
      return '選擇位置'
    case 'select_facing':
      return '選擇方向'
    case 'select_attack':
      return actionMode.value === 'hazard' ? '選擇地板區域' : '預覽攻擊方向'
    case 'attack_windup':
      return '攻擊讀條中'
    default:
      return '待命'
  }
})
const actionModeLabel = computed(() => {
  if (actionMode.value === 'attack') return '攻擊'
  if (actionMode.value === 'hazard') return '地板傷害'
  if (actionMode.value === 'combo') return '連續動作'
  return '移動'
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

function isFacingWheelDirActive(unit: CombatUnit, dir: (typeof facingOptions)[number]): boolean {
  if (moveStep.value === 'select_attack') return attackPreviewDir.value === dir
  return unit.facing === dir
}

function isCellOccupied(q: number, r: number, excludeUnitId?: string): boolean {
  return aliveUnits.value.some((unit) => unit.id !== excludeUnitId && unit.pos.q === q && unit.pos.r === r)
}

function isMoveCellSelectable(cell: Cell): boolean {
  if (!selectedPlayerUnit.value) return false
  const moveSpec = currentMoveSpec()
  if (isCellOccupied(cell.q, cell.r, selectedPlayerUnit.value.id) && !moveSpec?.ignoreUnits) return false
  const destination = state.value.cells[hexKey(cell.q, cell.r)]
  if (!destination || (!moveSpec?.ignoreTerrain && !destination.passable)) return false
  return reachableMoveKeys.value.has(hexKey(cell.q, cell.r))
}

function dirOffset(origin: { q: number; r: number }, dir: FacingDir): { q: number; r: number } {
  const vec = HEX_DIRECTIONS[dir] ?? HEX_DIRECTIONS[0]!
  return { q: origin.q + vec.q, r: origin.r + vec.r }
}

function buildMeleeWarningCells(origin: { q: number; r: number }, facing: FacingDir): { q: number; r: number }[] {
  const left = ((facing + 5) % 6) as FacingDir
  const right = ((facing + 1) % 6) as FacingDir
  return [dirOffset(origin, left), dirOffset(origin, facing), dirOffset(origin, right)]
}

function makeDirectedAttackArea(origin: { q: number; r: number }, facing: FacingDir): DirectedAttackArea {
  return {
    kind: 'directed_attack',
    origin: { ...origin },
    facing,
    pattern: 'front_arc_3',
    warningCells: buildMeleeWarningCells(origin, facing),
  }
}

function makeGroundHazardArea(center: { q: number; r: number }): GroundHazardArea {
  return {
    kind: 'ground_hazard',
    center: { ...center },
    pattern: 'radius_1',
    warningCells: [{ ...center }],
    durationMs: ATTACK_WINDUP_MS,
    tickMs: ATTACK_WINDUP_MS,
  }
}

function findNearestFacingDir(from: { q: number; r: number }, to: { q: number; r: number }): FacingDir | null {
  if (from.q === to.q && from.r === to.r) return null

  const fromPx = axialToPixel(from.q, from.r, 1)
  const toPx = axialToPixel(to.q, to.r, 1)
  const dx = toPx.x - fromPx.x
  const dy = toPx.y - fromPx.y
  let bestDir: FacingDir = 0
  let bestScore = -Infinity

  for (const dir of facingOptions) {
    const vec = HEX_DIRECTIONS[dir] ?? HEX_DIRECTIONS[0]!
    const dirPx = axialToPixel(vec.q, vec.r, 1)
    const score = dx * dirPx.x + dy * dirPx.y
    if (score > bestScore) {
      bestScore = score
      bestDir = dir
    }
  }

  return bestDir
}

function isStraightLineReach(from: { q: number; r: number }, to: { q: number; r: number }): boolean {
  const dq = to.q - from.q
  const dr = to.r - from.r
  if (dq === 0 && dr === 0) return true
  return HEX_DIRECTIONS.some((dir) => {
    if (dir.q === 0) return dq === 0 && dr !== 0 && Math.sign(dr) === Math.sign(dir.r)
    if (dir.r === 0) return dr === 0 && dq !== 0 && Math.sign(dq) === Math.sign(dir.q)
    return dq !== 0 && dr !== 0 && dq * dir.r === dr * dir.q && Math.sign(dq) === Math.sign(dir.q) && Math.sign(dr) === Math.sign(dir.r)
  })
}

function currentMoveSpec(): MoveSpec | undefined {
  if (specialMoveMode.value === 'charge') {
    return {
      mode: 'charge',
      routeRule: 'straight_line',
      maxRangeOverride: Math.max(4, selectedPlayerUnit.value?.move ?? 4),
    }
  }
  if (specialMoveMode.value === 'leap') {
    return {
      mode: 'leap',
      ignoreTerrain: true,
      ignoreUnits: true,
      maxRangeOverride: Math.max(4, selectedPlayerUnit.value?.move ?? 4),
    }
  }
  return undefined
}

function currentMoveRange(): number {
  return currentMoveSpec()?.maxRangeOverride ?? selectedPlayerUnit.value?.move ?? 0
}

function currentAttackPreviewArea(): DirectedAttackArea | null {
  if (moveStep.value !== 'select_attack' || !selectedPlayerUnit.value || attackPreviewDir.value === null) return null
  return makeDirectedAttackArea(selectedPlayerUnit.value.pos, attackPreviewDir.value)
}

function currentPreviewArea(): DamageArea | null {
  if (moveStep.value !== 'select_attack') return null
  if (actionMode.value === 'hazard') {
    return hazardPreviewCenter.value ? makeGroundHazardArea(hazardPreviewCenter.value) : null
  }
  return currentAttackPreviewArea()
}

function getAreaCells(area: DamageArea | null | undefined): { q: number; r: number }[] {
  return area?.warningCells ?? []
}

function findEnemyVictimsInArea(area: DamageArea | null | undefined): CombatUnit[] {
  const cells = getAreaCells(area)
  if (cells.length === 0) return []
  return aliveUnits.value.filter((unit) =>
    unit.team === 'enemy' && cells.some((cell) => cell.q === unit.pos.q && cell.r === unit.pos.r),
  )
}

function findPreviewVictim(area: DamageArea | null | undefined): CombatUnit | null {
  return findEnemyVictimsInArea(area)[0] ?? null
}

function cellStateClass(cell: Cell): string {
  const occupant = aliveUnits.value.find((unit) => unit.pos.q === cell.q && unit.pos.r === cell.r)
  if (getAreaCells(pendingAttack.value?.area).some((warning) => warning.q === cell.q && warning.r === cell.r)) {
    return 'hex-cell--warning'
  }
  if (getAreaCells(currentPreviewArea()).some((warning) => warning.q === cell.q && warning.r === cell.r)) {
    return 'hex-cell--preview'
  }
  if (moveStep.value === 'select_target' && isMoveCellSelectable(cell)) return 'hex-cell--move-target'
  if (selectedPlayerUnit.value && selectedPlayerUnit.value.pos.q === cell.q && selectedPlayerUnit.value.pos.r === cell.r) {
    return 'hex-cell--selected-unit'
  }
  if (occupant?.team === 'enemy' && selectedPlayerUnit.value && hexDistance(selectedPlayerUnit.value.pos, occupant.pos) === 1) {
    return 'hex-cell--attack'
  }
  return 'hex-cell--default'
}

function commitAction(action: BattleAction) {
  const result = reduce(state.value, action)
  state.value = result.newState
  lastEvents.value = result.events
  lastAction.value = action
}

function clearPendingAttack() {
  if (attackTimerId !== null) {
    window.clearTimeout(attackTimerId)
    attackTimerId = null
  }
  pendingAttack.value = null
}

function clearAttackPreview() {
  attackPreviewDir.value = null
  hazardPreviewCenter.value = null
}

function clearQueuedFollowup() {
  queuedFollowup.value = null
}

function clearSpecialMoveMode() {
  specialMoveMode.value = null
}

function ensureClock() {
  if (clockTimerId !== null) return
  clockTimerId = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 100)
}

function stopClockIfIdle() {
  if (pendingAttack.value || clockTimerId === null) return
  window.clearInterval(clockTimerId)
  clockTimerId = null
}

function setUnitFacing(unitId: string, facing: FacingDir) {
  const unit = state.value.units[unitId]
  if (!unit) return
  state.value = {
    ...state.value,
    units: {
      ...state.value.units,
      [unitId]: {
        ...unit,
        facing,
      },
    },
  }
}

function resolvePendingAttack() {
  const pending = pendingAttack.value
  if (!pending) return

  clearPendingAttack()

  const attacker = state.value.units[pending.attackerId]
  const lockedTarget = pending.targetId ? state.value.units[pending.targetId] : null
  const victims = !attacker || attacker.isDead
    ? []
    : findEnemyVictimsInArea(pending.area)
  const primaryTarget = pending.targetId
    ? victims.find((unit) => unit.id === pending.targetId) ?? victims[0] ?? null
    : victims[0] ?? null

  if (!attacker || attacker.isDead || victims.length === 0 || !primaryTarget) {
    lastEvents.value = lockedTarget
      ? [{ type: 'ATTACK_MISSED', sourceId: pending.attackerId, targetId: lockedTarget.id, pos: lockedTarget.pos }]
      : []
    moveStep.value = 'idle'
    selectedUnitId.value = null
    actionMode.value = 'move'
    clearQueuedFollowup()
    stopClockIfIdle()
    return
  }

  if (pending.area.kind === 'ground_hazard') {
    const damage = Math.max(1, Math.floor(attacker.damage * 0.5))
    const nextUnits = { ...state.value.units }
    const hazardEvents: Event[] = victims.map((unit) => {
      const nextHp = Math.max(0, unit.hp - damage)
      nextUnits[unit.id] = {
        ...unit,
        hp: nextHp,
        isDead: nextHp <= 0,
      }
      return {
        type: 'DAMAGE_DEALT',
        sourceId: pending.attackerId,
        targetId: unit.id,
        amount: damage,
        damageType: 'arcane',
        isBackstab: false,
        pos: unit.pos,
      }
    })
    state.value = {
      ...state.value,
      units: nextUnits,
    }
    lastEvents.value = hazardEvents
    lastAction.value = null
    selectedUnitId.value = null
    moveStep.value = 'idle'
    actionMode.value = 'move'
    clearQueuedFollowup()
    stopClockIfIdle()
    return
  }

  commitAction({
    type: 'ATTACK',
    attackerId: pending.attackerId,
    targetIds: victims.map((v) => v.id),
    profile: {
      baseDamage: attacker.damage,
      damageType: 'slash',
      elementType: 'none',
      attackClass: 'melee',
      canBackstab: true,
    },
    recoveryMs: 18,
  })
  selectedUnitId.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  clearQueuedFollowup()
  stopClockIfIdle()
}

function startAttackWindupByDirection(attacker: CombatUnit, facing: FacingDir, targetId: string | null = null) {

  clearPendingAttack()
  clearAttackPreview()
  clearQueuedFollowup()
  setUnitFacing(attacker.id, facing)
  selectedUnitId.value = attacker.id
  moveStep.value = 'attack_windup'
  actionMode.value = 'attack'

  const readyAtMs = Date.now() + ATTACK_WINDUP_MS
  const area = makeDirectedAttackArea(attacker.pos, facing)
  pendingAttack.value = {
    attackerId: attacker.id,
    targetId,
    readyAtMs,
    area,
  }
  nowMs.value = Date.now()
  ensureClock()
  lastAction.value = {
    type: 'ATTACK',
    attackerId: attacker.id,
    targetIds: targetId ? [targetId] : [],
    profile: {
      baseDamage: attacker.damage,
      damageType: 'slash',
      elementType: 'none',
      attackClass: 'melee',
      canBackstab: true,
    },
    recoveryMs: 18,
  }
  lastEvents.value = [{
    type: 'CAST_STARTED',
    unitId: attacker.id,
    castTimeMs: ATTACK_WINDUP_MS,
    warningCells: area.warningCells,
  }]
  attackTimerId = window.setTimeout(() => {
    attackTimerId = null
    resolvePendingAttack()
  }, ATTACK_WINDUP_MS)
}

function startHazardWindup(attacker: CombatUnit, center: { q: number; r: number }) {
  clearPendingAttack()
  clearAttackPreview()
  clearQueuedFollowup()
  selectedUnitId.value = attacker.id
  moveStep.value = 'attack_windup'
  actionMode.value = 'hazard'

  const readyAtMs = Date.now() + ATTACK_WINDUP_MS
  const area = makeGroundHazardArea(center)
  const previewVictim = findPreviewVictim(area)
  pendingAttack.value = {
    attackerId: attacker.id,
    targetId: previewVictim?.id ?? null,
    readyAtMs,
    area,
  }
  nowMs.value = Date.now()
  ensureClock()
  lastAction.value = null
  lastEvents.value = [{
    type: 'CAST_STARTED',
    unitId: attacker.id,
    castTimeMs: ATTACK_WINDUP_MS,
    warningCells: area.warningCells,
  }]
  attackTimerId = window.setTimeout(() => {
    attackTimerId = null
    resolvePendingAttack()
  }, ATTACK_WINDUP_MS)
}

function handleUnitClick(unit: CombatUnit) {
  if (moveStep.value === 'attack_windup') return
  if (moveStep.value !== 'idle' && moveStep.value !== 'select_attack' && unit.team !== 'player') return

  if (unit.team === 'player') {
    selectedUnitId.value = unit.id
    clearQueuedFollowup()
    if (actionMode.value === 'hazard') {
      moveStep.value = 'select_attack'
      hazardPreviewCenter.value = { ...unit.pos }
    }
    else if (actionMode.value === 'attack') {
      moveStep.value = 'select_attack'
      attackPreviewDir.value = unit.facing
    }
    else {
      actionMode.value = 'move'
      moveStep.value = 'select_target'
    }
    pendingMoveTo.value = null
    if (actionMode.value !== 'hazard' && actionMode.value !== 'attack') clearAttackPreview()
    return
  }

  if (!selectedPlayerUnit.value) {
    selectedUnitId.value = unit.id
    return
  }

  if (moveStep.value === 'select_attack') return
  return
}

function handleCellHover(cell: Cell) {
  if (moveStep.value !== 'select_attack' || !selectedPlayerUnit.value) return
  if (actionMode.value === 'hazard') {
    hazardPreviewCenter.value = { q: cell.q, r: cell.r }
    return
  }
  attackPreviewDir.value = findNearestFacingDir(selectedPlayerUnit.value.pos, { q: cell.q, r: cell.r })
}

function handleCellClick(cell: Cell) {
  if (moveStep.value === 'attack_windup') return
  if (moveStep.value === 'select_attack') {
    const actor = selectedPlayerUnit.value
    if (!actor) return
    if (actionMode.value === 'hazard') {
      startHazardWindup(actor, { q: cell.q, r: cell.r })
      return
    }
    const dir = findNearestFacingDir(actor.pos, { q: cell.q, r: cell.r })
    if (dir === null) return
    const area = makeDirectedAttackArea(actor.pos, dir)
    const previewVictim = findPreviewVictim(area)
    startAttackWindupByDirection(actor, dir, previewVictim?.id ?? null)
    return
  }
  if (moveStep.value !== 'select_target' || !selectedPlayerUnit.value) return
  if (!isMoveCellSelectable(cell)) return
  if (queuedFollowup.value === 'attack') {
    const unitId = selectedPlayerUnit.value.id
    const nextPos = { q: cell.q, r: cell.r }
    commitAction({
      type: 'MOVE',
      unitId,
      to: nextPos,
      facing: selectedPlayerUnit.value.facing,
      recoveryMs: 8,
    })
    selectedUnitId.value = unitId
    pendingMoveTo.value = null
    actionMode.value = 'attack'
    attackPreviewDir.value = state.value.units[unitId]?.facing ?? selectedPlayerUnit.value.facing
    moveStep.value = 'select_attack'
    clearQueuedFollowup()
    return
  }
  if (specialMoveMode.value) {
    const unitId = selectedPlayerUnit.value.id
    commitAction({
      type: 'MOVE',
      unitId,
      to: { q: cell.q, r: cell.r },
      facing: selectedPlayerUnit.value.facing,
      moveSpec: currentMoveSpec(),
      recoveryMs: 8,
    })
    selectedUnitId.value = unitId
    pendingMoveTo.value = null
    moveStep.value = 'idle'
    actionMode.value = 'move'
    clearSpecialMoveMode()
    clearQueuedFollowup()
    return
  }
  pendingMoveTo.value = { q: cell.q, r: cell.r }
  moveStep.value = 'select_facing'
}

function applyFacing(dir: FacingDir) {
  if (!selectedPlayerUnit.value || !pendingMoveTo.value) return
  const unitId = selectedPlayerUnit.value.id
  commitAction({
    type: 'MOVE',
    unitId,
    to: { ...pendingMoveTo.value },
    facing: dir,
    recoveryMs: 8,
  })
  actionMode.value = 'move'
  moveStep.value = 'idle'
  pendingMoveTo.value = null
  selectedUnitId.value = unitId
  clearSpecialMoveMode()
  clearQueuedFollowup()
}

function handleFacingWheelHover(dir: FacingDir) {
  if (moveStep.value === 'select_attack' && actionMode.value !== 'hazard') {
    attackPreviewDir.value = dir
  }
}

function handleFacingWheelClick(dir: FacingDir) {
  if (moveStep.value === 'select_attack' && actionMode.value !== 'hazard') {
    const actor = selectedPlayerUnit.value
    if (!actor) return
    const area = makeDirectedAttackArea(actor.pos, dir)
    const previewVictim = findPreviewVictim(area)
    startAttackWindupByDirection(actor, dir, previewVictim?.id ?? null)
    return
  }
  applyFacing(dir)
}

function passTurn() {
  if (moveStep.value === 'attack_windup') return
  if (!selectedPlayerUnit.value) return
  commitAction({
    type: 'PASS',
    unitId: selectedPlayerUnit.value.id,
    recoveryMs: 8,
  })
  selectedUnitId.value = null
  actionMode.value = 'move'
  moveStep.value = 'idle'
  pendingMoveTo.value = null
  clearAttackPreview()
  clearSpecialMoveMode()
  clearQueuedFollowup()
}

function backToTargetStep() {
  pendingMoveTo.value = null
  clearAttackPreview()
  clearSpecialMoveMode()
  actionMode.value = 'move'
  moveStep.value = 'idle'
  clearQueuedFollowup()
}

function cancelMoveStep() {
  clearPendingAttack()
  stopClockIfIdle()
  pendingMoveTo.value = null
  clearAttackPreview()
  clearSpecialMoveMode()
  actionMode.value = 'move'
  moveStep.value = 'idle'
  clearQueuedFollowup()
}

function beginMoveMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'move'
  clearAttackPreview()
  clearSpecialMoveMode()
  clearQueuedFollowup()
  pendingMoveTo.value = null
  moveStep.value = 'select_target'
}

function beginAttackMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'attack'
  clearSpecialMoveMode()
  clearQueuedFollowup()
  pendingMoveTo.value = null
  attackPreviewDir.value = selectedPlayerUnit.value.facing
  moveStep.value = 'select_attack'
}

function beginHazardMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'hazard'
  clearSpecialMoveMode()
  clearQueuedFollowup()
  pendingMoveTo.value = null
  attackPreviewDir.value = null
  hazardPreviewCenter.value = { ...selectedPlayerUnit.value.pos }
  moveStep.value = 'select_attack'
}

function beginChargeMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'move'
  specialMoveMode.value = 'charge'
  clearAttackPreview()
  clearQueuedFollowup()
  pendingMoveTo.value = null
  moveStep.value = 'select_target'
}

function beginLeapMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'move'
  specialMoveMode.value = 'leap'
  clearAttackPreview()
  clearQueuedFollowup()
  pendingMoveTo.value = null
  moveStep.value = 'select_target'
}

function beginComboMode() {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'combo'
  queuedFollowup.value = 'attack'
  clearAttackPreview()
  clearSpecialMoveMode()
  pendingMoveTo.value = null
  moveStep.value = 'select_target'
}

function previewAttackTowardsUnit(unit: CombatUnit) {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  actionMode.value = 'attack'
  moveStep.value = 'select_attack'
  attackPreviewDir.value = findNearestFacingDir(selectedPlayerUnit.value.pos, unit.pos)
}

function beginAttackModeFromUnit(unit: CombatUnit) {
  if (!selectedPlayerUnit.value || moveStep.value === 'attack_windup') return
  const dir = findNearestFacingDir(selectedPlayerUnit.value.pos, unit.pos)
  if (dir === null) return
  startAttackWindupByDirection(selectedPlayerUnit.value, dir, unit.id)
}

function resetBattle() {
  clearPendingAttack()
  if (clockTimerId !== null) {
    window.clearInterval(clockTimerId)
    clockTimerId = null
  }
  state.value = makeBattleState()
  selectedUnitId.value = null
  moveStep.value = 'idle'
  actionMode.value = 'move'
  pendingMoveTo.value = null
  pendingAttack.value = null
  clearAttackPreview()
  clearSpecialMoveMode()
  clearQueuedFollowup()
  lastEvents.value = []
  lastAction.value = null
}

onBeforeUnmount(() => {
  clearPendingAttack()
  if (clockTimerId !== null) {
    window.clearInterval(clockTimerId)
  }
})
</script>

<style scoped>
.battle-wrapper { display: flex; flex-direction: column; gap: 16px; }
.battle-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.battle-title { margin: 0; font-size: 22px; }
.battle-toolbar__controls { display: flex; align-items: center; gap: 14px; }
.toggle-label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #7d6852; }
.btn-reset { padding: 8px 16px; border-radius: 10px; border: 1px solid rgba(154, 108, 61, 0.25); background: rgba(255, 251, 245, 0.9); color: #6b4c2a; font: inherit; font-size: 14px; cursor: pointer; }
.btn-reset--active { background: rgba(196, 142, 37, 0.16); border-color: rgba(196, 142, 37, 0.56); color: #7a4d11; }
.btn-reset:disabled { opacity: 0.45; cursor: not-allowed; }
.battle-scene { display: flex; align-items: flex-start; gap: 20px; overflow-x: auto; }
.battle-svg { flex-shrink: 0; border-radius: 20px; background: rgba(255, 251, 245, 0.88); border: 1px solid rgba(131, 102, 70, 0.14); box-shadow: 0 8px 28px rgba(125, 99, 71, 0.1); }
.hex-cell { transition: fill 0.12s; stroke: rgba(174, 141, 103, 0.45); stroke-width: 1.2; }
.hex-cell--default { fill: rgba(240, 230, 210, 0.6); }
.hex-cell--move-target { fill: rgba(100, 160, 210, 0.28); stroke: rgba(80, 140, 200, 0.6); }
.hex-cell--attack { fill: rgba(210, 110, 80, 0.18); stroke: rgba(190, 90, 60, 0.45); }
.hex-cell--preview { fill: rgba(226, 181, 94, 0.18); stroke: rgba(196, 142, 37, 0.68); }
.hex-cell--warning { fill: rgba(228, 144, 73, 0.22); stroke: rgba(214, 118, 39, 0.72); }
.hex-cell--selected-unit { fill: rgba(100, 160, 210, 0.18); }
.hex-coord { fill: rgba(154, 108, 61, 0.55); font-size: 9px; font-family: 'JetBrains Mono', monospace; pointer-events: none; user-select: none; }
.hex-unit-group { cursor: pointer; }
.unit-select-ring { fill: none; stroke: #fff; stroke-width: 2.5; filter: drop-shadow(0 0 4px rgba(255,255,255,0.8)); }
.unit-circle--player { fill: #5085c4; }
.unit-circle--enemy { fill: #c45040; }
.hp-bar--player { fill: #6bc79a; }
.hp-bar--enemy { fill: #e87c66; }
.facing-indicator { stroke: #fff; stroke-width: 1.6; filter: drop-shadow(0 0 2px rgba(255,255,255,0.5)); }
.facing-indicator--player { fill: #5d91ce; }
.facing-indicator--enemy { fill: #d76655; }
.facing-wheel { pointer-events: none; }
.facing-wheel__node { pointer-events: all; cursor: pointer; }
.facing-wheel__dot { fill: rgba(255, 250, 243, 0.92); stroke: rgba(117, 88, 59, 0.4); stroke-width: 1.5; filter: drop-shadow(0 3px 8px rgba(125, 99, 71, 0.28)); }
.facing-wheel__dot--active { fill: #5d91ce; stroke: #fff; }
.facing-wheel__label { font-size: 11px; font-weight: 700; fill: #6b4c2a; user-select: none; pointer-events: none; }
.battle-info-panel { width: 320px; flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
.info-card { padding: 18px; border-radius: 18px; background: rgba(255, 251, 245, 0.9); border: 1px solid rgba(131, 102, 70, 0.14); box-shadow: 0 6px 20px rgba(125, 99, 71, 0.07); }
.info-card__name { margin: 0 0 12px; font-size: 18px; }
.stat-row { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; border-radius: 10px; background: rgba(120, 94, 65, 0.06); font-size: 13px; margin-bottom: 8px; }
.stat-row span { color: #8a7763; }
.step-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.unit-list { display: grid; gap: 8px; }
.unit-chip { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(154, 108, 61, 0.18); background: rgba(255,255,255,0.72); cursor: pointer; text-align: left; font: inherit; color: inherit; }
.unit-chip--active { border-color: rgba(80, 133, 196, 0.42); background: rgba(80, 133, 196, 0.08); }
.unit-chip--enemy { border-color: rgba(190, 90, 60, 0.25); background: rgba(210, 110, 80, 0.08); }
.unit-chip span { font-size: 12px; color: #8a7763; }
.event-log { margin: 0; padding: 12px; border-radius: 12px; background: rgba(120, 94, 65, 0.08); font-size: 12px; overflow: auto; }
.empty-text { color: #9a8070; font-size: 13px; }
</style>
