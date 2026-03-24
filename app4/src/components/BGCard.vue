<template>
  <div
    class="bg-card"
    :class="[`owner-${bg.owner}`, `state-${bg.state}`, { 'is-acting': isActing, 'is-selectable': isSelectable }]"
    :title="tooltipText"
  >
    <div class="card-header">
      <span class="name">{{ bg.name }}</span>
      <span class="class-badge" :class="`cls-${bg.bgClass}`">{{ bg.bgClass }}</span>
    </div>
    <div class="hp-bar">
      <div class="hp-fill" :style="{ width: hpPercent + '%' }"></div>
      <span class="hp-text">{{ currentHP }} / {{ bg.hpBase }}</span>
    </div>
    <div class="stats">
      <span class="stat atk" title="對敵力">⚔ {{ effectiveAtk }}</span>
      <span class="stat sup" title="協助力">🤝 {{ effectiveSup }}</span>
    </div>
    <div class="state-badge" v-if="bg.state !== 'normal'">
      {{ bg.state === 'stunned' ? '暈眩' : 'KO' }}
    </div>
    <div class="reaction-indicator" v-if="bg.reactionCard" title="已安裝反應卡">⚡</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BGInstance } from '../engine'
import { effectiveAttack, effectiveSupport, effectiveHP } from '../engine'
import { bgCardById } from '../data/bg-cards'

const props = defineProps<{ bg: BGInstance; isActing: boolean; isSelectable?: boolean }>()

const currentHP = computed(() => effectiveHP(props.bg))
const effectiveAtk = computed(() => effectiveAttack(props.bg))
const effectiveSup = computed(() => effectiveSupport(props.bg))
const hpPercent = computed(() => Math.max(0, Math.min(100, (currentHP.value / props.bg.hpBase) * 100)))

const tooltipText = computed(() => {
  const def = bgCardById[props.bg.cardId]
  if (!def) return props.bg.name
  return `${def.name}\n技能1: ${def.skills[0].name}\n技能2: ${def.skills[1].name}`
})
</script>

<style scoped>
.bg-card {
  width: 90px; min-height: 120px; background: #0f3460; border-radius: 8px;
  padding: 0.5rem; cursor: pointer; position: relative; border: 2px solid transparent;
  transition: all 0.2s; user-select: none;
}
.bg-card:hover { transform: translateY(-2px); border-color: #9ad4d6; }
.bg-card.is-acting { border-color: #e8c97a; box-shadow: 0 0 12px rgba(232, 201, 122, 0.5); }
.bg-card.is-selectable { border-color: #00ff99; box-shadow: 0 0 10px rgba(0,255,153,0.5); cursor: pointer; animation: pulse 1s infinite alternate; }
@keyframes pulse { from { box-shadow: 0 0 6px rgba(0,255,153,0.4); } to { box-shadow: 0 0 16px rgba(0,255,153,0.8); } }
.bg-card.owner-p2 { background: #3d0030; }
.bg-card.state-stunned { transform: rotate(90deg); opacity: 0.8; }
.bg-card.state-ko { transform: rotate(180deg); opacity: 0.6; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.name { font-size: 0.75rem; font-weight: bold; }
.class-badge { font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; }
.cls-BOM { background: #8b4513; }
.cls-ATK { background: #8b0000; }
.cls-SHT { background: #005f8b; }
.cls-BLC { background: #2d5a27; }
.hp-bar {
  height: 8px; background: #333; border-radius: 4px; position: relative; margin-bottom: 0.3rem; overflow: hidden;
}
.hp-fill { height: 100%; background: #4caf50; border-radius: 4px; transition: width 0.3s; }
.hp-text {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 0.6rem; color: #fff; white-space: nowrap;
}
.stats { display: flex; gap: 0.3rem; font-size: 0.7rem; }
.stat { padding: 1px 3px; background: #1a1a2e; border-radius: 3px; }
.state-badge {
  position: absolute; top: 2px; right: 2px; font-size: 0.6rem;
  background: #ff6b35; padding: 1px 4px; border-radius: 3px;
}
.reaction-indicator { position: absolute; bottom: 2px; right: 4px; font-size: 0.75rem; }
</style>
