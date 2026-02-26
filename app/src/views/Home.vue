<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameSetup, type GameMode, type SideOrRandom, type Difficulty } from '../stores/gameSetup'

const router = useRouter()
const setup = useGameSetup()

const mode = ref<GameMode>(setup.mode)
const playerSide = ref<SideOrRandom>(setup.playerSide)
const firstPlayer = ref<SideOrRandom>(setup.firstPlayer)
const difficulty = ref<Difficulty>(setup.difficulty)

const isPve = computed(() => mode.value === 'pve')

function startGame() {
  setup.mode = mode.value
  setup.playerSide = playerSide.value
  setup.firstPlayer = firstPlayer.value
  setup.difficulty = difficulty.value
  setup.resolve()
  router.push({ name: 'game' })
}
</script>

<template>
  <div class="page">
    <h1 class="title">幽冥棋</h1>

    <div class="card">
      <!-- 遊戲模式 -->
      <div class="section">
        <div class="section-label">遊戲模式</div>
        <div class="btn-group">
          <button
            type="button"
            :class="['opt-btn', mode === 'pvp' && 'active']"
            @click="mode = 'pvp'"
          >雙人對戰</button>
          <button
            type="button"
            :class="['opt-btn', mode === 'pve' && 'active']"
            @click="mode = 'pve'"
          >對電腦</button>
        </div>
      </div>

      <!-- 先攻 -->
      <div class="section">
        <div class="section-label">先攻方</div>
        <div class="btn-group">
          <button
            type="button"
            :class="['opt-btn red-opt', firstPlayer === 'red' && 'active']"
            @click="firstPlayer = 'red'"
          >紅方</button>
          <button
            type="button"
            :class="['opt-btn black-opt', firstPlayer === 'black' && 'active']"
            @click="firstPlayer = 'black'"
          >黑方</button>
          <button
            type="button"
            :class="['opt-btn', firstPlayer === 'random' && 'active']"
            @click="firstPlayer = 'random'"
          >隨機</button>
        </div>
      </div>

      <!-- 玩家選邊（PVE 限定） -->
      <div v-if="isPve" class="section">
        <div class="section-label">我方陣營</div>
        <div class="btn-group">
          <button
            type="button"
            :class="['opt-btn red-opt', playerSide === 'red' && 'active']"
            @click="playerSide = 'red'"
          >紅方</button>
          <button
            type="button"
            :class="['opt-btn black-opt', playerSide === 'black' && 'active']"
            @click="playerSide = 'black'"
          >黑方</button>
          <button
            type="button"
            :class="['opt-btn', playerSide === 'random' && 'active']"
            @click="playerSide = 'random'"
          >隨機</button>
        </div>
      </div>

      <!-- 難度（PVE 限定） -->
      <div v-if="isPve" class="section">
        <div class="section-label">難度</div>
        <div class="btn-group">
          <button
            type="button"
            :class="['opt-btn', difficulty === 'easy' && 'active']"
            @click="difficulty = 'easy'"
          >
            <span class="diff-label">簡單</span>
            <span class="diff-desc">固定規則 AI</span>
          </button>
          <button
            type="button"
            :class="['opt-btn', difficulty === 'hard' && 'active']"
            @click="difficulty = 'hard'"
          >
            <span class="diff-label">困難</span>
            <span class="diff-desc">訓練強化 AI</span>
          </button>
        </div>
      </div>

      <button type="button" class="start-btn" @click="startGame">開始遊戲</button>
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
  font-size: 2rem;
  letter-spacing: 0.15em;
  color: #e8d8a0;
  text-shadow: 0 0 24px rgba(220, 180, 80, 0.4);
}

.card {
  width: min(440px, 95vw);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.45);
  border-radius: 14px;
  padding: 24px 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 12px;
  letter-spacing: 0.1em;
  opacity: 0.55;
  text-transform: uppercase;
}

.btn-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.opt-btn {
  flex: 1;
  min-width: 80px;
  padding: 9px 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.3;
}

.opt-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.opt-btn.active {
  background: rgba(200, 160, 60, 0.18);
  border-color: rgba(200, 160, 60, 0.55);
  color: #e8d8a0;
}

.opt-btn.red-opt.active {
  background: rgba(200, 60, 60, 0.18);
  border-color: rgba(200, 60, 60, 0.55);
  color: #f4a0a0;
}

.opt-btn.black-opt.active {
  background: rgba(80, 80, 80, 0.25);
  border-color: rgba(180, 180, 180, 0.45);
  color: #ccc;
}

.diff-label {
  font-size: 13px;
  font-weight: 600;
}

.diff-desc {
  font-size: 10px;
  opacity: 0.6;
}

.start-btn {
  margin-top: 4px;
  padding: 13px;
  background: rgba(200, 160, 60, 0.2);
  border: 1px solid rgba(200, 160, 60, 0.5);
  border-radius: 10px;
  color: #e8d8a0;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.15s;
}

.start-btn:hover {
  background: rgba(200, 160, 60, 0.32);
}
</style>
