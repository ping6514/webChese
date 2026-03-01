<script lang="ts">
import { defineComponent, type PropType } from 'vue'

export default defineComponent({
  name: 'ShootActionOverlay',
  props: {
    show: { type: Boolean, required: false, default: false },
    title: { type: String as PropType<string>, required: false, default: '射擊選單' },
    styleObj: { type: Object as PropType<Record<string, string>>, required: false, default: () => ({}) },
    confirmDisabled: { type: Boolean, required: false, default: false },
    confirmTitle: { type: String as PropType<string>, required: false, default: '' },
    confirmLabel: { type: String as PropType<string>, required: false, default: '射擊 (Enter)' },
    cancelLabel: { type: String as PropType<string>, required: false, default: '取消 (Esc)' },
    detailsLabel: { type: String as PropType<string>, required: false, default: '射擊預覽' },
    showDetails: { type: Boolean, required: false, default: true },
    offset: {
      type: Object as PropType<{ x: number; y: number }>,
      required: false,
      default: () => ({ x: 0, y: 0 }),
    },
  },
  emits: {
    confirm: () => true,
    cancel: () => true,
    details: () => true,
    'update:offset': (_next: { x: number; y: number }) => true,
  },
  setup(props, { emit }) {
    let dragging = false
    let startX = 0
    let startY = 0
    let startOffsetX = 0
    let startOffsetY = 0

    function onPointerDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null
      if (t && t.tagName === 'BUTTON') return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      startOffsetX = props.offset.x
      startOffsetY = props.offset.y
      ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      emit('update:offset', { x: startOffsetX + dx, y: startOffsetY + dy })
      e.preventDefault()
      e.stopPropagation()
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging) return
      dragging = false
      ;(e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId)
      e.preventDefault()
      e.stopPropagation()
    }

    function onConfirm(e: MouseEvent) {
      e.stopPropagation()
      emit('confirm')
    }

    function onCancel(e: MouseEvent) {
      e.stopPropagation()
      emit('cancel')
    }

    function onDetails(e: MouseEvent) {
      e.stopPropagation()
      emit('details')
    }

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onConfirm,
      onCancel,
      onDetails,
    }
  },
})
</script>

<template>
  <div
    v-if="show"
    class="shootActions"
    :style="styleObj"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @click.stop
  >
    <div class="shootActionsTitle"><span>{{ title }}</span> <button type="button" @click="onCancel">Ｘ</button></div>
    <div class="shootActionsButtons">
      <button type="button" class="shootBtn" :disabled="confirmDisabled" :title="confirmDisabled ? confirmTitle : ''" @click="onConfirm">
        {{ confirmLabel }}
      </button>
      <button type="button" class="shootBtn" @click="onCancel">{{ cancelLabel }}</button>
      <button v-if="showDetails" type="button" class="shootBtn" @click="onDetails">{{ detailsLabel }}</button>
    </div>
  </div>
</template>

<style scoped>
.shootActionsTitle {
  display: flex;
  justify-content: space-between;
}
.shootActionsButtons {
  display: flex;
  gap: 8px;
}
.shootActions {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal);
  backdrop-filter: blur(10px);
  z-index: 90;
  pointer-events: auto;
  user-select: none;
  touch-action: none;
  cursor: pointer;
}

.shootBtn {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 15px;
  font-weight: 800;
  font-size: 12px;
  cursor: pointer;
}

.shootBtn:hover {
  border-color: var(--border-focus);
  background: var(--bg-surface-1);
}

.shootBtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
