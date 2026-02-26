import type { GameState } from './state'
import { getSoulCard } from './cards'
import { computeRawDamage } from './damage'
import { countCorpses } from './corpses'

export type ShotPreviewEffect =
  | {
      kind: 'DAMAGE_SHARE'
      byUnitId: string
      amount: number
    }
  | {
      kind: 'DAMAGE_BONUS'
      byUnitId: string
      amount: number
    }
  | {
      kind: 'AURA_DAMAGE_BONUS'
      byUnitId: string
      amount: number
    }
  | {
      kind: 'AURA_IGNORE_BLOCKING_COUNT'
      byUnitId: string
      count: number
    }
  | {
      kind: 'AURA_IGNORE_BLOCKING_ALL'
      byUnitId: string
    }
  | {
      kind: 'IGNORE_BLOCKING_COUNT'
      byUnitId: string
      count: number
    }
  | {
      kind: 'IGNORE_BLOCKING_ALL'
      byUnitId: string
    }
  | {
      kind: 'SPLASH'
      byUnitId: string
      radius: number
      targetUnitIds: string[]
      fixedDamage: number
    }
  | {
      kind: 'CHAIN'
      byUnitId: string
      targetUnitId: string
      fixedDamage: number
    }
  | {
      kind: 'PIERCE'
      byUnitId: string
      mode: 'CANNON_SCREEN_AND_TARGET' | 'LINE_ENEMIES'
      targetUnitIds: string[]
      fixedDamage: number
    }
  | {
      kind: 'TARGET_DEF_MINUS'
      byUnitId: string
      key: 'phys' | 'magic'
      amount: number
    }

export type ShotPreview = {
  ok: true
  attackerId: string
  targetUnitId: string
  rawDamage: number
  damageToTarget: number
  shared: { toUnitId: string; amount: number } | null
  effects: ShotPreviewEffect[]
} | { ok: false; error: string }

function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function chebyshev(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

function getUnitAt(state: GameState, pos: { x: number; y: number }) {
  for (const u of Object.values(state.units)) {
    if (u.pos.x === pos.x && u.pos.y === pos.y) return u
  }
  return null
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

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function auraAppliesToAttacker(state: GameState, auraUnitId: string, attackerId: string, when: any, clan: string): boolean {
  const auraUnit = state.units[auraUnitId]
  const attacker = state.units[attackerId]
  if (!auraUnit || !attacker) return false
  if (auraUnit.side !== attacker.side) return false

  const type = String(when?.type ?? '')
  if (!type) return true

  if (type === 'ATTACKER_IN_PALACE') {
    return palaceContains(attacker.side, attacker.pos)
  }

  if (type === 'RESONANCE_ACTIVE') {
    const soulId = auraUnit.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const res = card?.abilities.find((a) => a.type === 'RESONANCE')
    const need = Number((res as any)?.need ?? 0)
    return isResonanceActive(state, auraUnit.id, need, clan)
  }

  return true
}

function alliesInPalaceCount(s: GameState, side: 'red' | 'black'): number {
  let n = 0
  for (const u of Object.values(s.units)) {
    if (u.side !== side) continue
    if (palaceContains(side, u.pos)) n++
  }
  return n
}

function findDamageSharer(s: GameState, targetSide: 'red' | 'black'): { unitId: string; amount: number } | null {
  const alliesInPalace = alliesInPalaceCount(s, targetSide)

  for (const u of Object.values(s.units).sort((a, b) => a.id.localeCompare(b.id))) {
    if (u.side !== targetSide) continue
    if (!palaceContains(targetSide, u.pos)) continue

    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    for (const ab of card.abilities) {
      if (ab.type !== 'DAMAGE_SHARE') continue
      const amount = Number((ab as any).amount ?? 0)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const when = (ab as any).when
      if (when && when.type === 'ALLIES_IN_PALACE_GTE') {
        const need = Number(when.count ?? 0)
        if (alliesInPalace < need) continue
      }
      return { unitId: u.id, amount }
    }
  }

  return null
}

export function buildShotPreview(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null): ShotPreview {
  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker) return { ok: false, error: 'Attacker not found' }
  if (!target) return { ok: false, error: 'Target not found' }

  const effects: ShotPreviewEffect[] = []

  const sacrificeBuff = state.status.sacrificeBuffByUnitId?.[attacker.id] ?? null

  let damageBonus = 0
  const attackerSoulId = attacker.enchant?.soulId
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      // Eternal Night: card-specific corpse thresholds (MVP)
      if (attackerSoulId === 'eternal_night_rook_guhua') {
        const corpses = countCorpses(state, attacker.side)
        if (corpses >= 6) {
          damageBonus += 2
          effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount: 2 })
        }
      }
      if (attackerSoulId === 'eternal_night_cannon_minggupao') {
        const corpses = countCorpses(state, attacker.side)
        if (corpses >= 4) {
          damageBonus += 1
          effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount: 1 })
        }
      }

      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      const crossedOk = !hasCrossRiver || crossedRiver(attacker.side, attacker.pos.y)

      if (crossedOk) {
        for (const ab of card.abilities) {
          if (ab.type !== 'DAMAGE_BONUS') continue
          const when = (ab as any).when
          if (when && String(when.type ?? '') === 'CORPSES_GTE') {
            const need = Number(when.count ?? 0)
            if (Number.isFinite(need) && need > 0) {
              const corpses = countCorpses(state, attacker.side)
              if (corpses < need) continue
            }
          }
          const amount = Number((ab as any).amount ?? 0)
          if (!Number.isFinite(amount) || amount <= 0) continue
          damageBonus += amount
        }
      }

      // NOTE: we already pushed individual DAMAGE_BONUS effects above; here we keep the existing
      // behavior for generic DAMAGE_BONUS abilities by adding one aggregate line for attacker-sourced bonus.
      const attackerSourced = card.abilities.some((a) => a.type === 'DAMAGE_BONUS')
      if (attackerSourced && damageBonus > 0) {
        effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount: damageBonus })
      }
    }
  }

  // AURA_DAMAGE_BONUS: from allied aura units (e.g. dark_moon_elephant_yueji)
  for (const u of Object.values(state.units)) {
    if (u.side !== attacker.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    for (const ab of card.abilities) {
      if (ab.type !== 'AURA_DAMAGE_BONUS') continue
      if (!auraAppliesToAttacker(state, u.id, attacker.id, (ab as any).when, card.clan)) continue

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
          damageBonus += amount
          effects.push({ kind: 'AURA_DAMAGE_BONUS', byUnitId: u.id, amount })
        }
        continue
      }

      const amount = Number((ab as any).amount ?? 0)
      if (Number.isFinite(amount) && amount > 0) {
        damageBonus += amount
        effects.push({ kind: 'AURA_DAMAGE_BONUS', byUnitId: u.id, amount })
      }
    }
  }

  const rawDamage = computeRawDamage(state, attacker.id, target.id)

  // Eternal Night: Sacrifice buffs (B)
  if (sacrificeBuff?.ignoreBlockingAll) {
    effects.push({ kind: 'IGNORE_BLOCKING_ALL', byUnitId: attacker.id })
  }
  const cap = Number((sacrificeBuff as any)?.damageBonusPerCorpsesCap ?? 0)
  if (Number.isFinite(cap) && cap > 0) {
    const corpses = countCorpses(state, attacker.side)
    const amount = Math.min(cap, Math.max(0, Math.floor(corpses)))
    if (amount > 0) effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount })
  }

  // TARGET_DEF_MINUS: preview transparency
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (String((ab as any).type ?? '') !== 'TARGET_DEF_MINUS') continue
        const onlyIfAtkKey = String((ab as any).onlyIfAtkKey ?? '')
        if (onlyIfAtkKey && onlyIfAtkKey !== attacker.atk.key) continue
        const key = String((ab as any).key ?? '')
        if (key !== 'phys' && key !== 'magic') continue
        const per = (ab as any).per
        if (!(per && String(per.type ?? '') === 'CORPSES_PER')) continue
        const perCount = Number(per.count ?? 0)
        const amountPer = Number((ab as any).amountPer ?? 0)
        if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue
        const corpses = countCorpses(state, attacker.side)
        const amount = Math.floor(corpses / perCount) * amountPer
        if (amount > 0) {
          effects.push({ kind: 'TARGET_DEF_MINUS', byUnitId: attacker.id, key: key as 'magic' | 'phys', amount })
        }
      }
    }
  }

  // PIERCE: mirror effects.ts PIERCE target selection for preview transparency.
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'PIERCE') continue

        const when = (ab as any).when
        if (when && String(when.type ?? '') === 'CORPSES_GTE') {
          const need = Number(when.count ?? 0)
          if (Number.isFinite(need) && need > 0) {
            const corpses = countCorpses(state, attacker.side)
            if (corpses < need) continue
          }
        }

        const mode = String((ab as any).mode ?? '')

        if (mode === 'CANNON_SCREEN_AND_TARGET') {
          if (attacker.base !== 'cannon') continue
          const dx = Math.sign(target.pos.x - attacker.pos.x)
          const dy = Math.sign(target.pos.y - attacker.pos.y)
          if (!((dx === 0 && dy !== 0) || (dy === 0 && dx !== 0))) continue

          const between: string[] = []
          for (let step = 1; step < 20; step++) {
            const pos = { x: attacker.pos.x + dx * step, y: attacker.pos.y + dy * step }
            if (pos.x < 0 || pos.x > 8 || pos.y < 0 || pos.y > 9) break
            if (pos.x === target.pos.x && pos.y === target.pos.y) break
            const hit = getUnitAt(state, pos)
            if (!hit) continue
            between.push(hit.id)
          }

          if (between.length !== 1) continue
          const screenId = between[0]
          const screen = screenId ? state.units[screenId] : null
          if (!screen) continue
          if (screen.side === attacker.side) continue
          effects.push({
            kind: 'PIERCE',
            byUnitId: attacker.id,
            mode: 'CANNON_SCREEN_AND_TARGET',
            targetUnitIds: [target.id, screen.id],
            fixedDamage: rawDamage,
          })
          continue
        }

        if (mode === 'LINE_ENEMIES') {
          const count = Number((ab as any).count ?? 0)
          if (!(Number.isFinite(count) && count > 1)) continue

          const dx = Math.sign(target.pos.x - attacker.pos.x)
          const dy = Math.sign(target.pos.y - attacker.pos.y)
          if (!((dx === 0 && dy !== 0) || (dy === 0 && dx !== 0))) continue

          const enemies: string[] = []
          for (let step = 1; step < 20; step++) {
            const pos = { x: attacker.pos.x + dx * step, y: attacker.pos.y + dy * step }
            if (pos.x < 0 || pos.x > 8 || pos.y < 0 || pos.y > 9) break
            const hit = getUnitAt(state, pos)
            if (!hit) continue
            if (hit.side === attacker.side) continue
            enemies.push(hit.id)
            if (enemies.length >= count) break
          }

          if (!enemies.includes(target.id)) continue
          effects.push({ kind: 'PIERCE', byUnitId: attacker.id, mode: 'LINE_ENEMIES', targetUnitIds: enemies, fixedDamage: rawDamage })
        }
      }
    }
  }

  // AURA_IGNORE_BLOCKING: from allied aura units (e.g. dark_moon_advisor_yeji)
  // This is implemented in effects.ts, so we mirror it here for preview transparency.
  for (const u of Object.values(state.units)) {
    if (u.side !== attacker.side) continue
    const soulId = u.enchant?.soulId
    if (!soulId) continue
    const card = getSoulCard(soulId)
    if (!card) continue

    for (const ab of card.abilities) {
      if (ab.type !== 'AURA_IGNORE_BLOCKING') continue
      if (!auraAppliesToAttacker(state, u.id, attacker.id, (ab as any).when, card.clan)) continue

      const forKey = String((ab as any).for ?? '')
      if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(attacker.side, attacker.pos.y)) continue

      const mode = String((ab as any).mode ?? '')
      if (mode === 'all') {
        effects.push({ kind: 'AURA_IGNORE_BLOCKING_ALL', byUnitId: u.id })
        continue
      }

      const count = Number((ab as any).count ?? 0)
      if (Number.isFinite(count) && count > 0) {
        effects.push({ kind: 'AURA_IGNORE_BLOCKING_COUNT', byUnitId: u.id, count })
      }
    }
  }

  // Note: we only show aura contributions; actual shoot legality uses the max across all effects.
  // We do NOT recompute legality here; we only expose the stack.

  // SPLASH: add extra instances around the target (enemy only), using fixedDamage equal to main rawDamage.
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      const crossedOk = !hasCrossRiver || crossedRiver(attacker.side, attacker.pos.y)
      if (crossedOk) {
        const splashAb = card.abilities.find((a) => a.type === 'SPLASH')
        const radius = Number((splashAb as any)?.radius ?? 0)
        if (Number.isFinite(radius) && radius > 0) {
          const splashTargets = Object.values(state.units)
            .filter((u) => u.side !== attacker.side)
            .filter((u) => u.id !== target.id)
            .filter((u) => chebyshev(u.pos, target.pos) <= radius)
            .map((u) => u.id)
            .sort((a, b) => a.localeCompare(b))

          if (splashTargets.length > 0) {
            effects.push({
              kind: 'SPLASH',
              byUnitId: attacker.id,
              radius,
              targetUnitIds: splashTargets,
              fixedDamage: rawDamage,
            })
          }
        }
      }
    }
  }

  // CHAIN: optionally add a single extra target chosen by UI, within radius of the main target.
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const chainAb = card.abilities.find((a) => a.type === 'CHAIN')
      const radius0 = Number((chainAb as any)?.radius ?? 0)
      const sbRadius = Number((sacrificeBuff as any)?.chainRadius ?? 0)
      const radius = Number.isFinite(sbRadius) && sbRadius > 0 ? sbRadius : radius0

      const when = (chainAb as any)?.when
      const chainActive = (() => {
        if (!when) return true
        if (Number.isFinite(sbRadius) && sbRadius > 0) return true
        if (String(when.type ?? '') !== 'CORPSES_GTE') return true
        const need = Number(when.count ?? 0)
        if (!(Number.isFinite(need) && need > 0)) return true
        const corpses = countCorpses(state, attacker.side)
        return corpses >= need
      })()

      const extraId = extraTargetUnitId ?? null
      if (chainActive && extraId && extraId !== target.id && Number.isFinite(radius) && radius > 0) {
        const extra = state.units[extraId]
        if (extra && extra.side !== attacker.side && chebyshev(extra.pos, target.pos) <= radius) {
          effects.push({ kind: 'CHAIN', byUnitId: attacker.id, targetUnitId: extra.id, fixedDamage: rawDamage })
        }
      }
    }
  }

  // Mirror current shoot validation effects (effects.ts): IGNORE_BLOCKING gated by CROSS_RIVER.
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const hasCrossRiver = card.abilities.some((a) => a.type === 'CROSS_RIVER')
      if (!hasCrossRiver || crossedRiver(attacker.side, attacker.pos.y)) {
        let ignoreAll = false
        let ignoreCount = 0
        for (const ab of card.abilities) {
          if (ab.type !== 'IGNORE_BLOCKING') continue
          const when = (ab as any).when
          if (when && String(when.type ?? '') === 'CORPSES_GTE') {
            const need = Number(when.count ?? 0)
            if (Number.isFinite(need) && need > 0) {
              const corpses = countCorpses(state, attacker.side)
              if (corpses < need) continue
            }
          }
          const mode = String((ab as any).mode ?? '')
          if (mode === 'all') {
            ignoreAll = true
          } else {
            const count = Number((ab as any).count ?? 0)
            if (Number.isFinite(count) && count > ignoreCount) ignoreCount = count
          }
        }
        if (ignoreAll) effects.push({ kind: 'IGNORE_BLOCKING_ALL', byUnitId: attacker.id })
        if (ignoreCount > 0) effects.push({ kind: 'IGNORE_BLOCKING_COUNT', byUnitId: attacker.id, count: ignoreCount })
      }
    }
  }

  let shared: { toUnitId: string; amount: number } | null = null
  const sharer = findDamageSharer(state, target.side)
  if (sharer && sharer.unitId !== target.id) {
    const sharedAmount = Math.max(0, Math.min(sharer.amount, rawDamage - 1))
    if (sharedAmount > 0) {
      shared = { toUnitId: sharer.unitId, amount: sharedAmount }
      effects.push({ kind: 'DAMAGE_SHARE', byUnitId: sharer.unitId, amount: sharedAmount })
    }
  }

  const damageToTarget = rawDamage - (shared?.amount ?? 0)

  return {
    ok: true,
    attackerId,
    targetUnitId,
    rawDamage,
    damageToTarget,
    shared,
    effects,
  }
}
