<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ winner?: unknown }>()

const winnerLabel = computed(() => {
  const w = String(props.winner ?? '')
  if (w === 'red') return 'Red'
  if (w === 'black') return 'Black'
  return 'Unknown'
})
</script>

<template>
  <div class="page">
    <h1 class="title">Game Over</h1>
    <div class="card">
      <div class="row">
        <span class="label">Winner</span>
        <span class="value mono">{{ winnerLabel }}</span>
      </div>
      <div class="hint">(Temporary screen)</div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.title {
  margin: 0 0 16px 0;
}

.card {
  width: min(560px, 95vw);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 16px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 16px;
}

.label {
  opacity: 0.8;
}

.value {
  font-weight: 800;
}

.hint {
  margin-top: 10px;
  opacity: 0.65;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
