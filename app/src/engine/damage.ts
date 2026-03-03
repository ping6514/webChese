import type { GameState } from './state'
import type { DamageBreakdownItem } from './events'
import { getSoulCard } from './cards'
import { getDefValueInState } from './stats'
import { countCorpses, countSoldiers } from './corpses'

export function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function getHighestTierAmount(tiers: { count: number; amount: number }[], soldierCount: number): number {
  const sorted = [...tiers].sort((a, b) => b.count - a.count)
  for (const tier of sorted) {
    if (soldierCount >= tier.count) return tier.amount
  }
  return 0
}

// Core implementation: always builds a breakdown alongside computing damage.
function computeDamageCore(
  state: GameState,
  attackerId: string,
  targetUnitId: string,
  diceValue: number,
): { damage: number; breakdown: DamageBreakdownItem[] } {
  const breakdown: DamageBreakdownItem[] = []
  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker || !target) return { damage: 1, breakdown }

  breakdown.push({ label: `1d6(${diceValue})`, amount: diceValue })
  if (attacker.atk.value > 0) {
    breakdown.push({ label: '攻擊力', amount: attacker.atk.value })
  }

  let defValue = getDefValueInState(state, target, attacker.atk.key)

  const attackerSoulId0 = attacker.enchant?.soulId
  if (attackerSoulId0) {
    const attackerCard0 = getSoulCard(attackerSoulId0)
    if (attackerCard0) {
      for (const ab of attackerCard0.abilities) {
        if (String((ab as any).type ?? '') !== 'TARGET_DEF_MINUS') continue

        const onlyIfAtkKey = String((ab as any).onlyIfAtkKey ?? '')
        if (onlyIfAtkKey && onlyIfAtkKey !== attacker.atk.key) continue

        const key = String((ab as any).key ?? '')
        if (!key || key !== attacker.atk.key) continue

        const per = (ab as any).per
        if (!(per && String(per.type ?? '') === 'CORPSES_PER')) continue
        const perCount = Number(per.count ?? 0)
        const amountPer = Number((ab as any).amountPer ?? 0)
        if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue

        const corpses = countCorpses(state, attacker.side)
        const minus = Math.floor(corpses / perCount) * amountPer
        if (!(Number.isFinite(minus) && minus > 0)) continue

        const minDef = Number((ab as any).minDef ?? 0)
        defValue = Math.max(Number.isFinite(minDef) ? Math.floor(minDef) : 0, defValue - minus)
      }
    }
  }

  let bonus = 0
  const attackerSoulId = attackerSoulId0
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      // Sacrifice buff (冥骨車)
      const sb = (state as any).status?.sacrificeBuffByUnitId?.[attackerId]
      const cap = Number((sb as any)?.damageBonusPerCorpsesCap ?? 0)
      if (Number.isFinite(cap) && cap > 0) {
        const corpses = countCorpses(state, attacker.side)
        const amount = Math.min(cap, Math.max(0, Math.floor(corpses)))
        if (amount > 0) {
          bonus += amount
          breakdown.push({ label: card.name + ' 骸骨', amount })
        }
      }

      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      const crossedOk = !hasCrossRiver || crossedRiver(attacker.side, attacker.pos.y)
      if (crossedOk) {
        for (const ab of card.abilities) {
          if (ab.type !== 'DAMAGE_BONUS') continue
          const when = (ab as any).when
          if (when) {
            const whenType = String(when.type ?? '')
            if (whenType === 'CORPSES_GTE') {
              const need = Number(when.count ?? 0)
              if (Number.isFinite(need) && need > 0) {
                if (countCorpses(state, attacker.side) < need) continue
              }
            }
            if (whenType === 'SOLDIERS_GTE') {
              const need = Number(when.count ?? 0)
              if (Number.isFinite(need) && need > 0) {
                if (countSoldiers(state, attacker.side) < need) continue
              }
            }
          }
          const targetWhen = (ab as any).targetWhen
          if (targetWhen && String(targetWhen.type ?? '') === 'TARGET_IN_PALACE') {
            const tgt = state.units[targetUnitId]
            if (!tgt || !palaceContains(tgt.side, tgt.pos)) continue
          }
          const amount = Number((ab as any).amount ?? 0)
          if (Number.isFinite(amount) && amount > 0) {
            bonus += amount
            breakdown.push({ label: card.name, amount })
          }
        }
      }
    }
  }

  // SOLDIERS_TIERED_DAMAGE_BONUS
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'SOLDIERS_TIERED_DAMAGE_BONUS') continue
        const tiers = (ab as any).tiers as { count: number; amount: number }[]
        if (!Array.isArray(tiers)) continue
        const soldiers = countSoldiers(state, attacker.side)
        const amount = getHighestTierAmount(tiers, soldiers)
        if (amount > 0) {
          bonus += amount
          breakdown.push({ label: card.name + ' 軍勢', amount })
        }
      }
    }
  }

  // DAMAGE_BONUS_PER_ADJACENT_SOLDIER (聯軍馬)
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'DAMAGE_BONUS_PER_ADJACENT_SOLDIER') continue
        const radius = Number((ab as any).radius ?? 1)
        const amountPer = Number((ab as any).amountPer ?? 1)
        const maxBonus = Number((ab as any).max ?? 999)
        let soldierCount = 0
        for (const u of Object.values(state.units)) {
          if (u.side !== attacker.side) continue
          if (u.base !== 'soldier') continue
          if (Math.max(Math.abs(u.pos.x - attacker.pos.x), Math.abs(u.pos.y - attacker.pos.y)) <= radius) soldierCount++
        }
        const amount = Math.min(maxBonus, soldierCount * amountPer)
        if (amount > 0) {
          bonus += amount
          breakdown.push({ label: card.name + ' 聯軍', amount })
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

      if (forKey === 'CLAN') {
        const clan = String((ab as any).clan ?? '')
        if (!clan) continue
        const attackerCard = attacker.enchant?.soulId ? getSoulCard(attacker.enchant.soulId) : undefined
        if (!attackerCard) continue
        if (String(attackerCard.clan ?? '') !== clan) continue

        const excludeBase = String((ab as any).excludeBase ?? '')
        if (excludeBase && attacker.base === excludeBase) continue
      }

      const per = (ab as any).per
      if (per && String(per.type ?? '') === 'CORPSES_PER') {
        const perCount = Number(per.count ?? 0)
        const amountPer = Number((ab as any).amountPer ?? 0)
        if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue
        const corpses = countCorpses(state, attacker.side)
        const amount = Math.floor(corpses / perCount) * amountPer
        if (amount > 0) {
          bonus += amount
          breakdown.push({ label: auraCard.name + ' 光環', amount })
        }
        continue
      }

      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) {
        bonus += amount
        breakdown.push({ label: auraCard.name + ' 光環', amount })
      }
    }
  }

  // SOLDIERS_TIERED_AURA_DAMAGE_BONUS
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== attacker.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities) {
      if (ab.type !== 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS') continue
      const tiers = (ab as any).tiers as { count: number; amount: number }[]
      if (!Array.isArray(tiers)) continue
      const soldiers = countSoldiers(state, auraUnit.side)
      const amount = getHighestTierAmount(tiers, soldiers)
      if (amount > 0) {
        bonus += amount
        breakdown.push({ label: auraCard.name + ' 光環', amount })
        break
      }
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
          breakdown.push({ label: '冥雷 過河', amount: bonusDamageIfTargetCrossRiver })
        }
      }
    }
  }

  // Defense (net after any reductions)
  if (defValue > 0) {
    breakdown.push({ label: attacker.atk.key === 'phys' ? '物防' : '魔防', amount: -defValue })
  }

  // SOLDIERS_TIERED_DMG_REDUCTION_AURA
  let dmgReduction = 0
  let dmgReductionLabel = ''
  const targetUnitForReduction = state.units[targetUnitId]
  if (targetUnitForReduction) {
    for (const auraUnit of Object.values(state.units)) {
      if (auraUnit.side !== targetUnitForReduction.side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue
      for (const ab of auraCard.abilities) {
        if (ab.type !== 'SOLDIERS_TIERED_DMG_REDUCTION_AURA') continue
        const tiers = (ab as any).tiers as { count: number; amount: number }[]
        if (!Array.isArray(tiers)) continue
        const soldiers = countSoldiers(state, auraUnit.side)
        const amount = getHighestTierAmount(tiers, soldiers)
        if (amount > 0) {
          dmgReduction = Math.max(dmgReduction, amount)
          dmgReductionLabel = auraCard.name
          break
        }
      }
    }
  }

  if (dmgReduction > 0) {
    breakdown.push({ label: dmgReductionLabel + ' 減傷', amount: -dmgReduction })
  }

  const beforeReduction = Math.max(1, diceValue + attacker.atk.value + bonus - defValue)
  const damage = Math.max(0, beforeReduction - dmgReduction)

  return { damage, breakdown }
}

export function computeRawDamage(state: GameState, attackerId: string, targetUnitId: string, diceValue?: number): number {
  const dice = Number.isFinite(diceValue as any) ? Math.floor(diceValue as number) : state.rules.diceFixed
  return computeDamageCore(state, attackerId, targetUnitId, dice).damage
}

export function computeDamageWithBreakdown(
  state: GameState,
  attackerId: string,
  targetUnitId: string,
  diceValue: number,
): { damage: number; breakdown: DamageBreakdownItem[] } {
  return computeDamageCore(state, attackerId, targetUnitId, diceValue)
}
