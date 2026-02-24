<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'CardDetailModal',
  props: {
    open: { type: Boolean, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    image: { type: String as () => string | null, required: false, default: null },
    actionLabel: { type: String as () => string | null, required: false, default: null },
    actionDisabled: { type: Boolean, required: false, default: false },
    actionTitle: { type: String as () => string, required: false, default: '' },
  },
  emits: ['close', 'action'],
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">{{ title }}</div>
        <button type="button" class="closeBtn" @click="$emit('close')">Close</button>
      </div>
      <div class="modalBody">
        <div class="imgCol">
          <img v-if="image" class="img" :src="image" alt="" />
          <div v-else class="noImg mono">no img</div>
        </div>
        <div class="modalDetail mono">{{ detail }}</div>
      </div>

      <div v-if="actionLabel" class="modalBtns">
        <button type="button" @click="$emit('action')" :disabled="actionDisabled" :title="actionTitle">
          {{ actionLabel }}
        </button>
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
  z-index: 80;
}

.modal {
  width: min(640px, 92vw);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
  padding: 16px;
}

.modalBody {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 14px;
  align-items: start;
}

.imgCol {
  width: 160px;
}

.img {
  width: 160px;
  height: 220px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.noImg {
  width: 160px;
  height: 220px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  opacity: 0.8;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.modalTitle {
  font-weight: 700;
  font-size: 16px;
}

.closeBtn {
  padding: 6px 10px;
}

.modalDetail {
  opacity: 0.9;
  white-space: pre-wrap;
}

.modalBtns {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
