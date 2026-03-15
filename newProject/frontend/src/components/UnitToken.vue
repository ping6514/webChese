<template>
  <div
    class="unit-token"
    :class="[
      `unit-token--${unit.kind}`,
      { 'unit-token--dead': unit.isDead },
      { 'unit-token--pending': isPending },
      { 'unit-token--selected': isSelected },
    ]"
    :title="unit.name"
  >
    <!-- 名字縮寫 / icon -->
    <span class="unit-glyph">{{ glyph }}</span>

    <!-- HP 條 -->
    <div class="unit-hpbar">
      <div class="unit-hpbar__fill" :style="{ width: hpPct + '%' }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Unit } from '@engine/state'

const props = defineProps<{
  unit: Unit
  isPending?: boolean
  isSelected?: boolean
}>()

const glyph = computed(() => {
  if (props.unit.kind === 'player') {
    // 使用職業首字
    return props.unit.jobId ? props.unit.jobId[0].toUpperCase() : '勇'
  }
  return props.unit.name[0]
})

const hpPct = computed(() =>
  props.unit.maxHP > 0 ? Math.round((props.unit.currentHP / props.unit.maxHP) * 100) : 0
)
</script>

<style scoped>
.unit-token {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  transition: box-shadow .1s;
}

/* 玩家：藍色邊框 */
.unit-token--player {
  background: rgba(26,95,160,.12);
  border: 2px solid var(--cell-player);
  color: var(--cell-player);
}
/* 怪物：紅色邊框 */
.unit-token--monster {
  background: rgba(139,32,32,.12);
  border: 2px solid var(--cell-monster);
  color: var(--cell-monster);
}
/* 等待行動 → 亮邊框 */
.unit-token--pending {
  box-shadow: 0 0 0 2px var(--accent-light);
  animation: pending-pulse 1s ease-in-out infinite;
}
/* 被選中 → 金色外框 */
.unit-token--selected {
  box-shadow: 0 0 0 2px var(--cell-select);
}
.unit-token--dead {
  opacity: .25;
  filter: grayscale(1);
}

.unit-glyph {
  line-height: 1;
  pointer-events: none;
}

/* HP 條貼底 */
.unit-hpbar {
  position: absolute;
  bottom: 1px;
  left: 1px;
  right: 1px;
  height: 3px;
  background: var(--border-light);
  border-radius: 2px;
  overflow: hidden;
}
.unit-hpbar__fill {
  height: 100%;
  background: var(--hp-bar);
  border-radius: 2px;
  transition: width .2s;
}

@keyframes pending-pulse {
  0%,100% { box-shadow: 0 0 0 2px var(--accent-light); }
  50%      { box-shadow: 0 0 0 4px var(--accent-light); }
}
</style>
