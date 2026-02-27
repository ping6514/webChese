<script lang="ts">
import { computed, defineComponent, ref, watch, type PropType } from 'vue'
import { BOARD_HEIGHT, BOARD_WIDTH, canEnchant, canMove, getSoulCard, type GameState, type PieceBase } from '../engine'
import BoardCell from './BoardCell.vue'
import ShootActionOverlay from './ShootActionOverlay.vue'

const BASE_IMAGES: Partial<Record<PieceBase, string>> = {
  king:     '/assets/cards/base/king.jpg',
  advisor:  '/assets/cards/base/advisor.jpg',
  elephant: '/assets/cards/base/elephant.jpg',
  rook:     '/assets/cards/base/rook.jpg',
  knight:   '/assets/cards/base/knight.jpg',
  cannon:   '/assets/cards/base/cannon.jpg',
  soldier:  '/assets/cards/base/soldier.jpg',
}

export default defineComponent({
  name: 'BoardGrid',
  components: { BoardCell, ShootActionOverlay },
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

    previewPierceMarks: {
      type: Object as PropType<Record<string, number>>,
      default: () => ({}),
    },

    previewSplashPosKeys: {
      type: Array as PropType<string[]>,
      default: () => [],
    },

    previewChainEligiblePosKeys: {
      type: Array as PropType<string[]>,
      default: () => [],
    },

    previewChainSelectedPosKey: {
      type: String as PropType<string | null>,
      default: null,
    },

    shootActionPosKey: {
      type: String as PropType<string | null>,
      default: null,
    },

    shootConfirmDisabled: {
      type: Boolean,
      default: false,
    },

    shootConfirmTitle: {
      type: String as PropType<string>,
      default: '',
    },

    shootActionsVisible: {
      type: Boolean,
      default: true,
    },

    sacrificeActionPosKey: {
      type: String as PropType<string | null>,
      default: null,
    },

    sacrificeConfirmDisabled: {
      type: Boolean,
      default: false,
    },

    sacrificeConfirmTitle: {
      type: String as PropType<string>,
      default: '',
    },

    sacrificeActionsVisible: {
      type: Boolean,
      default: true,
    },

    fxAttackUnitIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxHitUnitIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxKilledUnitIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxAbilityUnitIds: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxKilledPosKeys: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxRevivedPosKeys: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    fxEnchantedPosKeys: {
      type: Array as PropType<string[]>,
      default: () => [],
    },
    floatTextsByPos: {
      type: Object as PropType<Record<string, Array<{ id: string; text: string; kind: 'damage' | 'heal' }>>>,
      default: () => ({}),
    },

    fxBeams: {
      type: Array as PropType<Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number } }>>,
      default: () => [],
    },
  },
  emits: {
    'select-unit': (_unitId: string | null) => true,
    'move-to': (_pos: { x: number; y: number }) => true,
    'cell-click': (_payload: { x: number; y: number; unitId: string | null }) => true,
    'enchant-drop': (_payload: { unitId: string; soulId: string }) => true,
    'shoot-confirm': () => true,
    'shoot-cancel': () => true,
    'shoot-details': () => true,
    'sacrifice-confirm': () => true,
    'sacrifice-cancel': () => true,
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
          baseImage: string | null
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
          baseImage: BASE_IMAGES[u.base] ?? null,
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

    const fxAttackSet = computed(() => new Set(props.fxAttackUnitIds))
    const fxHitSet = computed(() => new Set(props.fxHitUnitIds))
    const fxKilledSet = computed(() => new Set(props.fxKilledUnitIds))
    const fxAbilitySet = computed(() => new Set(props.fxAbilityUnitIds))
    const fxKilledPosSet = computed(() => new Set(props.fxKilledPosKeys))
    const fxRevivedPosSet = computed(() => new Set(props.fxRevivedPosKeys))
    const fxEnchantedPosSet = computed(() => new Set(props.fxEnchantedPosKeys))

    const previewSplashSet = computed(() => new Set(props.previewSplashPosKeys))
    const previewChainEligibleSet = computed(() => new Set(props.previewChainEligiblePosKeys))

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
      return (res as any).reason ?? (res as any).error ?? ''
    }

    function enchantDragUnitReason(unitId: string): string {
      const soulId = props.enchantDragSoulId
      if (!soulId) return ''

      const u = props.state.units[unitId]
      if (!u) return ''
      if (u.side !== props.state.turn.side) return 'Enemy unit'

      const g = canEnchant(props.state, unitId, soulId)
      if (g.ok) return 'Drop to enchant'
      return (g as any).reason ?? (g as any).error ?? ''
    }

    function cellClass(x: number, y: number): Record<string, boolean> {
      const key = `${x},${y}`
      const u = unitByPos.value.get(key)
      const pierceMark = props.previewPierceMarks[key] ?? null

      const isPalace = (yy: number) => {
        if (x < 3 || x > 5) return false
        return (yy >= 0 && yy <= 2) || (yy >= 7 && yy <= 9)
      }

      const palace = isPalace(y)
      const palaceNorth = palace && (y === 0 || y === 7)
      const palaceSouth = palace && (y === 2 || y === 9)
      const palaceWest = palace && x === 3
      const palaceEast = palace && x === 5

      const riverNorth = y === 4
      const riverSouth = y === 5

      return {
        'cell-selected': selectedPosKey.value === key,
        'cell-legal': legalMoveSet.value.has(key),
        'cell-shootable': !!u && shootableTargetSet.value.has(u.id),
        'cell-enchantable': !!u && highlightUnitSet.value.has(u.id),
        'cell-invalid-hoverable': !!cellInvalidReason(x, y),

        'cell-preview-pierce': pierceMark != null,
        'cell-preview-splash': previewSplashSet.value.has(key),
        'cell-preview-chain-eligible': previewChainEligibleSet.value.has(key),
        'cell-preview-chain-selected': !!props.previewChainSelectedPosKey && props.previewChainSelectedPosKey === key,

        'cell-fx-attack': !!u && fxAttackSet.value.has(u.id),
        'cell-fx-hit': !!u && fxHitSet.value.has(u.id),
        'cell-fx-killed': fxKilledPosSet.value.has(key) || (!!u && fxKilledSet.value.has(u.id)),
        'cell-fx-ability': !!u && fxAbilitySet.value.has(u.id),
        'cell-fx-revived': fxRevivedPosSet.value.has(key),
        'cell-fx-enchanted': fxEnchantedPosSet.value.has(key),

        'cell-river-north': riverNorth,
        'cell-river-south': riverSouth,

        'cell-palace-north': palaceNorth,
        'cell-palace-south': palaceSouth,
        'cell-palace-west': palaceWest,
        'cell-palace-east': palaceEast,
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

    function onShootConfirm() {
      emit('shoot-confirm')
    }

    function onShootCancel() {
      emit('shoot-cancel')
    }

    function onShootDetails() {
      emit('shoot-details')
    }

    function onSacrificeConfirm() {
      emit('sacrifice-confirm')
    }

    function onSacrificeCancel() {
      emit('sacrifice-cancel')
    }

    const overlayOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 })
    watch(
      () => props.shootActionPosKey,
      () => {
        overlayOffset.value = { x: 0, y: 0 }
      },
    )

    const sacrificeOverlayOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 })
    watch(
      () => props.sacrificeActionPosKey,
      () => {
        sacrificeOverlayOffset.value = { x: 0, y: 0 }
      },
    )

    const shootOverlayStyle = computed<Record<string, string>>(() => {
      if (!props.shootActionPosKey) {
        return {
          left: '0%',
          top: '0%',
          transform: 'translate(-50%, -110%)',
        }
      }
      const [xs, ys] = String(props.shootActionPosKey).split(',')
      const x = Number(xs)
      const y = Number(ys)
      if (!(Number.isFinite(x) && Number.isFinite(y))) {
        return {
          left: '0%',
          top: '0%',
          transform: 'translate(-50%, -110%)',
        }
      }

      const leftPct = ((x + 0.5) / BOARD_WIDTH) * 100
      const topPct = ((y + 0.5) / BOARD_HEIGHT) * 100

      const baseTransformX = (() => {
        // Prevent overlay from being clipped by the board container near edges.
        if (x <= 1) return 'translate(0%, -110%)'
        if (x >= BOARD_WIDTH - 2) return 'translate(-100%, -110%)'
        return 'translate(-50%, -110%)'
      })()

      return {
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `${baseTransformX} translate(${overlayOffset.value.x}px, ${overlayOffset.value.y}px)`,
      }
    })

    const sacrificeOverlayStyle = computed<Record<string, string>>(() => {
      if (!props.sacrificeActionPosKey) {
        return {
          left: '0%',
          top: '0%',
          transform: 'translate(-50%, -110%)',
        }
      }
      const [xs, ys] = String(props.sacrificeActionPosKey).split(',')
      const x = Number(xs)
      const y = Number(ys)
      if (!(Number.isFinite(x) && Number.isFinite(y))) {
        return {
          left: '0%',
          top: '0%',
          transform: 'translate(-50%, -110%)',
        }
      }

      const leftPct = ((x + 0.5) / BOARD_WIDTH) * 100
      const topPct = ((y + 0.5) / BOARD_HEIGHT) * 100

      const baseTransformX = (() => {
        // Prevent overlay from being clipped by the board container near edges.
        if (x <= 1) return 'translate(0%, -110%)'
        if (x >= BOARD_WIDTH - 2) return 'translate(-100%, -110%)'
        return 'translate(-50%, -110%)'
      })()

      return {
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `${baseTransformX} translate(${sacrificeOverlayOffset.value.x}px, ${sacrificeOverlayOffset.value.y}px)`,
      }
    })

    function setOverlayOffset(v: { x: number; y: number }) {
      overlayOffset.value = v
    }

    function setSacrificeOverlayOffset(v: { x: number; y: number }) {
      sacrificeOverlayOffset.value = v
    }

    return {
      BOARD_WIDTH,
      BOARD_HEIGHT,
      overlayOffset,
      shootOverlayStyle,
      setOverlayOffset,
      sacrificeOverlayOffset,
      sacrificeOverlayStyle,
      setSacrificeOverlayOffset,
      unitByPos,
      corpseCountByPos,
      cellClass,
      cellTitle,
      cellInvalidReason,
      onCellClick,
      onDropSoul,
      onShootConfirm,
      onShootCancel,
      onShootDetails,
      onSacrificeConfirm,
      onSacrificeCancel,
    }
  },
})
</script>

<template>
  <div class="board-wrap">
    <div class="board" :style="{ gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)` }">
      <ShootActionOverlay
        :show="!!shootActionPosKey && shootActionsVisible"
        :style-obj="shootOverlayStyle"
        :confirm-disabled="shootConfirmDisabled"
        :confirm-title="shootConfirmTitle"
        :offset="overlayOffset"
        @update:offset="setOverlayOffset"
        @confirm="onShootConfirm"
        @cancel="onShootCancel"
        @details="onShootDetails"
      />

      <ShootActionOverlay
        :show="!!sacrificeActionPosKey && sacrificeActionsVisible"
        title="獻祭選單"
        :style-obj="sacrificeOverlayStyle"
        :confirm-disabled="sacrificeConfirmDisabled"
        :confirm-title="sacrificeConfirmTitle"
        confirm-label="獻祭"
        cancel-label="取消"
        :show-details="false"
        :offset="sacrificeOverlayOffset"
        @update:offset="setSacrificeOverlayOffset"
        @confirm="onSacrificeConfirm"
        @cancel="onSacrificeCancel"
      />

      <svg v-if="fxBeams.length > 0" class="fxOverlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="rgba(200,230,255,0.0)" />
            <stop offset="0.2" stop-color="rgba(200,230,255,0.95)" />
            <stop offset="0.8" stop-color="rgba(145,202,255,0.95)" />
            <stop offset="1" stop-color="rgba(145,202,255,0.0)" />
          </linearGradient>
          <filter id="beamGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g v-for="b in fxBeams" :key="b.id" filter="url(#beamGlow)">
          <line
            :x1="((b.from.x + 0.5) / BOARD_WIDTH) * 100"
            :y1="((b.from.y + 0.5) / BOARD_HEIGHT) * 100"
            :x2="((b.to.x + 0.5) / BOARD_WIDTH) * 100"
            :y2="((b.to.y + 0.5) / BOARD_HEIGHT) * 100"
            stroke="url(#beamGrad)"
            stroke-width="1.6"
            stroke-linecap="round"
            class="beam"
          />
          <line
            :x1="((b.from.x + 0.5) / BOARD_WIDTH) * 100"
            :y1="((b.from.y + 0.5) / BOARD_HEIGHT) * 100"
            :x2="((b.to.x + 0.5) / BOARD_WIDTH) * 100"
            :y2="((b.to.y + 0.5) / BOARD_HEIGHT) * 100"
            stroke="rgba(255,255,255,0.95)"
            stroke-width="0.55"
            stroke-linecap="round"
            class="beamCore"
          />
        </g>
      </svg>

      <BoardCell
        v-for="i in BOARD_WIDTH * BOARD_HEIGHT"
        :key="i"
        :x="(i - 1) % BOARD_WIDTH"
        :y="Math.floor((i - 1) / BOARD_WIDTH)"
        :cell-class="cellClass((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        :title-text="cellTitle((i - 1) % BOARD_WIDTH, Math.floor((i - 1) / BOARD_WIDTH))"
        :unit="unitByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`) ?? null"
        :corpse-count="corpseCountByPos.get(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`) ?? null"
        :float-texts="floatTextsByPos[`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`] ?? []"
        :pierce-mark="previewPierceMarks[`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`] ?? null"
        :splash-mark="previewSplashPosKeys.includes(`${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`) ? '濺' : null"
        :chain-mark="
          (() => {
            const key = `${(i - 1) % BOARD_WIDTH},${Math.floor((i - 1) / BOARD_WIDTH)}`
            if (previewChainSelectedPosKey && previewChainSelectedPosKey === key) return '連'
            if (previewChainEligiblePosKeys.includes(key)) return '連?'
            return null
          })()
        "
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
  margin: 8px 0;
  overflow: visible;
  position: relative;
  background: var(--bg-surface-3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
}

.hint {
  margin-bottom: 8px;
}

.board {
  display: grid;
  gap: 3px;
  width: 100%;
  max-width: 100%;
  overflow: visible;
  position: relative;
}

.fxOverlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.beam {
  opacity: 0.95;
  animation: beamPulse 240ms ease-out 1;
}

.beamCore {
  opacity: 0.95;
  animation: beamPulse 240ms ease-out 1;
}

@keyframes beamPulse {
  0% {
    opacity: 0;
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
}
</style>
