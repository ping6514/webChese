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
  emits: ['close', 'show-unit-detail'],
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">Units</div>
        <button type="button" class="closeBtn" @click="$emit('close')">Close</button>
      </div>

      <div class="grid">
        <UnitListPanel :title="myTitle" :units="myUnits" @show-unit-detail="$emit('show-unit-detail', $event)" />
        <UnitListPanel :title="enemyTitle" :units="enemyUnits" @show-unit-detail="$emit('show-unit-detail', $event)" />
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
  width: min(1000px, 96vw);
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

.modalTitle {
  font-weight: 700;
  font-size: 16px;
}

.closeBtn {
  padding: 6px 10px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}
</style>
