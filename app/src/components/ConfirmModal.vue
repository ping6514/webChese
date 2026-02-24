<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult } from '../engine'

export default defineComponent({
  name: 'ConfirmModal',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    image: { type: String as () => string | null, required: false, default: null },
    guard: {
      type: Object as () => GuardResult | null,
      required: false,
      default: null,
    },
  },
  emits: ['confirm', 'cancel'],
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modalTitle">{{ title }}</div>
      <div class="modalBody">
        <div v-if="image" class="imgCol">
          <img class="img" :src="image" alt="" />
        </div>
        <div class="modalDetail mono">{{ detail }}</div>
      </div>
      <div class="modalBtns">
        <button type="button" @click="$emit('confirm')" :disabled="guard ? !guard.ok : false" :title="guard && !guard.ok ? guard.reason : ''">
          Confirm
        </button>
        <button type="button" @click="$emit('cancel')">Cancel</button>
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
  z-index: 50;
}

.modal {
  width: min(520px, 92vw);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
  padding: 16px;
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

.modalTitle {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
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
