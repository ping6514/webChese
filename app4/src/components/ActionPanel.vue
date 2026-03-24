<template>
  <div class="action-panel">
    <div class="panel-title">
      行動 — {{ cpLabel }}
      <span class="phase-badge">{{ phaseLabel }}</span>
    </div>

    <!-- 補充階段 -->
    <div v-if="phase === 'draw'" class="actions">
      <div class="draw-info">補充行動：{{ drawActionsUsed }} / 2（砌磚須靠BLC技能）</div>
      <button @click="drawCard" :disabled="!canDraw">抽牌</button>
      <button class="next-btn" @click="nextPhase">下一階段 →</button>
    </div>

    <!-- 主要階段 -->
    <div v-else-if="phase === 'main'" class="actions">
      <div class="info">可打出建築卡（{{ buildingPlayed ? '已打' : '未打' }}）+ 任意事件卡</div>
      <button class="next-btn" @click="nextPhase">下一階段 →</button>
    </div>

    <!-- 行動階段 -->
    <div v-else-if="phase === 'action'" class="actions">
      <div class="bg-actions-info">
        BG 行動：{{ bgActionsUsed }} / {{ bgActionsMax }}
        <span v-if="actingBGId" class="acting-name">行動中：{{ actingBGName }}</span>
      </div>

      <!-- 移動選項 -->
      <div v-if="actingBGId && !actingBGMoved" class="move-row">
        <span>移動至：</span>
        <button v-for="zone in moveTargets" :key="zone" @click="moveBG(zone)">{{ zoneLabel(zone) }}</button>
        <button @click="moveBG(actingBGZone as ZoneId)">留在原地</button>
      </div>

      <!-- 通常動作 -->
      <div v-if="actingBGId" class="normal-actions">
        <button @click="doSiege" :disabled="!canSiege">攻城</button>
        <button @click="selectingClearBrick = !selectingClearBrick" :disabled="!hasClearTargets">清磚</button>
        <div v-if="selectingClearBrick" class="clear-targets">
          <button v-for="t in clearTargets" :key="t.id" @click="doClearBrick(t.id)">
            清除 {{ t.label }}（{{ t.count }}塊）
          </button>
        </div>
      </div>

      <!-- 技能 -->
      <div v-if="actingBGId && !actingBGUsedSkill" class="skills">
        <button v-for="(skill, idx) in actingBGSkills" :key="idx" @click="openSkillModal(idx as 0 | 1)">
          技能{{ idx + 1 }}: {{ skill.name }} (CD {{ skill.cd }})
        </button>
      </div>

      <button v-if="actingBGId" @click="endBGAction">結束此BG行動</button>
      <button class="next-btn" @click="nextPhase" :disabled="!!actingBGId">下一階段 →</button>
    </div>

    <!-- 反應階段 -->
    <div v-else-if="phase === 'react'" class="actions">
      <div class="info">可為未安裝反應卡的 BG 安裝反應卡（從手牌選擇）</div>
      <button class="next-btn" @click="nextPhase">結束回合 →</button>
    </div>

    <!-- 結束階段 -->
    <div v-else-if="phase === 'end'" class="actions">
      <button class="next-btn" @click="nextPhase">交給對方 →</button>
    </div>

    <button class="surrender-btn" @click="surrender">投降</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGameStore } from '../stores/game'
import type { ZoneId, BrickAreaId } from '../engine'
import { opponentOf, frontZone, areAdjacent, effectiveHP } from '../engine'
import type { SkillParams } from '../engine'
import { bgCardById } from '../data/bg-cards'
import { getClearTargetAreas } from '../engine/guards'

const game = useGameStore()
const gs = computed(() => game.state!)
const cp = computed(() => gs.value.currentPlayer)
const cpLabel = computed(() => cp.value === 'p1' ? 'P1' : 'P2')
const phase = computed(() => gs.value.phase)
const phaseLabels: Record<string, string> = {
  draw: '補充', main: '主要', action: '行動', react: '反應', end: '結束',
}
const phaseLabel = computed(() => phaseLabels[phase.value] ?? phase.value)

// ── 補充階段 ─────────────────────────────────
const drawActionsUsed = computed(() => gs.value.drawActionsUsed)
const canDraw = computed(() => game.canAct({ type: 'DRAW_CARD' }, cp.value))

function drawCard() { game.dispatchForCurrentPlayer({ type: 'DRAW_CARD' }) }

// ── 主要階段 ─────────────────────────────────
const buildingPlayed = computed(() => gs.value.mainBuildingPlayed)

// ── 行動階段 ─────────────────────────────────
const bgActionsUsed = computed(() => gs.value.bgActionsUsed)
const bgActionsMax = computed(() => gs.value.bgActionsMax)
const actingBGId = computed(() => gs.value.actingBGId)
const actingBG = computed(() => actingBGId.value ? gs.value.bgs[actingBGId.value] : null)
const actingBGName = computed(() => actingBG.value?.name ?? '')
const actingBGZone = computed(() => actingBG.value?.zone)
const actingBGMoved = computed(() => actingBG.value?.movedThisAction ?? false)
const actingBGUsedSkill = computed(() => actingBG.value?.usedSkillThisAction ?? false)

const actingBGSkills = computed(() => {
  if (!actingBG.value) return []
  return bgCardById[actingBG.value.cardId]?.skills ?? []
})

const zones: ZoneId[] = ['p1_base', 'plaza', 'p2_base']
const zoneLabelMap: Record<ZoneId, string> = {
  p1_base: 'P1主堡', plaza: '廣場', p2_base: 'P2主堡',
}
function zoneLabel(z: ZoneId) { return zoneLabelMap[z] }

const moveTargets = computed(() => {
  if (!actingBG.value) return []
  const bg = actingBG.value
  const from = bg.zone
  return zones.filter(z => {
    if (z === from) return false
    return areAdjacent(from, z) && game.canAct({ type: 'MOVE_BG', toZone: z }, cp.value)
  })
})

function moveBG(zone: ZoneId) {
  game.dispatchForCurrentPlayer({ type: 'MOVE_BG', toZone: zone })
}

const canSiege = computed(() => game.canAct({ type: 'DO_SIEGE' }, cp.value))

const selectingClearBrick = ref(false)
const clearTargets = computed(() => {
  if (!actingBG.value) return []
  const bg = actingBG.value
  const areas = getClearTargetAreas(bg.zone, cp.value)
  return areas
    .filter(id => gs.value.brickAreas[id].slots.length > 0)
    .map(id => ({
      id,
      label: id,
      count: gs.value.brickAreas[id].slots.length,
    }))
})
const hasClearTargets = computed(() => clearTargets.value.length > 0)

function doClearBrick(areaId: BrickAreaId) {
  game.dispatchForCurrentPlayer({ type: 'DO_CLEAR_BRICK', areaId })
  selectingClearBrick.value = false
}
function doSiege() { game.dispatchForCurrentPlayer({ type: 'DO_SIEGE' }) }

function openSkillModal(skillIndex: 0 | 1) {
  const s = gs.value
  const p = cp.value
  const bgId = actingBGId.value
  if (!bgId) return
  const bg = s.bgs[bgId]
  const enemy = opponentOf(p)
  const hand = s.players[p].hand
  const skill = actingBGSkills.value[skillIndex]
  if (!skill) return

  const handCost = skill.handCost ?? 0
  const discardCardIds = handCost > 0 ? hand.slice(0, handCost) : []

  const enemiesInZone = Object.values(s.bgs)
    .filter(e => e.owner === enemy && e.zone === bg.zone && e.state !== 'ko')
    .sort((a, b) => effectiveHP(a) - effectiveHP(b))

  const params: SkillParams = {
    discardCardIds,
    targetBGIds: enemiesInZone.map(e => e.id),
    targetBGId: enemiesInZone[0]?.id,
    targetZone: frontZone(p),
  }

  game.dispatchForCurrentPlayer({ type: 'USE_SKILL', skillIndex, params })
}

function endBGAction() { game.dispatchForCurrentPlayer({ type: 'END_BG_ACTION' }) }

// ── 通用 ─────────────────────────────────────
function nextPhase() { game.dispatchForCurrentPlayer({ type: 'NEXT_PHASE' }) }
function surrender() { game.dispatchForCurrentPlayer({ type: 'SURRENDER' }) }
</script>

<style scoped>
.action-panel { }
.panel-title { font-weight: bold; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; color: #2a1f14; }
.phase-badge { font-size: 0.75rem; background: #ddd5c8; padding: 2px 6px; border-radius: 4px; color: #1a8090; border: 1px solid #c0b5a5; }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.draw-info, .info, .bg-actions-info { width: 100%; font-size: 0.85rem; color: #7a6a58; }
.acting-name { color: #b8820a; margin-left: 0.5rem; font-weight: bold; }
.move-row, .normal-actions, .skills, .clear-targets {
  display: flex; flex-wrap: wrap; gap: 0.4rem; width: 100%; margin-top: 0.2rem;
}
button {
  padding: 0.3rem 0.7rem; background: #f5f0e8; border: 1px solid #c0b5a5; color: #2a1f14;
  border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;
}
button:hover:not(:disabled) { background: #e4ddd0; border-color: #1a8090; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.next-btn { background: #d8edd8; border-color: #2a8a30; color: #1a5020; }
.next-btn:hover:not(:disabled) { background: #c4e0c4; }
.surrender-btn { background: #f0d8d8; border-color: #c07070; color: #7a1010; margin-top: 0.5rem; }
select {
  padding: 0.3rem; background: #f5f0e8; border: 1px solid #c0b5a5; color: #2a1f14;
  border-radius: 4px; font-size: 0.8rem;
}
</style>
