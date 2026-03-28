<template>
  <div class="action-panel">
    <div class="panel-title">
      行動 — {{ cpLabel }}
      <span class="phase-badge">{{ phaseLabel }}</span>
    </div>

    <!-- ── 待確認行動列（所有互動的確認點） ── -->
    <Transition name="confirm-bar">
      <div v-if="game.uiPending" class="confirm-bar">
        <span class="confirm-label">{{ game.uiPending.label }}</span>
        <button class="confirm-yes" @click="game.confirmPending()">✔ 確認</button>
        <button class="confirm-no" @click="game.clearPending()">✘ 取消</button>
      </div>
    </Transition>

    <!-- 補充階段（自動抽排中，過渡動畫） -->
    <div v-if="phase === 'draw'" class="actions draw-auto">
      <div class="draw-anim">
        <span class="draw-spinner">🃏</span>
        <span class="draw-label">自動抽取手牌中…</span>
      </div>
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
        <span v-if="allyName" class="ally-name">聯合：{{ allyName }}</span>
        <button v-if="game.uiSelectedAllyId && !lockedAllyId" class="deselect-ally" @click="game.deselectAlly()">× 取消聯合</button>
      </div>

      <!-- 提示：行動中才顯示 -->
      <div v-if="actingBGId" class="action-hints">
        <span v-if="!actingBGMoved">點擊區域移動</span>
        <span v-if="!doneNormalAction && hasEnemiesInZone">點擊敵方 BG 對敵</span>
        <span v-if="!doneNormalAction && hasEligibleAllies && !effectiveAlly">點擊我方 BG 聯合</span>
        <span v-if="!doneNormalAction && canSiege">或</span>
      </div>

      <!-- 通常動作：攻城（其他由點擊觸發） -->
      <div v-if="actingBGId" class="normal-actions">
        <button @click="doSiegeConfirm" :disabled="!canSiege" class="siege-btn">攻城</button>
      </div>

      <!-- 技能目標選擇 -->
      <div v-if="game.pendingSkill && game.pendingSkill.targetOptions.length > 0" class="discard-prompt target-prompt">
        <span>選擇技能目標：</span>
        <button
          v-for="t in game.pendingSkill.targetOptions" :key="t.id"
          :class="['target-btn', { selected: game.pendingSkill.targetBGId === t.id }]"
          @click="game.pendingSkill!.targetBGId = t.id"
        >{{ t.name }}</button>
        <!-- 不需棄牌時直接顯示確認鈕 -->
        <button
          v-if="game.pendingSkill.handCost === 0"
          class="confirm-btn"
          :disabled="game.pendingSkill.targetBGId === null"
          @click="confirmSkill"
        >確認施放</button>
        <button @click="game.pendingSkill = null">取消</button>
      </div>

      <!-- 棄牌選擇提示 -->
      <div v-if="game.pendingSkill && game.pendingSkill.handCost > 0" class="discard-prompt">
        <span>從手牌選 {{ game.pendingSkill.handCost }} 張棄牌
          （已選 {{ game.pendingSkill.selected.length }}）</span>
        <button
          class="confirm-btn"
          :disabled="game.pendingSkill.selected.length < game.pendingSkill.handCost ||
                     (game.pendingSkill.targetOptions.length > 0 && game.pendingSkill.targetBGId === null)"
          @click="confirmSkill"
        >確認施放</button>
        <button @click="game.pendingSkill = null">取消</button>
      </div>

      <!-- 技能（本次行動只能用一次） -->
      <div v-if="actingBGId && !actingBGUsedSkill && !game.pendingSkill" class="skills">
        <span v-if="effectiveAlly" class="skill-label">{{ actingBGName }} 技能：</span>
        <button v-for="(skill, idx) in actingBGSkills" :key="idx"
          :disabled="(actingBG?.skillCooldowns[idx] ?? 0) > 0"
          @click="openSkillModal(idx as 0 | 1)">
          技能{{ idx + 1 }}: {{ skill.name }}
          <span v-if="(actingBG?.skillCooldowns[idx] ?? 0) > 0" class="cd-hint">冷卻{{ actingBG!.skillCooldowns[idx] }}</span>
          <span v-else class="cd-hint cd-ready">CD {{ skill.cd }}</span>
          <span v-if="skill.handCost" class="cost-hint">棄×{{ skill.handCost }}</span>
        </button>
        <template v-if="effectiveAlly && allySkills.length">
          <span class="skill-label">{{ allyName }} 技能：</span>
          <button v-for="(skill, idx) in allySkills" :key="'a' + idx"
            :disabled="(effectiveAlly?.skillCooldowns[idx] ?? 0) > 0"
            @click="openAllySkillModal(idx as 0 | 1)">
            技能{{ idx + 1 }}: {{ skill.name }}
            <span v-if="(effectiveAlly?.skillCooldowns[idx] ?? 0) > 0" class="cd-hint">冷卻{{ effectiveAlly!.skillCooldowns[idx] }}</span>
            <span v-else class="cd-hint cd-ready">CD {{ skill.cd }}</span>
            <span v-if="skill.handCost" class="cost-hint">棄×{{ skill.handCost }}</span>
          </button>
        </template>
      </div>

      <button v-if="actingBGId" @click="endBGAction">結束此BG行動</button>
      <button class="next-btn" @click="nextPhase" :disabled="!!actingBGId">下一階段 →</button>
    </div>

    <!-- 反應階段 -->
    <div v-else-if="phase === 'react'" class="actions">
      <div class="info">可為未安裝反應卡的 BG 安裝反應卡（從手牌選擇）</div>
      <button class="next-btn" @click="nextPhase">結束回合 →</button>
    </div>

    <button class="surrender-btn" @click="surrender">投降</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import type { ZoneId } from '../engine'
import { opponentOf, frontZone, effectiveHP, effectiveAttack, effectiveSupport } from '../engine'
import type { SkillParams } from '../engine'
import { bgCardById } from '../data/bg-cards'

const game = useGameStore()
const gs = computed(() => game.state!)
const cp = computed(() => gs.value.currentPlayer)
const cpLabel = computed(() => cp.value === 'p1' ? 'P1' : 'P2')
const phase = computed(() => gs.value.phase)
const phaseLabels: Record<string, string> = {
  draw: '補充', main: '主要', action: '行動', react: '反應',
}
const phaseLabel = computed(() => phaseLabels[phase.value] ?? phase.value)

// ── 主要階段 ─────────────────────────────────
const buildingPlayed = computed(() => gs.value.mainBuildingPlayed)

// ── 行動階段 ─────────────────────────────────
const bgActionsUsed = computed(() => gs.value.bgActionsUsed)
const bgActionsMax = computed(() => gs.value.bgActionsMax)
const actingBGId = computed(() => gs.value.actingBGId)
const actingBG = computed(() => actingBGId.value ? gs.value.bgs[actingBGId.value] : null)
const actingBGName = computed(() => actingBG.value?.name ?? '')
const actingBGMoved = computed(() => actingBG.value?.movedThisAction ?? false)
const actingBGUsedSkill = computed(() => actingBG.value?.usedSkillThisAction ?? false)
const doneNormalAction = computed(() => actingBG.value?.doneNormalAction ?? false)
const lockedAllyId = computed(() => gs.value.jointAllyId)

const actingBGSkills = computed(() => {
  if (!actingBG.value) return []
  return bgCardById[actingBG.value.cardId]?.skills ?? []
})

// 實際生效的 ally（引擎鎖定優先，否則用 UI 選取）
const effectiveAlly = computed(() => game.effectiveAllyId ? gs.value.bgs[game.effectiveAllyId] : null)
const allyName = computed(() => effectiveAlly.value?.name ?? '')
const allySkills = computed(() => {
  if (!effectiveAlly.value) return []
  return bgCardById[effectiveAlly.value.cardId]?.skills ?? []
})

// 提示輔助
const hasEnemiesInZone = computed(() => {
  if (!actingBG.value) return false
  const enemy = opponentOf(cp.value)
  return Object.values(gs.value.bgs).some(
    bg => bg.owner === enemy && bg.zone === actingBG.value!.zone && bg.state !== 'ko'
  )
})
const hasEligibleAllies = computed(() => {
  if (!actingBG.value) return false
  return Object.values(gs.value.bgs).some(
    bg => bg.owner === cp.value && bg.id !== actingBGId.value &&
          bg.zone === actingBG.value!.zone && !bg.actedThisPhase &&
          bg.state !== 'stunned' && bg.state !== 'ko'
  )
})

// ── 攻城（唯一保留按鈕的通常動作） ────────────
const canSiege = computed(() => game.canAct({ type: 'DO_SIEGE' }, cp.value))

function doSiegeConfirm() {
  game.setPending({ type: 'siege', label: '攻城？' })
}

// ── 技能 ─────────────────────────────────────
function buildSkillParams(skillIndex: 0 | 1, fromBGId?: string): SkillParams {
  const s = gs.value
  const p = cp.value
  const enemy = opponentOf(p)
  const casterBG = fromBGId ? s.bgs[fromBGId] : actingBG.value!
  const skills = bgCardById[casterBG.cardId]?.skills ?? []
  const skill = skills[skillIndex]
  const handCost = skill?.handCost ?? 0
  const hand = s.players[p].hand
  const discardCardIds = handCost > 0 ? hand.slice(0, handCost) : []
  const enemiesInZone = Object.values(s.bgs)
    .filter(e => e.owner === enemy && e.zone === (actingBG.value?.zone ?? 'plaza') && e.state !== 'ko')
    .sort((a, b) => effectiveHP(a) - effectiveHP(b))
  return {
    discardCardIds,
    targetBGIds: enemiesInZone.map(e => e.id),
    targetBGId: enemiesInZone[0]?.id,
    targetZone: frontZone(p),
  }
}

function getTargetOptions(skillIndex: 0 | 1, fromBGId?: string) {
  if (!actingBG.value) return []
  const casterCardId = fromBGId
    ? gs.value.bgs[fromBGId]?.cardId
    : actingBG.value.cardId
  const skillDef = bgCardById[casterCardId ?? '']?.skills[skillIndex]
  if (!skillDef?.needsTarget) return []   // 未標記 needsTarget = 不需手動選目標
  const enemy = opponentOf(cp.value)
  return Object.values(gs.value.bgs)
    .filter(bg => bg.owner === enemy && bg.state !== 'ko')
    .map(bg => ({ id: bg.id, name: bg.name }))
}

function startPendingSkill(skillIndex: 0 | 1, fromBGId: string | undefined) {
  const skillList = fromBGId ? allySkills.value : actingBGSkills.value
  const skill = skillList[skillIndex]
  const handCost = skill?.handCost ?? 0
  const options = getTargetOptions(skillIndex, fromBGId)
  const needsSelect = options.length > 0
  game.pendingSkill = {
    skillIndex,
    fromBGId,
    handCost,
    selected: [],
    targetBGId: needsSelect ? null : (options[0]?.id ?? ''),
    targetOptions: needsSelect ? options : [],
  }
  if (!needsSelect && handCost === 0) {
    confirmSkill()
  }
}

function openSkillModal(skillIndex: 0 | 1) {
  if (!actingBGId.value) return
  startPendingSkill(skillIndex, undefined)
}

function openAllySkillModal(skillIndex: 0 | 1) {
  const allyId = game.effectiveAllyId
  if (!allyId || !actingBGId.value) return
  startPendingSkill(skillIndex, allyId)
}

function confirmSkill() {
  const ps = game.pendingSkill
  if (!ps || !actingBGId.value) return
  if (ps.targetOptions.length > 0 && ps.targetBGId === null) return
  if (ps.handCost > 0 && ps.selected.length < ps.handCost) return

  const discardCardIds = ps.selected.map(s => s.split(':').slice(1).join(':'))
  const params = buildSkillParams(ps.skillIndex, ps.fromBGId)
  params.discardCardIds = discardCardIds

  if (ps.targetBGId) {
    const others = (params.targetBGIds ?? []).filter(id => id !== ps.targetBGId)
    params.targetBGId = ps.targetBGId
    params.targetBGIds = [ps.targetBGId, ...others]
  }

  game.pendingSkill = null
  game.dispatchForCurrentPlayer({
    type: 'USE_SKILL',
    skillIndex: ps.skillIndex,
    params,
    ...(ps.fromBGId ? { fromBGId: ps.fromBGId } : {}),
  })
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

/* ── 待確認列 ── */
.confirm-bar {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  background: #fff8e1; border: 2px solid #f0a000; border-radius: 8px;
  padding: 0.5rem 0.8rem; margin-bottom: 0.5rem;
}
.confirm-label { flex: 1; font-size: 0.9rem; font-weight: bold; color: #5a3000; }
.confirm-yes {
  background: #2a8a30; color: #fff; border: none; border-radius: 6px;
  padding: 0.3rem 1rem; cursor: pointer; font-size: 0.85rem; font-weight: bold;
}
.confirm-yes:hover { background: #1a7020; }
.confirm-no {
  background: #c04040; color: #fff; border: none; border-radius: 6px;
  padding: 0.3rem 1rem; cursor: pointer; font-size: 0.85rem;
}
.confirm-no:hover { background: #a03030; }
.confirm-bar-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.confirm-bar-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.confirm-bar-enter-from, .confirm-bar-leave-to { opacity: 0; transform: translateY(-4px); }

.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.draw-auto { justify-content: center; padding: 0.5rem 0; }
.draw-anim { display: flex; align-items: center; gap: 0.6rem; color: #1a8090; font-size: 0.9rem; }
.draw-spinner { font-size: 1.4rem; animation: cardSpin 0.6s ease-in-out infinite alternate; }
@keyframes cardSpin { from { transform: rotate(-10deg) scale(0.9); } to { transform: rotate(10deg) scale(1.1); } }
.draw-label { font-weight: 500; }
.info, .bg-actions-info { width: 100%; font-size: 0.85rem; color: #7a6a58; display: flex; align-items: center; flex-wrap: wrap; gap: 0.3rem; }
.acting-name { color: #b8820a; margin-left: 0.3rem; font-weight: bold; }
.ally-name { color: #1a8090; margin-left: 0.3rem; font-weight: bold; }
.deselect-ally {
  font-size: 0.72rem; padding: 1px 6px; background: #f0e8d0; border: 1px solid #c0a070;
  color: #5a3000; border-radius: 4px; cursor: pointer;
}
.action-hints {
  width: 100%; font-size: 0.78rem; color: #888; display: flex; gap: 0.6rem; flex-wrap: wrap;
  margin-top: 0.1rem;
}
.action-hints span { background: #f0ead8; padding: 1px 6px; border-radius: 4px; }
.normal-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; width: 100%; margin-top: 0.2rem; }
.siege-btn { background: #f8e0d0; border-color: #c06020; color: #5a1a00; }
.skills { display: flex; flex-wrap: wrap; gap: 0.4rem; width: 100%; margin-top: 0.2rem; align-items: center; }
.skill-label { font-size: 0.75rem; color: #5a4a38; width: 100%; margin-top: 0.2rem; }
button {
  padding: 0.3rem 0.7rem; background: #f5f0e8; border: 1px solid #c0b5a5; color: #2a1f14;
  border-radius: 4px; cursor: pointer; font-size: 0.8rem; transition: background 0.2s;
}
button:hover:not(:disabled) { background: #e4ddd0; border-color: #1a8090; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
.next-btn { background: #d8edd8; border-color: #2a8a30; color: #1a5020; }
.next-btn:hover:not(:disabled) { background: #c4e0c4; }
.surrender-btn { background: #f0d8d8; border-color: #c07070; color: #7a1010; margin-top: 0.5rem; }
.discard-prompt {
  width: 100%; background: #fff3e0; border: 1px solid #e07000; border-radius: 6px;
  padding: 0.4rem 0.7rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  font-size: 0.85rem; color: #5a3000;
}
.confirm-btn { background: #d8edd8; border-color: #2a8a30; color: #1a5020; }
.target-prompt { border-color: #8040c0; background: #f0e8ff; color: #3a1060; }
.target-btn { background: #ede0ff; border-color: #8040c0; color: #3a1060; }
.target-btn.selected { background: #b080e0; border-color: #5010a0; color: #fff; font-weight: bold; }
.cost-hint { font-size: 0.68rem; background: #c0a040; color: #fff; padding: 1px 4px; border-radius: 3px; margin-left: 3px; }
.cd-hint { font-size: 0.68rem; background: #c06060; color: #fff; padding: 1px 4px; border-radius: 3px; margin-left: 3px; }
.cd-hint.cd-ready { background: #607060; }
</style>
