<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{ winner?: unknown }>()
const router = useRouter()

const winnerLabel = computed(() => {
  const w = String(props.winner ?? '')
  if (w === 'red') return '紅方勝利'
  if (w === 'black') return '黑方勝利'
  return '平局'
})

const winnerClass = computed(() => {
  const w = String(props.winner ?? '')
  if (w === 'red') return 'red'
  if (w === 'black') return 'black'
  return ''
})

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="page">
    <h1 class="title">遊戲結束</h1>
    <div class="card">
      <div class="winner-text" :class="winnerClass">{{ winnerLabel }}</div>
      <div class="btn-row">
        <button type="button" class="btn btn-secondary" @click="goHome">重新選擇</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0d0d12;
}

.title {
  margin: 0 0 20px;
  font-size: 1.6rem;
  letter-spacing: 0.12em;
  color: #e8d8a0;
}

.card {
  width: min(400px, 95vw);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 14px;
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.winner-text {
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: #e8d8a0;
}

.winner-text.red {
  color: #f4a0a0;
  text-shadow: 0 0 24px rgba(220, 80, 80, 0.5);
}

.winner-text.black {
  color: #c0c0c0;
  text-shadow: 0 0 24px rgba(180, 180, 180, 0.3);
}

.btn-row {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary {
  background: rgba(200, 160, 60, 0.15);
  border: 1px solid rgba(200, 160, 60, 0.45);
  color: #e8d8a0;
}

.btn-secondary:hover {
  background: rgba(200, 160, 60, 0.28);
}
</style>
