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
  data: () => ({ mobileTab: 'my' as 'my' | 'enemy' }),
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">⚔️ 所有單位</div>
        <button type="button" class="closeBtn" @click="$emit('close')">✕ 關閉</button>
      </div>

      <!-- Mobile tab bar -->
      <div class="mobileTabs">
        <button class="mobileTabBtn" :class="{ active: mobileTab === 'my' }" @click="mobileTab = 'my'">{{ myTitle }}</button>
        <button class="mobileTabBtn" :class="{ active: mobileTab === 'enemy' }" @click="mobileTab = 'enemy'">{{ enemyTitle }}</button>
      </div>

      <div class="grid">
        <UnitListPanel
          :class="{ mobileHidden: mobileTab !== 'my' }"
          :title="myTitle"
          :units="myUnits"
          @show-unit-detail="$emit('show-unit-detail', $event)"
          @select-cell="$emit('select-cell', $event)"
        />
        <UnitListPanel
          :class="{ mobileHidden: mobileTab !== 'enemy' }"
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
  padding-block: 24px;
  z-index: 150;
  backdrop-filter: blur(3px);
}

.modal {
  width: min(1000px, 96vw);
  max-height: min(90vh, 860px);
  overflow: auto;
  overscroll-behavior: contain;
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

.mobileTabs { display: none; }

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 640px) {
  .mobileTabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .mobileTabBtn {
    flex: 1;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 700;
    border: 1px solid var(--border-strong);
    background: var(--bg-surface-2);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .mobileTabBtn.active {
    background: rgba(145, 202, 255, 0.15);
    border-color: rgba(145, 202, 255, 0.5);
    color: #91caff;
  }
  .grid { grid-template-columns: 1fr; }
  .mobileHidden { display: none; }
}
</style>
