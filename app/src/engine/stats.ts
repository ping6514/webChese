import type { GameState, Unit } from './state'
import { BASE_STATS } from './state'
import { getSoulCard } from './cards'
import { getItemCard } from './items'
import { countCorpses } from './corpses'
import { countSoldiers } from './corpses'

function getItemHandTotalValue(state: GameState, side: 'red' | 'black'): number {
  let total = 0
  for (const itemId of state.hands[side].items) {
    const item = getItemCard(itemId)
    total += Number(item?.costGold ?? 0)
  }
  return total
}

export function getDefValue(unit: Unit, atkKey: string): number {
  const found = unit.def.find((d) => d.key === atkKey)
  return found ? found.value : 0
}

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
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
    if (!c) continue
    if (c.clan !== clan) continue
    count++
  }
  return count >= need
}

function auraWhenOk(state: GameState, auraUnit: Unit, when: any, clanFallback: string): boolean {
  const type = String(when?.type ?? '')
  if (!type) return true
  if (type === 'SOURCE_IN_PALACE') {
    return palaceContains(auraUnit.side, auraUnit.pos)
  }
  if (type === 'CORPSES_GTE') {
    const need = Number(when?.count ?? 0)
    if (!(Number.isFinite(need) && need > 0)) return false
    return countCorpses(state, auraUnit.side) >= need
  }
  if (type === 'RESONANCE_ACTIVE') {
    const soulId = auraUnit.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const res = card?.abilities.find((a) => a.type === 'RESONANCE') as any
    const need = Number(res?.need ?? 0)
    const resClan = String(res?.clan ?? '')
    return isResonanceActive(state, auraUnit.id, need, resClan || clanFallback)
  }
  return true
}

function getAuraStatBonusAtkAmountForKey(ab: any, unitAtkKey: string): number {
  const raw = ab?.bonus?.atk
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.floor(raw) : 0
  }
  if (!raw || typeof raw !== 'object') return 0
  const atkKey = String((raw as any)?.key ?? '')
  if (atkKey && atkKey !== unitAtkKey) return 0
  const amount = Number((raw as any)?.value ?? 0)
  return Number.isFinite(amount) ? Math.floor(amount) : 0
}

function getAuraStatBonusDefAmounts(ab: any): { phys: number; magic: number } {
  const raw = ab?.bonus?.def
  if (typeof raw === 'number') {
    const v = Number.isFinite(raw) ? Math.floor(raw) : 0
    return { phys: v, magic: v }
  }
  if (!raw || typeof raw !== 'object') return { phys: 0, magic: 0 }
  const phys = Number((raw as any).phys ?? 0)
  const magic = Number((raw as any).magic ?? 0)
  return {
    phys: Number.isFinite(phys) ? Math.floor(phys) : 0,
    magic: Number.isFinite(magic) ? Math.floor(magic) : 0,
  }
}

function getDefBonusAmountByKey(raw: any, key: string): number {
  if (Array.isArray(raw)) {
    const found = raw.find((x: any) => String(x?.key ?? '') === key)
    const value = Number(found?.value ?? 0)
    return Number.isFinite(value) ? Math.floor(value) : 0
  }
  if (!raw || typeof raw !== 'object') return 0
  const value = Number(raw[key] ?? 0)
  return Number.isFinite(value) ? Math.floor(value) : 0
}

function getDefBonusPair(raw: any): { phys: number; magic: number } {
  return {
    phys: getDefBonusAmountByKey(raw, 'phys'),
    magic: getDefBonusAmountByKey(raw, 'magic'),
  }
}

function auraForKeysOk(targetUnit: Unit, ab: any): boolean {
  const forRaw = ab?.for
  const forKeys = Array.isArray(forRaw) ? (forRaw.map((x: any) => String(x ?? '')).filter(Boolean)) : [String(forRaw ?? '')].filter(Boolean)
  if (forKeys.length === 0) return false

  for (const forKey of forKeys) {
    if (forKey === 'ALLIES_IN_PALACE') {
      if (!palaceContains(targetUnit.side, targetUnit.pos)) return false
      continue
    }
    if (forKey === 'CROSS_RIVER_UNITS') {
      if (!crossedRiver(targetUnit.side, targetUnit.pos.y)) return false
      continue
    }
    if (forKey === 'CLAN') {
      const clan = String(ab?.clan ?? '')
      if (!clan) return false
      const soulId = targetUnit.enchant?.soulId
      const card = soulId ? getSoulCard(soulId) : undefined
      if (!card) return false
      if (String(card.clan ?? '') !== clan) return false

      const excludeBase = String(ab?.excludeBase ?? '')
      if (excludeBase && targetUnit.base === excludeBase) return false
      continue
    }
  }
  return true
}

function unitCountDelta(state: GameState, side: 'red' | 'black'): number {
  const ownCount = Object.values(state.units).filter((u) => u.side === side).length
  const enemyCount = Object.values(state.units).filter((u) => u.side !== side).length
  return ownCount - enemyCount
}

export function getAuraHpBonusInState(state: GameState, unitId: string): { hpBonus: number; healCurrent: boolean } {
  const unit = state.units[unitId]
  if (!unit) return { hpBonus: 0, healCurrent: false }
  let hpBonus = 0
  let healCurrent = false

  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      if (!auraWhenOk(state, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue
      if (!auraForKeysOk(unit, ab)) continue

      const bonus = ab.bonus ?? {}
      const hp = Number(bonus.hp ?? 0)
      if (Number.isFinite(hp) && hp > 0) hpBonus += Math.floor(hp)
      if (bonus.healCurrent === true) healCurrent = true
    }
  }

  return { hpBonus, healCurrent }
}

export type StatBonusPart = { label: string; amount: number }

export type DefPanel = {
  phys: { base: number; total: number; parts: StatBonusPart[] }
  magic: { base: number; total: number; parts: StatBonusPart[] }
}

export type HpPanel = {
  current: number
  maxBase: number
  maxTotal: number
  parts: StatBonusPart[]
}

export function getAtkPanelBreakdownInState(state: GameState, unitId: string): { key: string; base: number; total: number; parts: StatBonusPart[] } {
  const unit = state.units[unitId]
  if (!unit) return { key: 'phys', base: 0, total: 0, parts: [] }
  const base = Number(unit.atk.value ?? 0)
  const key = String(unit.atk.key ?? 'phys')
  const parts: StatBonusPart[] = []
  let bonus = 0

  // Self ATK_BONUS from the unit's own soul card (conditional)
  const soulId = unit.enchant?.soulId
  if (soulId) {
    const card = getSoulCard(soulId)
    if (card) {
      const crossed = crossedRiver(unit.side, unit.pos.y)
      for (const ab of card.abilities as any[]) {
        if (ab.type !== 'ATK_BONUS') continue

        const when = ab.when
        const whenType = String(when?.type ?? '')
        if (whenType === 'AFTER_CROSS_RIVER' && !crossed) continue

        if (whenType === 'CORPSES_GTE') {
          const need = Number(when?.count ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (countCorpses(state, unit.side) < need) continue
        }
        if (whenType === 'SOLDIERS_GTE') {
          const need = Number(when?.count ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (countSoldiers(state, unit.side) < need) continue
        }
        if (whenType === 'MOVED_THIS_TURN') {
          if (!state.turnFlags.movedThisTurn?.[unitId]) continue
        }
        if (whenType === 'ENEMY_KILLED_THIS_TURN_GTE') {
          const need = Number(when?.count ?? 0)
          const cur = Number(state.turnFlags.enemyKilledThisTurnCount ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (cur < need) continue
        }

        const amount = Number(ab.amount ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) continue
        bonus += amount
        parts.push({ label: card.name, amount })
      }
    }
  }

  // Aura-based ATK from AURA_STAT_BONUS
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      if (!auraWhenOk(state, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue
      if (!auraForKeysOk(unit, ab)) continue

      const amount = getAuraStatBonusAtkAmountForKey(ab, key)
      if (amount <= 0) continue
      bonus += amount
      parts.push({ label: auraCard.name + ' 光環', amount })
    }
  }

  // ITEM_VALUE_AURA (global ATK aura when total item value in hand reaches threshold)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
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
      const totalValue = getItemHandTotalValue(state, unit.side)
      if (totalValue < threshold) continue
      const amount = Number(ab?.bonus?.atk ?? 0)
      if (!(Number.isFinite(amount) && amount > 0)) continue
      const add = Math.floor(amount)
      bonus += add
      parts.push({ label: auraCard.name + ' 收藏', amount: add })
    }
  }

  const total = base + bonus
  return { key, base, total, parts }
}

export function getMaxHpForUnitInState(state: GameState, unitId: string): number {
  const u = state.units[unitId]
  if (!u) return 0

  const base = BASE_STATS[u.base]
  const baseHp = u.enchant?.soulId
    ? (getSoulCard(u.enchant.soulId)?.stats.hp ?? base.hp)
    : base.hp
  const { hpBonus } = getAuraHpBonusInState(state, unitId)
  return Math.max(0, Math.floor(Number(baseHp ?? 0) + hpBonus))
}

export function getHpPanelBreakdownInState(state: GameState, unitId: string): HpPanel {
  const u = state.units[unitId]
  if (!u) return { current: 0, maxBase: 0, maxTotal: 0, parts: [] }

  const base = BASE_STATS[u.base]
  const maxBase = u.enchant?.soulId
    ? (getSoulCard(u.enchant.soulId)?.stats.hp ?? base.hp)
    : base.hp

  const parts: StatBonusPart[] = []
  let bonus = 0

  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      if (!auraWhenOk(state, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue
      if (!auraForKeysOk(u, ab)) continue
      const hp = Number(ab?.bonus?.hp ?? 0)
      if (!Number.isFinite(hp) || hp <= 0) continue
      const add = Math.floor(hp)
      bonus += add
      parts.push({ label: auraCard.name + ' 光環', amount: add })
    }
  }

  const maxTotal = Math.max(0, Math.floor(Number(maxBase ?? 0) + bonus))
  const current = Math.min(maxTotal, u.hpCurrent)
  return { current, maxBase: Math.floor(Number(maxBase ?? 0)), maxTotal, parts }
}

export function getDefPanelBreakdownInState(state: GameState, unitId: string): DefPanel {
  const u = state.units[unitId]
  if (!u) return {
    phys: { base: 0, total: 0, parts: [] },
    magic: { base: 0, total: 0, parts: [] },
  }

  const basePhys = getDefValue(u, 'phys')
  const baseMagic = getDefValue(u, 'magic')

  const physParts: StatBonusPart[] = []
  const magicParts: StatBonusPart[] = []
  let physBonus = 0
  let magicBonus = 0

  {
    const selfSoulId = u.enchant?.soulId
    if (selfSoulId) {
      const selfCard = getSoulCard(selfSoulId)
      if (selfCard && u.hpCurrent < getMaxHpForUnitInState(state, u.id)) {
        for (const ab of selfCard.abilities as any[]) {
          if (ab.type !== 'BELOW_MAX_HP_DEFENSE_BONUS') continue
          const { phys: p, magic: m } = getDefBonusPair(ab?.defBonus)
          if (p > 0) { physBonus += p; physParts.push({ label: selfCard.name, amount: p }) }
          if (m > 0) { magicBonus += m; magicParts.push({ label: selfCard.name, amount: m }) }
        }
      }
    }
  }

  // GOLD_THRESHOLD_ATK self DEF bonus
  {
    const selfSoulId = u.enchant?.soulId
    if (selfSoulId) {
      const selfCard = getSoulCard(selfSoulId)
      if (selfCard) {
        for (const ab of selfCard.abilities as any[]) {
          if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
          const scope = String(ab.scope ?? 'self')
          if (scope !== 'self') continue
          const defBonus = ab.defBonus
          if (!defBonus) continue
          const threshold = Number(ab.threshold ?? 0)
          if (!(Number.isFinite(threshold) && threshold > 0)) continue
          if (state.resources[u.side].gold < threshold) continue

          const p = Number(defBonus.phys ?? 0)
          const m = Number(defBonus.magic ?? 0)
          if (Number.isFinite(p) && p > 0) { physBonus += p; physParts.push({ label: selfCard.name, amount: p }) }
          if (Number.isFinite(m) && m > 0) { magicBonus += m; magicParts.push({ label: selfCard.name, amount: m }) }
        }
      }
    }
  }

  // GOLD_THRESHOLD_ATK global DEF aura
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
      const scope = String(ab.scope ?? 'self')
      if (scope !== 'global') continue
      const defBonus = ab.defBonus
      if (!defBonus) continue
      const threshold = Number(ab.threshold ?? 0)
      if (!(Number.isFinite(threshold) && threshold > 0)) continue
      if (state.resources[u.side].gold < threshold) continue
      const p = Number(defBonus.phys ?? 0)
      const m = Number(defBonus.magic ?? 0)
      if (Number.isFinite(p) && p > 0) { physBonus += p; physParts.push({ label: auraCard.name, amount: p }) }
      if (Number.isFinite(m) && m > 0) { magicBonus += m; magicParts.push({ label: auraCard.name, amount: m }) }
    }
  }

  // AURA_DEF_BONUS
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_DEF_BONUS') continue
      const amount = Number(ab.amount ?? 0)
      if (!(Number.isFinite(amount) && amount > 0)) continue

      const when = ab.when
      const whenType = String(when?.type ?? '')
      if (whenType === 'SOURCE_IN_PALACE' && !palaceContains(auraUnit.side, auraUnit.pos)) continue
      if (whenType === 'CORPSES_GTE') {
        const need = Number(when?.count ?? 0)
        if (!(Number.isFinite(need) && need > 0)) continue
        if (countCorpses(state, auraUnit.side) < need) continue
      }

      const forKey = String(ab.for ?? '')
      if (forKey === 'ALLIES_IN_PALACE' && !palaceContains(u.side, u.pos)) continue
      if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(u.side, u.pos.y)) continue

      if (forKey === 'CLAN') {
        const clan = String(ab.clan ?? '')
        if (!clan) continue
        const sid = u.enchant?.soulId
        const uc = sid ? getSoulCard(sid) : undefined
        if (!uc) continue
        if (String(uc.clan ?? '') !== clan) continue
        const excludeBase = String(ab.excludeBase ?? '')
        if (excludeBase && u.base === excludeBase) continue
      }

      const key = String(ab.key ?? '')
      if (key === 'phys') { physBonus += amount; physParts.push({ label: auraCard.name + ' 光環', amount }) }
      if (key === 'magic') { magicBonus += amount; magicParts.push({ label: auraCard.name + ' 光環', amount }) }
    }
  }

  // AURA_STAT_BONUS(def)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      if (!auraWhenOk(state, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue
      if (!auraForKeysOk(u, ab)) continue
      const { phys: p, magic: m } = getAuraStatBonusDefAmounts(ab)
      if (p > 0) { physBonus += p; physParts.push({ label: auraCard.name + ' 光環', amount: p }) }
      if (m > 0) { magicBonus += m; magicParts.push({ label: auraCard.name + ' 光環', amount: m }) }
    }
  }

  // ITEM_VALUE_AURA(def)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
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
      const totalValue = getItemHandTotalValue(state, u.side)
      if (totalValue < threshold) continue
      const { phys: p, magic: m } = getDefBonusPair(ab?.bonus?.def)
      if (p > 0) { physBonus += p; physParts.push({ label: auraCard.name + ' 收藏', amount: p }) }
      if (m > 0) { magicBonus += m; magicParts.push({ label: auraCard.name + ' 收藏', amount: m }) }
    }
  }

  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== u.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    const advantage = unitCountDelta(state, u.side)
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'UNIT_COUNT_ADVANTAGE_AURA') continue
      const scope = String(ab.scope ?? 'global')
      if (scope !== 'global') continue
      const margin = Number(ab.margin ?? 1)
      if (!(Number.isFinite(margin) && margin > 0)) continue
      if (advantage < margin) continue
      const { phys: p, magic: m } = getDefBonusPair(ab?.defBonus)
      if (p > 0) { physBonus += p; physParts.push({ label: auraCard.name + ' 盛勢', amount: p }) }
      if (m > 0) { magicBonus += m; magicParts.push({ label: auraCard.name + ' 盛勢', amount: m }) }
    }
  }

  return {
    phys: { base: basePhys, total: basePhys + physBonus, parts: physParts },
    magic: { base: baseMagic, total: baseMagic + magicBonus, parts: magicParts },
  }
}

export function getDefValueInState(state: GameState, unit: Unit, atkKey: string): number {
  let defValue = getDefValue(unit, atkKey)

  {
    const selfSoulId = unit.enchant?.soulId
    if (selfSoulId) {
      const selfCard = getSoulCard(selfSoulId)
      if (selfCard && unit.hpCurrent < getMaxHpForUnitInState(state, unit.id)) {
        for (const ab of selfCard.abilities as any[]) {
          if (ab.type !== 'BELOW_MAX_HP_DEFENSE_BONUS') continue
          const bonusAmount = getDefBonusAmountByKey(ab?.defBonus, atkKey)
          if (Number.isFinite(bonusAmount) && bonusAmount > 0) defValue += Math.floor(bonusAmount)
        }
      }
    }
  }

  // GOLD_THRESHOLD_ATK self DEF bonus (守金 style: threshold-based self DEF)
  {
    const selfSoulId = unit.enchant?.soulId
    if (selfSoulId) {
      const selfCard = getSoulCard(selfSoulId)
      if (selfCard) {
        for (const ab of selfCard.abilities) {
          if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
          const scope = String((ab as any).scope ?? 'self')
          if (scope !== 'self') continue
          const defBonus = (ab as any).defBonus
          if (!defBonus) continue
          const bonusAmount = Number(defBonus[atkKey] ?? 0)
          if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) continue
          const threshold = Number((ab as any).threshold ?? 0)
          if (!Number.isFinite(threshold) || threshold <= 0) continue
          if (state.resources[unit.side].gold >= threshold) defValue += bonusAmount
        }
      }
    }
  }

  // GOLD_THRESHOLD_ATK global DEF aura (幣侍 style: all allies get DEF bonus)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    for (const ab of auraCard.abilities) {
      if (ab.type !== 'GOLD_THRESHOLD_ATK') continue
      const scope = String((ab as any).scope ?? 'self')
      if (scope !== 'global') continue
      const defBonus = (ab as any).defBonus
      if (!defBonus) continue
      const bonusAmount = Number(defBonus[atkKey] ?? 0)
      if (!Number.isFinite(bonusAmount) || bonusAmount <= 0) continue
      const threshold = Number((ab as any).threshold ?? 0)
      if (!Number.isFinite(threshold) || threshold <= 0) continue
      if (state.resources[auraUnit.side].gold >= threshold) defValue += bonusAmount
    }
  }

  // ITEM_VALUE_AURA global DEF aura
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
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
      const totalValue = getItemHandTotalValue(state, unit.side)
      if (totalValue < threshold) continue
      const bonusAmount = getDefBonusAmountByKey(ab?.bonus?.def, atkKey)
      if (Number.isFinite(bonusAmount) && bonusAmount > 0) defValue += Math.floor(bonusAmount)
    }
  }

  // AURA_DEF_BONUS: allied aura units can add to defenders' DEF.
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities) {
      if (ab.type !== 'AURA_DEF_BONUS') continue

      const key = String((ab as any).key ?? '')
      if (!key || key !== atkKey) continue

      const amount = Number((ab as any).amount ?? 0)
      if (!(Number.isFinite(amount) && amount > 0)) continue

      const when = (ab as any).when
      const whenType = String(when?.type ?? '')
      if (whenType === 'SOURCE_IN_PALACE' && !palaceContains(auraUnit.side, auraUnit.pos)) continue

      if (whenType === 'CORPSES_GTE') {
        const need = Number(when?.count ?? 0)
        if (!(Number.isFinite(need) && need > 0)) continue
        const corpses = countCorpses(state, auraUnit.side)
        if (corpses < need) continue
      }

      const forKey = String((ab as any).for ?? '')
      if (forKey === 'ALLIES_IN_PALACE' && !palaceContains(unit.side, unit.pos)) continue

      if (forKey === 'CLAN') {
        const clan = String((ab as any).clan ?? '')
        if (!clan) continue
        const soulId = unit.enchant?.soulId
        const card = soulId ? getSoulCard(soulId) : undefined
        if (!card) continue
        if (String(card.clan ?? '') !== clan) continue

        const excludeBase = String((ab as any).excludeBase ?? '')
        if (excludeBase && unit.base === excludeBase) continue
      }

      defValue += amount
    }
  }

  // AURA_STAT_BONUS: unified aura stats (currently used for DEF bonus)
  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue

    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'AURA_STAT_BONUS') continue
      if (!auraWhenOk(state, auraUnit, ab.when, String(auraCard.clan ?? ''))) continue
      if (!auraForKeysOk(unit, ab)) continue

      const { phys, magic } = getAuraStatBonusDefAmounts(ab)
      const add = atkKey === 'magic' ? magic : phys
      if (add > 0) defValue += add
    }
  }

  for (const auraUnit of Object.values(state.units)) {
    if (auraUnit.side !== unit.side) continue
    const auraSoulId = auraUnit.enchant?.soulId
    if (!auraSoulId) continue
    const auraCard = getSoulCard(auraSoulId)
    if (!auraCard) continue
    const advantage = unitCountDelta(state, unit.side)
    for (const ab of auraCard.abilities as any[]) {
      if (ab.type !== 'UNIT_COUNT_ADVANTAGE_AURA') continue
      const scope = String(ab.scope ?? 'global')
      if (scope !== 'global') continue
      const margin = Number(ab.margin ?? 1)
      if (!(Number.isFinite(margin) && margin > 0)) continue
      if (advantage < margin) continue
      const bonusAmount = getDefBonusAmountByKey(ab?.defBonus, atkKey)
      if (Number.isFinite(bonusAmount) && bonusAmount > 0) defValue += Math.floor(bonusAmount)
    }
  }

  return defValue
}

export type Modifier = {
  id: string
  scope: 'all' | 'side' | 'unit'
  side?: Unit['side']
  unitId?: string
  stat: 'atk' | 'def'
  key?: string
  add: number
}

export function applyModifiers(_state: GameState, unit: Unit): Unit {
  // Skeleton for future buff/auras/item modifiers.
  // For now it returns base unit values unchanged.
  return unit
}
