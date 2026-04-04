import { ref } from 'vue'
import type { GameState, DamageBreakdownItem, IncomeReportItem } from '../engine'
import type { Event } from '../engine/events'
import { getSoulCard } from '../engine'
import { getItemCard } from '../engine/items'
import type { ItemCard } from '../engine/items'
import type { SoulCard } from '../engine/cards'

export type FloatText = { id: string; text: string; kind: 'damage' | 'heal' }
export type BeamFx = { id: string; from: { x: number; y: number }; to: { x: number; y: number } }
export type DamageToast = {
  id: string
  attackerName: string
  targetName: string
  breakdown: DamageBreakdownItem[]
  finalAmount: number
}
export type IncomeToast = {
  id: string
  side: 'red' | 'black'
  items: IncomeReportItem[]
}
export type CardUsageToast = {
  id: string
  card: ItemCard | SoulCard
  actionType: 'use_item' | 'enchant'
  actionDescription: string
}

const BASE_LABELS: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

const FX_ABILITY_MS = 520
const FX_HIT_MS = 620
const FX_ATTACK_MS = 520
const FX_BEAM_MS = 240
const FX_FLOAT_MS = 780
const FX_ITEM_FLOAT_MS = 900
const FX_KILL_MS = 760
const FX_REVIVE_MS = 760
const FX_ENCHANT_MS = 820
const FX_TOAST_MS = 3200
const FX_CARD_USAGE_MS = 2800

function getUnitDisplayName(state: GameState, unitId: string): string {
  const u = state.units[unitId]
  if (!u) return unitId
  const soulName = u.enchant?.soulId ? getSoulCard(u.enchant.soulId)?.name : null
  return soulName ?? BASE_LABELS[u.base] ?? u.base
}

export type ItemUsedEvent = { id: string; itemId: string; posKey: string }

export function useGameEffects() {
  const fxAttackUnitIds = ref<string[]>([])
  const fxHitUnitIds = ref<string[]>([])
  const fxKilledUnitIds = ref<string[]>([])
  const fxAbilityUnitIds = ref<string[]>([])
  const floatTextsByPos = ref<Record<string, FloatText[]>>({})
  const fxBeams = ref<BeamFx[]>([])
  const fxKilledPosKeys = ref<string[]>([])
  const fxRevivedPosKeys = ref<string[]>([])
  const fxEnchantedPosKeys = ref<string[]>([])
  const itemUsedEvents = ref<ItemUsedEvent[]>([])
  const damageToasts = ref<DamageToast[]>([])
  const incomeToasts = ref<IncomeToast[]>([])
  const cardUsageToasts = ref<CardUsageToast[]>([])

  function addFloatText(posKey: string, text: string, kind: FloatText['kind'], ms = FX_FLOAT_MS) {
    const id = `${Date.now()}-${Math.random()}`
    const cur = floatTextsByPos.value[posKey] ?? []
    floatTextsByPos.value = { ...floatTextsByPos.value, [posKey]: [...cur, { id, text, kind }] }
    window.setTimeout(() => {
      const cur2 = floatTextsByPos.value[posKey] ?? []
      floatTextsByPos.value = { ...floatTextsByPos.value, [posKey]: cur2.filter((x) => x.id !== id) }
    }, ms)
  }

  function addUnitIdFx(arr: typeof fxAttackUnitIds, unitId: string, ms: number) {
    arr.value = [...arr.value.filter((id) => id !== unitId), unitId]
    window.setTimeout(() => {
      arr.value = arr.value.filter((id) => id !== unitId)
    }, ms)
  }

  function addPosKeyFx(arr: typeof fxKilledPosKeys, posKey: string, ms: number) {
    arr.value = [...arr.value.filter((k) => k !== posKey), posKey]
    window.setTimeout(() => {
      arr.value = arr.value.filter((k) => k !== posKey)
    }, ms)
  }

  function processEventFx(events: Event[], nextState: GameState, prevState?: GameState) {
    for (const e of events) {

      if (e.type === 'ITEM_USED') {
        const itemId = e.itemId
        const itemName = e.itemName
        const usedSide = e.side
        const targetUnitId = e.targetUnitId ?? ''
        const targetPosKey = ''
        const king = Object.values(nextState.units).find((u) => u.side === usedSide && u.base === 'king')
        if (king && itemName) {
          addFloatText(`${king.pos.x},${king.pos.y}`, itemName, 'heal', FX_ITEM_FLOAT_MS)
        }
        
        // Track item usage for visual effects
        let effectPosKey = ''
        if (targetUnitId) {
          const targetUnit = nextState.units[targetUnitId]
          if (targetUnit) {
            effectPosKey = `${targetUnit.pos.x},${targetUnit.pos.y}`
          }
        } else if (targetPosKey) {
          effectPosKey = targetPosKey
        } else if (king) {
          effectPosKey = `${king.pos.x},${king.pos.y}`
        }
        
        if (effectPosKey && itemId) {
          const eventId = `${Date.now()}-${Math.random()}`
          itemUsedEvents.value = [...itemUsedEvents.value, { id: eventId, itemId, posKey: effectPosKey }]
          window.setTimeout(() => {
            itemUsedEvents.value = itemUsedEvents.value.filter((ev) => ev.id !== eventId)
          }, 1000)
        }
        
        // Card usage toast for item
        const itemCard = getItemCard(itemId)
        if (itemCard) {
          const toastId = `${Date.now()}-${Math.random()}`
          let actionDesc = itemCard.text ?? '使用道具'
          if (targetUnitId) {
            const targetUnit = nextState.units[targetUnitId]
            if (targetUnit) {
              const targetName = getUnitDisplayName(nextState, targetUnitId)
              actionDesc = `對 ${targetName} 使用`
            }
          }
          cardUsageToasts.value = [...cardUsageToasts.value, {
            id: toastId,
            card: itemCard,
            actionType: 'use_item',
            actionDescription: actionDesc,
          }]
          window.setTimeout(() => {
            cardUsageToasts.value = cardUsageToasts.value.filter((t) => t.id !== toastId)
          }, FX_CARD_USAGE_MS)
        }
      }

      if (e.type === 'ABILITY_TRIGGERED') {
        const unitId = e.unitId
        const text = e.text ?? e.abilityType
        const u = unitId ? nextState.units[unitId] : null
        if (u && text) {
          addUnitIdFx(fxAbilityUnitIds, unitId, FX_ABILITY_MS)
          addFloatText(`${u.pos.x},${u.pos.y}`, text, 'heal', FX_FLOAT_MS)
        }
      }

      if (e.type === 'SHOT_FIRED') {
        const attackerId = e.attackerId
        const targetId = e.targetUnitId
        const attacker = attackerId ? nextState.units[attackerId] : null
        // Try nextState first, then prevState (in case target was killed)
        const target = targetId ? (nextState.units[targetId] || prevState?.units[targetId]) : null
        if (attacker && target) {
          const id = `${Date.now()}-${Math.random()}`
          const beam: BeamFx = { id, from: { ...attacker.pos }, to: { ...target.pos } }
          fxBeams.value = [...fxBeams.value, beam]
          window.setTimeout(() => {
            fxBeams.value = fxBeams.value.filter((b) => b.id !== id)
          }, FX_BEAM_MS)
        }
        if (attackerId) addUnitIdFx(fxAttackUnitIds, attackerId, FX_ATTACK_MS)
        if (targetId) addUnitIdFx(fxHitUnitIds, targetId, FX_HIT_MS)
      }

      if (e.type === 'DAMAGE_DEALT') {
        const attackerId = e.attackerId
        const targetId = e.targetUnitId
        const amount = e.amount
        if (attackerId) addUnitIdFx(fxAttackUnitIds, attackerId, FX_ATTACK_MS)
        if (targetId) addUnitIdFx(fxHitUnitIds, targetId, FX_HIT_MS)
        const u = targetId ? nextState.units[targetId] : null
        if (u && Number.isFinite(amount) && amount !== 0) {
          addFloatText(`${u.pos.x},${u.pos.y}`, amount > 0 ? `-${amount}` : `${amount}`, 'damage', FX_FLOAT_MS)
        }
        // Toast：只有含 breakdown 的主目標事件才顯示
        const breakdown = e.breakdown
        if (Array.isArray(breakdown) && breakdown.length > 0 && amount > 0) {
          const toastId = `${Date.now()}-${Math.random()}`
          damageToasts.value = [...damageToasts.value, {
            id: toastId,
            attackerName: getUnitDisplayName(nextState, attackerId),
            targetName: getUnitDisplayName(nextState, targetId),
            breakdown,
            finalAmount: amount,
          }]
          window.setTimeout(() => {
            damageToasts.value = damageToasts.value.filter((t) => t.id !== toastId)
          }, FX_TOAST_MS)
        }
      }

      if (e.type === 'UNIT_HP_CHANGED') {
        const unitId = e.unitId
        const from = e.from
        const to = e.to
        const delta = to - from
        const u = unitId ? nextState.units[unitId] : null
        if (u && Number.isFinite(delta) && delta > 0) {
          addFloatText(`${u.pos.x},${u.pos.y}`, `+${delta}`, 'heal', FX_FLOAT_MS)
        }
      }

      if (e.type === 'UNIT_KILLED') {
        const unitId = e.unitId
        if (unitId) {
          addUnitIdFx(fxKilledUnitIds, unitId, FX_KILL_MS)
          const pos = prevState?.units[unitId]?.pos
          if (pos) addPosKeyFx(fxKilledPosKeys, `${pos.x},${pos.y}`, FX_KILL_MS)
        }
      }

      if (e.type === 'REVIVED') {
        const pos = e.pos
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          addPosKeyFx(fxRevivedPosKeys, `${pos.x},${pos.y}`, FX_REVIVE_MS)
        }
      }

      if (e.type === 'ENCHANTED') {
        const unitId = e.unitId
        const soulId = e.soulId
        const u = unitId ? nextState.units[unitId] : null
        if (u) addPosKeyFx(fxEnchantedPosKeys, `${u.pos.x},${u.pos.y}`, FX_ENCHANT_MS)
        
        // Card usage toast for enchantment
        const soulCard = getSoulCard(soulId)
        if (soulCard && u) {
          const toastId = `${Date.now()}-${Math.random()}`
          const unitName = getUnitDisplayName(nextState, unitId)
          cardUsageToasts.value = [...cardUsageToasts.value, {
            id: toastId,
            card: soulCard,
            actionType: 'enchant',
            actionDescription: `附魔於 ${unitName}`,
          }]
          window.setTimeout(() => {
            cardUsageToasts.value = cardUsageToasts.value.filter((t) => t.id !== toastId)
          }, FX_CARD_USAGE_MS)
        }
      }

      if (e.type === 'INCOME_REPORT') {
        const side = e.side
        const items = e.items
        const toastId = `${Date.now()}-${Math.random()}`
        incomeToasts.value = [...incomeToasts.value, { id: toastId, side, items }]
        window.setTimeout(() => {
          incomeToasts.value = incomeToasts.value.filter((t) => t.id !== toastId)
        }, FX_TOAST_MS)
      }
    }

    // Fallback: if engine didn't emit UNIT_KILLED but a unit disappeared this dispatch, still show killed FX.
    if (prevState) {
      for (const [unitId, prevU] of Object.entries(prevState.units)) {
        if (nextState.units[unitId]) continue
        addPosKeyFx(fxKilledPosKeys, `${prevU.pos.x},${prevU.pos.y}`, FX_KILL_MS)
      }
    }
  }

  return {
    fxAttackUnitIds,
    fxHitUnitIds,
    fxKilledUnitIds,
    fxAbilityUnitIds,
    floatTextsByPos,
    fxBeams,
    fxKilledPosKeys,
    fxRevivedPosKeys,
    fxEnchantedPosKeys,
    itemUsedEvents,
    damageToasts,
    incomeToasts,
    cardUsageToasts,
    addFloatText,
    processEventFx,
  }
}
