<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { BOARD_HEIGHT, BOARD_WIDTH, type GameState } from '../engine'

export default defineComponent({
  name: 'BoardGrid',
  props: {
    state: {
      type: Object as () => GameState,
      required: true,
    },
    selectedUnitId: {
      type: String as PropType<string | null>,
      default: null,
    },
    legalMoves: {
      type: Array as PropType<Array<{ x: number; y: number }>>,
      default: () => [],
    },
    shootableTargetIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
  },
  emits: {
    'select-unit': (_unitId: string | null) => true,
    'move-to': (_pos: { x: number; y: number }) => true,
    'cell-click': (_payload: { x: number; y: number; unitId: string | null }) => true,
    'enchant-drop': (_payload: { unitId: string; soulId: string }) => true,
  },
  setup(props, { emit }) {
    const unitByPos = computed(() => {
      const map = new Map<string, { id: string; label: string; side: string; sideClass: string }>()
      for (const u of Object.values(props.state.units)) {
        map.set(`${u.pos.x},${u.pos.y}`, {
          id: u.id,
          side: u.side,
          label: `${u.side.charAt(0).toUpperCase()}-${u.base.slice(0, 2)}`,
          sideClass: u.side === 'red' ? 'unit-red' : 'unit-black',
        })
      }
      return map
    })

    const legalMoveSet = computed(() => {
      const set = new Set<string>()
      for (const p of props.legalMoves) set.add(`${p.x},${p.y}`)
      return set
    })

    const shootableTargetSet = computed(() => new Set(props.shootableTargetIds))

    const selectedPosKey = computed(() => {
      if (!props.selectedUnitId) return null
      const u = props.state.units[props.selectedUnitId]
      if (!u) return null
      return `${u.pos.x},${u.pos.y}`
    })

    function cellClass(x: number, y: number): Record<string, boolean> {
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      return {
        'cell-selected': selectedPosKey.value === key,
        'cell-legal': legalMoveSet.value.has(key),
        'cell-shootable': !!u && shootableTargetSet.value.has(u.id),
      }
    }

    function onCellClick(x: number, y: number) {
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      emit('cell-click', { x, y, unitId: u?.id ?? null })
      if (u) {
        emit('select-unit', props.selectedUnitId === u.id ? null : u.id)
        return
      }
      emit('move-to', { x, y })
    }

    function onCellDrop(e: DragEvent, x: number, y: number) {
      const soulId = e.dataTransfer?.getData('application/x-soul-id') || ''
      if (!soulId) return
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      if (!u) return
      emit('enchant-drop', { unitId: u.id, soulId })
    }

    return {
      BOARD_WIDTH,
      BOARD_HEIGHT,
      unitByPos,
      cellClass,
      onCellClick,
      onCellDrop,
    }
  },
})
</script>

<template>
  <div class="board-wrap">
    <div class="hint">
      Selected: <span class="mono">{{ selectedUnitId ?? 'none' }}</span>
    </div>

    <div class="board" :style="{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 52px)` }">
      <button
        v-for="i in BOARD_WIDTH * BOARD_HEIGHT"
        :key="i"
        class="cell"
        :class="cellClass((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        type="button"
        @click="onCellClick((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        @dragover.prevent
        @drop="onCellDrop($event, (i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
      >
        <span class="coord mono"
          >{{ (i - 1) % BOARD_WIDTH }},{{ Math.floor((i - 1) / BOARD_WIDTH) }}</span
        >
        <span
          class="unit mono"
          :class="
            unitByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`)?.sideClass
          "
        >
          {{
            unitByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`)?.label ?? ''
          }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.board-wrap {
  margin: 16px 0;
  overflow: visible;
}

.hint {
  margin-bottom: 8px;
}

.board {
  display: grid;
  gap: 4px;
  width: max-content;
  overflow: visible;
}

.cell {
  height: 52px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(0, 0, 0, 0.15);
  color: #eaeaea;
  text-align: left;
  padding: 4px 6px;
  border-radius: 6px;
  position: relative;
}

.cell:hover {
  background: rgba(255, 255, 255, 0.12);
}

.tip {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  left: 0;
  top: -6px;
  transform: translateY(-100%);
  z-index: 999;
  background: rgba(0, 0, 0, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 6px 8px;
  color: rgba(255, 255, 255, 0.92);
  min-width: 180px;
  pointer-events: none;
  transition: opacity 120ms ease;
}

.cell:hover .tip {
  visibility: visible;
  opacity: 1;
}

.tipRow {
  font-size: 11px;
  line-height: 14px;
  white-space: nowrap;
}

.cell-selected {
  border-color: rgba(145, 202, 255, 0.85);
  background: rgba(145, 202, 255, 0.12);
}

.cell-legal {
  border-color: rgba(82, 196, 26, 0.7);
  background: rgba(82, 196, 26, 0.12);
}

.cell-shootable {
  border-color: rgba(250, 173, 20, 0.9);
  background: rgba(250, 173, 20, 0.12);
}

.cell:focus-visible {
  outline: 2px solid #91caff;
  outline-offset: 2px;
}

.coord {
  display: block;
  opacity: 0.6;
  font-size: 10px;
  line-height: 12px;
}

.unit {
  display: block;
  font-size: 12px;
  line-height: 16px;
}

.unit-red {
  color: #ff4d4f;
}

.unit-black {
  color: #52c41a;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
</style>
