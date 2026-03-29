<script setup lang="ts">
import { computed } from 'vue'
import type { ItemCard } from '../engine/items'
import type { SoulCard } from '../engine/cards'

export type CardUsageInfo = {
  id: string
  card: ItemCard | SoulCard
  actionType: 'use_item' | 'enchant'
  actionDescription: string
}

const props = defineProps<{
  toasts: CardUsageInfo[]
}>()

function isItemCard(card: ItemCard | SoulCard): card is ItemCard {
  return 'timing' in card
}

function isSoulCard(card: ItemCard | SoulCard): card is SoulCard {
  return 'base' in card && 'clan' in card
}

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

function getCardTypeLabel(card: ItemCard | SoulCard): string {
  if (isItemCard(card)) {
    const timing = card.timing
    if (timing === 'buy') return '💰 購買道具'
    if (timing === 'necro') return '⚗️ 死靈道具'
    if (timing === 'combat') return '⚔️ 戰鬥道具'
    return '🎒 道具'
  }
  if (isSoulCard(card)) {
    return `⚗️ 附魔 · ${BASE_LABEL[card.base] ?? card.base}`
  }
  return ''
}
</script>

<template>
  <div class="cardUsageToastContainer">
    <TransitionGroup name="card-toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="cardUsageToast"
        :class="toast.actionType === 'enchant' ? 'toastEnchant' : 'toastItem'"
      >
        <div class="toastContent">
          <!-- Card image -->
          <div class="cardImageWrap">
            <img
              v-if="toast.card.image"
              :src="toast.card.image"
              :alt="toast.card.name"
              class="cardImage"
            />
            <div v-else class="cardImageEmpty">
              {{ toast.actionType === 'enchant' ? '🃏' : '🎒' }}
            </div>
          </div>

          <!-- Card info -->
          <div class="cardInfo">
            <div class="cardTypeLabel">{{ getCardTypeLabel(toast.card) }}</div>
            <div class="cardName">{{ toast.card.name }}</div>
            <div class="actionDesc">{{ toast.actionDescription }}</div>
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.cardUsageToastContainer {
  position: fixed;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9050;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.cardUsageToast {
  min-width: 320px;
  max-width: 420px;
  backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 14px 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
  animation: cardPulse 0.6s ease-out;
}

.toastItem {
  background: linear-gradient(135deg, rgba(232, 208, 112, 0.18) 0%, rgba(200, 160, 40, 0.12) 100%);
  border: 1px solid rgba(232, 208, 112, 0.4);
}

.toastEnchant {
  background: linear-gradient(135deg, rgba(180, 130, 255, 0.18) 0%, rgba(145, 202, 255, 0.12) 100%);
  border: 1px solid rgba(180, 130, 255, 0.45);
}

.toastContent {
  display: flex;
  gap: 14px;
  align-items: center;
}

.cardImageWrap {
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
}

.cardImage {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cardImageEmpty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 2.5rem;
  background: rgba(255, 255, 255, 0.05);
}

.cardInfo {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cardTypeLabel {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
  color: rgba(255, 255, 255, 0.85);
}

.cardName {
  font-size: 1.125rem;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.95);
  line-height: 1.3;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.actionDesc {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.4;
  margin-top: 2px;
}

@keyframes cardPulse {
  0% {
    transform: scale(0.92);
    opacity: 0;
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-toast-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.card-toast-leave-active {
  transition: all 0.5s ease-out;
}

.card-toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}

.card-toast-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.card-toast-move {
  transition: transform 0.3s ease;
}
</style>
