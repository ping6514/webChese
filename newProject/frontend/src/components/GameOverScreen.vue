<template>
  <div class="phase-screen">
    <div class="phase-card panel">
      <div class="gameover-icon">💀</div>
      <h2 class="phase-title">地城挑戰失敗</h2>
      <p class="phase-sub">深入至第 {{ floorNumber }} 層</p>

      <button class="btn btn--primary confirm-btn" @click="retry">
        重新挑戰
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const floorNumber = computed(() => game.gameState?.run.floorNumber ?? 1)

function retry() {
  game.reset()
}
</script>

<style scoped>
.phase-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}
.phase-card {
  width: 100%;
  max-width: 320px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.gameover-icon { font-size: 48px; }
.phase-title { font-size: 22px; font-weight: 700; color: var(--red); }
.phase-sub   { color: var(--text-dim); font-size: 13px; }
.confirm-btn { width: 100%; padding: 10px; font-size: 14px; margin-top: 8px; }
</style>
