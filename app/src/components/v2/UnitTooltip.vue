<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  visible: boolean
  unitId: string | null
  soulCardImage: string | null
  soulCardName: string | null
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const tooltipStyle = computed(() => {
  if (!props.visible || !props.soulCardImage) return { display: 'none' }
  
  // Position tooltip to the right of the unit, or left if too close to right edge
  const offsetX = props.position.x > window.innerWidth - 250 ? -220 : 80
  const offsetY = -100 // Center vertically relative to unit
  
  return {
    display: 'block',
    left: `${props.position.x + offsetX}px`,
    top: `${props.position.y + offsetY}px`,
  }
})
</script>

<template>
  <Transition name="tooltip-fade">
    <div v-if="visible && soulCardImage" class="unit-tooltip" :style="tooltipStyle">
      <div class="tooltip-card">
        <img :src="soulCardImage" :alt="soulCardName || 'Soul Card'" class="card-image" />
        <div v-if="soulCardName" class="card-name">{{ soulCardName }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.unit-tooltip {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
}

.tooltip-card {
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid #b37feb;
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(179, 127, 235, 0.4);
  backdrop-filter: blur(8px);
}

.card-image {
  width: 200px;
  height: auto;
  border-radius: 8px;
  display: block;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}

.card-name {
  margin-top: 8px;
  text-align: center;
  font-size: 14px;
  font-weight: bold;
  color: #b37feb;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

.tooltip-fade-enter-active {
  transition: all 0.2s ease-out;
}

.tooltip-fade-leave-active {
  transition: all 0.15s ease-in;
}

.tooltip-fade-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}

.tooltip-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
