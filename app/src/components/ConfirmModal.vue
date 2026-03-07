<script lang="ts">
export default { name: 'ConfirmModal' }
</script>

<script setup lang="ts">
import { watch } from 'vue'
import type { GuardResult } from '../engine'
import { useDraggable } from '../composables/useDraggable'

const props = defineProps<{
  open: boolean
  title: string
  detail: string
  image?: string | null
  guard?: GuardResult | null
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const { dragStyle, onDragDown, onDragMove, onDragUp, resetDrag } = useDraggable()
watch(() => props.open, (v) => { if (v) resetDrag() })
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="emit('cancel')">
    <div
      class="modal"
      :style="dragStyle"
      @pointerdown="onDragDown"
      @pointermove="onDragMove"
      @pointerup="onDragUp"
      @pointercancel="onDragUp"
    >
      <div class="modalTitle">
        <span>{{ title }}</span>
        <span class="dragHint">⠿</span>
      </div>
      <div class="modalBody">
        <div v-if="image" class="imgCol">
          <img class="img" :src="image" alt="" />
        </div>
        <div class="modalDetail mono">{{ detail }}</div>
      </div>
      <div class="modalBtns">
        <button type="button" @click="emit('confirm')" :disabled="guard ? !guard.ok : false" :title="guard && !guard.ok ? guard.reason : ''">
          Confirm
        </button>
        <button type="button" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: var(--bg-modal-overlay);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
}

.modal {
  width: min(520px, 92vw);
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal);
  padding: 16px;
  cursor: default;
  user-select: none;
  touch-action: none;
}

.modalTitle {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
}
.modalTitle:active { cursor: grabbing; }

.dragHint {
  font-size: 1rem;
  opacity: 0.3;
  pointer-events: none;
}

.modalBody {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: start;
  margin-bottom: 12px;
}

.imgCol {
  width: 120px;
}

.img {
  width: 120px;
  height: 165px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.modalDetail {
  opacity: 0.9;
  white-space: pre-wrap;
}

.modalBtns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
