<template>
  <div
    class="board-wrap"
    ref="wrapRef"
    @pointermove="onPointerMove"
    @pointerleave="game.hoveredPos = null"
  >
    <div
      class="board"
      :style="{
        width: boardPx + 'px',
        height: boardH + 'px',
        '--cell': CELL + 'px',
      }"
    >
      <!-- 格子層 -->
      <template v-for="(row, y) in floor.cells" :key="y">
        <div
          v-for="(cell, x) in row"
          :key="x"
          class="cell"
          :class="[
            `cell--${cell.type}`,
            `cell--terrain-${cell.terrain}`,
            { 'cell--wall': !cell.passable },
            { 'cell--highlight-move':   highlightKind(x,y) === 'move' },
            { 'cell--highlight-attack': highlightKind(x,y) === 'attack' },
            { 'cell--highlight-select': highlightKind(x,y) === 'select' },
            { 'cell--hovered': isHovered(x,y) },
          ]"
          :style="{ left: x*CELL+'px', top: y*CELL+'px' }"
          @click="onCellClick(x, y)"
        >
          <!-- 出口標示 -->
          <span v-if="cell.type === 'stairs_down'" class="cell-exit-badge">🪜</span>
          <!-- 地形標示 -->
          <span v-if="cell.terrain !== 'normal'" class="cell-terrain-badge">
            {{ terrainChar(cell.terrain) }}
          </span>
        </div>
      </template>

      <!-- 單位層 -->
      <template v-for="unit in visibleUnits" :key="unit.id">
        <div
          class="cell-unit"
          :style="{ left: unit.pos.x*CELL+'px', top: unit.pos.y*CELL+'px', width: CELL+'px', height: CELL+'px' }"
          @click.stop="onUnitClick(unit.id)"
        >
          <UnitToken
            :unit="unit"
            :is-pending="unit.id === game.pendingUnitId"
            :is-selected="unit.id === game.selectedUnitId"
          />
        </div>
      </template>

      <!-- 浮字 FX 層 -->
      <TransitionGroup name="float">
        <div
          v-for="ft in game.floatTexts"
          :key="ft.id"
          class="float-text"
          :class="`float-text--${ft.kind}`"
          :style="{
            left: ft.pos.x*CELL + CELL/2 + 'px',
            top:  ft.pos.y*CELL + 'px',
          }"
        >{{ ft.text }}</div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/game'
import type { Pos } from '@engine/state'
import UnitToken from './UnitToken.vue'

const emit = defineEmits<{
  (e: 'cellClick', pos: Pos): void
  (e: 'unitClick', unitId: string): void
}>()

const game = useGameStore()
const wrapRef = ref<HTMLElement>()

const CELL = 36  // px per cell

const floor = computed(() => game.gameState!.floor)

const boardPx = computed(() => floor.value.width * CELL)
const boardH  = computed(() => floor.value.height * CELL)

const visibleUnits = computed(() =>
  Object.values(game.gameState!.units)
)

// ── highlight lookup ───────────────────────────────────────────────────────────
const highlightMap = computed(() => {
  const m = new Map<string, 'move' | 'attack' | 'select'>()
  for (const h of game.highlights) {
    m.set(`${h.pos.x},${h.pos.y}`, h.kind)
  }
  return m
})

function highlightKind(x: number, y: number) {
  return highlightMap.value.get(`${x},${y}`) ?? null
}

function isHovered(x: number, y: number) {
  const h = game.hoveredPos
  return h !== null && h.x === x && h.y === y
}

// ── terrain display ────────────────────────────────────────────────────────────
const TERRAIN_CHAR: Record<string, string> = {
  forest: '🌲', water: '💧', rubble: '░', altar: '✦',
}
function terrainChar(t: string) { return TERRAIN_CHAR[t] ?? '' }

// ── events ─────────────────────────────────────────────────────────────────────
function onCellClick(x: number, y: number) {
  emit('cellClick', { x, y })
}
function onUnitClick(unitId: string) {
  emit('unitClick', unitId)
}
function onPointerMove(e: PointerEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) / CELL)
  const y = Math.floor((e.clientY - rect.top) / CELL)
  game.hoveredPos = { x, y }
}
</script>

<style scoped>
.board-wrap {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x pan-y;
  cursor: default;
}

.board {
  position: relative;
  background: var(--bg-card);
}

/* ── 格子 ─────────────────────────────────────────────────────────────────── */
.cell {
  position: absolute;
  width: var(--cell);
  height: var(--cell);
  box-sizing: border-box;
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: background .1s;
}

.cell--wall {
  background: var(--cell-wall);
  border-color: var(--cell-wall);
  cursor: default;
}

/* 地形色 */
.cell--terrain-forest { background: var(--terrain-forest); }
.cell--terrain-water  { background: var(--terrain-water);  }
.cell--terrain-rubble { background: var(--terrain-rubble); }
.cell--terrain-altar  { background: var(--terrain-altar);  }

/* 特殊格類型 */
.cell--recovery  { background: #d4f0d4; }
.cell--chest     { background: #f0e8d0; }

/* 高亮覆蓋 */
.cell--highlight-move   { background: var(--cell-move)   !important; }
.cell--highlight-attack { background: var(--cell-target) !important; }
.cell--highlight-select { outline: 2px solid var(--cell-select); outline-offset: -2px; }

.cell--hovered:not(.cell--wall) { filter: brightness(0.92); }

.cell-terrain-badge {
  position: absolute;
  bottom: 1px;
  right: 1px;
  font-size: 9px;
  opacity: .6;
  pointer-events: none;
}

.cell--stairs_down {
  background: #fff8c5 !important;
  outline: 2px solid #f0c040;
  outline-offset: -2px;
  animation: exit-pulse 2s ease-in-out infinite;
}

.cell-exit-badge {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  pointer-events: none;
  z-index: 5;
}

@keyframes exit-pulse {
  0%, 100% { outline-color: #f0c040; }
  50%       { outline-color: #ff9900; }
}

/* ── 單位覆蓋層 ────────────────────────────────────────────────────────────── */
.cell-unit {
  position: absolute;
  padding: 2px;
  box-sizing: border-box;
  pointer-events: auto;
  z-index: 10;
}

/* ── 浮字 FX ──────────────────────────────────────────────────────────────── */
.float-text {
  position: absolute;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 700;
  pointer-events: none;
  z-index: 30;
  text-shadow: 0 1px 2px rgba(0,0,0,.35);
  white-space: nowrap;
}
.float-text--damage { color: var(--red); }
.float-text--heal   { color: var(--green); }
.float-text--miss   { color: var(--text-dim); }
.float-text--status { color: var(--purple); }

/* float transition */
.float-enter-from { opacity: 1; transform: translateX(-50%) translateY(0); }
.float-enter-active { transition: opacity 1s ease, transform 1s ease; }
.float-enter-to   { opacity: 0; transform: translateX(-50%) translateY(-28px); }
.float-leave-active { display: none; }
</style>
