<template>
  <div class="phase-screen">
    <div class="phase-card panel">
      <h2 class="phase-title">選擇路徑</h2>
      <p class="phase-sub">第 {{ floorNumber }} 層通關　↓ 繼續深入</p>

      <div class="path-options">
        <button class="path-btn panel" @click="choose('safe')">
          <div class="path-label safe">平穩之路</div>
          <div class="path-desc">較少、較弱的敵人<br>適合補充狀態</div>
        </button>
        <button class="path-btn panel" @click="choose('trial')">
          <div class="path-label trial">試煉之路</div>
          <div class="path-desc">更多強敵、更好的掉落<br>挑戰高風險</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const game = useGameStore()
const floorNumber = computed(() => game.gameState?.run.floorNumber ?? 1)

function choose(pathType: 'safe' | 'trial') {
  game.dispatchAction({ type: 'SELECT_PATH', pathType })
  // 回到戰鬥場景（由 checkPhaseTransition 透過 SELECT_PATH 事件重新啟動）
  game.phase = 'combat'
  // Re-start game loop after SELECT_PATH advances to next floor
  // game store's startLoop handles this via checkPhaseTransition
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
  max-width: 420px;
  padding: 28px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.phase-title { font-size: 22px; font-weight: 700; color: var(--accent); text-align: center; }
.phase-sub   { text-align: center; color: var(--text-dim); font-size: 13px; margin-top: -12px; }

.path-options { display: flex; gap: 12px; }
.path-btn {
  flex: 1;
  padding: 16px 12px;
  cursor: pointer;
  text-align: center;
  border: 2px solid var(--border-light);
  background: var(--bg-card);
  transition: border-color .15s, background .15s;
}
.path-btn:hover { border-color: var(--accent); background: var(--accent-bg); }

.path-label { font-weight: 700; font-size: 15px; margin-bottom: 8px; }
.path-label.safe   { color: var(--green); }
.path-label.trial  { color: var(--red); }
.path-desc { font-size: 12px; color: var(--text-dim); line-height: 1.5; }
</style>
