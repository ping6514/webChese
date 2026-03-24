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
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal-box {
  background: #f5f0e8; border: 2px solid #901a3a; border-radius: 12px;
  padding: 1.5rem 2rem; min-width: 320px; text-align: center; color: #2a1f14;
}
.modal-title { font-size: 1.3rem; color: #901a3a; font-weight: bold; margin-bottom: 0.8rem; }
.modal-desc { color: #5a4a38; font-size: 0.9rem; margin-bottom: 1.2rem; line-height: 1.6; }
.mover-name { color: #b8820a; font-weight: bold; }
.choices { display: flex; gap: 1rem; justify-content: center; }
.choice-btn {
  padding: 0.7rem 1.2rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
  border: 2px solid transparent; transition: all 0.2s; color: #2a1f14;
}
.choice-btn.damage { background: #f0d8d8; border-color: #c07070; }
.choice-btn.damage:hover { background: #e8c8c8; border-color: #901a1a; }
.choice-btn.moveback { background: #d8edd8; border-color: #2a8a30; }
.choice-btn.moveback:hover { background: #c4e0c4; border-color: #1a6020; }
.sub { font-size: 0.75rem; opacity: 0.7; }
</style>
