<template>
  <div
    class="zone-panel"
    :class="[`zone-${zone}`, { active: hasActingBG, 'move-target': isMoveTarget }]"
    @click.self="onZoneAreaClick"
  >
    <div class="zone-label" @click.stop="onZoneAreaClick">
      {{ zoneLabel }}
      <span v-if="isMoveTarget" class="move-arrow">→ 移動</span>
    </div>

    <div class="bgs-in-zone">
      <BGCard
        v-for="bg in bgsHere"
        :key="bg.id"
        :bg="bg"
        :is-acting="bg.id === activeBgId"
        :is-selectable="isSelectable(bg.id)"
        :is-acted="bg.actedThisPhase"
        :mode="bgMode(bg)"
        @click="onBGClick(bg)"
        @detail="game.detailBGId = $event"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import BGCard from './BGCard.vue'
import type { BGCardMode } from './BGCard.vue'
import type { ZoneId } from '../engine'
import type { BGInstance } from '../engine'
import { opponentOf, effectiveSupport, effectiveAttack } from '../engine'

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

const gs = computed(() => game.state)
const cp = computed(() => gs.value?.currentPlayer ?? 'p1')
const isHumanTurn = computed(() => !game.pveMode || cp.value === game.localPlayer)

const isMoveTarget = computed(() => {
  const s = gs.value
  if (!s || s.phase !== 'action' || !isHumanTurn.value || !s.actingBGId) return false
  const actingBG = s.bgs[s.actingBGId]
  if (!actingBG || actingBG.zone === props.zone) return false
  return game.canAct({ type: 'MOVE_BG', toZone: props.zone }, cp.value)
})

function bgMode(bg: BGInstance): BGCardMode {
  const s = gs.value
  if (!s || s.phase !== 'action' || !isHumanTurn.value) return 'normal'

  if (!s.actingBGId) {
    // 無行動中 BG：我方可用 BG 顯示 can-start
    if (bg.owner === cp.value && !bg.actedThisPhase && bg.state !== 'stunned' && bg.state !== 'ko') {
      if (game.canAct({ type: 'START_BG_ACTION', bgId: bg.id }, cp.value)) return 'can-start'
    }
    return 'normal'
  }

  const actingBG = s.bgs[s.actingBGId]

  // 敵方同區 BG：對敵目標
  if (bg.owner !== cp.value && bg.zone === actingBG.zone && bg.state !== 'ko') {
    return 'attack-target'
  }

  // 我方同區非行動 BG：聯合對象
  if (
    bg.owner === cp.value &&
    bg.id !== s.actingBGId &&
    bg.zone === actingBG.zone &&
    !bg.actedThisPhase &&
    bg.state !== 'stunned' &&
    bg.state !== 'ko' &&
    !s.jointAllyId        // 引擎已鎖定則不再顯示選項
  ) {
    return game.effectiveAllyId === bg.id ? 'selected-ally' : 'ally-target'
  }

  return 'normal'
}

function isSelectable(bgId: string): boolean {
  return game.selection?.validBGIds.includes(bgId) ?? false
}

function onZoneAreaClick() {
  if (!isMoveTarget.value) return
  game.setPending({
    type: 'move',
    toZone: props.zone,
    label: `移動至${zoneLabels[props.zone]}？`,
  })
}

function onBGClick(bg: BGInstance) {
  const s = gs.value
  if (!s) return

  // 選擇模式（技能/事件目標）優先
  if (game.selection?.validBGIds.includes(bg.id)) {
    game.selectBG(bg.id)
    return
  }

  if (game.pveMode && cp.value !== game.localPlayer) return
  if (s.phase !== 'action') return

  // 點擊同一目標 → 取消 pending
  const pend = game.uiPending
  if (pend) {
    const same =
      (pend.type === 'start_bg' && pend.bgId === bg.id) ||
      (pend.type === 'attack' && pend.targetBGId === bg.id) ||
      (pend.type === 'joint' && pend.bgId === bg.id)
    if (same) { game.clearPending(); return }
  }

  if (!s.actingBGId) {
    // 選擇行動 BG
    if (game.canAct({ type: 'START_BG_ACTION', bgId: bg.id }, cp.value)) {
      game.setPending({ type: 'start_bg', bgId: bg.id, label: `選擇 ${bg.name} 行動？` })
    }
    return
  }

  const actingBG = s.bgs[s.actingBGId]

  // 點擊敵方 BG → 對敵
  if (bg.owner !== cp.value && bg.zone === actingBG.zone && bg.state !== 'ko') {
    const allyId = (s.jointAllyId ?? game.uiSelectedAllyId) ?? undefined
    const allyBG = allyId ? s.bgs[allyId] : null
    const atkVal = effectiveAttack(actingBG) + (allyBG ? effectiveSupport(allyBG) : 0)
    if (game.canAct({ type: 'DO_ATTACK', targetBGId: bg.id, allyId }, cp.value)) {
      game.setPending({ type: 'attack', targetBGId: bg.id, label: `對敵 ${bg.name}（⚔ ${atkVal} 傷害）？` })
    }
    return
  }

  // 點擊我方同區 BG → 聯合
  if (
    bg.owner === cp.value &&
    bg.id !== s.actingBGId &&
    bg.zone === actingBG.zone &&
    !bg.actedThisPhase &&
    bg.state !== 'stunned' &&
    bg.state !== 'ko' &&
    !s.jointAllyId
  ) {
    if (game.uiSelectedAllyId === bg.id) {
      // 再次點擊已選聯合 → 取消
      game.deselectAlly()
    } else {
      game.setPending({ type: 'joint', bgId: bg.id, label: `與 ${bg.name} 聯合（🤝 +${effectiveSupport(s.bgs[bg.id])} 協助力）？` })
    }
  }
}
</script>

<style scoped>
.zone-panel {
  flex: 1; min-height: 180px; background: #ede8dc; border-radius: 8px;
  padding: 0.7rem; border: 2px solid #c0b5a5; transition: border-color 0.2s;
  cursor: default; position: relative;
}
.zone-panel.active { border-color: #b8820a; }
.zone-panel.move-target {
  border-color: #1a8040; border-style: dashed;
  box-shadow: 0 0 10px rgba(26,128,64,0.3);
  cursor: pointer;
  animation: zone-pulse 1s ease-in-out infinite alternate;
}
@keyframes zone-pulse {
  from { box-shadow: 0 0 4px rgba(26,128,64,0.2); }
  to   { box-shadow: 0 0 14px rgba(26,128,64,0.5); }
}
.zone-p1_base { border-top: 3px solid #1a5090; }
.zone-p2_base { border-top: 3px solid #901a3a; }
.zone-plaza { border-top: 3px solid #1a8090; }
.zone-label {
  font-size: 0.8rem; color: #7a6a58; margin-bottom: 0.5rem;
  display: flex; align-items: center; gap: 0.5rem;
}
.move-arrow {
  font-size: 0.7rem; background: #1a8040; color: #fff;
  padding: 1px 6px; border-radius: 10px; font-weight: bold;
}
.bgs-in-zone { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
