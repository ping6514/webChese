<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue'
import { BOARD_HEIGHT, BOARD_WIDTH, canEnchant, canMove, getSoulCard, type GameState } from '../engine'
import BoardCell from './BoardCell.vue'

export default defineComponent({
  name: 'BoardGrid',
  components: { BoardCell },
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
    highlightUnitIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    enchantDragSoulId: {
      type: String as PropType<string | null>,
      default: null,
    },
  },
  emits: {
    'select-unit': (_unitId: string | null) => true,
    'move-to': (_pos: { x: number; y: number }) => true,
    'cell-click': (_payload: { x: number; y: number; unitId: string | null }) => true,
    'enchant-drop': (_payload: { unitId: string; soulId: string }) => true,
  },
  setup(props, { emit }) {
    function getChineseLabel(side: 'red' | 'black', base: string): string {
      // red uses traditional xiangqi chars: 帥/仕/相/車/馬/砲/兵
      // black uses: 將/士/象/車/馬/炮/卒
      switch (base) {
        case 'king':
          return side === 'red' ? '帥' : '將'
        case 'advisor':
          return side === 'red' ? '仕' : '士'
        case 'elephant':
          return side === 'red' ? '相' : '象'
        case 'rook':
          return '車'
        case 'knight':
          return '馬'
        case 'cannon':
          return side === 'red' ? '砲' : '炮'
        case 'soldier':
          return side === 'red' ? '兵' : '卒'
        default:
          return base.slice(0, 1)
      }
    }

    const unitByPos = computed(() => {
      const map = new Map<
        string,
        {
          id: string
          label: string
          side: 'red' | 'black'
          sideClass: string
          hp: number
          enchantName: string | null
          enchantImage: string | null
        }
      >()
      for (const u of Object.values(props.state.units)) {
        const soulId = u.enchant?.soulId
        const soul = soulId ? getSoulCard(soulId) : null
        const baseLabel = getChineseLabel(u.side, u.base)
        const displayLabel = soul?.name ? `${baseLabel}-${soul.name}` : baseLabel
        map.set(`${u.pos.x},${u.pos.y}`, {
          id: u.id,
          side: u.side,
          label: displayLabel,
          sideClass: u.side === 'red' ? 'unit-red' : 'unit-black',
          hp: u.hpCurrent,
          enchantName: soul?.name ?? null,
          enchantImage: soul?.image || null,
        })
      }
      return map
    })

    const corpseCountByPos = computed(() => {
      const map = new Map<string, number>()
      for (const [k, arr] of Object.entries(props.state.corpsesByPos)) {
        if (arr.length > 0) map.set(k, arr.length)
      }
      return map
    })

    const legalMoveSet = computed(() => {
      const set = new Set<string>()
      for (const p of props.legalMoves) set.add(`${p.x},${p.y}`)
      return set
    })

    const shootableTargetSet = computed(() => new Set(props.shootableTargetIds))

    const highlightUnitSet = computed(() => new Set(props.highlightUnitIds))

    const selectedPosKey = computed(() => {
      if (!props.selectedUnitId) return null
      const u = props.state.units[props.selectedUnitId]
      if (!u) return null
      return `${u.pos.x},${u.pos.y}`
    })

    const selectedUnit = computed(() => {
      if (!props.selectedUnitId) return null
      return props.state.units[props.selectedUnitId] ?? null
    })

    function cellInvalidReason(x: number, y: number): string {
      if (props.state.turn.phase !== 'combat') return ''
      const u = selectedUnit.value
      if (!u) return ''
      if (u.side !== props.state.turn.side) return ''

      const key = `${x},${y}`
      if (selectedPosKey.value === key) return ''
      if (unitByPos.value.get(key)) return ''

      const res = canMove(props.state, u.id, { x, y })
      if (res.ok === true) return ''
      return res.reason
    }

    function enchantDragUnitReason(unitId: string): string {
      const soulId = props.enchantDragSoulId
      if (!soulId) return ''

      const u = props.state.units[unitId]
      if (!u) return ''
      if (u.side !== props.state.turn.side) return 'Enemy unit'

      const g = canEnchant(props.state, unitId, soulId)
      if (g.ok) return 'Drop to enchant'
      return g.reason
    }

    function cellClass(x: number, y: number): Record<string, boolean> {
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      return {
        'cell-selected': selectedPosKey.value === key,
        'cell-legal': legalMoveSet.value.has(key),
        'cell-shootable': !!u && shootableTargetSet.value.has(u.id),
        'cell-enchantable': !!u && highlightUnitSet.value.has(u.id),
        'cell-invalid-hoverable': !!cellInvalidReason(x, y),
      }
    }

    function cellTitle(x: number, y: number): string {
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      if (u && props.enchantDragSoulId) return enchantDragUnitReason(u.id)
      return cellInvalidReason(x, y)
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

    function onDropSoul(payload: { x: number; y: number; unitId: string; soulId: string }) {
      emit('enchant-drop', { unitId: payload.unitId, soulId: payload.soulId })
    }

    return {
      BOARD_WIDTH,
      BOARD_HEIGHT,
      unitByPos,
      corpseCountByPos,
      cellClass,
      cellTitle,
      cellInvalidReason,
      onCellClick,
      onDropSoul,
    }
  },
})
</script>

<template>
  <div class="board-wrap">
    <div class="hint">
      Selected: <span class="mono">{{ selectedUnitId ?? 'none' }}</span>
    </div>

    <div class="board" :style="{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)` }">
      <BoardCell
        v-for="i in BOARD_WIDTH * BOARD_HEIGHT"
        :key="i"
        :x="(i - 1) % BOARD_WIDTH"
        :y="Math.floor((i - 1) / BOARD_WIDTH)"
        :cell-class="cellClass((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        :title-text="cellTitle((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        :unit="unitByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`) ?? null"
        :corpse-count="corpseCountByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`) ?? null"
        :allow-drop="
          (() => {
            const key = `${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`
            const u = unitByPos.get(key)
            return !!(u && enchantDragSoulId && highlightUnitIds.includes(u.id))
          })()
        "
        @click="onCellClick($event.x, $event.y)"
        @drop-soul="onDropSoul"
      />
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
  width: 100%;
  max-width: 100%;
  overflow: visible;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
</style>
