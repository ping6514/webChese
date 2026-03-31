<script setup lang="ts">
import { ref, computed, watch, inject, onMounted, onUnmounted, nextTick, type Ref } from 'vue'
import { GAME_V2_KEY, type GameV2Ctx } from '../../composables/useGameV2Context'
import type { GameState } from '../../engine'
import { canEnchant, canSacrifice, getSoulCard } from '../../engine'
import BoardGrid from '../BoardGrid.vue'
import PixiBoard from './PixiBoard.vue'
import ConfirmModal from '../ConfirmModal.vue'
import ShootPreviewModal from '../ShootPreviewModal.vue'
import type { SkillOption } from '../../game/BoardActionPanel'
import DamageFormulaToast from '../DamageFormulaToast.vue'
import IncomeToast from '../IncomeToast.vue'
import { useSelection } from '../../useSelection'
import { useShootPreview } from '../../useShootPreview'
import { usePendingConfirm } from '../../usePendingConfirm'
import { useInteractionMode } from '../../composables/useInteractionMode'
import { useUiStore } from '../../stores/ui'
import { getItemCard } from '../../engine'
import { useDraggable } from '../../composables/useDraggable'
import type { ShotPreviewEffect } from '../../engine/shotPreview'

const props = defineProps<{ mobile?: boolean }>()

const ctx = inject(GAME_V2_KEY) as GameV2Ctx
const state = ctx.state as Ref<GameState>
const ui = useUiStore()
const lastError = ref<string | null>(null)

// PixiJS renderer always enabled
const usePixiRenderer = true
const pixiBoardRef = ref<InstanceType<typeof PixiBoard>>()

// 連鎖目標選擇模式（面板隱藏中，等待玩家點選目標）
const isSelectingChain = ref(false)
const activeKeysForConfirm = ref<string[]>([])

// 結束連鎖選擇，重新顯示確認面板
function finishChainSelection() {
  isSelectingChain.value = false
  if (shootPreview.value) {
    nextTick(() => showCanvasConfirm(activeKeysForConfirm.value))
  }
}

// Adapter for PixiBoard cell-click event
function onPixiCellClick(payload: { x: number; y: number }) {
  const unitId = Object.values(state.value.units).find(u => u.pos.x === payload.x && u.pos.y === payload.y)?.id ?? null
  if (isSelectingChain.value) {
    onCellClick({ ...payload, unitId })
    finishChainSelection()
    return
  }
  onCellClick({ ...payload, unitId })
}

// Wrapper for PixiBoard unit-click that handles shooting preview
function onPixiUnitClick(unitId: string) {
  const unit = state.value.units[unitId]
  if (!unit) return

  // 連鎖選擇模式：點選棋子 → 更新連鎖目標 → 重新開啟面板
  if (isSelectingChain.value) {
    onCellClick({ x: unit.pos.x, y: unit.pos.y, unitId })
    finishChainSelection()
    return
  }

  // 射擊預覽中（面板可見）：忽略棋子點擊，避免誤觸
  if (shootPreview.value) return

  // Check if we're in enchant mode - if so, route through onCellClick
  if (ui.interactionMode.kind === 'enchant_select_unit') {
    onCellClick({ x: unit.pos.x, y: unit.pos.y, unitId })
    return
  }
  
  // Check if we're in sacrifice mode
  if (ui.interactionMode.kind === 'sacrifice_select_target') {
    onCellClick({ x: unit.pos.x, y: unit.pos.y, unitId })
    return
  }
  
  // Check if we're in item target mode
  if (ui.interactionMode.kind === 'use_item_target_unit') {
    onCellClick({ x: unit.pos.x, y: unit.pos.y, unitId })
    return
  }
  
  // If we have a selected unit that can shoot, and clicked an enemy unit, open shoot preview
  if (selectedUnit.value && shootableTargetIds.value.includes(unitId)) {
    openShootPreview(selectedUnit.value.id, unitId)
    return
  }
  
  // Otherwise, normal unit selection
  onSelectUnit(unitId)
}

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
  goldForDamageInfo: shootGoldForDamageInfo,
  spendGoldForDamage: shootSpendGoldForDamage,
  bloodSacrificeInfo: shootBloodSacrificeInfo,
  sacrificeHp: shootSacrificeHp,
  suppressPierce: shootSuppressPierce,
  pierceInfo: shootPierceInfo,
} = useShootPreview({ getState: () => state.value })

const shootExtraTargetUnitId = computed(() => shootPreview.value?.extraTargetUnitId ?? null)
const shootDetailsOpen = ref(false)

const shootConfirmTitle = computed(() => {
  const g = shootPreviewGuard.value
  if (g.ok) return ''
  return String((g as any).reason ?? '')
})

const shootManaCost = computed<number | null>(() => {
  const info = shootPreviewInfo.value
  if (!info?.ok) return null
  const cost = Number((info as any).cost ?? NaN)
  return Number.isFinite(cost) ? cost : state.value.rules.shootManaCost
})

const shootPreviewPierceMarks = computed<Record<string, number>>(() => {
  if (!shootPreview.value) return {}
  const info = shootPreviewInfo.value
  if (!info?.ok) return {}

  const unitIds: string[] = []
  for (const e of (info.effects ?? []) as ShotPreviewEffect[]) {
    if (e.kind !== 'PIERCE') continue
    const ids = Array.isArray((e as any).targetUnitIds) ? ((e as any).targetUnitIds as string[]) : []
    for (const id of ids) unitIds.push(id)
  }

  const marks: Record<string, number> = {}
  let idx = 0
  for (const id of unitIds) {
    const u = state.value.units[id]
    if (!u) continue
    idx++
    marks[`${u.pos.x},${u.pos.y}`] = idx
  }
  return marks
})

function cancelShootPreview() {
  shootDetailsOpen.value = false
  isSelectingChain.value = false
  closeShootPreview()
  pixiBoardRef.value?.hideActionPanel()
}

// ── Canvas action panel flow ───────────────────────────────────────────────

function getTargetScreenPos(): { x: number; y: number } | undefined {
  const target = shootPreviewTarget.value
  if (!target) return undefined
  return pixiBoardRef.value?.getCellScreenPos(target.pos.x, target.pos.y)
}

function buildSummary(activeKeys: string[]): string | undefined {
  const parts: string[] = []
  if (shootManaCost.value != null) parts.push(`耗魔 ${shootManaCost.value}`)
  if (activeKeys.includes('sacrifice')) parts.push('血祭')
  if (activeKeys.includes('gold')) parts.push('以財傷敵')
  if (activeKeys.includes('enable_pierce') && shootPierceInfo.value) {
    parts.push(`貫通×${shootPierceInfo.value.targetCount}`)
  }
  return parts.length ? parts.join(' ／ ') : undefined
}

function showCanvasConfirm(activeKeys: string[]) {
  activeKeysForConfirm.value = activeKeys
  const hasSkills = !!(shootBloodSacrificeInfo.value || shootGoldForDamageInfo.value || shootPierceInfo.value)
  const chainEligible = shootChainEligibleEnemyIds.value.length > 0
  pixiBoardRef.value?.showAttackConfirm({
    title: '確認射擊',
    summary: buildSummary(activeKeys),
    confirmLabel: '確認射擊',
    confirmDisabled: !shootPreviewGuard.value.ok,
    onSelectChain: chainEligible ? () => {
      if (shootExtraTargetUnitId.value) {
        // 已有目標 → 清除，按鈕回到未選擇狀態
        openShootPreview(shootPreview.value!.attackerId, shootPreview.value!.targetUnitId, null)
        pixiBoardRef.value?.updateChainTarget(false)
      } else {
        // 未選擇 → 隱藏面板，等待玩家點選目標
        isSelectingChain.value = true
        pixiBoardRef.value?.hideActionPanel()
      }
    } : undefined,
    targetScreenPos: getTargetScreenPos(),
    onConfirm: confirmShootPreview,
    onBack: hasSkills ? () => openCanvasAttackFlow() : undefined,
    onCancel: cancelShootPreview,
    onPreview: () => { shootDetailsOpen.value = true },
  })
  // 同步連鎖按鈕的當前選取狀態
  if (chainEligible) {
    nextTick(() => pixiBoardRef.value?.updateChainTarget(!!shootExtraTargetUnitId.value))
  }
}

function openCanvasAttackFlow() {
  const skills: SkillOption[] = []
  if (shootBloodSacrificeInfo.value) {
    skills.push({
      key: 'sacrifice',
      label: `血祭 帥-${shootBloodSacrificeInfo.value.hpCost ?? 1}HP`,
      style: 'blood',
    })
  }
  if (shootGoldForDamageInfo.value) {
    skills.push({
      key: 'gold',
      label: `以財傷敵 -${shootGoldForDamageInfo.value.goldCost}G +${shootGoldForDamageInfo.value.damageBonus}傷`,
      style: 'gold',
    })
  }

  if (shootPierceInfo.value) {
    skills.push({
      key: 'enable_pierce',
      label: `啟用貫通（穿透 ${shootPierceInfo.value.targetCount} 個目標）`,
      style: 'gold',
    })
  }
  const chainEligibleCount = shootChainEligibleEnemyIds.value.length
  const targetScreenPos = getTargetScreenPos()

  if (skills.length > 0) {
    pixiBoardRef.value?.showSkillSelect({
      title: '攻擊前技能選擇',
      skills,
      chainEligibleCount: chainEligibleCount || undefined,
      targetScreenPos,
      onContinue: (activeKeys) => {
        setShootSpendGold(activeKeys.includes('gold'))
        setShootSacrificeHp(activeKeys.includes('sacrifice'))
        setShootSuppressPierce(!activeKeys.includes('enable_pierce'))
        showCanvasConfirm(activeKeys)
      },
      onCancel: cancelShootPreview,
    })
  } else {
    showCanvasConfirm([])
  }
}

// 連鎖目標更新後，若面板可見則同步顯示
watch(shootExtraTargetUnitId, (id) => {
  if (shootPreview.value && !isSelectingChain.value) {
    pixiBoardRef.value?.updateChainTarget(!!id)
  }
})

// 當 shootPreview 開啟時，啟動 Canvas 面板流程
watch(shootPreview, async (newVal, oldVal) => {
  if (!newVal) {
    isSelectingChain.value = false
    pixiBoardRef.value?.hideActionPanel()
    return
  }
  if (!oldVal) {
    await nextTick()
    openCanvasAttackFlow()
  }
})

// 詳情預覽開啟/關閉時同步面板狀態
watch(shootDetailsOpen, (open) => {
  if (open) {
    pixiBoardRef.value?.hideActionPanel()
  } else if (shootPreview.value) {
    const activeKeys: string[] = []
    if (shootSacrificeHp.value) activeKeys.push('sacrifice')
    if (shootSpendGoldForDamage.value) activeKeys.push('gold')
    if (!shootSuppressPierce.value) activeKeys.push('enable_pierce')
    showCanvasConfirm(activeKeys)
  }
})

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

// ── Corpse targetable positions ───────────────────────────────────────────────
const corpseTargetablePosKeys = computed(() => {
  if (ui.interactionMode.kind !== 'use_item_target_corpse') return []
  const out: string[] = []
  for (const [posKey, corpses] of Object.entries(state.value.corpsesByPos)) {
    const hasFriendlyCorpse = corpses.some((c) => c.ownerSide === state.value.turn.side)
    if (hasFriendlyCorpse) out.push(posKey)
  }
  return out
})

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
  const sbRadius = Number.isFinite(sb?.chainRadius as any) && Number((sb as any).chainRadius) > 0
    ? Number((sb as any).chainRadius) : 0
  // Also check BLOOD_SACRIFICE → CHAIN when sacrifice toggle is active
  let bsRadius = 0
  if (shootSacrificeHp.value) {
    const bsAb = card.abilities.find((a) => a.type === 'BLOOD_SACRIFICE')
    if (bsAb && (bsAb as any).onActivate?.type === 'CHAIN') {
      bsRadius = Number((bsAb as any).onActivate?.radius ?? 0)
    }
  }
  const radius = Math.max(radius0, sbRadius, bsRadius)
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

// ── Sacrifice Pixi confirm panel ───────────────────────────────────────────────
function showSacrificeConfirmPanel(action: { type: 'SACRIFICE'; sourceUnitId: string; targetUnitId: string; range: number }) {
  const srcUnit = state.value.units[action.sourceUnitId]
  const tgtUnit = state.value.units[action.targetUnitId]
  const srcName = srcUnit?.enchant?.soulId ? (getSoulCard(srcUnit.enchant.soulId)?.name ?? srcUnit.base) : (srcUnit?.base ?? action.sourceUnitId)
  const tgtName = tgtUnit?.enchant?.soulId ? (getSoulCard(tgtUnit.enchant.soulId)?.name ?? tgtUnit.base) : (tgtUnit?.base ?? action.targetUnitId)
  const targetScreenPos = tgtUnit ? pixiBoardRef.value?.getCellScreenPos(tgtUnit.pos.x, tgtUnit.pos.y) : undefined
  pixiBoardRef.value?.showAttackConfirm({
    title: '確認獻祭',
    summary: `${srcName} 獻祭 → ${tgtName}`,
    confirmLabel: '確認獻祭',
    targetScreenPos,
    onConfirm: () => { ctx.dispatch(action) },
    onCancel: () => {},
  })
}

function handleSetPending(p: Parameters<typeof setPending>[0]) {
  if (p.action.type === 'SACRIFICE') {
    showSacrificeConfirmPanel(p.action as { type: 'SACRIFICE'; sourceUnitId: string; targetUnitId: string; range: number })
    return
  }
  setPending(p)
}

// ── Interaction mode (cell click routing) ─────────────────────────────────────
const { boneRefineChoicePos, onUseItem, onCellClick, boneRefineChoose, cancelBoneRefine } =
  useInteractionMode({
    state, lastError, selectedUnit, shootPreview, shootChainEligibleEnemyIds,
    shootExtraTargetUnitId, enchantableUnitIds, sacrificeTargetableUnitIds,
    onCellClickSelection, openShootPreview, cancelShootPreview,
    shootDetailsOpen, legalMoves, setPending: handleSetPending,
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
    title: '確認附魔',
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

function setShootSpendGold(v: boolean) {
  shootSpendGoldForDamage.value = v
}

function setShootSacrificeHp(v: boolean) {
  shootSacrificeHp.value = v
}

function setShootSuppressPierce(v: boolean) {
  shootSuppressPierce.value = v
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
const itemUsedEvents = computed(() => ctx.fx?.itemUsedEvents?.value ?? [])
const floatTextsByPos  = computed(() => ctx.fx?.floatTextsByPos.value  ?? {})
const fxBeams          = computed(() => ctx.fx?.fxBeams.value          ?? [])
const damageToasts     = computed(() => ctx.fx?.damageToasts.value     ?? [])
const incomeToasts     = computed(() => ctx.fx?.incomeToasts.value     ?? [])

// ── Position toast ─────────────────────────────────────────────────────────────
const posToastVisible = ref(false)
const posToastText = ref('')
let posToastTimer: ReturnType<typeof setTimeout> | null = null

function handleToggleToastPosition() {
  ui.toggleToastPosition()
  const label = ui.toastPosition === 'top' ? '頂部' : ui.toastPosition === 'right' ? '右側' : '左側'
  posToastText.value = `通知位置：${label}`
  posToastVisible.value = true
  if (posToastTimer) clearTimeout(posToastTimer)
  posToastTimer = setTimeout(() => { posToastVisible.value = false }, 1500)
}

// ── Board hover + showTip ──────────────────────────────────────────────────────
const showTip = computed(() =>
  ui.boardHoverEnabled && !(props.mobile && state.value.turn.phase === 'combat')
)

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
        :title="`通知位置：${ui.toastPosition === 'top' ? '頂部' : ui.toastPosition === 'right' ? '右側' : '左側'}`"
        @click="handleToggleToastPosition()"
      >{{ ui.toastPosition === 'top' ? '通知⬆' : ui.toastPosition === 'right' ? '通知➡' : '通知⬅' }}</button>
      <button
        type="button"
        class="scaleBtn"
        :class="{ scaleActive: ui.boardHoverEnabled }"
        :title="ui.boardHoverEnabled ? '棋盤hover說明：開（點擊關閉）' : '棋盤hover說明：關（點擊開啟）'"
        @click="ui.toggleBoardHover()"
      >{{ ui.boardHoverEnabled ? '👁提示' : '👁關' }}</button>
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
      <!-- PixiJS Renderer -->
      <PixiBoard
        v-if="usePixiRenderer"
        ref="pixiBoardRef"
        :state="state"
        :selected-unit-id="selectedUnitId"
        :legal-moves="legalMoves"
        :shootable-target-ids="shootableTargetIds"
        :highlight-unit-ids="
          isSelectingChain ? shootChainEligibleEnemyIds :
          enchantMode ? enchantableUnitIds :
          sacrificeMode ? sacrificeTargetableUnitIds :
          ui.interactionMode.kind === 'use_item_target_unit' ? ui.interactionMode.validUnitIds :
          []
        "
        :highlight-corpse-pos-keys="corpseTargetablePosKeys"
        :fx-attack-unit-ids="fxAttackUnitIds"
        :fx-hit-unit-ids="fxHitUnitIds"
        :fx-killed-unit-ids="fxKilledUnitIds"
        :fx-killed-pos-keys="fxKilledPosKeys"
        :fx-enchanted-pos-keys="fxEnchantedPosKeys"
        :fx-revived-pos-keys="fxRevivedPosKeys"
        :item-used-events="itemUsedEvents"
        :float-texts-by-pos="floatTextsByPos"
        :fx-beams="fxBeams"
        @cell-click="onPixiCellClick"
        @unit-click="onPixiUnitClick"
      />
      
      <!-- DOM Renderer (Original) -->
      <BoardGrid
        v-else
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
        :highlight-corpse-pos-keys="corpseTargetablePosKeys"
        :enchant-drag-soul-id="ui.interactionMode.kind === 'enchant_select_unit' ? ui.interactionMode.soulId : null"
        :preview-pierce-marks="shootPreviewPierceMarks"
        :preview-splash-pos-keys="[]"
        :preview-chain-eligible-pos-keys="shootPreviewChainEligiblePosKeys"
        :preview-chain-selected-pos-key="shootPreviewChainSelectedPosKey"
        :shoot-action-pos-key="shootTargetPosKey"
        :shoot-mana-cost="shootManaCost"
        :shoot-actions-visible="!shootDetailsOpen"
        :shoot-confirm-disabled="!shootPreviewGuard.ok"
        :shoot-confirm-title="shootConfirmTitle"
        :shoot-gold-for-damage="shootGoldForDamageInfo"
        :shoot-spend-gold-for-damage="shootSpendGoldForDamage"
        :shoot-blood-sacrifice="shootBloodSacrificeInfo"
        :shoot-sacrifice-hp="shootSacrificeHp"
        @update:shoot-spend-gold-for-damage="setShootSpendGold"
        @update:shoot-sacrifice-hp="setShootSacrificeHp"
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
        :show-tip="showTip"
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
    <IncomeToast :toasts="incomeToasts" :position="ui.toastPosition" />

    <!-- Position toggle toast -->
    <Transition name="pos-toast">
      <div v-if="posToastVisible" class="posToast">{{ posToastText }}</div>
    </Transition>

    <!-- 射擊流程已移入 Canvas (BoardActionPanel)，此處不再需要 DOM overlay -->

    <!-- Shoot preview modal (second layer - detailed preview) -->
    <ShootPreviewModal
      :open="shootDetailsOpen"
      :attacker="shootPreviewAttacker"
      :target="shootPreviewTarget"
      :guard="shootPreviewGuard"
      :cost="shootManaCost"
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
          <button type="button" class="choiceBtn choiceGold" @click.stop="boneRefineChoose('gold')" @pointerdown.stop>
            <span class="choiceIcon">💰</span>
            <span>+{{ getItemCard('item_bone_refine')?.effect?.goldAmount ?? 3 }} 財力</span>
          </button>
          <button type="button" class="choiceBtn choiceMana" @click.stop="boneRefineChoose('mana')" @pointerdown.stop>
            <span class="choiceIcon">💧</span>
            <span>+{{ getItemCard('item_bone_refine')?.effect?.manaAmount ?? 2 }} 魔力</span>
          </button>
        </div>
        <button type="button" class="boneRefineCancel" @click.stop="cancelBoneRefine()" @pointerdown.stop>取消</button>
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

/* ── Position toggle toast ── */
.posToast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 250;
  background: rgba(20, 22, 40, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 6px 18px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  pointer-events: none;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}
.pos-toast-enter-active { transition: opacity 0.2s ease; }
.pos-toast-leave-active { transition: opacity 0.4s ease; }
.pos-toast-enter-from, .pos-toast-leave-to { opacity: 0; }
</style>
