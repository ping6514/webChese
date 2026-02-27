<script lang="ts">
import { defineComponent } from 'vue'
import type { PieceBase } from '../engine'
import UnitListPanel from './UnitListPanel.vue'

type UnitRow = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  hpCurrent: number
  name: string
  image?: string
  pos: { x: number; y: number }
  dead?: boolean
}

export default defineComponent({
  name: 'AllUnitsModal',
  components: { UnitListPanel },
  props: {
    open: { type: Boolean, required: true },
    myTitle: { type: String, required: true },
    enemyTitle: { type: String, required: true },
    myUnits: { type: Array as () => UnitRow[], required: true },
    enemyUnits: { type: Array as () => UnitRow[], required: true },
  },
  emits: ['close', 'show-unit-detail', 'select-cell'],
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">⚔️ 所有單位</div>
        <button type="button" class="closeBtn" @click="$emit('close')">✕ 關閉</button>
      </div>

      <div class="grid">
        <UnitListPanel
          :title="myTitle"
          :units="myUnits"
          @show-unit-detail="$emit('show-unit-detail', $event)"
          @select-cell="$emit('select-cell', $event)"
        />
        <UnitListPanel
          :title="enemyTitle"
          :units="enemyUnits"
          @show-unit-detail="$emit('show-unit-detail', $event)"
          @select-cell="$emit('select-cell', $event)"
        />
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
  backdrop-filter: blur(3px);
}

.modal {
  width: min(1000px, 96vw);
  max-height: min(90vh, 860px);
  overflow: auto;
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal-strong);
  padding: 20px;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.4);
}

.modalHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.modalTitle {
  font-weight: 900;
  font-size: 20px;
}

.closeBtn {
  padding: 6px 16px;
  border-radius: 8px;
  font-weight: 700;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.closeBtn:hover { background: var(--bg-surface-1); }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}
</style>
