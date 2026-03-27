import { computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '../engine'
import { getSoulCard } from '../engine'
import { DEATH_CHAIN_MAX_KILLS } from '../engine/gameConfig'
import { countCorpses } from '../engine/corpses'
import { getItemCard } from '../engine/items'

export type BuffEntry = { label: string; kind: 'aura' | 'free' | 'buff' }

function highestTierAmount(tiers: { count: number; amount: number }[], n: number): number {
  const sorted = [...tiers].sort((a, b) => b.count - a.count)
  for (const t of sorted) { if (n >= t.count) return t.amount }
  return 0
}

function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function getItemHandTotalValue(state: GameState, side: 'red' | 'black'): number {
  let total = 0
  for (const itemId of state.hands[side].items) {
    const item = getItemCard(itemId)
    total += Number(item?.costGold ?? 0)
  }
  return total
}

function isResonanceActive(state: GameState, sourceUnitId: string, need: number, clan: string): boolean {
  if (!Number.isFinite(need) || need <= 0) return false
  const source = state.units[sourceUnitId]
  if (!source) return false
  let count = 0
  for (const u of Object.values(state.units)) {
    if (u.side !== source.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const c = getSoulCard(soulId)
    if (!c || c.clan !== clan) continue
    count++
  }
  return count >= need
}

export function useActiveBuffs(state: Ref<GameState>) {
  const activeBuffs = computed((): BuffEntry[] => {
    const s = state.value
    const side = s.turn.side
    const phase = s.turn.phase
    const buffs: BuffEntry[] = []

    const soldierCount = Object.values(s.units).filter((u) => u.side === side && u.base === 'soldier').length
    const corpseCount = countCorpses(s, side)
    const itemHandValue = getItemHandTotalValue(s, side)
    const itemHandCount = s.hands[side].items.length
    const goldCurrent = s.resources[side].gold

    const ownUnitCount = Object.values(s.units).filter((u) => u.side === side).length
    const enemyUnitCount = Object.values(s.units).filter((u) => u.side !== side).length
    const unitDelta = ownUnitCount - enemyUnitCount  // positive = we have more
    const unitDeficit = enemyUnitCount - ownUnitCount // positive = enemy has more

    const king = Object.values(s.units).find((u) => u.side === side && u.base === 'king')
    const kingHp = king?.hpCurrent ?? 999

    for (const u of Object.values(s.units)) {
      if (u.side !== side) continue
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue

      for (const ab of card.abilities) {
        const type = ab.type

        // ── Global aura: soldiers tiered ATK ────────────────────────────────
        if (type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS') {
          const amt = highestTierAmount((ab as any).tiers ?? [], soldierCount)
          if (amt > 0) buffs.push({ label: `${card.name}：全軍 ATK +${amt}`, kind: 'aura' })
        }

        // ── Global aura: soldiers tiered DMG reduction ───────────────────────
        if (type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA') {
          const amt = highestTierAmount((ab as any).tiers ?? [], soldierCount)
          if (amt > 0) buffs.push({ label: `${card.name}：全軍 減傷 -${amt}`, kind: 'aura' })
        }

        // ── Per-unit tiered damage bonus (like 軍華/騎兵靈) ─────────────────
        if (type === 'SOLDIERS_TIERED_DAMAGE_BONUS' && phase === 'combat') {
          const amt = highestTierAmount((ab as any).tiers ?? [], soldierCount)
          if (amt > 0) buffs.push({ label: `${card.name}：卒 ${soldierCount} 個 → 傷害 +${amt}`, kind: 'buff' })
        }

        // ── FORMATION_COMMAND ───────────────────────────────────────────────
        if (type === 'FORMATION_COMMAND' && phase === 'combat') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:FORMATION_COMMAND`] ?? 0
          if (used < perTurn) buffs.push({ label: `${card.name}（整編）：相鄰卒可免費移動`, kind: 'free' })
        }

        // ── LOGISTICS_REVIVE ────────────────────────────────────────────────
        if (type === 'LOGISTICS_REVIVE' && phase === 'necro') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:LOGISTICS_REVIVE`] ?? 0
          if (used < perTurn) buffs.push({ label: `${card.name}（後勤）：可免費復活 1 個卒`, kind: 'free' })
        }

        // ── PALACE_GUARD ────────────────────────────────────────────────────
        if (type === 'PALACE_GUARD') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:PALACE_GUARD`] ?? 0
          const amount = Number((ab as any).amount ?? 0)
          if (used < perTurn)
            buffs.push({ label: `${card.name}（宮護）：帥受傷 -${amount}（剩 ${perTurn - used} 次）`, kind: 'buff' })
        }

        // ── FREE_SHOOT ──────────────────────────────────────────────────────
        if (type === 'FREE_SHOOT' && phase === 'combat') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'SOLDIERS_GTE') ok = soldierCount >= Number(when.count ?? 0)
            else if (wt === 'CORPSES_GTE') ok = corpseCount >= Number(when.count ?? 0)
            else if (wt === 'AFTER_CROSS_RIVER') ok = crossedRiver(u.side, u.pos.y)
          }
          if (ok) {
            const perTurn = Number((ab as any).perTurn ?? 1)
            const used = s.turnFlags.abilityUsed?.[`${u.id}:FREE_SHOOT`] ?? 0
            if (used < perTurn) buffs.push({ label: `${card.name}：可免費射擊 ×${perTurn - used}`, kind: 'free' })
          }
        }

        // ── EXTRA_SHOT (額外射擊機會) ────────────────────────────────────────
        if (type === 'EXTRA_SHOT' && phase === 'combat') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'AFTER_CROSS_RIVER') ok = crossedRiver(u.side, u.pos.y)
            else if (wt === 'SOLDIERS_GTE') ok = soldierCount >= Number(when.count ?? 0)
            else if (wt === 'CORPSES_GTE') ok = corpseCount >= Number(when.count ?? 0)
          }
          if (ok) {
            const perTurn = Number((ab as any).perTurn ?? 1)
            const used = s.turnFlags.abilityUsed?.[`${u.id}:EXTRA_SHOT`] ?? 0
            if (used < perTurn) buffs.push({ label: `${card.name}：可額外射擊 ×${perTurn - used}`, kind: 'free' })
          }
        }

        // ── IGNORE_BLOCKING ─────────────────────────────────────────────────
        if (type === 'IGNORE_BLOCKING' && phase === 'combat') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'SOLDIERS_GTE') ok = soldierCount >= Number(when.count ?? 0)
            else if (wt === 'CORPSES_GTE') ok = corpseCount >= Number(when.count ?? 0)
            else if (wt === 'AFTER_CROSS_RIVER') ok = crossedRiver(u.side, u.pos.y)
          }
          if (ok) {
            const mode = String((ab as any).mode ?? '')
            const label = mode === 'all' ? `${card.name}：無視全部阻擋` : `${card.name}：無視阻擋`
            buffs.push({ label, kind: 'buff' })
          }
        }

        // ── IGNORE_PATH_BLOCKING (移動穿透) ─────────────────────────────────
        if (type === 'IGNORE_PATH_BLOCKING') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'AFTER_CROSS_RIVER') ok = crossedRiver(u.side, u.pos.y)
          }
          if (ok) {
            const count = (ab as any).count
            const label = count ? `${card.name}：移動穿透 ${count} 個阻擋` : `${card.name}：移動無視所有阻擋`
            buffs.push({ label, kind: 'buff' })
          }
        }

        // ── AURA_IGNORE_BLOCKING (友軍射擊無視阻擋) ─────────────────────────
        if (type === 'AURA_IGNORE_BLOCKING' && phase === 'combat') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'ATTACKER_IN_PALACE') ok = true // applies when any attacker is in palace
            else if (wt === 'RESONANCE_ACTIVE') {
              const resAb = card.abilities.find((a) => a.type === 'RESONANCE') as any
              ok = isResonanceActive(s, u.id, Number(resAb?.need ?? 0), String(resAb?.clan ?? ''))
            }
          }
          if (ok) {
            const perTurn = Number((ab as any).perTurn ?? 1)
            const used = s.turnFlags.abilityUsed?.[`${u.id}:AURA_IGNORE_BLOCKING`] ?? 0
            if (used < perTurn) {
              const count = (ab as any).count
              const lbl = count ? `${card.name}：友軍忽略 ${count} 阻擋` : `${card.name}：友軍無視阻擋`
              const condNote = String(when?.type ?? '') === 'ATTACKER_IN_PALACE' ? '（宮內攻擊者）' : ''
              buffs.push({ label: lbl + condNote, kind: 'aura' })
            }
          }
        }

        // ── SPLASH (濺射) ───────────────────────────────────────────────────
        if (type === 'SPLASH' && phase === 'combat') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'AFTER_CROSS_RIVER') ok = crossedRiver(u.side, u.pos.y)
          }
          if (ok) {
            const perTurn = Number((ab as any).perTurn ?? 0)
            const used = perTurn > 0 ? (s.turnFlags.abilityUsed?.[`${u.id}:SPLASH`] ?? 0) : 0
            if (perTurn <= 0 || used < perTurn) {
              const fd = Number((ab as any).fixedDamage ?? 0)
              buffs.push({ label: `${card.name}：射擊產生濺射（鄰格 ${fd} 固定傷害）`, kind: 'buff' })
            }
          }
        }

        // ── DAMAGE_SHARE (傷害分攤) ──────────────────────────────────────────
        if (type === 'DAMAGE_SHARE') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'ALLIES_IN_PALACE_GTE') {
              const need = Number(when.count ?? 0)
              const inPalace = Object.values(s.units).filter(
                (unit) => unit.side === side && palaceContains(side, unit.pos)
              ).length
              ok = inPalace >= need
            }
          }
          if (ok) {
            const amount = Number((ab as any).amount ?? 0)
            buffs.push({ label: `${card.name}：分攤 ${amount} 傷害（宮內 ≥${(ab as any).when?.count ?? 0} 單位）`, kind: 'aura' })
          }
        }

        // ── COUNTER (反擊) ───────────────────────────────────────────────────
        if (type === 'COUNTER') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:COUNTER`] ?? 0
          if (used < perTurn)
            buffs.push({ label: `${card.name}：反擊（剩 ${perTurn - used} 次）`, kind: 'buff' })
        }

        // ── FIRST_DAMAGED_REDUCTION (首傷減免) ───────────────────────────────
        if (type === 'FIRST_DAMAGED_REDUCTION') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:FIRST_DAMAGED_REDUCTION`] ?? 0
          const amount = Number((ab as any).amount ?? 0)
          if (used < perTurn)
            buffs.push({ label: `${card.name}：首次受傷 -${amount}（剩 ${perTurn - used} 次）`, kind: 'buff' })
        }

        // ── AURA_DAMAGE_BONUS (友軍傷害光環) ────────────────────────────────
        if (type === 'AURA_DAMAGE_BONUS') {
          const when = (ab as any).when
          let ok = !when
          if (!ok) {
            const wt = String(when?.type ?? '')
            if (wt === 'RESONANCE_ACTIVE') {
              const resAb = card.abilities.find((a) => a.type === 'RESONANCE') as any
              ok = isResonanceActive(s, u.id, Number(resAb?.need ?? 0), String(resAb?.clan ?? ''))
            } else if (wt === 'CORPSES_GTE') {
              ok = corpseCount >= Number(when.count ?? 0)
            }
          }
          if (ok) {
            const per = (ab as any).per
            if (per?.type === 'CORPSES_PER') {
              const perCount = Number(per.count ?? 1)
              const amountPer = Number((ab as any).amountPer ?? 1)
              const bonus = Math.floor(corpseCount / perCount) * amountPer
              if (bonus > 0)
                buffs.push({ label: `${card.name}：友軍傷害 +${bonus}（屍骸 ${corpseCount} 具）`, kind: 'aura' })
            } else {
              const amount = Number((ab as any).amount ?? 0)
              if (amount > 0)
                buffs.push({ label: `${card.name}：友軍傷害 +${amount}`, kind: 'aura' })
            }
          }
        }

        // ── ARMY_RALLY (軍援) ────────────────────────────────────────────────
        if (type === 'ARMY_RALLY' && phase === 'combat') {
          buffs.push({ label: `${card.name}：射擊聯動卒追擊`, kind: 'aura' })
        }

        // ── DAMAGE_BONUS_PER_ADJACENT_SOLDIER (周圍卒加成) ───────────────────
        if (type === 'DAMAGE_BONUS_PER_ADJACENT_SOLDIER' && phase === 'combat') {
          const radius = Number((ab as any).radius ?? 1)
          const amountPer = Number((ab as any).amountPer ?? 1)
          const cap = Number((ab as any).max ?? Infinity)
          const adjSoldiers = Object.values(s.units).filter((unit) => {
            if (unit.side !== side || unit.base !== 'soldier') return false
            const dx = Math.abs(unit.pos.x - u.pos.x)
            const dy = Math.abs(unit.pos.y - u.pos.y)
            return dx <= radius && dy <= radius && (dx + dy > 0)
          }).length
          const bonus = Math.min(adjSoldiers * amountPer, cap)
          if (bonus > 0)
            buffs.push({ label: `${card.name}：周圍 ${adjSoldiers} 卒 → 傷害 +${bonus}`, kind: 'buff' })
        }

        // ── INCOME_BONUS (收入加成) ──────────────────────────────────────────
        if (type === 'INCOME_BONUS') {
          const amount = Number((ab as any).amount ?? 0)
          if (amount > 0)
            buffs.push({ label: `${card.name}：每回合財力 +${amount}`, kind: 'aura' })
        }

        // ── KILL_GOLD_GAIN ───────────────────────────────────────────────────
        if (type === 'KILL_GOLD_GAIN') {
          const amount = Number((ab as any).amount ?? 0)
          if (amount > 0)
            buffs.push({ label: `${card.name}：擊殺 → +${amount} 財力`, kind: 'aura' })
        }

        // ── KILL_MANA_GAIN ───────────────────────────────────────────────────
        if (type === 'KILL_MANA_GAIN') {
          const amount = Number((ab as any).amount ?? 0)
          if (amount > 0)
            buffs.push({ label: `${card.name}：擊殺 → +${amount} 魔力`, kind: 'aura' })
        }

        // ── HEAL_SELF_AND_KING_ON_KILL ───────────────────────────────────────
        if (type === 'HEAL_SELF_AND_KING_ON_KILL' && phase === 'combat') {
          const selfAmt = Number((ab as any).selfAmount ?? 0)
          const kingAmt = Number((ab as any).kingAmount ?? 0)
          buffs.push({ label: `${card.name}：擊殺 → 自身+${selfAmt} HP，帥+${kingAmt} HP`, kind: 'aura' })
        }

        // ── DEATH_COUNTER (最後一搏) ─────────────────────────────────────────
        if (type === 'DEATH_COUNTER') {
          buffs.push({ label: `${card.name}：最後一搏（死亡時反擊）`, kind: 'buff' })
        }

        // ── GOLD_THRESHOLD_ATK self scope ────────────────────────────────────
        if (type === 'GOLD_THRESHOLD_ATK') {
          const scope = String((ab as any).scope ?? 'self')
          if (scope === 'self') {
            const threshold = Number((ab as any).threshold ?? 0)
            const atkBonus = Number((ab as any).atkBonus ?? 0)
            if (goldCurrent >= threshold && atkBonus > 0)
              buffs.push({ label: `${card.name}：財力≥${threshold} → ATK +${atkBonus}`, kind: 'buff' })
          }
          // global scope handled below via separate pass
        }

        // ── ITEM_COUNT_ATK_BONUS ─────────────────────────────────────────────
        if (type === 'ITEM_COUNT_ATK_BONUS') {
          if (itemHandCount > 0)
            buffs.push({ label: `${card.name}：持有 ${itemHandCount} 張道具 → ATK +${itemHandCount}`, kind: 'buff' })
        }

        // ── ITEM_VALUE_ATK_BONUS ─────────────────────────────────────────────
        if (type === 'ITEM_VALUE_ATK_BONUS') {
          const threshold = Number((ab as any).threshold ?? 0)
          const atkBonus = Number((ab as any).atkBonus ?? 0)
          if (itemHandValue >= threshold && atkBonus > 0)
            buffs.push({ label: `${card.name}：道具費≥${threshold} → ATK +${atkBonus}`, kind: 'buff' })
        }

        // ── ITEM_VALUE_AURA (全隊道具費光環) ────────────────────────────────
        if (type === 'ITEM_VALUE_AURA') {
          const threshold = Number((ab as any).threshold ?? 0)
          const bonus = (ab as any).bonus ?? {}
          if (itemHandValue >= threshold) {
            const atkBonus = Number(bonus.atk ?? 0)
            if (atkBonus > 0)
              buffs.push({ label: `${card.name}：道具費≥${threshold} → 全軍 ATK +${atkBonus}`, kind: 'aura' })
            const defPhys = Number(bonus?.def?.phys ?? 0)
            const defMagic = Number(bonus?.def?.magic ?? 0)
            if (defPhys > 0 || defMagic > 0) {
              const defLabel = defPhys === defMagic ? `雙防 +${defPhys}` : `物防 +${defPhys}/魔防 +${defMagic}`
              buffs.push({ label: `${card.name}：道具費≥${threshold} → 全軍 ${defLabel}`, kind: 'aura' })
            }
          }
        }

        // ── FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD ───────────────────────────────
        if (type === 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD') {
          const threshold = Number((ab as any).threshold ?? 0)
          const amount = Number((ab as any).amount ?? 0)
          const perTurn = Number((ab as any).perTurn ?? 1)
          const scope = String((ab as any).scope ?? 'self')
          if (goldCurrent < threshold) {
            const key = scope === 'global'
              ? `${u.id}:FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD:global`
              : `${u.id}:FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD`
            const used = s.turnFlags.abilityUsed?.[key] ?? 0
            if (used < perTurn)
              buffs.push({ label: `${card.name}：首次攻擊 → +${amount} 財力（×${perTurn - used}）`, kind: 'free' })
          }
        }

        // ── FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD ─────────────────────────────
        if (type === 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD') {
          const threshold = Number((ab as any).threshold ?? 0)
          const amount = Number((ab as any).amount ?? 0)
          const perTurn = Number((ab as any).perTurn ?? 1)
          if (goldCurrent < threshold) {
            const used = s.turnFlags.abilityUsed?.[`${u.id}:FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD`] ?? 0
            if (used < perTurn)
              buffs.push({ label: `${card.name}：首次道具 → +${amount} 財力（×${perTurn - used}）`, kind: 'free' })
          }
        }

        // ── UNDERDOG_AURA (逆境) ─────────────────────────────────────────────
        if (type === 'UNDERDOG_AURA') {
          const stages = (ab as any).stages as Array<{ margin: number; atkBonus: number }> | undefined
          const scope = String((ab as any).scope ?? 'self')
          if (stages && unitDeficit > 0) {
            const sorted = [...stages].sort((a, b) => a.margin - b.margin)
            let bestBonus = 0
            for (const st of sorted) { if (unitDeficit >= st.margin) bestBonus = st.atkBonus }
            if (bestBonus > 0) {
              const scopeLabel = scope === 'global' ? '全軍' : card.name
              buffs.push({ label: `${card.name}：逆境 → ${scopeLabel} ATK +${bestBonus}`, kind: 'buff' })
            }
          }
        }

        // ── BLOOD_RAGE_AURA (血憤) ───────────────────────────────────────────
        if (type === 'BLOOD_RAGE_AURA' && king) {
          const stages = (ab as any).stages as Array<{ threshold: number; atkBonus: number }> | undefined
          const scope = String((ab as any).scope ?? 'self')
          if (stages) {
            const sorted = [...stages].sort((a, b) => b.threshold - a.threshold)
            let bestBonus = 0
            let matchedThreshold = 0
            for (const st of sorted) {
              if (kingHp <= st.threshold) { bestBonus = st.atkBonus; matchedThreshold = st.threshold }
            }
            if (bestBonus > 0) {
              const scopeLabel = scope === 'global' ? '全軍' : card.name
              buffs.push({ label: `${card.name}（帥 HP≤${matchedThreshold}）：${scopeLabel} ATK +${bestBonus}`, kind: 'buff' })
            }
          }
        }

        // ── UNIT_COUNT_ADVANTAGE_AURA (盛勢) ─────────────────────────────────
        if (type === 'UNIT_COUNT_ADVANTAGE_AURA') {
          const margin = Number((ab as any).margin ?? 1)
          const defBonus = (ab as any).defBonus
          if (unitDelta >= margin && defBonus) {
            const defArr: { key: string; value: number }[] = Array.isArray(defBonus)
              ? defBonus
              : Object.entries(defBonus).map(([key, value]) => ({ key, value: Number(value) }))
            const physAmt = defArr.find((d) => d.key === 'phys')?.value ?? 0
            const magicAmt = defArr.find((d) => d.key === 'magic')?.value ?? 0
            const defLabel = physAmt === magicAmt ? `雙防 +${physAmt}` : `物防 +${physAmt}/魔防 +${magicAmt}`
            buffs.push({ label: `${card.name}：盛勢 → 全軍 ${defLabel}`, kind: 'aura' })
          }
        }

        // ── UNIT_COUNT_UNDERDOG_AURA (逆勢) ──────────────────────────────────
        if (type === 'UNIT_COUNT_UNDERDOG_AURA') {
          const margin = Number((ab as any).margin ?? 1)
          const atkBonus = Number((ab as any).atkBonus ?? 0)
          if (unitDeficit >= margin && atkBonus > 0)
            buffs.push({ label: `${card.name}：逆勢 → 全軍 ATK +${atkBonus}`, kind: 'buff' })
        }
      }
    }

    // ── Global GOLD_THRESHOLD_ATK aura pass ──────────────────────────────────
    for (const auraUnit of Object.values(s.units)) {
      if (auraUnit.side !== side) continue
      const auraSoulId = auraUnit.enchant?.soulId
      if (!auraSoulId) continue
      const auraCard = getSoulCard(auraSoulId)
      if (!auraCard) continue
      for (const ab of auraCard.abilities as any[]) {
        if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
        const scope = String(ab.scope ?? 'self')
        if (scope !== 'global') continue
        const threshold = Number(ab.threshold ?? 0)
        if (goldCurrent < threshold) continue
        const atkBonus = Number(ab.atkBonus ?? 0)
        const defBonus = ab.defBonus
        if (atkBonus > 0)
          buffs.push({ label: `${auraCard.name}：財力≥${threshold} → 全軍 ATK +${atkBonus}`, kind: 'aura' })
        if (defBonus) {
          const p = Number(defBonus.phys ?? 0)
          const m = Number(defBonus.magic ?? 0)
          if (p > 0 || m > 0) {
            const defLabel = p === m ? `雙防 +${p}` : `物防 +${p}/魔防 +${m}`
            buffs.push({ label: `${auraCard.name}：財力≥${threshold} → 全軍 ${defLabel}`, kind: 'aura' })
          }
        }
      }
    }

    // ── state.status: SACRIFICE_SHOT_BUFF active units ───────────────────────
    for (const [unitId, buff] of Object.entries(s.status.sacrificeBuffByUnitId)) {
      const buffUnit = s.units[unitId]
      if (!buffUnit || buffUnit.side !== side) continue
      const buffSoulId = buffUnit.enchant?.soulId
      const buffCard = buffSoulId ? getSoulCard(buffSoulId) : null
      const buffName = buffCard?.name ?? '單位'
      if (buff.ignoreBlockingAll)
        buffs.push({ label: `${buffName}（獻祭激活）：下次射擊無視全部阻擋`, kind: 'free' })
      if (buff.chainRadius != null)
        buffs.push({ label: `${buffName}（獻祭激活）：下次射擊獲得連鎖`, kind: 'free' })
      if (buff.damageBonusPerCorpsesCap != null) {
        const bonusAmt = Math.min(corpseCount, buff.damageBonusPerCorpsesCap)
        buffs.push({ label: `${buffName}（獻祭激活）：下次射擊傷害 +${bonusAmt}（屍骸 ${corpseCount} 具）`, kind: 'free' })
      }
    }

    // ── state.status: King invincible ────────────────────────────────────────
    if (s.status.kingInvincibleSide === side)
      buffs.push({ label: '帥：無敵（直到下回合開始）', kind: 'aura' })

    // ── TurnFlags ────────────────────────────────────────────────────────────
    if ((s.turnFlags.freeShootBonus ?? 0) > 0)
      buffs.push({ label: `本回合：免費射擊 ×${s.turnFlags.freeShootBonus}`, kind: 'free' })
    if ((s.turnFlags.freeMoveBonus ?? 0) > 0)
      buffs.push({ label: `本回合：免費移動 ×${s.turnFlags.freeMoveBonus}`, kind: 'free' })
    if ((s.turnFlags.enchantGoldDiscount ?? 0) > 0)
      buffs.push({ label: `冥魂灌注：附魔 -${s.turnFlags.enchantGoldDiscount}G`, kind: 'buff' })
    if ((s.turnFlags.itemNecroBonus ?? 0) > 0)
      buffs.push({ label: `冥魂灌注：死靈術 +${s.turnFlags.itemNecroBonus}`, kind: 'buff' })
    if ((s.turnFlags.necroBonusActions ?? 0) > 0)
      buffs.push({ label: `血液祭儀：死靈術 +${s.turnFlags.necroBonusActions}`, kind: 'buff' })
    if ((s.turnFlags.lastStandContractBonus ?? 0) > 0)
      buffs.push({ label: `死戰契約：可免費復活 ×${s.turnFlags.lastStandContractBonus}`, kind: 'free' })
    if (s.turnFlags.deathChainActive) {
      const used = s.turnFlags.deathChainKillCount ?? 0
      const cfg = (s.turnFlags as any).onKillGainResource as { resource: string; amount: number; perTurnCap: number } | undefined
      const cap = Math.max(0, Math.floor(Number(cfg?.perTurnCap ?? DEATH_CHAIN_MAX_KILLS)))
      const amt = Math.max(0, Math.floor(Number(cfg?.amount ?? 1)))
      const resKey = String(cfg?.resource ?? 'mana')
      if (used < cap) {
        const resLabel = resKey === 'gold' ? '財力' : '魔力'
        buffs.push({ label: `死亡連鎖：擊殺 +${amt} ${resLabel}（剩 ${cap - used} 次）`, kind: 'aura' })
      }
    }

    // ── Blood sacrifice active shot effect ────────────────────────────────────
    const bsEffect = s.turnFlags.bloodSacrificeActiveShotEffect
    if (bsEffect) {
      const bsUnit = s.units[bsEffect.unitId]
      if (bsUnit?.side === side) {
        const bsCard = bsUnit.enchant?.soulId ? getSoulCard(bsUnit.enchant.soulId) : null
        const bsName = bsCard?.name ?? '血祭'
        const effType = String((bsEffect.effect as any)?.type ?? '')
        const effLabels: Record<string, string> = {
          PIERCE: '貫穿', CHAIN: '連鎖', IGNORE_BLOCKING: '無視阻擋',
          FREE_SHOOT: '免費射擊', DAMAGE_BONUS: `傷害 +${(bsEffect.effect as any)?.amount ?? '?'}`,
          MOVE_THEN_SHOOT: '移動後射',
        }
        const effLabel = effLabels[effType] ?? effType
        buffs.push({ label: `${bsName}（血祭激活）：${effLabel}`, kind: 'free' })
      }
    }

    // Sort: free (one-time actions) → aura (global/passive) → buff (conditional)
    const kindOrder: Record<string, number> = { free: 0, aura: 1, buff: 2 }
    buffs.sort((a, b) => (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9))
    return buffs
  })

  return { activeBuffs }
}
