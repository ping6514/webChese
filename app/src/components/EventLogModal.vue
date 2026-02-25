<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'EventLogModal',
  props: {
    open: { type: Boolean, required: true },
    text: { type: String, required: true },
  },
  emits: ['close', 'copy'],
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">Event log</div>
        <div class="headBtns">
          <button type="button" @click="$emit('copy')">Copy</button>
          <button type="button" class="closeBtn" @click="$emit('close')">Close</button>
        </div>
      </div>

      <textarea class="events mono" readonly :value="text" />
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
  z-index: 60;
}

.modal {
  width: min(900px, 96vw);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
  padding: 16px;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.headBtns {
  display: flex;
  gap: 8px;
}

.modalTitle {
  font-weight: 800;
  font-size: 16px;
}

.closeBtn {
  padding: 6px 10px;
}

.events {
  width: 100%;
  height: min(70vh, 560px);
  resize: vertical;
  overflow: auto;
  box-sizing: border-box;
  white-space: pre;
  background: rgba(0, 0, 0, 0.18);
  color: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
