import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { GameState, Pos } from './engine'
import { getLegalMoves, getShootableTargetIds } from './engine'
import { useUiStore } from './stores/ui'

export function useSelection(opts: { getState: () => GameState }) {
  const ui = useUiStore()
  const { selectedUnitId, selectedCell } = storeToRefs(ui)

  const selectedUnit = computed(() => {
    const id = selectedUnitId.value
    if (!id) return null
    return opts.getState().units[id] ?? null
  })

  const legalMoves = computed<Pos[]>(() => {
    const s = opts.getState()
    const id = selectedUnitId.value
    if (!id) return []
    const unit = s.units[id]
    if (!unit) return []
    if (unit.side !== s.turn.side) return []
    if (s.turn.phase !== 'combat') return []
    return getLegalMoves(s, unit.id)
  })

  const shootableTargetIds = computed<string[]>(() => {
    const s = opts.getState()
    const id = selectedUnitId.value
    if (!id) return []
    const unit = s.units[id]
    if (!unit) return []
    if (unit.side !== s.turn.side) return []
    if (s.turn.phase !== 'combat') return []
    return getShootableTargetIds(s, unit.id)
  })

  const selectedCellKey = computed(() =>
    selectedCell.value ? `${selectedCell.value.x},${selectedCell.value.y}` : null,
  )

  const selectedCellUnit = computed(() => {
    const s = opts.getState()
    const cell = selectedCell.value
    if (!cell) return null
    for (const u of Object.values(s.units)) {
      if (u.pos.x === cell.x && u.pos.y === cell.y) return u
    }
    return null
  })

  const selectedCellCorpses = computed(() => {
    const s = opts.getState()
    const k = selectedCellKey.value
    if (!k) return []
    return s.corpsesByPos[k] ?? []
  })

  function onSelectUnit(unitId: string | null) {
    if (!unitId) {
      ui.setSelectedUnitId(null)
      return
    }
    const s = opts.getState()
    const unit = s.units[unitId]
    if (!unit) return
    ui.setSelectedUnitId(unitId)
  }

  function onCellClick(payload: { x: number; y: number; unitId: string | null }, onEnemyClick: (enemyUnitId: string) => void) {
    ui.setSelectedCell({ x: payload.x, y: payload.y })

    const s = opts.getState()
    if (s.turn.phase !== 'combat') {
      if (!payload.unitId) ui.setSelectedUnitId(null)
      return
    }

    if (payload.unitId) {
      const clicked = s.units[payload.unitId]
      if (!clicked) return

      if (clicked.side === s.turn.side) {
        onSelectUnit(clicked.id)
        return
      }

      if (!selectedUnit.value) return
      if (selectedUnit.value.side !== s.turn.side) return

      onEnemyClick(clicked.id)
      return
    }

    if (!selectedUnit.value) return

    const isLegalMove = legalMoves.value.some((p) => p.x === payload.x && p.y === payload.y)
    if (!isLegalMove) {
      ui.setSelectedUnitId(null)
      return
    }
  }

  return {
    selectedUnitId,
    selectedCell,
    selectedUnit,
    legalMoves,
    shootableTargetIds,
    selectedCellUnit,
    selectedCellCorpses,
    onSelectUnit,
    onCellClick,
  }
}
