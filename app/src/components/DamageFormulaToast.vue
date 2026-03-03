<script setup lang="ts">
import type { DamageBreakdownItem } from '../engine'

export type DamageToast = {
  id: string
  attackerName: string
  targetName: string
  breakdown: DamageBreakdownItem[]
  finalAmount: number
}

defineProps<{
  toasts: DamageToast[]
}>()

function buildFormulaString(breakdown: DamageBreakdownItem[]): string {
  return breakdown
    .map((b) => (b.amount > 0 ? `+${b.amount} ${b.label}` : `${b.amount} ${b.label}`))
    .join('  ')
}
</script>

<template>
  <div class="toastStack">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast">
        <div class="toastHeader">⚔ {{ t.attackerName }} → {{ t.targetName }}</div>
        <div class="toastFormula">{{ buildFormulaString(t.breakdown) }}</div>
        <div class="toastResult">💥 {{ t.finalAmount }}</div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toastStack {
  position: fixed;
  top: 80px;
  right: 16px;
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  width: min(340px, 88vw);
}

.toast {
  background: var(--bg-modal, rgba(28, 28, 36, 0.95));
  border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.2));
  border-radius: 10px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  backdrop-filter: blur(8px);
}

.toastHeader {
  font-size: 12px;
  opacity: 0.7;
  letter-spacing: 0.04em;
}

.toastFormula {
  font-family: ui-monospace, monospace;
  font-size: 11px;
  opacity: 0.85;
  word-break: break-all;
  line-height: 1.6;
}

.toastResult {
  font-size: 18px;
  font-weight: 900;
  color: #e8c83c;
  text-align: right;
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
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
