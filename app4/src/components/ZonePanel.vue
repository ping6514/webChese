<template>
  <div class="zone-panel" :class="[`zone-${zone}`, { active: hasActingBG }]">
    <div class="zone-label">{{ zoneLabel }}</div>

    <div class="bgs-in-zone">
      <BGCard
        v-for="bg in bgsHere"
        :key="bg.id"
        :bg="bg"
        :is-acting="bg.id === activeBgId"
        :is-selectable="isSelectable(bg.id)"
        @click="onBGClick(bg)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import BGCard from './BGCard.vue'
import type { ZoneId } from '../engine'
import type { BGInstance } from '../engine'

const props = defineProps<{ zone: ZoneId; activeBgId: string | null }>()
const game = useGameStore()

const zoneLabels: Record<ZoneId, string> = {
  p1_base: 'P1 主堡區',
  plaza: '廣場區',
  p2_base: 'P2 主堡區',
}

const zoneLabel = computed(() => zoneLabels[props.zone])
const bgsHere = computed(() => game.bgsInZone(props.zone))
const hasActingBG = computed(() => bgsHere.value.some(b => b.id === props.activeBgId))

function isSelectable(bgId: string): boolean {
  return game.selection?.validBGIds.includes(bgId) ?? false
}

function onBGClick(bg: BGInstance) {
  // 選擇模式優先
  if (game.selection?.validBGIds.includes(bg.id)) {
    game.selectBG(bg.id)
    return
  }

  const gs = game.state
  if (!gs) return
  const cp = gs.currentPlayer

  // PVE模式：Bot回合時不允許人類操作
  if (game.pveMode && cp !== game.localPlayer) return

  if (gs.phase === 'action') {
    if (!gs.actingBGId) {
      game.dispatchForCurrentPlayer({ type: 'START_BG_ACTION', bgId: bg.id })
    } else {
      const actingBG = gs.bgs[gs.actingBGId]
      if (bg.owner !== cp && bg.zone === actingBG.zone) {
        game.dispatchForCurrentPlayer({ type: 'DO_ATTACK', targetBGId: bg.id })
      }
    }
  }
}
</script>

<style scoped>
.zone-panel {
  flex: 1; min-height: 180px; background: #16213e; border-radius: 8px;
  padding: 0.7rem; border: 2px solid transparent; transition: border-color 0.2s;
}
.zone-panel.active { border-color: #e8c97a; }
.zone-p1_base { border-top: 3px solid #6fbfff; }
.zone-p2_base { border-top: 3px solid #ff8fa0; }
.zone-plaza { border-top: 3px solid #9ad4d6; }
.zone-label { font-size: 0.8rem; color: #aaa; margin-bottom: 0.5rem; }
.bgs-in-zone { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
