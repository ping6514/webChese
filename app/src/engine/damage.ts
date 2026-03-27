import type { GameState } from './state'
import type { DamageBreakdownItem } from './events'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import { getDefValueInState } from './stats'
import { countCorpses, countSoldiers } from './corpses'

function getItemHandTotalValue(state: GameState, side: 'red' | 'black'): number {
  let totalValue = 0
  for (const itemId of state.hands[side].items) {
    const itemCard = getItemCard(itemId)
    totalValue += Number(itemCard?.costGold ?? 0)
  }
  return totalValue
}

export function findFirstDamagedReduction(
  state: GameState,
  targetUnitId: string,
): { amount: number; key: string; label: string } | null {
  const target = state.units[targetUnitId]
  if (!target) return null
  const soulId = target.enchant?.soulId
  if (!soulId) return null
  const card = getSoulCard(soulId)
  if (!card) return null

  for (const ab of card.abilities) {
    if (String((ab as any).type ?? '') !== 'FIRST_DAMAGED_REDUCTION') continue
    const amount = Number((ab as any).amount ?? 0)
    const perTurn = Number((ab as any).perTurn ?? 1)
    if (!(Number.isFinite(amount) && amount > 0)) continue
    if (!(Number.isFinite(perTurn) && perTurn > 0)) continue
    const key = `${target.id}:FIRST_DAMAGED_REDUCTION`
    const used = Number(state.turnFlags.abilityUsed?.[key] ?? 0)
    if (used >= perTurn) continue
    return { amount: Math.floor(amount), key, label: `${card.name} 迴避` }
  }

  return null
}

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
  extraBonus: number = 0,
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
  const bsShotEffect =
    state.turnFlags.bloodSacrificeActiveShotEffect?.unitId === attackerId
      ? state.turnFlags.bloodSacrificeActiveShotEffect.effect
      : null

  const targetDefMinusAbilities: Array<Record<string, unknown>> = []
  if (attackerSoulId0) {
    const attackerCard0 = getSoulCard(attackerSoulId0)
    if (attackerCard0) {
      for (const ab of attackerCard0.abilities) {
        if (String((ab as any).type ?? '') === 'TARGET_DEF_MINUS') {
          targetDefMinusAbilities.push(ab as any)
        }
      }
    }
  }
  if (String((bsShotEffect as any)?.type ?? '') === 'TARGET_DEF_MINUS') {
    targetDefMinusAbilities.push(bsShotEffect as Record<string, unknown>)
  }
  for (const ab of targetDefMinusAbilities) {
    const onlyIfAtkKey = String((ab as any).onlyIfAtkKey ?? '')
    if (onlyIfAtkKey && onlyIfAtkKey !== attacker.atk.key) continue

    const key = String((ab as any).key ?? '')
    if (!key || key !== attacker.atk.key) continue

    let minus = 0
    const per = (ab as any).per
    if (per && String(per.type ?? '') === 'CORPSES_PER') {
      const perCount = Number(per.count ?? 0)
      const amountPer = Number((ab as any).amountPer ?? 0)
      if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue
      const corpses = countCorpses(state, attacker.side)
      minus = Math.floor(corpses / perCount) * amountPer
    } else {
      minus = Number((ab as any).amount ?? 0)
    }
    if (!(Number.isFinite(minus) && minus > 0)) continue

    const minDef = Number((ab as any).minDef ?? 0)
    defValue = Math.max(Number.isFinite(minDef) ? Math.floor(minDef) : 0, defValue - minus)
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
      const crossed = crossedRiver(attacker.side, attacker.pos.y)
      for (const ab of card.abilities) {
        if (ab.type !== 'DAMAGE_BONUS' && ab.type !== 'DAMAGE_MODIFIER') continue
        const when = (ab as any).when
        const whenType = String(when?.type ?? '')
        // Data-driven gate
        if (whenType === 'AFTER_CROSS_RIVER' && !crossed) continue
        // Legacy gate (only if ability has no when)
        if (!whenType && hasCrossRiver && !crossed) continue

        if (whenType === 'CORPSES_GTE') {
          const need = Number(when?.count ?? 0)
          if (Number.isFinite(need) && need > 0) {
            if (countCorpses(state, attacker.side) < need) continue
          }
        }
        if (whenType === 'MOVED_THIS_TURN') {
          if (!state.turnFlags.movedThisTurn?.[attackerId]) continue
        }
        if (whenType === 'ENEMY_KILLED_THIS_TURN_GTE') {
          const need = Number(when?.count ?? 0)
          const cur = Number(state.turnFlags.enemyKilledThisTurnCount ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (cur < need) continue
        }
        if (whenType === 'SOLDIERS_GTE') {
          const need = Number(when?.count ?? 0)
          if (Number.isFinite(need) && need > 0) {
            if (countSoldiers(state, attacker.side) < need) continue
          }
        }

        const targetWhen = (ab as any).targetWhen
        if (targetWhen && String(targetWhen.type ?? '') === 'TARGET_IN_PALACE') {
          const tgt = state.units[targetUnitId]
          if (!tgt || !palaceContains(tgt.side, tgt.pos)) continue
        }
        if (targetWhen && String(targetWhen.type ?? '') === 'TARGET_CROSS_RIVER') {
          const tgt = state.units[targetUnitId]
          if (!tgt || !crossedRiver(tgt.side, tgt.pos.y)) continue
        }

        const amount = Number((ab as any).amount ?? 0)
        if (Number.isFinite(amount) && amount > 0) {
          bonus += amount
          breakdown.push({ label: card.name, amount })
        }
      }

      if (String((bsShotEffect as any)?.type ?? '') === 'DAMAGE_BONUS') {
        const bsAb = bsShotEffect as any
        const targetWhen = bsAb.targetWhen
        if (targetWhen && String(targetWhen.type ?? '') === 'TARGET_IN_PALACE') {
          if (palaceContains(target.side, target.pos)) {
            const amount = Number(bsAb.amount ?? 0)
            if (Number.isFinite(amount) && amount > 0) {
              bonus += amount
              breakdown.push({ label: '血祭', amount })
            }
          }
        } else if (targetWhen && String(targetWhen.type ?? '') === 'TARGET_CROSS_RIVER') {
          if (crossedRiver(target.side, target.pos.y)) {
            const amount = Number(bsAb.amount ?? 0)
            if (Number.isFinite(amount) && amount > 0) {
              bonus += amount
              breakdown.push({ label: '血祭', amount })
            }
          }
        } else if (!targetWhen) {
          const amount = Number(bsAb.amount ?? 0)
          if (Number.isFinite(amount) && amount > 0) {
            bonus += amount
            breakdown.push({ label: '血祭', amount })
          }
        }
      }
    }
  }

  // ATK_BONUS (conditional ATK increase, e.g. eternal_night_knight_minggu: corpses >= 4 → +2)
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      const crossed = crossedRiver(attacker.side, attacker.pos.y)
      for (const ab of card.abilities) {
        if (ab.type !== 'ATK_BONUS') continue
        const when = (ab as any).when
        const whenType = String(when?.type ?? '')
        if (whenType === 'AFTER_CROSS_RIVER' && !crossed) continue
        if (!whenType && hasCrossRiver && !crossed) continue

        if (whenType === 'CORPSES_GTE') {
          const need = Number(when?.count ?? 0)
          if (Number.isFinite(need) && need > 0) {
            if (countCorpses(state, attacker.side) < need) continue
          }
        }
        if (whenType === 'MOVED_THIS_TURN') {
          if (!state.turnFlags.movedThisTurn?.[attackerId]) continue
        }
        if (whenType === 'ENEMY_KILLED_THIS_TURN_GTE') {
          const need = Number(when?.count ?? 0)
          const cur = Number(state.turnFlags.enemyKilledThisTurnCount ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (cur < need) continue
        }
        if (whenType === 'SOLDIERS_GTE') {
          const need = Number(when?.count ?? 0)
          if (Number.isFinite(need) && need > 0) {
            if (countSoldiers(state, attacker.side) < need) continue
          }
        }

        const amount = Number((ab as any).amount ?? 0)
        if (Number.isFinite(amount) && amount > 0) {
          bonus += amount
          breakdown.push({ label: card.name + ' 攻擊+', amount })
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

  // BLOOD_RAGE_AURA: ATK bonus when king HP <= threshold (self or global)
  {
    const kingHp = (() => {
      for (const u of Object.values(state.units)) {
        if (u.side === attacker.side && u.base === 'king') return u.hpCurrent
      }
      return 999
    })()

    // self scope: attacker's own card
    if (attackerSoulId) {
      const card = getSoulCard(attackerSoulId)
      if (card) {
        for (const ab of card.abilities) {
          if (ab.type !== 'BLOOD_RAGE_AURA') continue
          const scope = String((ab as any).scope ?? 'self')
          if (scope !== 'self') continue
          const stages = (ab as any).stages as Array<{ threshold: number; atkBonus: number }> | undefined
          if (Array.isArray(stages)) {
            const sorted = [...stages].sort((a, b) => b.threshold - a.threshold)
            let bestBonus = 0
            for (const s of sorted) {
              if (kingHp <= s.threshold) bestBonus = s.atkBonus
            }
            if (bestBonus > 0) {
              bonus += bestBonus
              breakdown.push({ label: card.name + ' 血憤', amount: bestBonus })
            }
          }
        }
      }
    }

    // global scope: aura from allied unit
    for (const auraUnit of Object.values(state.units)) {
      if (auraUnit.side !== attacker.side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue
      for (const ab of auraCard.abilities) {
        if (ab.type !== 'BLOOD_RAGE_AURA') continue
        const scope = String((ab as any).scope ?? 'self')
        if (scope !== 'global') continue
        const stages = (ab as any).stages as Array<{ threshold: number; atkBonus: number }> | undefined
        if (!Array.isArray(stages)) continue
        const sorted = [...stages].sort((a, b) => b.threshold - a.threshold)
        let bestBonus = 0
        for (const s of sorted) {
          if (kingHp <= s.threshold) bestBonus = s.atkBonus
        }
        if (bestBonus > 0) {
          bonus += bestBonus
          breakdown.push({ label: auraCard.name + ' 血憤', amount: bestBonus })
        }
      }
    }
  }

  // UNDERDOG_AURA: ATK bonus when own unit count < enemy count by margin (self or global)
  {
    const ownCount = Object.values(state.units).filter((u) => u.side === attacker.side).length
    const enemyCount = Object.values(state.units).filter((u) => u.side !== attacker.side).length
    const deficit = enemyCount - ownCount  // positive = we have fewer units

    // self scope
    if (attackerSoulId) {
      const card = getSoulCard(attackerSoulId)
      if (card) {
        for (const ab of card.abilities) {
          if (ab.type !== 'UNDERDOG_AURA') continue
          const scope = String((ab as any).scope ?? 'self')
          if (scope !== 'self') continue
          const stages = (ab as any).stages as Array<{ margin: number; atkBonus: number }> | undefined
          if (Array.isArray(stages)) {
            const sorted = [...stages].sort((a, b) => a.margin - b.margin)
            let bestBonus = 0
            for (const s of sorted) {
              if (deficit >= s.margin) bestBonus = s.atkBonus
            }
            if (bestBonus > 0) {
              bonus += bestBonus
              breakdown.push({ label: card.name + ' 逆境', amount: bestBonus })
            }
          } else if (deficit > 0) {
            // Legacy single-threshold (no stages): any deficit triggers
            const atkBonus = Number((ab as any).atkBonus ?? 1)
            if (atkBonus > 0) {
              bonus += atkBonus
              breakdown.push({ label: card.name + ' 逆境', amount: atkBonus })
            }
          }
        }
      }
    }

    // global scope: aura from allied unit
    for (const auraUnit of Object.values(state.units)) {
      if (auraUnit.side !== attacker.side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue
      for (const ab of auraCard.abilities) {
        if (ab.type !== 'UNDERDOG_AURA') continue
        const scope = String((ab as any).scope ?? 'self')
        if (scope !== 'global') continue
        const stages = (ab as any).stages as Array<{ margin: number; atkBonus: number }> | undefined
        if (!Array.isArray(stages)) continue
        const sorted = [...stages].sort((a, b) => a.margin - b.margin)
        let bestBonus = 0
        for (const s of sorted) {
          if (deficit >= s.margin) bestBonus = s.atkBonus
        }
        if (bestBonus > 0) {
          bonus += bestBonus
          breakdown.push({ label: auraCard.name + ' 逆境', amount: bestBonus })
        }
      }
    }
  }

  // UNIT_COUNT_UNDERDOG_AURA: global ATK bonus when own unit count < enemy count by margin
  {
    const ownCount = Object.values(state.units).filter((u) => u.side === attacker.side).length
    const enemyCount = Object.values(state.units).filter((u) => u.side !== attacker.side).length
    const deficit = enemyCount - ownCount

    for (const auraUnit of Object.values(state.units)) {
      if (auraUnit.side !== attacker.side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue
      for (const ab of auraCard.abilities as any[]) {
        if (ab.type !== 'UNIT_COUNT_UNDERDOG_AURA') continue
        const scope = String(ab.scope ?? 'global')
        if (scope !== 'global') continue
        const margin = Number(ab.margin ?? 1)
        const atkBonus = Number(ab.atkBonus ?? 0)
        if (!(Number.isFinite(margin) && margin > 0)) continue
        if (!(Number.isFinite(atkBonus) && atkBonus > 0)) continue
        if (deficit < margin) continue
        bonus += Math.floor(atkBonus)
        breakdown.push({ label: auraCard.name + ' 逆勢', amount: Math.floor(atkBonus) })
      }
    }
  }

  // GOLD_THRESHOLD_ATK (self ATK bonus)
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
        const scope = String((ab as any).scope ?? 'self')
        if (scope !== 'self') continue
        const atkBonus = Number((ab as any).atkBonus ?? 0)
        if (!Number.isFinite(atkBonus) || atkBonus <= 0) continue
        const threshold = Number((ab as any).threshold ?? 0)
        if (!Number.isFinite(threshold) || threshold <= 0) continue
        if (state.resources[attacker.side].gold < threshold) continue
        bonus += atkBonus
        breakdown.push({ label: card.name + ' 財力', amount: atkBonus })
      }
    }
  }

  // ITEM_COUNT_ATK_BONUS (ATK += number of items in hand)
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'ITEM_COUNT_ATK_BONUS') continue
        const itemCount = state.hands[attacker.side].items.length
        if (itemCount > 0) {
          bonus += itemCount
          breakdown.push({ label: card.name + ' 道具', amount: itemCount })
        }
      }
    }
  }

  // ITEM_VALUE_ATK_BONUS (ATK bonus if total item value >= threshold)
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'ITEM_VALUE_ATK_BONUS') continue
        const threshold = Number((ab as any).threshold ?? 0)
        const atkBonus = Number((ab as any).atkBonus ?? 0)
        if (!Number.isFinite(threshold) || threshold <= 0) continue
        if (!Number.isFinite(atkBonus) || atkBonus <= 0) continue
        let totalValue = 0
        for (const itemId of state.hands[attacker.side].items) {
          const itemCard = getItemCard(itemId)
          totalValue += Number(itemCard?.costGold ?? 0)
        }
        if (totalValue >= threshold) {
          bonus += atkBonus
          breakdown.push({ label: card.name + ' 高價', amount: atkBonus })
        }
      }
    }
  }

  // ITEM_VALUE_AURA (global ATK aura when total item value in hand reaches threshold)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== attacker.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'ITEM_VALUE_AURA') continue
      const scope = String(ab.scope ?? 'global')
      if (scope !== 'global') continue
      const threshold = Number(ab.threshold ?? 0)
      if (!(Number.isFinite(threshold) && threshold > 0)) continue
      if (getItemHandTotalValue(state, attacker.side) < threshold) continue
      const atkBonus = Number(ab?.bonus?.atk ?? 0)
      if (!(Number.isFinite(atkBonus) && atkBonus > 0)) continue
      const add = Math.floor(atkBonus)
      bonus += add
      breakdown.push({ label: auraCard.name + ' 收藏', amount: add })
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
      if (ab.type !== 'AURA_DAMAGE_BONUS' && ab.type !== 'AURA_DAMAGE_MODIFIER') continue

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

      const forRaw = (ab as any).for
      const forKeys = Array.isArray(forRaw) ? (forRaw.map((x: any) => String(x ?? '')).filter(Boolean)) : [String(forRaw ?? '')].filter(Boolean)
      let forAllowed = true
      for (const forKey of forKeys) {
        if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(attacker.side, attacker.pos.y)) {
          forAllowed = false; break
        }
        if (forKey === 'CLAN') {
          const clan = String((ab as any).clan ?? '')
          if (!clan) { forAllowed = false; break }
          const attackerCard = attacker.enchant?.soulId ? getSoulCard(attacker.enchant.soulId) : undefined
          if (!attackerCard) { forAllowed = false; break }
          if (String(attackerCard.clan ?? '') !== clan) { forAllowed = false; break }
          const excludeBase = String((ab as any).excludeBase ?? '')
          if (excludeBase && attacker.base === excludeBase) { forAllowed = false; break }
        }
      }
      if (!forAllowed) continue

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

  const firstDamagedReduction = findFirstDamagedReduction(state, targetUnitId)
  if (firstDamagedReduction && firstDamagedReduction.amount > 0) {
    dmgReduction += firstDamagedReduction.amount
    breakdown.push({ label: firstDamagedReduction.label, amount: -firstDamagedReduction.amount })
  }

  // extraBonus from active abilities (e.g. GOLD_FOR_DAMAGE)
  if (extraBonus > 0) {
    bonus += extraBonus
    breakdown.push({ label: '以財傷敵', amount: extraBonus })
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
  extraBonus: number = 0,
): { damage: number; breakdown: DamageBreakdownItem[] } {
  return computeDamageCore(state, attackerId, targetUnitId, diceValue, extraBonus)
}
