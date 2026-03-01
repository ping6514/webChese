import { ref } from 'vue'
import type { GameState } from '../engine'

export type FloatText = { id: string; text: string; kind: 'damage' | 'heal' }
export type BeamFx = { id: string; from: { x: number; y: number }; to: { x: number; y: number } }

const FX_ABILITY_MS = 520
const FX_HIT_MS = 620
const FX_ATTACK_MS = 520
const FX_BEAM_MS = 240
const FX_FLOAT_MS = 780
const FX_ITEM_FLOAT_MS = 900
const FX_KILL_MS = 760
const FX_REVIVE_MS = 760
const FX_ENCHANT_MS = 820

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

  function processEventFx(events: unknown[], nextState: GameState, prevState?: GameState) {
    for (const e of events) {
      const type = (e as any).type

      if (type === 'ITEM_USED') {
        const itemName = String((e as any).itemName ?? '')
        const usedSide = String((e as any).side ?? nextState.turn.side)
        const king = Object.values(nextState.units).find((u) => u.side === usedSide && u.base === 'king')
        if (king && itemName) {
          addFloatText(`${king.pos.x},${king.pos.y}`, itemName, 'heal', FX_ITEM_FLOAT_MS)
        }
      }

      if (type === 'ABILITY_TRIGGERED') {
        const unitId = String((e as any).unitId ?? '')
        const text = String((e as any).text ?? (e as any).abilityType ?? '')
        const u = unitId ? nextState.units[unitId] : null
        if (u && text) {
          addUnitIdFx(fxAbilityUnitIds, unitId, FX_ABILITY_MS)
          addFloatText(`${u.pos.x},${u.pos.y}`, text, 'heal', FX_FLOAT_MS)
        }
      }

      if (type === 'SHOT_FIRED') {
        const attackerId = String((e as any).attackerId ?? '')
        const targetId = String((e as any).targetUnitId ?? '')
        const attacker = attackerId ? nextState.units[attackerId] : null
        const target = targetId ? nextState.units[targetId] : null
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

      if (type === 'DAMAGE_DEALT') {
        const attackerId = String((e as any).attackerId ?? '')
        const targetId = String((e as any).targetUnitId ?? '')
        const amount = Number((e as any).amount ?? 0)
        if (attackerId) addUnitIdFx(fxAttackUnitIds, attackerId, FX_ATTACK_MS)
        if (targetId) addUnitIdFx(fxHitUnitIds, targetId, FX_HIT_MS)
        const u = targetId ? nextState.units[targetId] : null
        if (u && Number.isFinite(amount) && amount !== 0) {
          addFloatText(`${u.pos.x},${u.pos.y}`, amount > 0 ? `-${amount}` : `${amount}`, 'damage', FX_FLOAT_MS)
        }
      }

      if (type === 'UNIT_HP_CHANGED') {
        const unitId = String((e as any).unitId ?? '')
        const from = Number((e as any).from ?? 0)
        const to = Number((e as any).to ?? 0)
        const delta = to - from
        const u = unitId ? nextState.units[unitId] : null
        if (u && Number.isFinite(delta) && delta > 0) {
          addFloatText(`${u.pos.x},${u.pos.y}`, `+${delta}`, 'heal', FX_FLOAT_MS)
        }
      }

      if (type === 'UNIT_KILLED') {
        const unitId = String((e as any).unitId ?? '')
        if (unitId) {
          addUnitIdFx(fxKilledUnitIds, unitId, FX_KILL_MS)
          const pos = prevState?.units[unitId]?.pos
          if (pos) addPosKeyFx(fxKilledPosKeys, `${pos.x},${pos.y}`, FX_KILL_MS)
        }
      }

      if (type === 'REVIVED') {
        const pos = (e as any).pos
        if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
          addPosKeyFx(fxRevivedPosKeys, `${pos.x},${pos.y}`, FX_REVIVE_MS)
        }
      }

      if (type === 'ENCHANTED') {
        const unitId = String((e as any).unitId ?? '')
        const u = unitId ? nextState.units[unitId] : null
        if (u) addPosKeyFx(fxEnchantedPosKeys, `${u.pos.x},${u.pos.y}`, FX_ENCHANT_MS)
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
    addFloatText,
    processEventFx,
  }
}
