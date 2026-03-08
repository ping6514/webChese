<script setup lang="ts">
import { computed } from 'vue'
import type { IncomeToast } from '../composables/useGameEffects'

const props = defineProps<{
  toasts: IncomeToast[]
  position?: 'top' | 'right' | 'left'
}>()

const stackStyle = computed(() => {
  if (props.position === 'right') return { top: '80px', left: '16px', right: 'unset', transform: 'none' }
  if (props.position === 'left')  return { top: '80px', right: '16px', left: 'unset', transform: 'none' }
  return { top: '66px', left: '50%', right: 'unset', transform: 'translateX(-50%)' }
})
</script>

<template>
  <div class="toastStack" :style="stackStyle">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast">
        <div class="toastHeader">💰 回合收入</div>
        <div class="toastBody">
          <span
            v-for="(item, i) in t.items"
            :key="i"
            :class="['item', item.kind, item.amount < 0 ? 'drain' : '']"
          >{{ item.amount >= 0 ? '+' : '' }}{{ item.amount }} {{ item.kind === 'gold' ? 'G' : '魔' }}<span class="itemLabel">{{ item.label }}</span></span>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toastStack {
  position: fixed;
  z-index: 121;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: min(280px, 88vw);
}

.toast {
  background: var(--bg-modal, rgba(28, 28, 36, 0.95));
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.2));
  border-radius: 10px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  backdrop-filter: blur(8px);
  width: 100%;
}

.toastHeader {
  font-size: 0.6875rem;
  opacity: 0.65;
  letter-spacing: 0.04em;
}

.toastBody {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.item {
  font-size: 0.75rem;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 3px;
}

.item.gold { color: #e8c83c; }
.item.mana { color: #7dd3fc; }
.item.drain { color: #f87171; }

.itemLabel {
  font-size: 0.625rem;
  font-weight: 400;
  opacity: 0.7;
}

/* Transition */
.toast-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
