<template>
  <div class="hex-wrapper">
    <!-- 頭部工具列 -->
    <div class="hex-toolbar">
      <h2 class="hex-title">六角格戰場原型</h2>
      <div class="hex-toolbar__controls">
        <label class="toggle-label">
          <input type="checkbox" v-model="showCoords" />
          顯示座標
        </label>
        <button class="btn-reset" @click="resetUnits">重置位置</button>
      </div>
    </div>

    <!-- 主戰場 -->
    <div class="hex-scene">
      <svg
        :width="svgWidth"
        :height="svgHeight"
        class="hex-svg"
        @click.self="clearSelection"
      >
        <!-- 格子 -->
        <g
          v-for="cell in cells"
          :key="cell.key"
          @click="onCellClick(cell)"
          @mouseenter="hoveredKey = cell.key"
          @mouseleave="hoveredKey = null"
          class="hex-cell-group"
        >
          <polygon
            :points="HEX_PTS"
            :transform="`translate(${cell.px + PAD}, ${cell.py + PAD})`"
            :class="['hex-cell', cellStateClass(cell)]"
          />
          <!-- 座標標籤 -->
          <text
            v-if="showCoords"
            :x="cell.px + PAD"
            :y="cell.py + PAD + 5"
            class="hex-coord"
            text-anchor="middle"
          >{{ cell.q }},{{ cell.r }}</text>
        </g>

        <!-- 單位 -->
        <g
          v-for="unit in units"
          :key="unit.id"
          :transform="`translate(${unitPx(unit).x + PAD}, ${unitPx(unit).y + PAD})`"
          @click.stop="onUnitClick(unit)"
          class="hex-unit-group"
        >
          <!-- 選中外環 -->
          <circle
            v-if="selectedUnitId === unit.id"
            :r="HEX_SIZE * 0.58"
            class="unit-select-ring"
          />
          <!-- 主體 -->
          <circle
            :r="HEX_SIZE * 0.48"
            :class="['unit-circle', unit.team === 'player' ? 'unit-circle--player' : 'unit-circle--enemy']"
          />
          <!-- 名稱縮寫 -->
          <text
            text-anchor="middle"
            dy="1"
            :font-size="HEX_SIZE * 0.3"
            font-weight="700"
            fill="#fff"
            style="pointer-events:none; user-select:none"
          >{{ unit.shortName }}</text>
          <!-- HP 背景條 -->
          <rect
            :x="-HEX_SIZE * 0.42"
            :y="HEX_SIZE * 0.4"
            :width="HEX_SIZE * 0.84"
            height="5"
            rx="2"
            fill="rgba(0,0,0,0.3)"
          />
          <!-- HP 前景條 -->
          <rect
            :x="-HEX_SIZE * 0.42"
            :y="HEX_SIZE * 0.4"
            :width="HEX_SIZE * 0.84 * (unit.hp / unit.maxHp)"
            height="5"
            rx="2"
            :class="unit.team === 'player' ? 'hp-bar--player' : 'hp-bar--enemy'"
          />
        </g>
      </svg>

      <!-- 右側資訊面板 -->
      <div class="hex-info-panel">
        <!-- 選中單位 -->
        <div v-if="selectedUnit" class="info-card info-card--selected">
          <div class="info-card__badge" :class="selectedUnit.team === 'player' ? 'badge--player' : 'badge--enemy'">
            {{ selectedUnit.team === 'player' ? '己方' : '敵方' }}
          </div>
          <h3 class="info-card__name">{{ selectedUnit.name }}</h3>
          <div class="info-card__stats">
            <div class="stat-row"><span>HP</span><strong>{{ selectedUnit.hp }} / {{ selectedUnit.maxHp }}</strong></div>
            <div class="stat-row"><span>移動</span><strong>{{ selectedUnit.move }}</strong></div>
            <div class="stat-row"><span>傷害</span><strong>{{ selectedUnit.damage }}</strong></div>
            <div class="stat-row"><span>打斷</span><strong>{{ selectedUnit.interrupt }}</strong></div>
            <div class="stat-row"><span>位置</span><strong>q={{ selectedUnit.q }}, r={{ selectedUnit.r }}</strong></div>
          </div>
          <div v-if="selectedUnit.team === 'player'" class="info-card__hint">
            點擊 <span class="legend-dot legend-dot--move"></span> 藍色格子移動
          </div>
          <button class="btn-deselect" @click="clearSelection">取消選擇</button>
        </div>

        <!-- 未選中時的說明 -->
        <div v-else class="info-card info-card--idle">
          <p class="info-idle-text">點擊單位查看資訊</p>
          <div class="legend">
            <div class="legend-item">
              <span class="legend-dot legend-dot--player"></span> 己方單位
            </div>
            <div class="legend-item">
              <span class="legend-dot legend-dot--enemy"></span> 敵方單位
            </div>
            <div class="legend-item">
              <span class="legend-dot legend-dot--move"></span> 移動範圍
            </div>
            <div class="legend-item">
              <span class="legend-dot legend-dot--attack"></span> 攻擊範圍
            </div>
          </div>
          <div class="grid-info">
            <p>格子數: {{ cells.length }}</p>
            <p>座標系: axial (q, r)</p>
            <p>格子類型: pointy-top</p>
          </div>
        </div>

        <!-- 格子資訊 -->
        <div v-if="hoveredCell" class="info-card info-card--hover">
          <p class="hover-coord">q={{ hoveredCell.q }}, r={{ hoveredCell.r }}</p>
          <p v-if="hoveredCellUnit" class="hover-unit">{{ hoveredCellUnit.name }}</p>
          <p v-if="selectedUnit && isInMoveRange(hoveredCell)" class="hover-hint">可移動</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  offsetToAxial,
  axialToPixel,
  hexRange,
  hexPoints,
  hexKey,
} from '../game/hex'
import type { HexCoord } from '../game/hex'

// ─── 常數 ──────────────────────────────────────────────────────────────────────

const COLS = 9
const ROWS = 7
const HEX_SIZE = 38        // circumradius（六角形頂點到中心距離）
const PAD = 52             // SVG padding

const HEX_PTS = hexPoints(HEX_SIZE)

// ─── 型別 ──────────────────────────────────────────────────────────────────────

type Cell = {
  key: string
  q: number
  r: number
  col: number
  row: number
  px: number  // SVG 像素 x（不含 PAD）
  py: number  // SVG 像素 y（不含 PAD）
}

type Unit = {
  id: string
  name: string
  shortName: string
  team: 'player' | 'enemy'
  q: number
  r: number
  hp: number
  maxHp: number
  move: number
  damage: number
  interrupt: number
}

// ─── State ─────────────────────────────────────────────────────────────────────

const showCoords = ref(false)
const selectedUnitId = ref<string | null>(null)
const hoveredKey = ref<string | null>(null)

function makeUnits(): Unit[] {
  return [
    // 己方 — 左側
    { id: 'p_wolf',  name: '狼牙證',    shortName: '狼', team: 'player', ...offsetToAxial(1, 1), hp: 95,  maxHp: 95,  move: 4, damage: 34, interrupt: 2 },
    { id: 'p_bird',  name: '妖織證',    shortName: '妖', team: 'player', ...offsetToAxial(1, 3), hp: 85,  maxHp: 85,  move: 4, damage: 24, interrupt: 1 },
    { id: 'p_slime', name: '護膜證',    shortName: '膜', team: 'player', ...offsetToAxial(1, 5), hp: 120, maxHp: 120, move: 3, damage: 22, interrupt: 1 },
    // 敵方 — 右側
    { id: 'e_sentinel_a', name: '哨兵α', shortName: 'α', team: 'enemy', ...offsetToAxial(7, 1), hp: 100, maxHp: 100, move: 3, damage: 28, interrupt: 1 },
    { id: 'e_sentinel_b', name: '哨兵β', shortName: 'β', team: 'enemy', ...offsetToAxial(7, 3), hp: 80,  maxHp: 80,  move: 4, damage: 24, interrupt: 1 },
    { id: 'e_boss',       name: '首領',   shortName: '王', team: 'enemy', ...offsetToAxial(7, 5), hp: 130, maxHp: 130, move: 2, damage: 45, interrupt: 3 },
  ]
}

const units = ref<Unit[]>(makeUnits())

// ─── Cells ─────────────────────────────────────────────────────────────────────

const cells = computed<Cell[]>(() => {
  const result: Cell[] = []
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { q, r } = offsetToAxial(col, row)
      const { x, y } = axialToPixel(q, r, HEX_SIZE)
      result.push({ key: hexKey(q, r), q, r, col, row, px: x, py: y })
    }
  }
  return result
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const cellMap = computed(() => {
  const m = new Map<string, Cell>()
  for (const c of cells.value) m.set(c.key, c)
  return m
})

const unitMap = computed(() => {
  const m = new Map<string, Unit>()
  for (const u of units.value) m.set(hexKey(u.q, u.r), u)
  return m
})

const selectedUnit = computed(() =>
  units.value.find(u => u.id === selectedUnitId.value) ?? null
)

const hoveredCell = computed(() =>
  hoveredKey.value ? cellMap.value.get(hoveredKey.value) ?? null : null
)

const hoveredCellUnit = computed(() =>
  hoveredKey.value ? unitMap.value.get(hoveredKey.value) ?? null : null
)

// 移動範圍（排除自己、排除被佔據的格）
const moveRangeKeys = computed((): Set<string> => {
  if (!selectedUnit.value || selectedUnit.value.team !== 'player') return new Set()
  const u = selectedUnit.value
  const center: HexCoord = { q: u.q, r: u.r }
  const all = hexRange(center, u.move)
  const occupied = new Set(units.value.map(x => hexKey(x.q, x.r)))
  return new Set(
    all
      .filter(c => cellMap.value.has(hexKey(c.q, c.r)))
      .filter(c => !(c.q === u.q && c.r === u.r))
      .filter(c => !occupied.has(hexKey(c.q, c.r)))
      .map(c => hexKey(c.q, c.r))
  )
})

// 攻擊範圍（移動範圍外擴 1 格，模擬近戰可到達位置）
const attackRangeKeys = computed((): Set<string> => {
  if (!selectedUnit.value || selectedUnit.value.team !== 'player') return new Set()
  const u = selectedUnit.value
  const center: HexCoord = { q: u.q, r: u.r }
  const all = hexRange(center, u.move + 1)
  return new Set(
    all
      .filter(c => cellMap.value.has(hexKey(c.q, c.r)))
      .filter(c => !(c.q === u.q && c.r === u.r))
      .filter(c => !moveRangeKeys.value.has(hexKey(c.q, c.r)))
      .map(c => hexKey(c.q, c.r))
  )
})

// SVG 尺寸
const svgWidth = computed(() => {
  const maxX = Math.max(...cells.value.map(c => c.px))
  return maxX + PAD * 2 + HEX_SIZE * Math.sqrt(3) / 2
})

const svgHeight = computed(() => {
  const maxY = Math.max(...cells.value.map(c => c.py))
  return maxY + PAD * 2 + HEX_SIZE
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unitPx(unit: Unit): { x: number; y: number } {
  return axialToPixel(unit.q, unit.r, HEX_SIZE)
}

function isInMoveRange(cell: Cell): boolean {
  return moveRangeKeys.value.has(cell.key)
}

function cellStateClass(cell: Cell): string {
  if (selectedUnit.value && cell.q === selectedUnit.value.q && cell.r === selectedUnit.value.r) {
    return 'hex-cell--selected-unit'
  }
  if (moveRangeKeys.value.has(cell.key)) return 'hex-cell--move'
  if (attackRangeKeys.value.has(cell.key)) return 'hex-cell--attack'
  if (cell.key === hoveredKey.value) return 'hex-cell--hovered'
  return 'hex-cell--default'
}

// ─── 互動 ──────────────────────────────────────────────────────────────────────

function onUnitClick(unit: Unit) {
  if (unit.team === 'enemy' && selectedUnit.value?.team === 'player') {
    // 敵方單位：在攻擊範圍內就高亮（未來做攻擊確認）
    selectedUnitId.value = unit.id
    return
  }
  selectedUnitId.value = unit.id
}

function onCellClick(cell: Cell) {
  if (!selectedUnit.value) return
  if (selectedUnit.value.team !== 'player') { clearSelection(); return }
  if (!moveRangeKeys.value.has(cell.key)) return

  // 移動
  const u = units.value.find(x => x.id === selectedUnitId.value)
  if (u) {
    u.q = cell.q
    u.r = cell.r
  }
  clearSelection()
}

function clearSelection() {
  selectedUnitId.value = null
}

function resetUnits() {
  units.value = makeUnits()
  clearSelection()
}
</script>

<style scoped>
.hex-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 工具列 ── */
.hex-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hex-title {
  margin: 0;
  font-size: 22px;
}

.hex-toolbar__controls {
  display: flex;
  align-items: center;
  gap: 14px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #7d6852;
  cursor: pointer;
  user-select: none;
}

.btn-reset {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid rgba(154, 108, 61, 0.25);
  background: rgba(255, 251, 245, 0.9);
  color: #6b4c2a;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-reset:hover { background: rgba(216, 194, 162, 0.5); }

/* ── 主場景 ── */
.hex-scene {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  overflow-x: auto;
}

/* ── SVG 格子 ── */
.hex-svg {
  flex-shrink: 0;
  border-radius: 20px;
  background: rgba(255, 251, 245, 0.88);
  border: 1px solid rgba(131, 102, 70, 0.14);
  box-shadow: 0 8px 28px rgba(125, 99, 71, 0.1);
}

.hex-cell-group { cursor: pointer; }

.hex-cell {
  transition: fill 0.12s;
  stroke: rgba(174, 141, 103, 0.45);
  stroke-width: 1.2;
}
.hex-cell--default  { fill: rgba(240, 230, 210, 0.6); }
.hex-cell--hovered  { fill: rgba(216, 194, 162, 0.7); }
.hex-cell--move     { fill: rgba(100, 160, 210, 0.28); stroke: rgba(80, 140, 200, 0.6); }
.hex-cell--attack   { fill: rgba(210, 110, 80, 0.18);  stroke: rgba(190, 90, 60, 0.45); }
.hex-cell--selected-unit { fill: rgba(100, 160, 210, 0.18); }

.hex-coord {
  fill: rgba(154, 108, 61, 0.55);
  font-size: 9px;
  font-family: 'JetBrains Mono', monospace;
  pointer-events: none;
  user-select: none;
}

/* ── 單位 ── */
.hex-unit-group { cursor: pointer; }

.unit-select-ring {
  fill: none;
  stroke: #fff;
  stroke-width: 2.5;
  filter: drop-shadow(0 0 4px rgba(255,255,255,0.8));
}

.unit-circle {
  transition: filter 0.1s;
}
.unit-circle:hover { filter: brightness(1.15); }

.unit-circle--player { fill: #5085c4; }
.unit-circle--enemy  { fill: #c45040; }

.hp-bar--player { fill: #6bc79a; }
.hp-bar--enemy  { fill: #e87c66; }

/* ── 資訊面板 ── */
.hex-info-panel {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-card {
  padding: 18px;
  border-radius: 18px;
  background: rgba(255, 251, 245, 0.9);
  border: 1px solid rgba(131, 102, 70, 0.14);
  box-shadow: 0 6px 20px rgba(125, 99, 71, 0.07);
}

.info-card--selected { border-color: rgba(80, 133, 196, 0.3); }

.info-card__badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 10px;
}
.badge--player { background: rgba(80, 133, 196, 0.14); color: #3a6fa8; }
.badge--enemy  { background: rgba(196, 80, 64, 0.14);  color: #a8402e; }

.info-card__name {
  margin: 0 0 12px;
  font-size: 18px;
}

.info-card__stats {
  display: grid;
  gap: 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(120, 94, 65, 0.06);
  font-size: 13px;
}
.stat-row span { color: #8a7763; }

.info-card__hint {
  margin-top: 12px;
  font-size: 12px;
  color: #7d6852;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-deselect {
  margin-top: 12px;
  width: 100%;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid rgba(154, 108, 61, 0.2);
  background: transparent;
  color: #7d6852;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.btn-deselect:hover { background: rgba(216, 194, 162, 0.3); }

.info-idle-text {
  margin: 0 0 14px;
  color: #9a8070;
  font-size: 14px;
}

.legend {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #6b5b4b;
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  flex-shrink: 0;
}
.legend-dot--player { background: #5085c4; }
.legend-dot--enemy  { background: #c45040; }
.legend-dot--move   { background: rgba(100, 160, 210, 0.6); border: 1.5px solid rgba(80,140,200,0.7); }
.legend-dot--attack { background: rgba(210, 110, 80, 0.5);  border: 1.5px solid rgba(190,90,60,0.6); }

.grid-info {
  border-top: 1px solid rgba(131, 102, 70, 0.1);
  padding-top: 10px;
}
.grid-info p {
  margin: 4px 0;
  font-size: 12px;
  color: #9a8070;
}

.info-card--hover {
  padding: 12px 16px;
}

.hover-coord {
  margin: 0;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  color: #7d6852;
}

.hover-unit {
  margin: 6px 0 0;
  font-weight: 600;
  font-size: 14px;
}

.hover-hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: #5085c4;
}
</style>
