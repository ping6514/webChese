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

  function translateGuardReason(reason: string): string {
    const r = String(reason ?? '')
    if (!r) return ''

    const map: Record<string, string> = {
      'No target': '未選擇目標',
      'Not in combat phase': '不在戰鬥階段',
      'Unit not found': '找不到單位',
      'Attacker not found': '找不到攻擊方',
      'Target not found': '找不到目標',
      'Not your turn': '不是你的回合',
      'Cannot target ally': '不能以友軍為目標',
      'Not enough mana': '魔力不足',
      'Already shot this turn': '此單位本回合已射擊',
      'Out of range': '超出射程',
      Blocked: '射線被阻擋',
      'Kings not in line': '帥對帥必須同一路徑且無阻擋',
    }

    return map[r] ?? r
  }

  function translateGuard(g: GuardResult): GuardResult {
    if (g.ok) return g
    return { ok: false as const, reason: translateGuardReason((g as any).reason ?? '') }
  }

  function openShootPreview(attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null) {
    ui.setShootPreview({ attackerId, targetUnitId, extraTargetUnitId: extraTargetUnitId ?? null })
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
    if (!shootPreview.value) return { ok: false as const, reason: '未選擇目標' }
    const res = canDispatch(s, {
      type: 'SHOOT',
      attackerId: shootPreview.value.attackerId,
      targetUnitId: shootPreview.value.targetUnitId,
      extraTargetUnitId: shootPreview.value.extraTargetUnitId ?? null,
    })
    return translateGuard(res)
  })

  const info = computed(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const res = buildShotPreview(
      s,
      shootPreview.value.attackerId,
      shootPreview.value.targetUnitId,
      shootPreview.value.extraTargetUnitId ?? null,
    )
    return res.ok ? res : null
  })

  function confirm(dispatch: (a: { type: 'SHOOT'; attackerId: string; targetUnitId: string; extraTargetUnitId?: string | null }) => void) {
    if (!shootPreview.value) return
    if (!guard.value.ok) return
    const a = shootPreview.value
    ui.clearShootPreview()
    dispatch({ type: 'SHOOT', attackerId: a.attackerId, targetUnitId: a.targetUnitId, extraTargetUnitId: a.extraTargetUnitId ?? null })
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
