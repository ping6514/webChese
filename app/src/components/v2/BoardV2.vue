<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onUnmounted, type Ref } from 'vue'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'
import type { GameState } from '../../engine'
import { canEnchant, canSacrifice, getSoulCard } from '../../engine'
import BoardGrid from '../BoardGrid.vue'
import ConfirmModal from '../ConfirmModal.vue'
import ShootPreviewModal from '../ShootPreviewModal.vue'
import DamageFormulaToast from '../DamageFormulaToast.vue'
import { useSelection } from '../../useSelection'
import { useShootPreview } from '../../useShootPreview'
import { usePendingConfirm } from '../../usePendingConfirm'
import { useInteractionMode } from '../../composables/useInteractionMode'
import { useUiStore } from '../../stores/ui'
import { getItemCard } from '../../engine'
import { useDraggable } from '../../composables/useDraggable'

const props = defineProps<{ mobile?: boolean }>()

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()
const lastError = ref<string | null>(null)

// ── Selection ─────────────────────────────────────────────────────────────────
const {
  selectedUnitId, selectedCellKey, selectedUnit,
  legalMoves, shootableTargetIds,
  onSelectUnit, onCellClick: onCellClickSelection,
} = useSelection({ getState: () => state.value })

// ── Shoot preview ─────────────────────────────────────────────────────────────
const {
  shootPreview, openShootPreview, closeShootPreview,
  attacker: shootPreviewAttacker,
  target: shootPreviewTarget,
  guard: shootPreviewGuard,
  info: shootPreviewInfo,
  confirm: confirmShootPreviewFromComposable,
} = useShootPreview({ getState: () => state.value })

const shootExtraTargetUnitId = computed(() => shootPreview.value?.extraTargetUnitId ?? null)
const shootDetailsOpen = ref(false)

function cancelShootPreview() {
  shootDetailsOpen.value = false
  closeShootPreview()
}

// ── Pending confirm ────────────────────────────────────────────────────────────
const {
  pending, pendingImage, pendingGuard, setPending, clearPending,
  confirmPending: confirmPendingFromComposable,
} = usePendingConfirm({ getState: () => state.value })

// ── Bone refine drag ────────────────────────────────────────────────────────────
const {
  dragStyle: boneRefineDragStyle,
  onDragDown: boneRefineOnDragDown,
  onDragMove: boneRefineOnDragMove,
  onDragUp: boneRefineOnDragUp,
  resetDrag: boneRefineResetDrag,
} = useDraggable()

// ── Enchant mode ───────────────────────────────────────────────────────────────
const enchantMode = computed(() => ui.interactionMode.kind === 'enchant_select_unit')
const enchantModeSoulName = computed(() => {
  if (ui.interactionMode.kind !== 'enchant_select_unit') return null
  return getSoulCard(ui.interactionMode.soulId)?.name ?? null
})
const enchantableUnitIds = computed(() => {
  if (state.value.turn.phase !== 'necro') return []
  if (ui.interactionMode.kind !== 'enchant_select_unit') return []
  const soulId = ui.interactionMode.soulId
  const out: string[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    if (canEnchant(state.value, u.id, soulId).ok) out.push(u.id)
  }
  return out
})

// ── Sacrifice mode ─────────────────────────────────────────────────────────────
const sacrificeMode = computed(() => ui.interactionMode.kind === 'sacrifice_select_target')
const sacrificeRange = computed(() =>
  ui.interactionMode.kind === 'sacrifice_select_target' ? ui.interactionMode.range : 1
)
const sacrificeTargetableUnitIds = computed(() => {
  if (state.value.turn.phase !== 'combat') return []
  if (ui.interactionMode.kind !== 'sacrifice_select_target') return []
  const srcId = ui.interactionMode.sourceUnitId
  const range = ui.interactionMode.range
  const out: string[] = []
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    if (canSacrifice(state.value, srcId, u.id, range).ok) out.push(u.id)
  }
  return out
})

const canStartSacrificeMode = computed(() => {
  if (state.value.turn.phase !== 'combat') return { ok: false as const, reason: 'Not in combat phase' }
  if (!selectedUnit.value) return { ok: false as const, reason: 'Select a unit' }
  if (selectedUnit.value.side !== state.value.turn.side) return { ok: false as const, reason: 'Not your turn' }
  for (const u of Object.values(state.value.units)) {
    if (u.side !== state.value.turn.side) continue
    if (canSacrifice(state.value, selectedUnit.value.id, u.id, 1).ok) return { ok: true as const }
  }
  return { ok: false as const, reason: 'No valid sacrifice target' }
})

const sacrificeOverlayVisible = computed(() =>
  state.value.turn.phase === 'combat' &&
  !!selectedUnit.value &&
  selectedUnit.value.side === state.value.turn.side &&
  canStartSacrificeMode.value.ok &&
  !shootPreview.value &&
  !pending.value &&
  ui.interactionMode.kind === 'idle'
)

// ── Chain-eligible enemies for shoot preview ───────────────────────────────────
const shootChainEligibleEnemyIds = computed(() => {
  if (!shootPreview.value) return []
  const attacker = state.value.units[shootPreview.value.attackerId]
  const target = state.value.units[shootPreview.value.targetUnitId]
  if (!attacker || !target) return []
  const soulId = attacker.enchant?.soulId
  if (!soulId) return []
  const card = getSoulCard(soulId)
  if (!card) return []
  const chain = card.abilities.find((a) => a.type === 'CHAIN')
  const radius0 = Number((chain as any)?.radius ?? 0)
  const sb = state.value.status.sacrificeBuffByUnitId?.[attacker.id] ?? null
  const radius = Number.isFinite(sb?.chainRadius as any) && Number((sb as any).chainRadius) > 0
    ? Number((sb as any).chainRadius) : radius0
  if (!(Number.isFinite(radius) && radius > 0)) return []
  const cheb = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
  return Object.values(state.value.units)
    .filter((u) => u.side !== attacker.side && u.id !== target.id && cheb(u.pos, target.pos) <= radius)
    .map((u) => u.id)
})

const shootPreviewChainEligiblePosKeys = computed(() => {
  const set = new Set<string>()
  for (const id of shootChainEligibleEnemyIds.value) {
    const u = state.value.units[id]
    if (u) set.add(`${u.pos.x},${u.pos.y}`)
  }
  return [...set]
})
const shootPreviewChainSelectedPosKey = computed(() => {
  const id = shootExtraTargetUnitId.value
  if (!id) return null
  const u = state.value.units[id]
  return u ? `${u.pos.x},${u.pos.y}` : null
})
const shootTargetPosKey = computed(() => {
  if (!shootPreview.value) return null
  const u = state.value.units[shootPreview.value.targetUnitId]
  return u ? `${u.pos.x},${u.pos.y}` : null
})

// ── Interaction mode (cell click routing) ─────────────────────────────────────
const { boneRefineChoicePos, onUseItem, onCellClick, boneRefineChoose, cancelBoneRefine } =
  useInteractionMode({
    state, lastError, selectedUnit, shootPreview, shootChainEligibleEnemyIds,
    shootExtraTargetUnitId, enchantableUnitIds, sacrificeTargetableUnitIds,
    onCellClickSelection, openShootPreview, cancelShootPreview,
    shootDetailsOpen, legalMoves, setPending,
  })

function startSacrificeMode(sourceUnitId: string, range?: number) {
  if (state.value.turn.phase !== 'combat') return
  ui.startSacrificeSelectTarget(sourceUnitId, range)
}
watch(boneRefineChoicePos, (v) => { if (v) boneRefineResetDrag() })

// ── Enchant drop ───────────────────────────────────────────────────────────────
function onEnchantDrop(payload: { unitId: string; soulId: string }) {
  if (state.value.turn.phase !== 'necro') return
  const unit = state.value.units[payload.unitId]
  const card = getSoulCard(payload.soulId)
  if (!unit || !card) return
  if (unit.side !== state.value.turn.side) return
  setPending({
    action: { type: 'ENCHANT', unitId: unit.id, soulId: card.id },
    title: 'Confirm Enchant',
    detail: [`${card.name} -> ${unit.id}`, `base: ${card.base}`, `cost: ${card.costGold}G`].join('\n'),
  })
}

// ── Confirm handlers ───────────────────────────────────────────────────────────
function confirmPending() {
  confirmPendingFromComposable((a) => ctx.dispatch(a))
}

function confirmShootPreview() {
  shootDetailsOpen.value = false
  confirmShootPreviewFromComposable((a) => ctx.dispatch(a))
}

// ── Phase toast ────────────────────────────────────────────────────────────────
const phaseToastText = ref('')
const phaseToastVisible = ref(false)
let phaseToastTimer: ReturnType<typeof setTimeout> | null = null

function showPhaseToast(text: string) {
  phaseToastText.value = text
  phaseToastVisible.value = true
  if (phaseToastTimer) clearTimeout(phaseToastTimer)
  phaseToastTimer = setTimeout(() => { phaseToastVisible.value = false }, 1800)
}

watch(
  () => state.value.turn.phase,
  (phase) => {
    ui.setSelectedUnitId(null)
    ui.setSelectedCell(null)
    ui.clearShootPreview()
    ui.clearInteractionMode()
    if (phase !== 'turnStart') {
      const labels: Record<string, string> = {
        buy: '💰 購買階段', necro: '⚗️ 死靈術階段', combat: '⚔️ 戰鬥階段',
      }
      if (labels[phase]) showPhaseToast(labels[phase])
    }
  },
)

// ── Keyboard shortcuts ─────────────────────────────────────────────────────────
onMounted(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && ui.interactionMode.kind !== 'idle') ui.clearInteractionMode()
    if (e.key === 'Escape' && shootPreview.value) cancelShootPreview()
    if (e.key === 'Enter' && shootPreview.value) confirmShootPreview()
  }
  window.addEventListener('keydown', onKeyDown)
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
})

// ── FX refs (auto-unwrapped in template via computed) ─────────────────────────
const fxAttackUnitIds = computed(() => ctx.fx?.fxAttackUnitIds.value ?? [])
const fxHitUnitIds    = computed(() => ctx.fx?.fxHitUnitIds.value    ?? [])
const fxKilledUnitIds = computed(() => ctx.fx?.fxKilledUnitIds.value ?? [])
const fxAbilityUnitIds = computed(() => ctx.fx?.fxAbilityUnitIds.value ?? [])
const fxKilledPosKeys  = computed(() => ctx.fx?.fxKilledPosKeys.value  ?? [])
const fxRevivedPosKeys = computed(() => ctx.fx?.fxRevivedPosKeys.value ?? [])
const fxEnchantedPosKeys = computed(() => ctx.fx?.fxEnchantedPosKeys.value ?? [])
const floatTextsByPos  = computed(() => ctx.fx?.floatTextsByPos.value  ?? {})
const fxBeams          = computed(() => ctx.fx?.fxBeams.value          ?? [])
const damageToasts     = computed(() => ctx.fx?.damageToasts.value     ?? [])

// ── Board scale + 3D style ─────────────────────────────────────────────────────
type BoardScale = 33 | 50 | 75 | 100
const VALID_SCALES: BoardScale[] = [33, 50, 75, 100]
const boardScale = ref<BoardScale>(
  (() => {
    const v = Number(localStorage.getItem('v2_board_scale'))
    return VALID_SCALES.includes(v as BoardScale) ? (v as BoardScale) : 75
  })()
)
watch(boardScale, (v) => localStorage.setItem('v2_board_scale', String(v)))
const SCALE_LABELS: Record<BoardScale, string> = { 33: '33%', 50: '50%', 75: '75%', 100: '100%' }
const boardWrapStyle = computed(() => {
  if (props.mobile) return { width: '100%' }
  if (ctx.board3D)
    return { width: `${boardScale.value}%`, transform: 'perspective(900px) rotateX(25deg)', transformOrigin: 'center top' }
  return { width: `${boardScale.value}%` }
})
const currentSide = computed(() => state.value.turn.side)

// Expose onUseItem for parent hand components
defineExpose({ onUseItem })
</script>

<template>
  <div class="boardV2">
    <!-- Phase toast -->
    <Transition name="phase-toast">
      <div
        v-if="phaseToastVisible"
        class="phaseToast"
        :class="currentSide === 'red' ? 'toastRed' : 'toastGreen'"
      >{{ phaseToastText }}</div>
    </Transition>

    <!-- Action status bars -->
    <div v-if="enchantMode" class="actionBar">
      <span>附魔：選擇目標單位 {{ enchantModeSoulName ? `(${enchantModeSoulName})` : '' }}</span>
      <button type="button" @click="ui.clearInteractionMode()">取消 (Esc)</button>
    </div>
    <div v-else-if="sacrificeMode" class="actionBar">
      <span>獻祭（範圍 {{ sacrificeRange }}）選擇目標</span>
      <button type="button" @click="ui.clearInteractionMode()">取消 (Esc)</button>
    </div>
    <div v-else-if="ui.interactionMode.kind === 'use_item_target_unit'" class="actionBar">
      <span>道具：選擇目標單位 — {{ getItemCard(ui.interactionMode.itemId)?.name ?? '' }}</span>
      <button type="button" @click="ui.clearInteractionMode()">取消 (Esc)</button>
    </div>
    <div v-else-if="ui.interactionMode.kind === 'use_item_target_corpse' && !boneRefineChoicePos" class="actionBar">
      <span>骸骨煉化：選擇屍骸格</span>
      <button type="button" @click="cancelBoneRefine()">取消 (Esc)</button>
    </div>

    <!-- Scale bar (desktop only) -->
    <div v-if="!mobile" class="boardScaleBar">
      <button type="button" class="scaleBtn" :class="{ scaleActive: ctx.board3D }" @click="ctx.toggleBoard3D?.()">
        {{ ctx.board3D ? '⬜ 平面' : '🎲 3D' }}
      </button>
      <button
        type="button"
        class="scaleBtn"
        :title="ui.toastPosition === 'top' ? '傷害提示：頂部（點擊切換右側）' : '傷害提示：右側（點擊切換頂部）'"
        @click="ui.toggleToastPosition()"
      >{{ ui.toastPosition === 'top' ? '傷害報告💥⬆' : '傷害報告💥➡' }}</button>
      <span class="scaleDivider" />
      <button
        type="button"
        class="scaleBtn scaleActive"
        title="點擊循環切換棋盤大小"
        @click="boardScale = VALID_SCALES[(VALID_SCALES.indexOf(boardScale) + 1) % VALID_SCALES.length] ?? boardScale"
      >🔲 {{ SCALE_LABELS[boardScale] }}</button>
    </div>

    <!-- Board container + scale wrapper -->
    <div class="boardContainer">
    <div class="boardScaleWrap" :style="boardWrapStyle" :class="currentSide === 'red' ? 'boardWrap--red' : 'boardWrap--green'">
      <BoardGrid
        :state="state"
        :selected-unit-id="selectedUnitId"
        :selected-cell-pos-key="selectedCellKey"
        :legal-moves="legalMoves"
        :shootable-target-ids="shootableTargetIds"
        :highlight-unit-ids="
          enchantMode ? enchantableUnitIds :
          sacrificeMode ? sacrificeTargetableUnitIds :
          ui.interactionMode.kind === 'use_item_target_unit' ? ui.interactionMode.validUnitIds :
          []
        "
        :enchant-drag-soul-id="ui.interactionMode.kind === 'enchant_select_unit' ? ui.interactionMode.soulId : null"
        :preview-pierce-marks="{}"
        :preview-splash-pos-keys="[]"
        :preview-chain-eligible-pos-keys="shootPreviewChainEligiblePosKeys"
        :preview-chain-selected-pos-key="shootPreviewChainSelectedPosKey"
        :shoot-action-pos-key="shootTargetPosKey"
        :shoot-actions-visible="!shootDetailsOpen"
        :shoot-confirm-disabled="!shootPreviewGuard.ok"
        :shoot-confirm-title="shootPreviewGuard.ok ? '' : (shootPreviewGuard as any).reason ?? ''"
        :sacrifice-action-pos-key="sacrificeOverlayVisible && selectedUnit ? `${selectedUnit.pos.x},${selectedUnit.pos.y}` : null"
        :sacrifice-actions-visible="sacrificeOverlayVisible"
        :sacrifice-confirm-disabled="!canStartSacrificeMode.ok"
        :sacrifice-confirm-title="canStartSacrificeMode.ok ? '' : canStartSacrificeMode.reason"
        :fx-attack-unit-ids="fxAttackUnitIds"
        :fx-hit-unit-ids="fxHitUnitIds"
        :fx-killed-unit-ids="fxKilledUnitIds"
        :fx-ability-unit-ids="fxAbilityUnitIds"
        :fx-killed-pos-keys="fxKilledPosKeys"
        :fx-revived-pos-keys="fxRevivedPosKeys"
        :fx-enchanted-pos-keys="fxEnchantedPosKeys"
        :float-texts-by-pos="floatTextsByPos"
        :fx-beams="fxBeams"
        :sealed-unit-ids="state.turnFlags.sealedUnitIds ?? []"
        @cell-click="onCellClick"
        @select-unit="onSelectUnit"
        @enchant-drop="onEnchantDrop"
        @shoot-confirm="confirmShootPreview"
        @shoot-cancel="cancelShootPreview"
        @shoot-details="shootDetailsOpen = true"
        @sacrifice-confirm="selectedUnit && startSacrificeMode(selectedUnit.id, 1)"
        @sacrifice-cancel="ui.setSelectedUnitId(null)"
      />
    </div>
    </div><!-- end boardContainer -->

    <!-- Damage formula toast -->
    <DamageFormulaToast :toasts="damageToasts" :position="ui.toastPosition" />

    <!-- Shoot preview modal -->
    <ShootPreviewModal
      :open="shootDetailsOpen"
      :attacker="shootPreviewAttacker"
      :target="shootPreviewTarget"
      :guard="shootPreviewGuard"
      :raw-damage="shootPreviewInfo?.rawDamage ?? null"
      :damage-to-target="shootPreviewInfo?.damageToTarget ?? null"
      :shared="shootPreviewInfo?.shared ?? null"
      :effects="shootPreviewInfo?.effects ?? []"
      :damage-formula="shootPreviewInfo?.damageFormula ?? null"
      @confirm="confirmShootPreview"
      @cancel="shootDetailsOpen = false"
    />

    <!-- Pending confirm modal -->
    <ConfirmModal
      :open="!!pending"
      :title="pending?.title ?? ''"
      :detail="pending?.detail ?? ''"
      :image="pendingImage"
      :guard="pendingGuard"
      @confirm="confirmPending"
      @cancel="clearPending"
    />

    <!-- Bone refine choice overlay -->
    <div v-if="boneRefineChoicePos" class="boneRefineOverlay" @click.self="cancelBoneRefine()">
      <div
        class="boneRefineModal"
        :style="boneRefineDragStyle"
        @pointerdown="boneRefineOnDragDown"
        @pointermove="boneRefineOnDragMove"
        @pointerup="boneRefineOnDragUp"
        @pointercancel="boneRefineOnDragUp"
      >
        <div class="boneRefineTitle">骸骨煉化 <span class="dragHint">⠿</span></div>
        <div class="boneRefineDesc">移除屍骸，選擇獲得的增益：</div>
        <div class="boneRefineBtns">
          <button type="button" class="choiceBtn choiceGold" @click="boneRefineChoose('gold')">
            <span class="choiceIcon">💰</span>
            <span>+{{ getItemCard('item_bone_refine')?.effect?.goldAmount ?? 3 }} 財力</span>
          </button>
          <button type="button" class="choiceBtn choiceMana" @click="boneRefineChoose('mana')">
            <span class="choiceIcon">💧</span>
            <span>+{{ getItemCard('item_bone_refine')?.effect?.manaAmount ?? 2 }} 魔力</span>
          </button>
        </div>
        <button type="button" class="boneRefineCancel" @click="cancelBoneRefine()">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.boardV2 {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: visible;
}

/* ── Phase toast ── */
.phaseToast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 200;
  padding: 10px 28px;
  border-radius: 12px;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(8px);
}
.toastRed   { background: rgba(255, 60, 60, 0.25); border: 1px solid rgba(255, 100, 100, 0.5); color: #ffb0b2; }
.toastGreen { background: rgba(30, 160, 80, 0.25); border: 1px solid rgba(60, 200, 100, 0.5); color: #b7eb8f; }

.phase-toast-enter-active { transition: opacity 0.3s, transform 0.3s; }
.phase-toast-leave-active { transition: opacity 0.5s, transform 0.5s; }
.phase-toast-enter-from  { opacity: 0; transform: translate(-50%, calc(-50% - 12px)); }
.phase-toast-leave-to    { opacity: 0; transform: translate(-50%, calc(-50% + 12px)); }

/* ── Action status bar ── */
.actionBar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  background: rgba(20, 22, 40, 0.92);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.8125rem;
  flex-shrink: 0;
}
.actionBar button {
  padding: 3px 10px;
  font-size: 0.75rem;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
}
.actionBar button:hover { background: rgba(255, 255, 255, 0.12); }

/* ── Scale bar ── */
.boardScaleBar {
  display: flex;
  gap: 4px;
  padding: 4px 10px;
  flex-shrink: 0;
}

.scaleBtn {
  padding: 2px 9px;
  font-size: 0.6875rem;
  font-weight: 700;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 0.15s;
}
.scaleBtn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.85);
}
.scaleActive {
  background: rgba(145, 202, 255, 0.18) !important;
  border-color: rgba(145, 202, 255, 0.65) !important;
  color: rgba(145, 202, 255, 0.95) !important;
}

.scaleDivider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.12);
  align-self: center;
  flex-shrink: 0;
}

/* ── Board container (centres board horizontally, allows vertical scroll via parent) ── */
.boardContainer {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-x: hidden;
}

/* ── Board scale wrapper ── */
.boardScaleWrap {
  transition: width 0.2s ease, transform 0.3s ease;
   margin: 2rem 0.5rem;
}
.boardWrap--red   {
  box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.28), 0 0 24px rgba(255, 77, 79, 0.14);
  border-radius: 10px;
}
.boardWrap--green {
  box-shadow: 0 0 0 2px rgba(82, 196, 26, 0.28), 0 0 24px rgba(82, 196, 26, 0.14);
  border-radius: 10px;
}

/* ── Bone refine overlay ── */
.boneRefineOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 200;
}
.boneRefineModal {
  background: rgba(16, 18, 36, 0.97);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  padding: 20px 24px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: default;
  user-select: none;
  touch-action: none;
  align-items: center;
}
.boneRefineTitle {
  font-size: 1rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  cursor: grab;
  display: flex;
  align-items: center;
  gap: 6px;
}
.boneRefineTitle:active { cursor: grabbing; }
.dragHint {
  font-size: 1rem;
  opacity: 0.3;
  pointer-events: none;
}
.boneRefineDesc {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.55);
}
.boneRefineBtns {
  display: flex;
  gap: 10px;
}
.choiceBtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.15s;
}
.choiceGold { border-color: rgba(232, 208, 112, 0.4); }
.choiceGold:hover { background: rgba(232, 208, 112, 0.12); }
.choiceMana { border-color: rgba(145, 202, 255, 0.4); }
.choiceMana:hover { background: rgba(145, 202, 255, 0.12); }
.choiceIcon { font-size: 1.25rem; }
.boneRefineCancel {
  font-size: 0.75rem;
  padding: 4px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
}
</style>
