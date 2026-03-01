import { computed } from 'vue'
import type { Ref } from 'vue'
import type { GameState } from '../engine'
import { getSoulCard } from '../engine'

export type BuffEntry = { label: string; kind: 'aura' | 'free' | 'buff' }

function highestTierAmount(tiers: { count: number; amount: number }[], n: number): number {
  const sorted = [...tiers].sort((a, b) => b.count - a.count)
  for (const t of sorted) { if (n >= t.count) return t.amount }
  return 0
}

export function useActiveBuffs(state: Ref<GameState>) {
  const activeBuffs = computed((): BuffEntry[] => {
    const s = state.value
    const side = s.turn.side
    const phase = s.turn.phase
    const buffs: BuffEntry[] = []

    const soldierCount = Object.values(s.units).filter((u) => u.side === side && u.base === 'soldier').length

    for (const u of Object.values(s.units)) {
      if (u.side !== side) continue
      const soulId = u.enchant?.soulId
      if (!soulId) continue
      const card = getSoulCard(soulId)
      if (!card) continue
      for (const ab of card.abilities) {
        const type = ab.type

        if (type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS') {
          const amt = highestTierAmount((ab as any).tiers ?? [], soldierCount)
          if (amt > 0) buffs.push({ label: `${card.name}：全軍 ATK +${amt}`, kind: 'aura' })
        }

        if (type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA') {
          const amt = highestTierAmount((ab as any).tiers ?? [], soldierCount)
          if (amt > 0) buffs.push({ label: `${card.name}：全軍 減傷 -${amt}`, kind: 'aura' })
        }

        if (type === 'FORMATION_COMMAND' && phase === 'combat') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:FORMATION_COMMAND`] ?? 0
          if (used < perTurn) buffs.push({ label: `${card.name}（整編）：相鄰卒可免費移動`, kind: 'free' })
        }

        if (type === 'LOGISTICS_REVIVE' && phase === 'necro') {
          const perTurn = Number((ab as any).perTurn ?? 1)
          const used = s.turnFlags.abilityUsed?.[`${u.id}:LOGISTICS_REVIVE`] ?? 0
          if (used < perTurn) buffs.push({ label: `${card.name}（後勤）：可免費復活 1 個卒`, kind: 'free' })
        }

        if (type === 'FREE_SHOOT' && phase === 'combat') {
          const when = (ab as any).when
          const conditionOk = !when || (String(when.type ?? '') === 'SOLDIERS_GTE' && soldierCount >= Number(when.count ?? 0))
          if (conditionOk) {
            const perTurn = Number((ab as any).perTurn ?? 1)
            const used = s.turnFlags.abilityUsed?.[`${u.id}:FREE_SHOOT`] ?? 0
            if (used < perTurn) buffs.push({ label: `${card.name}：可免費射擊 ×${perTurn - used}`, kind: 'free' })
          }
        }

        if (type === 'IGNORE_BLOCKING') {
          const when = (ab as any).when
          const conditionOk = !when || (String(when.type ?? '') === 'SOLDIERS_GTE' && soldierCount >= Number(when.count ?? 0))
          if (conditionOk && phase === 'combat') buffs.push({ label: `${card.name}：無視阻擋`, kind: 'buff' })
        }
      }
    }

    // TurnFlags 額外狀態
    if ((s.turnFlags.freeShootBonus ?? 0) > 0)
      buffs.push({ label: `魂能超載：下次射擊免費 ×${s.turnFlags.freeShootBonus}`, kind: 'free' })
    if ((s.turnFlags.enchantGoldDiscount ?? 0) > 0)
      buffs.push({ label: `冥魂灌注：附魔 -${s.turnFlags.enchantGoldDiscount}G`, kind: 'buff' })
    if ((s.turnFlags.itemNecroBonus ?? 0) > 0)
      buffs.push({ label: `冥魂灌注：死靈術 +${s.turnFlags.itemNecroBonus}`, kind: 'buff' })
    if ((s.turnFlags.necroBonusActions ?? 0) > 0)
      buffs.push({ label: `血液祭儀：死靈術 +${s.turnFlags.necroBonusActions}`, kind: 'buff' })
    if ((s.turnFlags.lastStandContractBonus ?? 0) > 0)
      buffs.push({ label: `死戰契約：可免費復活 ×${s.turnFlags.lastStandContractBonus}`, kind: 'free' })
    if (s.turnFlags.darkMoonScopeActive)
      buffs.push({ label: '暗月窺視：可選任意墳場卡', kind: 'buff' })
    if (s.turnFlags.deathChainActive)
      buffs.push({ label: '死亡連鎖：擊殺 +1 魔力', kind: 'aura' })

    return buffs
  })

  return { activeBuffs }
}
