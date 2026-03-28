<template>
  <div
    class="bg-card"
    :class="[`owner-${bg.owner}`, `state-${bg.state}`, `mode-${mode}`, { 'is-acting': isActing, 'is-selectable': isSelectable, 'is-acted': isActed }]"
    :title="tooltipText"
    @click.stop="$emit('click')"
    @contextmenu.prevent="$emit('detail', bg.id)"
  >
    <div class="card-header">
      <span class="name">{{ bg.name }}</span>
      <span class="class-badge" :class="`cls-${bg.bgClass}`">{{ bg.bgClass }}</span>
    </div>
    <div class="card-art">
      <img
        :src="`/assets/cards/bg/${bg.cardId}.png`"
        :alt="bg.name"
        class="card-img"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
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
    <div class="acted-badge" v-if="isActed && bg.state === 'normal'">已行動</div>

    <!-- 模式標籤 -->
    <div v-if="mode === 'can-start'" class="mode-hint start-hint">點擊行動</div>
    <div v-else-if="mode === 'attack-target'" class="mode-hint attack-hint">⚔ 對敵</div>
    <div v-else-if="mode === 'ally-target'" class="mode-hint ally-hint">🤝 聯合</div>
    <div v-else-if="mode === 'selected-ally'" class="mode-hint sel-ally-hint">🤝 已選</div>

    <div class="reaction-indicator" v-if="bg.reactionCard" :title="`反應卡：${bg.reactionCard}`">
      <img
        :src="`/assets/cards/reaction/${bg.reactionCard}.png`"
        :alt="bg.reactionCard"
        class="reaction-img"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <span class="reaction-fallback">⚡</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BGInstance } from '../engine'
import { effectiveAttack, effectiveSupport, effectiveHP } from '../engine'
import { bgCardById } from '../data/bg-cards'

export type BGCardMode = 'normal' | 'can-start' | 'attack-target' | 'ally-target' | 'selected-ally'

const props = defineProps<{
  bg: BGInstance
  isActing: boolean
  isSelectable?: boolean
  isActed?: boolean
  mode?: BGCardMode
}>()
defineEmits<{ detail: [bgId: string]; click: [] }>()

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
  width: 90px; min-height: 120px; background: #cce8f4; border-radius: 8px;
  padding: 0.5rem; cursor: pointer; position: relative;
  border: 4px solid #1a6eb5;
  box-shadow: 0 0 8px rgba(26,110,181,0.35);
  transition: all 0.2s; user-select: none; color: #0c1f3a;
}
.bg-card:hover { transform: translateY(-2px); box-shadow: 0 0 14px rgba(26,110,181,0.6); }
.bg-card.is-acting { border-color: #b8820a; box-shadow: 0 0 14px rgba(184,130,10,0.6); }
.bg-card.is-selectable { border-color: #007a50; box-shadow: 0 0 12px rgba(0,122,80,0.5); cursor: pointer; animation: pulse 1s infinite alternate; }

/* 模式樣式 */
.bg-card.mode-can-start { border-color: #1a8040; box-shadow: 0 0 12px rgba(26,128,64,0.55); animation: pulse-green 1s infinite alternate; }
.bg-card.mode-attack-target { border-color: #c04010; box-shadow: 0 0 12px rgba(192,64,16,0.6); animation: pulse-red 1s infinite alternate; cursor: crosshair; }
.bg-card.mode-ally-target { border-color: #1080c0; box-shadow: 0 0 12px rgba(16,128,192,0.55); animation: pulse-blue 1s infinite alternate; }
.bg-card.mode-selected-ally { border-color: #1a8090; border-style: dashed; box-shadow: 0 0 10px rgba(26,128,144,0.5); }

@keyframes pulse { from { box-shadow: 0 0 6px rgba(0,122,80,0.3); } to { box-shadow: 0 0 16px rgba(0,122,80,0.75); } }
@keyframes pulse-green { from { box-shadow: 0 0 6px rgba(26,128,64,0.3); } to { box-shadow: 0 0 16px rgba(26,128,64,0.8); } }
@keyframes pulse-red { from { box-shadow: 0 0 6px rgba(192,64,16,0.3); } to { box-shadow: 0 0 20px rgba(192,64,16,0.9); } }
@keyframes pulse-blue { from { box-shadow: 0 0 6px rgba(16,128,192,0.3); } to { box-shadow: 0 0 16px rgba(16,128,192,0.8); } }

/* P2 — 紅色系 */
.bg-card.owner-p2 { background: #f5d5d8; border-color: #c01a1a; box-shadow: 0 0 8px rgba(192,26,26,0.35); color: #3a0c0c; }
.bg-card.owner-p2:hover { box-shadow: 0 0 14px rgba(192,26,26,0.6); }
.bg-card.state-stunned { transform: rotate(90deg); opacity: 0.8; }
.bg-card.state-ko { transform: rotate(180deg); opacity: 0.5; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.3rem; }
.name { font-size: 0.75rem; font-weight: bold; }
.class-badge { font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; color: #fff; }
.cls-BOM { background: #8b4513; }
.cls-ATK { background: #8b1010; }
.cls-SHT { background: #1055a0; }
.cls-BLC { background: #2d6a27; }
.card-art {
  width: 100%; height: 70px; overflow: hidden; border-radius: 4px; margin-bottom: 0.3rem;
  background: #b0a898; display: flex; align-items: center; justify-content: center;
}
.card-img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.hp-bar {
  height: 8px; background: #c0b5a5; border-radius: 4px; position: relative; margin-bottom: 0.3rem; overflow: hidden;
}
.hp-fill { height: 100%; background: #2a8a30; border-radius: 4px; transition: width 0.3s; }
.hp-text {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 0.6rem; color: #fff; white-space: nowrap; text-shadow: 0 0 3px rgba(0,0,0,0.6);
}
.stats { display: flex; gap: 0.3rem; font-size: 0.7rem; }
.stat { padding: 1px 3px; background: #f5f0e8; border-radius: 3px; border: 1px solid #c0b5a5; }
.state-badge {
  position: absolute; top: 2px; right: 2px; font-size: 0.6rem;
  background: #c04000; color: #fff; padding: 1px 4px; border-radius: 3px;
}
.acted-badge {
  position: absolute; top: 2px; right: 2px; font-size: 0.6rem;
  background: #888; color: #fff; padding: 1px 4px; border-radius: 3px;
}
.bg-card.is-acted { opacity: 0.6; filter: grayscale(40%); }
.mode-hint {
  position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
  font-size: 0.58rem; white-space: nowrap; padding: 1px 5px; border-radius: 3px;
  pointer-events: none; font-weight: bold;
}
.start-hint { background: #1a8040; color: #fff; }
.attack-hint { background: #c04010; color: #fff; }
.ally-hint { background: #1080c0; color: #fff; }
.sel-ally-hint { background: #1a8090; color: #fff; }
.reaction-indicator {
  position: absolute; bottom: 2px; right: 2px;
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
}
.reaction-img { width: 22px; height: 22px; object-fit: cover; border-radius: 3px; border: 1px solid #888; }
.reaction-img ~ .reaction-fallback { display: none; }
.reaction-fallback { font-size: 0.75rem; }
</style>
