<template>
  <Transition name="intercept-overlay">
    <div v-if="ic" class="intercept-backdrop">
      <div class="intercept-box">
        <div class="intercept-title">
          ⚔ 即將受到攻擊！
        </div>
        <div class="intercept-bg">{{ ic.defenderBGName }}</div>

        <!-- 反應卡 -->
        <div v-if="ic.reactionCardId" class="intercept-card">
          <span class="card-tag">反應卡</span>
          <span class="card-name">{{ ic.reactionCardName }}</span>
          <span class="card-desc">{{ reactionDesc(ic.reactionCardId) }}</span>
        </div>

        <!-- 反擊技能 -->
        <div v-if="ic.counterattackSkillName" class="intercept-card">
          <span class="card-tag skill-tag">反擊技能</span>
          <span class="card-name">{{ ic.counterattackSkillName }}</span>
        </div>

        <div class="intercept-prompt">是否發動？</div>

        <div class="intercept-btns">
          <button class="btn-use" @click="game.resolveInterceptChoice(false)">✔ 發動</button>
          <button class="btn-skip" @click="game.resolveInterceptChoice(true)">✘ 放棄</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { reactionById } from '../data/reactions'

const game = useGameStore()
const ic = computed(() => game.pendingInterceptChoice)

function reactionDesc(id: string): string {
  return reactionById[id]?.description ?? ''
}
</script>

<style scoped>
.intercept-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 210;
}

.intercept-box {
  background: #f8f0e8;
  border: 2px solid #c04040;
  border-radius: 14px;
  padding: 1.5rem 2rem;
  text-align: center;
  min-width: 280px;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.intercept-title {
  font-size: 1.1rem;
  font-weight: bold;
  color: #901a1a;
  margin-bottom: 0.3rem;
}

.intercept-bg {
  font-size: 1.3rem;
  font-weight: bold;
  color: #2a1f14;
  margin-bottom: 1rem;
}

.intercept-card {
  background: #fff3e0;
  border: 1px solid #e07000;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  margin-bottom: 0.6rem;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.card-tag {
  font-size: 0.68rem;
  background: #8040c0;
  color: #fff;
  padding: 1px 6px;
  border-radius: 99px;
  align-self: flex-start;
}

.skill-tag { background: #1a6090; }

.card-name {
  font-size: 1rem;
  font-weight: bold;
  color: #3a1060;
}

.card-desc {
  font-size: 0.78rem;
  color: #5a4030;
  line-height: 1.4;
}

.intercept-prompt {
  font-size: 0.95rem;
  color: #5a3000;
  margin: 0.8rem 0 0.6rem;
}

.intercept-btns {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-use {
  padding: 0.55rem 1.6rem;
  background: #2a8a30;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-use:hover { background: #1a7020; }

.btn-skip {
  padding: 0.55rem 1.6rem;
  background: #888;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-skip:hover { background: #666; }

.intercept-overlay-enter-active { transition: opacity 0.15s ease; }
.intercept-overlay-leave-active { transition: opacity 0.2s ease; }
.intercept-overlay-enter-from,
.intercept-overlay-leave-to { opacity: 0; }
.intercept-overlay-enter-active .intercept-box { transition: transform 0.15s ease; }
.intercept-overlay-leave-active .intercept-box { transition: transform 0.2s ease; }
.intercept-overlay-enter-from .intercept-box { transform: scale(0.92); }
.intercept-overlay-leave-to .intercept-box { transform: scale(0.95); }
</style>
