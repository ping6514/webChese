<template>
  <div
    class="brick-area"
    :class="[`area-${areaId}`, { 'can-clear': canClear }]"
    @click="onClearClick"
  >
    <div class="area-label">
      {{ label }}
      <span v-if="canClear" class="clear-hint">點擊清磚</span>
    </div>
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

const gs = computed(() => game.state)
const cp = computed(() => gs.value?.currentPlayer ?? 'p1')
const isHumanTurn = computed(() => !game.pveMode || cp.value === game.localPlayer)

const area = computed(() => game.state?.brickAreas[props.areaId] ?? { slots: [], maxSlots: 2 })
const emptySlots = computed(() => Math.max(0, area.value.maxSlots - area.value.slots.length))

const canClear = computed(() => {
  if (!gs.value || gs.value.phase !== 'action' || !isHumanTurn.value) return false
  return game.canAct({ type: 'DO_CLEAR_BRICK', areaId: props.areaId }, cp.value)
})

function buildingName(id: string) {
  return buildingById[id]?.name ?? id
}

function onClearClick() {
  if (!canClear.value) return
  const count = area.value.slots.length
  // 如果已有此 areaId 的 pending，取消
  const pend = game.uiPending
  if (pend?.type === 'clear' && pend.areaId === props.areaId) {
    game.clearPending()
    return
  }
  game.setPending({
    type: 'clear',
    areaId: props.areaId,
    label: `清磚 ${props.label}（共 ${count} 塊）？`,
  })
}
</script>

<style scoped>
.brick-area {
  flex: 1; background: #ede8dc; border-radius: 6px; padding: 0.5rem;
  border: 1px solid #c0b5a5; min-width: 80px; transition: all 0.2s;
}
.brick-area.can-clear {
  border-color: #c04000; border-style: dashed; cursor: pointer;
  animation: brick-pulse 1s ease-in-out infinite alternate;
}
@keyframes brick-pulse {
  from { box-shadow: 0 0 3px rgba(192,64,0,0.2); }
  to   { box-shadow: 0 0 10px rgba(192,64,0,0.5); }
}
.area-label {
  font-size: 0.7rem; color: #7a6a58; margin-bottom: 0.4rem;
  display: flex; align-items: center; gap: 0.4rem;
}
.clear-hint {
  font-size: 0.62rem; background: #c04000; color: #fff;
  padding: 1px 5px; border-radius: 8px; font-weight: bold;
}
.slots { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.slot {
  width: 32px; height: 40px; background: #d0c8b8; border: 1px solid #b8b0a0; border-radius: 4px;
  display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #2a1f14;
}
.slot.building { background: #e8d8b0; border-color: #b8920a; color: #7a5000; font-size: 0.6rem; text-align: center; }
.slot.empty { background: #f0ead8; color: #b0a090; }
</style>
