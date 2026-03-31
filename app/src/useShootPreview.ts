import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { buildShotPreview, canDispatch, getSoulCard, getDefValueInState, type GuardResult, type GameState, type PieceBase } from './engine'
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

  const spendGoldForDamage = ref(false)
  const sacrificeHp = ref(false)
  const suppressPierce = ref(true)   // 貫通預設關閉，玩家主動啟用
  watch(shootPreview, (newVal, oldVal) => {
    // 只有在開啟新射擊預覽時才重置（攻擊方或主目標改變）
    // 單純更新 extraTargetUnitId（連鎖/貫穿目標選擇）不重置 toggles
    const sameSession = newVal && oldVal &&
      newVal.attackerId === oldVal.attackerId &&
      newVal.targetUnitId === oldVal.targetUnitId
    if (!sameSession) {
      spendGoldForDamage.value = false
      sacrificeHp.value = false
      suppressPierce.value = true
    }
  })

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
      image: soul?.image || `/assets/cards/base/${u.base}.jpg`,
    }
  })

  const target = computed<UnitPreview | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const u = s.units[shootPreview.value.targetUnitId]
    if (!u) return null
    const soul = u.enchant?.soulId ? getSoulCard(u.enchant.soulId) : null
    // Build effective DEF (including aura bonuses) for each key
    const defKeys = [...new Set(u.def.map((d) => d.key))]
    const effectiveDef = defKeys.map((key) => ({ key, value: getDefValueInState(s, u, key) }))
    return {
      id: u.id,
      side: u.side,
      base: u.base,
      pos: { ...u.pos },
      hpCurrent: u.hpCurrent,
      atk: { ...u.atk },
      def: effectiveDef,
      name: soul?.name ?? u.base,
      image: soul?.image || `/assets/cards/base/${u.base}.jpg`,
    }
  })

  const bloodSacrificeInfo = computed<{ onActivateType: string; label: string; hpCost: number } | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const u = s.units[shootPreview.value.attackerId]
    if (!u?.enchant?.soulId) return null
    const card = getSoulCard(u.enchant.soulId)
    if (!card) return null
    const ab = card.abilities.find((a) => a.type === 'BLOOD_SACRIFICE')
    if (!ab) return null
    const hpCost = Number((ab as any).hpCost ?? 1)
    const king = Object.values(s.units).find((unit) => unit.side === s.turn.side && unit.base === 'king')
    if (!king || king.hpCurrent <= hpCost) return null
    const onActivate = (ab as any).onActivate as Record<string, unknown> | undefined
    if (!onActivate) return null
    const typeMap: Record<string, string> = {
      PIERCE: '貫穿', CHAIN: '連鎖', IGNORE_BLOCKING: '無視阻擋',
      DAMAGE_BONUS: `傷害+${(onActivate as any).amount ?? '?'}`,
      MOVE_THEN_SHOOT: '移動後射',
    }
    const label = typeMap[String(onActivate.type ?? '')] ?? String(onActivate.type ?? '')
    return { onActivateType: String(onActivate.type ?? ''), label, hpCost }
  })

  const goldForDamageInfo = computed<{ goldCost: number; damageBonus: number } | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const u = s.units[shootPreview.value.attackerId]
    if (!u?.enchant?.soulId) return null
    const card = getSoulCard(u.enchant.soulId)
    if (!card) return null
    const ab = card.abilities.find((a) => a.type === 'GOLD_FOR_DAMAGE')
    if (!ab) return null
    const goldCost = Number((ab as any).goldCost ?? 0)
    const damageBonus = Number((ab as any).damageBonus ?? 0)
    if (s.resources[u.side].gold < goldCost) return null
    return { goldCost, damageBonus }
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
      suppressPierce.value,
    )
    return res.ok ? res : null
  })

  /** 永遠以「貫通啟用」狀態計算，用於判斷貫通是否可用及目標數 */
  const pierceInfo = computed<{ targetCount: number } | null>(() => {
    const s = opts.getState()
    if (!shootPreview.value) return null
    const res = buildShotPreview(
      s,
      shootPreview.value.attackerId,
      shootPreview.value.targetUnitId,
      shootPreview.value.extraTargetUnitId ?? null,
      false,
    )
    if (!res.ok) return null
    const pierce = (res.effects ?? []).find((e) => e.kind === 'PIERCE') as any
    if (!pierce) return null
    const count = Array.isArray(pierce.targetUnitIds) ? pierce.targetUnitIds.length : 0
    return count > 0 ? { targetCount: count } : null
  })

  function confirm(dispatch: (a: { type: 'SHOOT'; attackerId: string; targetUnitId: string; extraTargetUnitId?: string | null; spendGoldForDamage?: boolean; sacrificeHp?: boolean; suppressPierce?: boolean }) => void) {
    if (!shootPreview.value) return
    if (!guard.value.ok) return
    const a = shootPreview.value
    const gold = spendGoldForDamage.value && goldForDamageInfo.value ? true : undefined
    const sacHp = sacrificeHp.value && bloodSacrificeInfo.value ? true : undefined
    const nopierce = suppressPierce.value ? true : undefined
    ui.clearShootPreview()
    dispatch({ type: 'SHOOT', attackerId: a.attackerId, targetUnitId: a.targetUnitId, extraTargetUnitId: a.extraTargetUnitId ?? null, spendGoldForDamage: gold, sacrificeHp: sacHp, suppressPierce: nopierce })
  }

  return {
    shootPreview,
    openShootPreview,
    closeShootPreview,
    attacker,
    target,
    guard,
    info,
    pierceInfo,
    confirm,
    goldForDamageInfo,
    spendGoldForDamage,
    bloodSacrificeInfo,
    sacrificeHp,
    suppressPierce,
  }
}
