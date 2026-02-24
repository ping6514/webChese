import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { buildShotPreview, canDispatch, getSoulCard, type GuardResult, type GameState, type PieceBase } from './engine'
import { useUiStore } from './stores/ui'

type UnitPreview = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  pos: { x: number; y: number }
  hpCurrent: number
  atk: { key: string; value: number }
  def: { key: string; value: number }[]
  name: string
  image: string | null
}

export function useShootPreview(opts: { getState: () => GameState }) {
  const ui = useUiStore()
  const { shootPreview } = storeToRefs(ui)

  function openShootPreview(attackerId: string, targetUnitId: string) {
    ui.setShootPreview({ attackerId, targetUnitId })
  }

  function closeShootPreview() {
    ui.clearShootPreview()
  }

  const attacker = computed<UnitPreview | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const u = s.units[shootPreview.value.attackerId]
    if (!u) return null
    const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
    return {
      id: u.id,
      side: u.side,
      base: u.base,
      pos: { ...u.pos },
      hpCurrent: u.hpCurrent,
      atk: { ...u.atk },
      def: u.def.map((d) => ({ ...d })),
      name: soul?.name ?? u.base,
      image: soul?.image || null,
    }
  })

  const target = computed<UnitPreview | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const u = s.units[shootPreview.value.targetUnitId]
    if (!u) return null
    const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
    return {
      id: u.id,
      side: u.side,
      base: u.base,
      pos: { ...u.pos },
      hpCurrent: u.hpCurrent,
      atk: { ...u.atk },
      def: u.def.map((d) => ({ ...d })),
      name: soul?.name ?? u.base,
      image: soul?.image || null,
    }
  })

  const guard = computed<GuardResult>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return { ok: false as const, reason: 'No target' }
    return canDispatch(s, {
      type: 'SHOOT',
      attackerId: shootPreview.value.attackerId,
      targetUnitId: shootPreview.value.targetUnitId,
    })
  })

  const info = computed(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const res = buildShotPreview(s, shootPreview.value.attackerId, shootPreview.value.targetUnitId)
    return res.ok ? res : null
  })

  function confirm(dispatch: (a: { type: 'SHOOT'; attackerId: string; targetUnitId: string }) => void) {
    if (!shootPreview.value) return
    if (!guard.value.ok) return
    const a = shootPreview.value
    ui.clearShootPreview()
    dispatch({ type: 'SHOOT', attackerId: a.attackerId, targetUnitId: a.targetUnitId })
  }

  return {
    shootPreview,
    openShootPreview,
    closeShootPreview,
    attacker,
    target,
    guard,
    info,
    confirm,
  }
}
