<template>
  <Transition name="rm-overlay">
    <div v-if="rm && rm.discardCardId" class="rm-backdrop">
      <div class="rm-box">
        <div class="rm-title">反應大師</div>
        <div class="rm-sub">捨棄：<span class="discard-name">{{ discardName }}</span></div>
        <div class="rm-prompt">選擇要撈取的反應卡：</div>

        <div class="rm-cards">
          <div
            v-for="card in rm.availableCards"
            :key="card.id"
            class="rm-card"
            :class="{ selected: selected === card.id }"
            @click="selected = card.id"
          >
            <div class="rm-card-name">{{ card.name }}</div>
            <div class="rm-card-source">{{ card.source === 'deck' ? '牌組' : '墓地' }}</div>
            <div class="rm-card-desc">{{ reactionDesc(card.id) }}</div>
          </div>
        </div>

        <div class="rm-btns">
          <button class="btn-confirm" :disabled="!selected" @click="confirm">✔ 確認</button>
          <button class="btn-cancel" @click="cancel">✘ 取消</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game'
import { reactionById } from '../data/reactions'
import { eventById } from '../data/events'
import { buildingById } from '../data/buildings'

const game = useGameStore()
const rm = computed(() => game.pendingReactionMaster)
const selected = ref<string | null>(null)

const discardName = computed(() => {
  const id = rm.value?.discardCardId ?? ''
  return reactionById[id]?.name ?? eventById[id]?.name ?? buildingById[id]?.name ?? id
})

function reactionDesc(id: string): string {
  return reactionById[id]?.description ?? ''
}

function confirm() {
  if (!selected.value || !rm.value) return
  const discardCardId = rm.value.discardCardId
  const targetCardId = selected.value
  game.pendingReactionMaster = null
  selected.value = null
  game.dispatchForCurrentPlayer({
    type: 'PLAY_EVENT',
    cardId: 'reaction_master',
    params: { discardCardId, targetCardId },
  })
}

function cancel() {
  game.pendingReactionMaster = null
  selected.value = null
}
</script>

<style scoped>
.rm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 220;
}

.rm-box {
  background: #f8f3eb;
  border: 2px solid #8040c0;
  border-radius: 14px;
  padding: 1.5rem 2rem;
  min-width: 300px;
  max-width: 420px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.rm-title {
  font-size: 1.2rem;
  font-weight: bold;
  color: #3a1060;
  margin-bottom: 0.3rem;
}

.rm-sub {
  font-size: 0.85rem;
  color: #5a4a38;
  margin-bottom: 0.8rem;
}

.discard-name {
  font-weight: bold;
  color: #c04040;
}

.rm-prompt {
  font-size: 0.9rem;
  color: #2a1f14;
  margin-bottom: 0.6rem;
}

.rm-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
  margin-bottom: 1rem;
}

.rm-card {
  background: #ede0ff;
  border: 2px solid #c0a0e0;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.rm-card:hover { background: #d8c0f8; border-color: #8040c0; }

.rm-card.selected {
  background: #b080e0;
  border-color: #5010a0;
  color: #fff;
}

.rm-card-name {
  font-weight: bold;
  font-size: 1rem;
  color: inherit;
}

.rm-card.selected .rm-card-name { color: #fff; }

.rm-card-source {
  font-size: 0.68rem;
  background: rgba(0,0,0,0.12);
  padding: 1px 5px;
  border-radius: 99px;
  display: inline-block;
  margin-top: 2px;
  color: inherit;
}

.rm-card-desc {
  font-size: 0.76rem;
  color: #5a4030;
  margin-top: 0.3rem;
  line-height: 1.35;
}

.rm-card.selected .rm-card-desc { color: #e8d8ff; }

.rm-btns {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

.btn-confirm {
  padding: 0.5rem 1.6rem;
  background: #5010a0;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-confirm:not(:disabled):hover { background: #3a0080; }

.btn-cancel {
  padding: 0.5rem 1.6rem;
  background: #888;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-cancel:hover { background: #666; }

.rm-overlay-enter-active { transition: opacity 0.15s ease; }
.rm-overlay-leave-active { transition: opacity 0.2s ease; }
.rm-overlay-enter-from, .rm-overlay-leave-to { opacity: 0; }
.rm-overlay-enter-active .rm-box { transition: transform 0.15s ease; }
.rm-overlay-leave-active .rm-box { transition: transform 0.2s ease; }
.rm-overlay-enter-from .rm-box { transform: scale(0.92); }
.rm-overlay-leave-to .rm-box { transform: scale(0.95); }
</style>
