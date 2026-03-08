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
    // cancelLabel: { type: String as PropType<string>, required: false, default: '取消 (Esc)' },
    detailsLabel: { type: String as PropType<string>, required: false, default: '射擊預覽' },
    showDetails: { type: Boolean, required: false, default: true },
    goldForDamage: { type: Object as PropType<{ goldCost: number; damageBonus: number } | null>, default: null },
    spendGoldForDamage: { type: Boolean, required: false, default: false },
    bloodSacrifice: { type: Object as PropType<{ label: string; hpCost?: number } | null>, default: null },
    sacrificeHp: { type: Boolean, required: false, default: false },
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
    'update:spendGoldForDamage': (_v: boolean) => true,
    'update:sacrificeHp': (_v: boolean) => true,
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
    <div v-if="bloodSacrifice" class="goldToggleRow">
      <button
        type="button"
        class="goldToggleBtn sacrificeBtn"
        :class="{ active: sacrificeHp }"
        @click.stop="$emit('update:sacrificeHp', !sacrificeHp)"
      >
        血祭 帥-{{ bloodSacrifice.hpCost ?? 1 }}HP → {{ bloodSacrifice.label }}
      </button>
    </div>
    <div v-if="goldForDamage" class="goldToggleRow">
      <button
        type="button"
        class="goldToggleBtn"
        :class="{ active: spendGoldForDamage }"
        @click.stop="$emit('update:spendGoldForDamage', !spendGoldForDamage)"
      >
        以財傷敵 -{{ goldForDamage.goldCost }}G +{{ goldForDamage.damageBonus }}
      </button>
    </div>
    <div class="shootActionsButtons">
      <button type="button" class="shootBtn" :disabled="confirmDisabled" :title="confirmDisabled ? confirmTitle : ''" @click="onConfirm">
        {{ confirmLabel }}
      </button>
      <!-- <button type="button" class="shootBtn" @click="onCancel">{{ cancelLabel }}</button> -->
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
  flex-wrap: nowrap;
  white-space: nowrap;
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
  width: max-content;
  max-width: 90vw;
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
  white-space: nowrap;
  flex-shrink: 0;
}

.shootBtn:hover {
  border-color: var(--border-focus);
  background: var(--bg-surface-1);
}

.shootBtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.goldToggleRow {
  display: flex;
}

.goldToggleBtn {
  flex: 1;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  opacity: 0.6;
  white-space: nowrap;
}

.goldToggleBtn.active {
  background: #78420a;
  border-color: #d97706;
  color: #fde68a;
  opacity: 1;
}

.sacrificeBtn.active {
  background: #5b0e0e;
  border-color: #dc2626;
  color: #fca5a5;
}
</style>
