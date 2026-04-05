<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { PixiBoardRenderer } from '../../game/PixiBoardRenderer'
import type { SkillSelectConfig, AttackConfirmConfig } from '../../game/BoardActionPanel'
import { getSoulCard } from '../../engine'
import type { GameState } from '../../engine'
import type { FloatText, BeamFx } from '../../composables/useGameEffects'
import UnitTooltip from './UnitTooltip.vue'

const props = defineProps<{
  state: GameState
  selectedUnitId: string | null
  legalMoves: Array<{ x: number; y: number }>
  shootableTargetIds: string[]
  highlightUnitIds: string[]
  highlightCorpsePosKeys: string[]
  fxAttackUnitIds: string[]
  fxHitUnitIds: string[]
  fxKilledUnitIds: string[]
  fxKilledPosKeys: string[]
  fxEnchantedPosKeys: string[]
  fxRevivedPosKeys: string[]
  itemUsedEvents: Array<{ id: string; itemId: string; posKey: string }>
  floatTextsByPos: Record<string, FloatText[]>
  fxBeams: BeamFx[]
  cellSize?: number
}>()

const emit = defineEmits<{
  'cell-click': [payload: { x: number; y: number }]
  'unit-click': [unitId: string]
}>()

const canvasRef = ref<HTMLCanvasElement>()
let renderer: PixiBoardRenderer | null = null

// 手勢滾動追蹤
const TAP_THRESHOLD = 10
let gestureStartX = 0
let gestureStartY = 0
let gesturePrevY = 0
let isScrollGesture = false

function findScrollParent(el: Element): Element | null {
  let cur: Element | null = el.parentElement
  while (cur && cur !== document.documentElement) {
    const style = getComputedStyle(cur)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight + 2) return cur
    cur = cur.parentElement
  }
  return null  // 找不到可捲容器就不捲，避免頁面捲動破壞 Pixi 座標
}

function onCanvasPointerDown(e: PointerEvent) {
  gestureStartX = e.clientX
  gestureStartY = e.clientY
  gesturePrevY = e.clientY
  isScrollGesture = false
}

function onCanvasPointerMove(e: PointerEvent) {
  if (e.buttons === 0) return
  // 面板顯示中（射擊/獻祭確認）不捲動，避免 canvas 位移導致面板閃退
  if (renderer?.isActionPanelVisible) {
    gesturePrevY = e.clientY
    return
  }
  const dx = e.clientX - gestureStartX
  const dy = e.clientY - gestureStartY
  if (!isScrollGesture && Math.abs(dy) > TAP_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.5) {
    isScrollGesture = true
  }
  if (isScrollGesture) {
    const scrollEl = findScrollParent(e.currentTarget as Element)
    if (scrollEl) {
      const delta = gesturePrevY - e.clientY
      scrollEl.scrollTop += delta
      if (renderer) renderer.suppressNextClick = true
    } else {
      // 沒有可捲容器，不要觸發 suppressNextClick
      isScrollGesture = false
    }
  }
  gesturePrevY = e.clientY
}

function onCanvasPointerUp() {
  isScrollGesture = false
}

// Tooltip state
const tooltipVisible = ref(false)
const tooltipUnitId = ref<string | null>(null)
const tooltipSoulCardImage = ref<string | null>(null)
const tooltipSoulCardName = ref<string | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (!canvasRef.value) return

  const cs = props.cellSize ?? 70
  const k = cs / 70
  const boardOffsetX = Math.round(10 * k)
  const boardOffsetY = Math.round(20 * k)
  const width = 9 * cs + boardOffsetX * 2
  const height = 10 * cs + boardOffsetY * 2

  renderer = new PixiBoardRenderer(canvasRef.value, width, height, cs)
  
  renderer.onCellClick = (x: number, y: number) => {
    emit('cell-click', { x, y })
  }
  
  renderer.onUnitClick = (unitId: string) => {
    emit('unit-click', unitId)
  }
  
  // Hover events for tooltip
  renderer.onUnitHover = (unitId: string, x: number, y: number) => {
    const unit = props.state.units[unitId]
    if (!unit || !unit.enchant) return
    
    // Clear existing timer
    if (tooltipTimer) clearTimeout(tooltipTimer)
    
    // Show tooltip after delay
    tooltipTimer = setTimeout(() => {
      const soulCard = getSoulCard(unit.enchant!.soulId)
      if (soulCard) {
        tooltipUnitId.value = unitId
        tooltipSoulCardImage.value = soulCard.image
        tooltipSoulCardName.value = soulCard.name
        tooltipPosition.value = { x, y }
        tooltipVisible.value = true
      }
    }, 300)
  }
  
  renderer.onUnitHoverOut = () => {
    if (tooltipTimer) {
      clearTimeout(tooltipTimer)
      tooltipTimer = null
    }
    tooltipVisible.value = false
    tooltipUnitId.value = null
  }
  
  updateBoard()
})

onUnmounted(() => {
  renderer?.destroy()
})

watch(() => props.state.units, () => {
  updateBoard()
}, { deep: true })

watch(() => props.shootableTargetIds, () => {
  updateHighlights()
}, { deep: true })

watch(() => props.highlightUnitIds, () => {
  updateHighlights()
}, { deep: true })

watch(() => props.selectedUnitId, (newId, oldId) => {
  if (oldId && renderer) {
    renderer.deselectUnit(oldId)
  }
  if (newId && renderer) {
    renderer.selectUnit(newId)
  }
  updateHighlights()
})

watch(() => props.legalMoves, (moves) => {
  if (!renderer) return
  renderer.clearHighlights()
  moves.forEach(pos => {
    renderer!.highlightCell(pos.x, pos.y, 0x91caff) // Blue for movement
  })
})

watch(() => props.shootableTargetIds, (targetIds) => {
  if (!renderer) return
  
  // Highlight shootable units with red glow
  targetIds.forEach(unitId => {
    const unit = props.state.units[unitId]
    if (unit) {
      renderer!.highlightCell(unit.pos.x, unit.pos.y, 0xff4d4f) // Red for attack targets
    }
  })
})

watch(() => props.fxAttackUnitIds, (unitIds) => {
  unitIds.forEach(unitId => {
    renderer?.playUnitAttackAnimation(unitId)
  })
})

watch(() => props.fxHitUnitIds, (unitIds) => {
  unitIds.forEach(unitId => {
    renderer?.playUnitHitAnimation(unitId)
  })
})

watch(() => props.fxKilledUnitIds, (unitIds) => {
  unitIds.forEach(unitId => {
    renderer?.removeUnit(unitId, true)
  })
})

// Separate watcher for death explosion effects using position keys
watch(() => props.fxKilledPosKeys, (posKeys) => {
  if (!renderer) return

  posKeys.forEach(posKey => {
    const coords = posKey.split(',').map(Number)
    if (coords.length !== 2 || coords.some(isNaN)) return
    const [x, y] = coords as [number, number]
    const pos = renderer!.getCellPosition(x, y)
    
    // Determine color from units at that position
    const unit = Object.values(props.state.units).find(u => u.pos.x === x && u.pos.y === y)
    const color = unit?.side === 'red' ? 0xff4d4f : 0x52c41a
    
    renderer!.effectsManager.createDeathEffect(pos.x, pos.y, color)
  })
})

watch(() => props.floatTextsByPos, (textsByPos) => {
  if (!renderer) return
  
  Object.entries(textsByPos).forEach(([posKey, texts]) => {
    const coords = posKey.split(',').map(Number)
    if (coords.length !== 2) return
    const [x, y] = coords as [number, number]
    const pos = renderer!.getCellPosition(x, y)

    texts.forEach(text => {
      if (text.kind === 'damage') {
        const damage = parseInt(text.text.replace('-', '').replace('+', ''))
        if (!isNaN(damage)) {
          renderer!.effectsManager.createDamageText(pos.x, pos.y, damage, false)
        }
      } else if (text.kind === 'heal') {
        const amount = parseInt(text.text.replace('+', '').replace('-', ''))
        if (!isNaN(amount)) {
          renderer!.effectsManager.createHealText(pos.x, pos.y, amount)
        }
      }
    })
  })
}, { deep: true })

watch(() => props.fxEnchantedPosKeys, (posKeys) => {
  if (!renderer) {
    console.error('❌ Renderer not available for enchant effect')
    return
  }
  console.log('🎆 Enchant effect triggered, posKeys:', posKeys, 'length:', posKeys.length)
  
  if (posKeys.length === 0) {
    console.warn('⚠️ Empty posKeys array for enchant effect')
    return
  }
  
  posKeys.forEach(posKey => {
    console.log('Processing posKey:', posKey)
    const coords = posKey.split(',').map(Number)
    if (coords.length !== 2 || coords.some(isNaN)) {
      console.warn('Invalid coords for enchant effect:', posKey, coords)
      return
    }
    const [x, y] = coords as [number, number]
    const pos = renderer!.getCellPosition(x, y)
    console.log(`✨ Creating enchant effect at grid (${x},${y}) -> screen (${pos.x},${pos.y})`)
    try {
      renderer!.effectsManager.createEnchantEffect(pos.x, pos.y)
      console.log('✅ Enchant effect created successfully')
    } catch (error) {
      console.error('❌ Error creating enchant effect:', error)
    }
  })
})

watch(() => props.fxRevivedPosKeys, (posKeys) => {
  if (!renderer) return
  
  posKeys.forEach(posKey => {
    const coords = posKey.split(',').map(Number)
    if (coords.length !== 2 || coords.some(isNaN)) return
    const [x, y] = coords as [number, number]
    const pos = renderer!.getCellPosition(x, y)
    renderer!.effectsManager.createReviveEffect(pos.x, pos.y)
  })
})

watch(() => props.fxBeams, (beams) => {
  if (!renderer) return
  
  beams.forEach(beam => {
    const fromPos = renderer!.getCellPosition(beam.from.x, beam.from.y)
    const toPos = renderer!.getCellPosition(beam.to.x, beam.to.y)
    renderer!.effectsManager.createBeam(fromPos, toPos)
  })
})

watch(() => props.itemUsedEvents, (events) => {
  if (!renderer) return
  
  events.forEach(event => {
    const coords = event.posKey.split(',').map(Number)
    if (coords.length !== 2 || coords.some(isNaN)) return
    const [x, y] = coords as [number, number]
    const pos = renderer!.getCellPosition(x, y)
    renderer!.effectsManager.createItemUseEffect(event.itemId, pos.x, pos.y)
  })
}, { deep: true })

function updateBoard() {
  if (!renderer) return
  renderer.syncUnitsFromState(props.state)
  renderer.syncCorpsesFromState(props.state)
}

function updateHighlights() {
  if (!renderer) return
  renderer.updateHighlights({
    selectedUnitId: props.selectedUnitId,
    legalMoves: props.legalMoves,
    shootableTargetIds: props.shootableTargetIds,
    highlightUnitIds: props.highlightUnitIds,
  })
}

defineExpose({
  showSkillSelect:    (config: SkillSelectConfig)  => renderer?.actionPanel.showSkillSelect(config),
  showAttackConfirm:  (config: AttackConfirmConfig) => renderer?.actionPanel.showAttackConfirm(config),
  hideActionPanel:    ()                            => renderer?.actionPanel.hide(),
  updateChainTarget:  (selected: boolean)           => renderer?.actionPanel.updateChainTarget(selected),
  getCellScreenPos:   (x: number, y: number)        => renderer?.getCellPosition(x, y) ?? { x: 0, y: 0 },
})
</script>

<template>
  <div class="pixi-board-wrapper">
    <canvas
      ref="canvasRef"
      @pointerdown="onCanvasPointerDown"
      @pointermove="onCanvasPointerMove"
      @pointerup="onCanvasPointerUp"
      @pointercancel="onCanvasPointerUp"
    />
    <UnitTooltip
      :visible="tooltipVisible"
      :unit-id="tooltipUnitId"
      :soul-card-image="tooltipSoulCardImage"
      :soul-card-name="tooltipSoulCardName"
      :position="tooltipPosition"
    />
  </div>
</template>

<style scoped>
.pixi-board-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  background: transparent;
}

canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
