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
  flex: 1; background: #16213e; border-radius: 6px; padding: 0.5rem;
  border: 1px solid #333; min-width: 80px;
}
.area-label { font-size: 0.7rem; color: #aaa; margin-bottom: 0.4rem; }
.slots { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.slot {
  width: 32px; height: 40px; background: #0f3460; border-radius: 4px;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem;
}
.slot.building { background: #3a2800; color: #e8c97a; font-size: 0.6rem; text-align: center; }
.slot.empty { background: #111; color: #444; }
</style>
