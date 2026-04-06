<template>
  <div class="prep-view">
    <h1>備戰編輯</h1>
    <div class="card-list">
      <div v-for="card in store.captainCards" :key="card.id" class="captain-card"
        :class="{ selected: store.selectedCardIds.includes(card.id) }"
        @click="toggleCard(card.id)">
        <div class="card-name">{{ getCaptainName(card.captainDefId) }}</div>
        <div class="card-type">{{ getCaptainType(card.captainDefId) }}</div>
      </div>
    </div>
    <div class="prep-footer">
      <router-link to="/battle">
        <button class="start-btn" :disabled="store.selectedCardIds.length === 0" @click="store.startBattle()">
          開始戰鬥 →
        </button>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()

function getCaptainName(defId: string) { return store.captainDefs.find(c => c.id === defId)?.name ?? defId }
function getCaptainType(defId: string) { return store.captainDefs.find(c => c.id === defId)?.type ?? '' }

function toggleCard(cardId: string) {
  const idx = store.selectedCardIds.indexOf(cardId)
  if (idx >= 0) store.selectedCardIds.splice(idx, 1)
  else if (store.selectedCardIds.length < 5) store.selectedCardIds.push(cardId)
}
</script>

<style scoped>
.prep-view { padding: 32px 24px; max-width: 800px; margin: 0 auto; color: #3a2e1e; }
h1 { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
.card-list { display: flex; flex-wrap: wrap; gap: 12px; }
.captain-card {
  border: 2px solid #c8b090; border-radius: 8px; padding: 16px 20px;
  background: #fdf6e8; cursor: pointer; min-width: 120px;
}
.captain-card.selected { border-color: #c8701e; background: #fff0d8; }
.card-name { font-weight: 700; font-size: 15px; }
.card-type { font-size: 12px; color: #8a6a3e; margin-top: 4px; }
.prep-footer { margin-top: 24px; }
.start-btn {
  padding: 12px 40px; background: #c8701e; border: none;
  color: #fff; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer;
}
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
