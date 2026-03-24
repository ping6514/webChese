<template>
  <div class="brick-area" :class="`area-${areaId}`">
    <div class="area-label">{{ label }}</div>
    <div class="slots">
      <div
        v-for="(slot, i) in area.slots"
        :key="i"
        class="slot"
        :class="{ building: slot.isBuilding }"
        :title="slot.isBuilding ? slot.cardId : '磚堆'"
      >
        {{ slot.isBuilding ? buildingName(slot.cardId) : '🧱' }}
      </div>
      <div v-for="i in emptySlots" :key="`empty-${i}`" class="slot empty">—</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import type { BrickAreaId } from '../engine'
import { buildingById } from '../data/buildings'

const props = defineProps<{ areaId: BrickAreaId; label: string }>()
const game = useGameStore()

const area = computed(() => game.state?.brickAreas[props.areaId] ?? { slots: [], maxSlots: 2 })
const emptySlots = computed(() => Math.max(0, area.value.maxSlots - area.value.slots.length))

function buildingName(id: string) {
  return buildingById[id]?.name ?? id
}
</script>

<style scoped>
.brick-area {
  flex: 1; background: #ede8dc; border-radius: 6px; padding: 0.5rem;
  border: 1px solid #c0b5a5; min-width: 80px;
}
.area-label { font-size: 0.7rem; color: #7a6a58; margin-bottom: 0.4rem; }
.slots { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.slot {
  width: 32px; height: 40px; background: #d0c8b8; border: 1px solid #b8b0a0; border-radius: 4px;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #2a1f14;
}
.slot.building { background: #e8d8b0; border-color: #b8920a; color: #7a5000; font-size: 0.6rem; text-align: center; }
.slot.empty { background: #f0ead8; color: #b0a090; }
</style>
