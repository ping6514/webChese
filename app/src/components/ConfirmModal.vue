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
        <button
          type="button"
          class="btn btnConfirm"
          :disabled="guard ? !guard.ok : false"
          :title="guard && !guard.ok ? guard.reason : ''"
          @click="emit('confirm')"
        >
          確認
        </button>
        <button type="button" class="btn btnCancel" @click="emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 150;
  backdrop-filter: blur(3px);
}

.modal {
  width: min(480px, 92vw);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: linear-gradient(160deg, rgba(22, 25, 46, 0.98) 0%, rgba(14, 16, 32, 0.98) 100%);
  padding: 18px;
  cursor: default;
  user-select: none;
  touch-action: none;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

.modalTitle {
  font-weight: 800;
  font-size: 15px;
  letter-spacing: 0.04em;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: grab;
  color: rgba(255, 255, 255, 0.92);
}
.modalTitle:active { cursor: grabbing; }

.dragHint {
  font-size: 1rem;
  opacity: 0.2;
  pointer-events: none;
}

.modalBody {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  align-items: start;
  margin-bottom: 16px;
}

.imgCol {
  width: 110px;
}

.img {
  width: 110px;
  height: 152px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.modalDetail {
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.78);
  white-space: pre-wrap;
}

.modalBtns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn {
  padding: 8px 22px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
}
.btn:active { transform: scale(0.96); }

.btnConfirm {
  background: rgba(82, 196, 26, 0.18);
  border: 1px solid rgba(82, 196, 26, 0.55);
  color: #b7eb8f;
  box-shadow: 0 0 10px rgba(82, 196, 26, 0.12);
}
.btnConfirm:hover:not(:disabled) {
  background: rgba(82, 196, 26, 0.3);
  box-shadow: 0 0 16px rgba(82, 196, 26, 0.25);
}
.btnConfirm:disabled {
  opacity: 0.32;
  cursor: not-allowed;
  transform: none;
}

.btnCancel {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.55);
}
.btnCancel:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.8);
}
</style>
