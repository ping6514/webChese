<template>
  <div class="modal-overlay" v-if="pending">
    <div class="modal-box">
      <div class="modal-title">⚡ 威嚇觸發！</div>
      <div class="modal-desc">
        <span class="mover-name">{{ moverName }}</span> 進入了有威嚇反應卡的區域。
        <br>選擇效果：
      </div>
      <div class="choices">
        <button class="choice-btn damage" @click="game.resolveIntimidateChoice('take_damage')">
          A：承受 4 點傷害
          <span class="sub">（繼續留在原位）</span>
        </button>
        <button class="choice-btn moveback" @click="game.resolveIntimidateChoice('move_back')">
          B：退回上一格
          <span class="sub">（不受傷害）</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'

const game = useGameStore()
const pending = computed(() => game.pendingIntimidateChoice)
const moverName = computed(() => {
  if (!pending.value || !game.state) return ''
  const bg = game.state.bgs[pending.value.triggerBGId]
  return bg ? bg.name : '未知BG'
})
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal-box {
  background: #16213e; border: 2px solid #ff8fa0; border-radius: 12px;
  padding: 1.5rem 2rem; min-width: 320px; text-align: center;
}
.modal-title { font-size: 1.3rem; color: #ff8fa0; font-weight: bold; margin-bottom: 0.8rem; }
.modal-desc { color: #ccc; font-size: 0.9rem; margin-bottom: 1.2rem; line-height: 1.6; }
.mover-name { color: #e8c97a; font-weight: bold; }
.choices { display: flex; gap: 1rem; justify-content: center; }
.choice-btn {
  padding: 0.7rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  border: 2px solid transparent; transition: all 0.2s;
}
.choice-btn.damage { background: #4a1010; border-color: #8b0000; color: #eee; }
.choice-btn.damage:hover { background: #6a1515; border-color: #ff4444; }
.choice-btn.moveback { background: #1a3a1a; border-color: #4caf50; color: #eee; }
.choice-btn.moveback:hover { background: #256325; border-color: #88ff88; }
.sub { font-size: 0.75rem; opacity: 0.7; }
</style>
