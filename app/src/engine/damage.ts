import type { GameState } from './state'
import { getSoulCard } from './cards'
import { getDefValueInState } from './stats'

export function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

export function computeRawDamage(state: GameState, attackerId: string, targetUnitId: string, diceValue?: number): number {
  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker || !target) return 1

  let defValue = getDefValueInState(state, target, attacker.atk.key)

  let bonus = 0
  const attackerSoulId = attacker.enchant?.soulId
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      const crossedOk = !hasCrossRiver || crossedRiver(attacker.side, attacker.pos.y)
      if (crossedOk) {
        for (const ab of card.abilities) {
          if (ab.type !== 'DAMAGE_BONUS') continue
          const amount = Number((ab as any).amount ?? 0)
          if (Number.isFinite(amount) && amount > 0) bonus += amount
        }
      }
    }
  }

  // AURA_DAMAGE_BONUS
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== attacker.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities) {
      if (ab.type !== 'AURA_DAMAGE_BONUS') continue

      const when = (ab as any).when
      const type = String(when?.type ?? '')
      if (type === 'ATTACKER_IN_PALACE') {
        const pos = attacker.pos
        const inPalace = pos.x >= 3 && pos.x <= 5 && (attacker.side === 'red' ? pos.y >= 7 && pos.y <= 9 : pos.y >= 0 && pos.y <= 2)
        if (!inPalace) continue
      }
      if (type === 'RESONANCE_ACTIVE') {
        const res = auraCard.abilities.find((a) => a.type === 'RESONANCE')
        const need = Number((res as any)?.need ?? 0)
        if (!(Number.isFinite(need) && need > 0)) continue
        let count = 0
        for (const u of Object.values(state.units)) {
          if (u.side !== auraUnit.side) continue
          const sid = u.enchant?.soulId
          if (!sid) continue
          const c = getSoulCard(sid)
          if (!c) continue
          if (c.clan !== auraCard.clan) continue
          count++
        }
        if (count < need) continue
      }

      const forKey = String((ab as any).for ?? '')
      if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(attacker.side, attacker.pos.y)) continue

      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) bonus += amount
    }
  }

  // MINGLEI
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    const minglei = card?.abilities.find((a) => a.type === 'MINGLEI')
    if (minglei) {
      const magicDefMinus = Number((minglei as any).magicDefMinus ?? 0)
      if (attacker.atk.key === 'magic' && Number.isFinite(magicDefMinus) && magicDefMinus > 0) {
        defValue = Math.max(0, defValue - magicDefMinus)
      }
      const bonusDamageIfTargetCrossRiver = Number((minglei as any).bonusDamageIfTargetCrossRiver ?? 0)
      if (Number.isFinite(bonusDamageIfTargetCrossRiver) && bonusDamageIfTargetCrossRiver > 0) {
        if (crossedRiver(target.side, target.pos.y)) {
          bonus += bonusDamageIfTargetCrossRiver
        }
      }
    }
  }

  const dice = Number.isFinite(diceValue as any) ? Math.floor(diceValue as number) : state.rules.diceFixed
  return Math.max(1, dice + attacker.atk.value + bonus - defValue)
}
