import { ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { getItemCard, getSoulCard, BASE_STATS, canRevive, getReviveGoldCost } from '../engine'
import type { Action, GameState, Pos, Unit } from '../engine'
import { useUiStore } from '../stores/ui'

type SetPendingFn = (p: { action: Action; title: string; detail: string }) => void

export function useInteractionMode(opts: {
  state: Ref<GameState>
  lastError: Ref<string | null>
  selectedUnit: ComputedRef<Unit | null>
  shootPreview: Ref<{ attackerId: string; targetUnitId: string; extraTargetUnitId?: string | null } | null>
  shootChainEligibleEnemyIds: ComputedRef<string[]>
  shootExtraTargetUnitId: ComputedRef<string | null>
  enchantableUnitIds: ComputedRef<string[]>
  sacrificeTargetableUnitIds: ComputedRef<string[]>
  onCellClickSelection: (payload: { x: number; y: number; unitId: string | null }, onEnemyClick: (id: string) => void) => void
  openShootPreview: (attackerId: string, targetUnitId: string, extra?: string | null) => void
  cancelShootPreview: () => void
  shootDetailsOpen: Ref<boolean>
  legalMoves: ComputedRef<Pos[]>
  setPending: SetPendingFn
}) {
  const {
    state, lastError, selectedUnit, shootPreview, shootChainEligibleEnemyIds,
    shootExtraTargetUnitId, enchantableUnitIds, sacrificeTargetableUnitIds,
    onCellClickSelection, openShootPreview, cancelShootPreview,
    shootDetailsOpen, legalMoves, setPending,
  } = opts

  const ui = useUiStore()

  // 骸骨煉化二選一：暫存選中的屍骸位置
  const boneRefineChoicePos = ref<Pos | null>(null)

  function getUnitHpMax(unit: GameState['units'][string]): number {
    if (unit.enchant) return getSoulCard(unit.enchant.soulId)?.stats.hp ?? BASE_STATS[unit.base].hp
    return BASE_STATS[unit.base].hp
  }

  function onUseItem(itemId: string) {
    const item = getItemCard(itemId)
    if (!item) return
    const side = state.value.turn.side

    switch (itemId) {
      case 'item_lingxue_holy_grail': {
        const validUnitIds = Object.values(state.value.units)
          .filter((u) => u.side === side && u.hpCurrent < getUnitHpMax(u))
          .map((u) => u.id)
        if (validUnitIds.length === 0) { lastError.value = '沒有可治療的單位'; return }
        ui.startUseItemTargetUnit(itemId, validUnitIds)
        break
      }
      case 'item_dead_return_path': {
        const validUnitIds = Object.values(state.value.units)
          .filter((u) => u.side === side && !!u.enchant)
          .map((u) => u.id)
        if (validUnitIds.length === 0) { lastError.value = '沒有附魔單位'; return }
        ui.startUseItemTargetUnit(itemId, validUnitIds)
        break
      }
      case 'item_bone_refine': {
        ui.startUseItemTargetCorpse(itemId)
        break
      }
      case 'item_nether_seal': {
        const validUnitIds = Object.values(state.value.units)
          .filter((u) => u.side !== side && u.base !== 'king')
          .map((u) => u.id)
        if (validUnitIds.length === 0) { lastError.value = '沒有可封印的敵方非帥單位'; return }
        ui.startUseItemTargetUnit(itemId, validUnitIds)
        break
      }
      case 'item_soul_detach_needle': {
        const validUnitIds = Object.values(state.value.units)
          .filter((u) => u.side !== side && !!u.enchant)
          .map((u) => u.id)
        if (validUnitIds.length === 0) { lastError.value = '敵方沒有附魔單位'; return }
        ui.startUseItemTargetUnit(itemId, validUnitIds)
        break
      }
      default: {
        // 無目標道具：直接彈出確認
        setPending({
          action: { type: 'USE_ITEM_FROM_HAND', itemId },
          title: item.name,
          detail: item.text ?? '',
        })
      }
    }
  }

  function boneRefineChoose(choice: 'gold' | 'mana') {
    if (!boneRefineChoicePos.value) return
    const eff = getItemCard('item_bone_refine')?.effect
    setPending({
      action: { type: 'USE_ITEM_FROM_HAND', itemId: 'item_bone_refine', targetPos: boneRefineChoicePos.value, choice },
      title: '骸骨煉化',
      detail: choice === 'gold'
        ? `移除屍骸 → 獲得 +${eff?.goldAmount ?? 9} 財力`
        : `移除屍骸 → 獲得 +${eff?.manaAmount ?? 2} 魔力`,
    })
    boneRefineChoicePos.value = null
    ui.clearInteractionMode()
  }

  function cancelBoneRefine() {
    boneRefineChoicePos.value = null
    ui.clearInteractionMode()
  }

  function onCellClick(payload: { x: number; y: number; unitId: string | null }) {
    if (ui.interactionMode.kind === 'enchant_select_unit') {
      ui.setSelectedCell({ x: payload.x, y: payload.y })
      const unitId = payload.unitId
      const soulId = ui.interactionMode.soulId
      if (unitId && enchantableUnitIds.value.includes(unitId)) {
        const card = getSoulCard(soulId)
        const targetUnit = state.value.units[unitId]
        const targetName = targetUnit?.enchant?.soulId
          ? (getSoulCard(targetUnit.enchant.soulId)?.name ?? targetUnit.base)
          : (targetUnit?.base ?? unitId)
        const discount = state.value.turnFlags.enchantGoldDiscount ?? 0
        const baseCost = card?.costGold ?? 0
        const effectiveCost = Math.max(0, baseCost - discount)
        const costLine = discount > 0 ? `費用：${effectiveCost} 財力（-${discount} 灌注折扣）` : `費用：${baseCost} 財力`
        setPending({
          action: { type: 'ENCHANT', unitId, soulId },
          title: '確認附魔',
          detail: [`靈魂：${card?.name ?? soulId}`, `目標：${targetName}`, costLine].join('\n'),
        })
        ui.clearInteractionMode()
        return
      }
      return
    }

    if (ui.interactionMode.kind === 'sacrifice_select_target') {
      ui.setSelectedCell({ x: payload.x, y: payload.y })
      const targetUnitId = payload.unitId
      const sourceUnitId = ui.interactionMode.sourceUnitId
      const range = ui.interactionMode.range
      if (targetUnitId && sacrificeTargetableUnitIds.value.includes(targetUnitId)) {
        const srcUnit = state.value.units[sourceUnitId]
        const srcName = srcUnit?.enchant?.soulId ? (getSoulCard(srcUnit.enchant.soulId)?.name ?? srcUnit.base) : (srcUnit?.base ?? sourceUnitId)
        const tgtUnit = state.value.units[targetUnitId]
        const tgtName = tgtUnit?.enchant?.soulId ? (getSoulCard(tgtUnit.enchant.soulId)?.name ?? tgtUnit.base) : (tgtUnit?.base ?? targetUnitId)
        setPending({
          action: { type: 'SACRIFICE', sourceUnitId, targetUnitId, range },
          title: '確認獻祭',
          detail: [`攻擊者：${srcName}`, `目標：${tgtName}`, `範圍：${range}`].join('\n'),
        })
        ui.clearInteractionMode()
        return
      }
      return
    }

    if (ui.interactionMode.kind === 'use_item_target_unit') {
      const unitId = payload.unitId
      const itemId = ui.interactionMode.itemId
      if (unitId && ui.interactionMode.validUnitIds.includes(unitId)) {
        const item = getItemCard(itemId)
        const unit = state.value.units[unitId]
        setPending({
          action: { type: 'USE_ITEM_FROM_HAND', itemId, targetUnitId: unitId },
          title: item?.name ?? itemId,
          detail: `目標: ${unit ? (getSoulCard(unit.enchant?.soulId ?? '')?.name ?? unit.base) : unitId}`,
        })
        ui.clearInteractionMode()
      }
      return
    }

    if (ui.interactionMode.kind === 'use_item_target_corpse') {
      const posKey = `${payload.x},${payload.y}`
      const stack = state.value.corpsesByPos[posKey]
      const hasFriendlyCorpse = stack && stack.some((c) => c.ownerSide === state.value.turn.side)
      if (hasFriendlyCorpse) {
        boneRefineChoicePos.value = { x: payload.x, y: payload.y }
      }
      return
    }

    // Necro phase: click cell with friendly corpse → revive popup
    if (state.value.turn.phase === 'necro' && !payload.unitId) {
      const posKey = `${payload.x},${payload.y}`
      const stack = state.value.corpsesByPos[posKey]
      const hasFriendly = stack?.some((c) => c.ownerSide === state.value.turn.side) ?? false
      if (hasFriendly) {
        const revGuard = canRevive(state.value, { x: payload.x, y: payload.y })
        if (revGuard.ok) {
          const corpse = [...stack!].reverse().find((c) => c.ownerSide === state.value.turn.side)
          const BASE_LABEL: Record<string, string> = { king: '帥', advisor: '士', elephant: '象', rook: '車', knight: '馬', cannon: '炮', soldier: '卒' }
          const baseName = BASE_LABEL[corpse?.base ?? ''] ?? (corpse?.base ?? '?')
          const isContract = (state.value.turnFlags.lastStandContractBonus ?? 0) > 0
          const isLogistics = corpse?.base === 'soldier' && Object.values(state.value.units).some((u) => {
            if (u.side !== state.value.turn.side || !u.enchant?.soulId) return false
            const card = getSoulCard(u.enchant.soulId)
            if (!card) return false
            const ab = card.abilities.find((a) => a.type === 'LOGISTICS_REVIVE')
            if (!ab) return false
            const used = state.value.turnFlags.abilityUsed?.[`${u.id}:LOGISTICS_REVIVE`] ?? 0
            return used < Number((ab as any).perTurn ?? 1)
          })
          const cost = getReviveGoldCost(corpse?.base ?? 'soldier')
          const isFree = isContract || isLogistics
          const costLabel = isFree ? '免費' : `${cost} 財力`
          setPending({
            action: { type: 'REVIVE', pos: { x: payload.x, y: payload.y } },
            title: '確認復活',
            detail: `復活 ${baseName} 於此格\n費用：${costLabel}`,
          })
          return
        }
      }
    }

    const prevSelectedUnit = selectedUnit.value

    // While shoot preview is open, allow selecting a CHAIN extra target by clicking a second eligible enemy.
    // Clicking ANY enemy while preview is open (eligible or not) should never reopen/reset the preview.
    if (shootPreview.value && payload.unitId) {
      const clicked = state.value.units[payload.unitId]
      if (clicked && clicked.side !== state.value.turn.side) {
        const eligible = shootChainEligibleEnemyIds.value
        if (eligible.includes(clicked.id)) {
          ui.setShootPreview({
            attackerId: shootPreview.value.attackerId,
            targetUnitId: shootPreview.value.targetUnitId,
            extraTargetUnitId: shootExtraTargetUnitId.value === clicked.id ? null : clicked.id,
          })
        }
        return
      }
    }

    // While shoot preview is active, clicking an empty cell cancels it.
    if (shootPreview.value && !payload.unitId) {
      cancelShootPreview()
      return
    }

    onCellClickSelection(payload, (enemyUnitId: string) => {
      if (!prevSelectedUnit) return
      openShootPreview(prevSelectedUnit.id, enemyUnitId, null)
      shootDetailsOpen.value = false
    })

    if (state.value.turn.phase !== 'combat') return
    if (payload.unitId) return
    if (!prevSelectedUnit) return
    if (!legalMoves.value.some((p) => p.x === payload.x && p.y === payload.y)) return

    const soulId = prevSelectedUnit.enchant?.soulId
    const movingName = soulId
      ? (getSoulCard(soulId)?.name ?? prevSelectedUnit.base)
      : prevSelectedUnit.base
    setPending({
      action: { type: 'MOVE', unitId: prevSelectedUnit.id, to: { x: payload.x, y: payload.y } },
      title: '確認移動',
      detail: `${movingName} 移動至 (${payload.x}, ${payload.y})`,
    })
  }

  return { boneRefineChoicePos, onUseItem, onCellClick, boneRefineChoose, cancelBoneRefine }
}
