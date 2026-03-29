<template>
  <Transition name="confirm-overlay">
    <div v-if="game.uiPending" class="overlay-backdrop" @click.self="game.clearPending()">
      <div class="overlay-box">
        <div class="overlay-label">{{ game.uiPending.label }}</div>
        <div class="overlay-btns">
          <button class="overlay-yes" @click="game.confirmPending()">✔ 確認</button>
          <button class="overlay-no"  @click="game.clearPending()">✘ 取消</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
const game = useGameStore()
</script>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.overlay-box {
  background: #f8f3eb;
  border: 2px solid #b8820a;
  border-radius: 14px;
  padding: 2rem 2.5rem;
  text-align: center;
  min-width: 240px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

.overlay-label {
  font-size: 1.2rem;
  font-weight: bold;
  color: #2a1f14;
  margin-bottom: 1.4rem;
  line-height: 1.4;
}

.overlay-btns {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.overlay-yes {
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
.overlay-yes:hover { background: #1a7020; }

.overlay-no {
  padding: 0.55rem 1.6rem;
  background: #c04040;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.overlay-no:hover { background: #a03030; }

/* Transition */
.confirm-overlay-enter-active {
  transition: opacity 0.15s ease;
}
.confirm-overlay-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-overlay-enter-from,
.confirm-overlay-leave-to {
  opacity: 0;
}
.confirm-overlay-enter-active .overlay-box {
  transition: transform 0.15s ease;
}
.confirm-overlay-leave-active .overlay-box {
  transition: transform 0.2s ease;
}
.confirm-overlay-enter-from .overlay-box {
  transform: scale(0.92);
}
.confirm-overlay-leave-to .overlay-box {
  transform: scale(0.95);
}
</style>
