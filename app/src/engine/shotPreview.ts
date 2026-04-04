import type { GameState } from './state'
import { getSoulCard, findAbility } from './cards'
import type { SoulAbilityCondition } from './cards'
import { computeRawDamage, computeDamageWithBreakdown } from './damage'
import { countCorpses, chebyshev } from './corpses'
import { palaceContains, crossedRiver } from './boardUtils'
import { isResonanceActive } from './stats'

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

export type DamageFormulaItem = {
  label: string
  amount: number | [number, number]
  isBonus: boolean
}

export type ShotPreview =
  | { ok: false; error: string }
  | {
      ok: true
      attackerId: string
      targetUnitId: string
      rawDamage: number
      damageToTarget: number
      shared: { toUnitId: string; amount: number } | null
      effects: ShotPreviewEffect[]
      damageFormula: {
        items: DamageFormulaItem[]
        resultMin: number
        resultMax: number
      }
      cost?: number
    }

function getUnitAt(state: GameState, pos: { x: number; y: number }) {
  for (const u of Object.values(state.units)) {
    if (u.pos.x === pos.x && u.pos.y === pos.y) return u
  }
  return null
}

function auraAppliesToAttacker(state: GameState, auraUnitId: string, attackerId: string, when: SoulAbilityCondition | undefined, clan: string): boolean {
  const auraUnit = state.units[auraUnitId]
  const attacker = state.units[attackerId]
  if (!auraUnit || !attacker) return false
  if (auraUnit.side !== attacker.side) return false

  const type = when?.type ?? ''
  if (!type) return true

  if (type === 'ATTACKER_IN_PALACE') {
    return palaceContains(attacker.side, attacker.pos)
  }

  if (type === 'RESONANCE_ACTIVE') {
    const soulId = auraUnit.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const res = findAbility(card?.abilities ?? [], 'RESONANCE')
    const need = Number(res?.need ?? 0)
    const resClan = String(res?.clan ?? '')
    return isResonanceActive(state, auraUnit.side, need, resClan || clan)
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
      const amount = Number(ab.amount)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const when = ab.when
      if (when?.type === 'ALLIES_IN_PALACE_GTE') {
        const need = Number(when.count)
        if (alliesInPalace < need) continue
      }
      return { unitId: u.id, amount }
    }
  }

  return null
}

export function buildShotPreview(state: GameState, attackerId: string, targetUnitId: string, extraTargetUnitId?: string | null, suppressPierce?: boolean): ShotPreview {
  const attacker = state.units[attackerId]
  const target = state.units[targetUnitId]
  if (!attacker) return { ok: false, error: '找不到攻擊者' }
  if (!target) return { ok: false, error: '找不到目標' }

  const effects: ShotPreviewEffect[] = []

  let cost = state.rules.shootManaCost
  const bsShotEffect =
    state.turnFlags.bloodSacrificeActiveShotEffect?.unitId === attacker.id
      ? state.turnFlags.bloodSacrificeActiveShotEffect.effect
      : null

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
      const crossed = crossedRiver(attacker.side, attacker.pos.y)

      for (const ab of card.abilities) {
        if (ab.type !== 'DAMAGE_BONUS') continue
        const when = ab.when
        if (when?.type === 'AFTER_CROSS_RIVER' && !crossed) continue
        if (!when?.type && hasCrossRiver && !crossed) continue

        if (when?.type === 'CORPSES_GTE') {
          const need = Number(when.count)
          if (Number.isFinite(need) && need > 0) {
            const corpses = countCorpses(state, attacker.side)
            if (corpses < need) continue
          }
        }
        if (when?.type === 'MOVED_THIS_TURN') {
          if (!state.turnFlags.movedThisTurn?.[attacker.id]) continue
        }
        if (when?.type === 'ENEMY_KILLED_THIS_TURN_GTE') {
          const need = Number(when.count)
          const cur = Number(state.turnFlags.enemyKilledThisTurnCount ?? 0)
          if (!(Number.isFinite(need) && need > 0)) continue
          if (cur < need) continue
        }

        const amount = Number(ab.amount ?? 0)
        if (!Number.isFinite(amount) || amount <= 0) continue
        damageBonus += amount
      }

      // NOTE: we already pushed individual DAMAGE_BONUS effects above; here we keep the existing
      // behavior for generic DAMAGE_BONUS abilities by adding one aggregate line for attacker-sourced bonus.
      const attackerSourced = card.abilities.some((a) => a.type === 'DAMAGE_BONUS')
      if (attackerSourced && damageBonus > 0) {
        effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount: damageBonus })
      }
    }
  }

  if (bsShotEffect && String(bsShotEffect.type ?? '') === 'DAMAGE_BONUS') {
    const targetWhen = bsShotEffect.targetWhen as { type: string } | undefined
    const targetOk =
      !targetWhen
      || (targetWhen.type === 'TARGET_IN_PALACE' && palaceContains(target.side, target.pos))
      || (targetWhen.type === 'TARGET_CROSS_RIVER' && crossedRiver(target.side, target.pos.y))
    const amount = Number(bsShotEffect.amount ?? 0)
    if (targetOk && Number.isFinite(amount) && amount > 0) {
      effects.push({ kind: 'DAMAGE_BONUS', byUnitId: attacker.id, amount })
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
      if (ab.type !== 'AURA_DAMAGE_BONUS' && ab.type !== 'AURA_DAMAGE_MODIFIER') continue
      if (!auraAppliesToAttacker(state, u.id, attacker.id, ab.when, card.clan)) continue

      const forRaw = ab.for
      const forKeys = Array.isArray(forRaw)
        ? (forRaw as unknown[]).map((x) => String(x ?? '')).filter(Boolean)
        : [String(forRaw ?? '')].filter(Boolean)
      let ok = true
      for (const forKey of forKeys) {
        if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(attacker.side, attacker.pos.y)) {
          ok = false; break
        }
        if (forKey === 'CLAN') {
          const clan = ab.type === 'AURA_DAMAGE_BONUS' ? String(ab.clan ?? '') : ''
          if (!clan) { ok = false; break }
          const attackerCard = attacker.enchant?.soulId ? getSoulCard(attacker.enchant.soulId) : undefined
          if (!attackerCard || attackerCard.clan !== clan) { ok = false; break }
          const excludeBase = ab.type === 'AURA_DAMAGE_BONUS' ? String(ab.excludeBase ?? '') : ''
          if (excludeBase && attacker.base === excludeBase) { ok = false; break }
        }
      }
      if (!ok) continue

      const per = ab.type === 'AURA_DAMAGE_BONUS' ? ab.per : undefined
      if (per?.type === 'CORPSES_PER' && ab.type === 'AURA_DAMAGE_BONUS') {
        const perCount = Number(per.count)
        const amountPer = Number(ab.amountPer ?? 0)
        if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue
        const corpses = countCorpses(state, attacker.side)
        const amount = Math.floor(corpses / perCount) * amountPer
        if (amount > 0) {
          damageBonus += amount
          effects.push({ kind: 'AURA_DAMAGE_BONUS', byUnitId: u.id, amount })
        }
        continue
      }

      const amount = Number(ab.amount ?? 0)
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
  const cap = Number(sacrificeBuff?.damageBonusPerCorpsesCap ?? 0)
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
        if (ab.type !== 'TARGET_DEF_MINUS') continue
        if (ab.onlyIfAtkKey && ab.onlyIfAtkKey !== attacker.atk.key) continue
        const per = ab.per
        if (!(per?.type === 'CORPSES_PER')) continue
        const perCount = Number(per.count)
        const amountPer = Number(ab.amountPer ?? 0)
        if (!(Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0)) continue
        const corpses = countCorpses(state, attacker.side)
        const amount = Math.floor(corpses / perCount) * amountPer
        if (amount > 0) {
          effects.push({ kind: 'TARGET_DEF_MINUS', byUnitId: attacker.id, key: ab.key, amount })
        }
      }
    }
  }
  if (bsShotEffect && String(bsShotEffect.type ?? '') === 'TARGET_DEF_MINUS') {
    const onlyIfAtkKey = String(bsShotEffect.onlyIfAtkKey ?? '')
    if (!onlyIfAtkKey || onlyIfAtkKey === attacker.atk.key) {
      const key = String(bsShotEffect.key ?? '')
      if (key === 'phys' || key === 'magic') {
        let amount = 0
        const per = bsShotEffect.per as { type: string; count: number } | undefined
        if (per?.type === 'CORPSES_PER') {
          const perCount = Number(per.count)
          const amountPer = Number(bsShotEffect.amountPer ?? 0)
          if (Number.isFinite(perCount) && perCount > 0 && Number.isFinite(amountPer) && amountPer > 0) {
            const corpses = countCorpses(state, attacker.side)
            amount = Math.floor(corpses / perCount) * amountPer
          }
        } else {
          amount = Number(bsShotEffect.amount ?? 0)
        }
        if (Number.isFinite(amount) && amount > 0) {
          effects.push({ kind: 'TARGET_DEF_MINUS', byUnitId: attacker.id, key: key as 'magic' | 'phys', amount })
        }
      }
    }
  }

  // PIERCE: mirror effects.ts PIERCE target selection for preview transparency.
  if (!suppressPierce && attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (ab.type !== 'PIERCE') continue

        if (ab.when?.type === 'CORPSES_GTE') {
          const need = Number(ab.when.count)
          if (Number.isFinite(need) && need > 0) {
            const corpses = countCorpses(state, attacker.side)
            if (corpses < need) continue
          }
        }

        const mode = ab.mode

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
          const count = Number(ab.count ?? 0)
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
      if (!auraAppliesToAttacker(state, u.id, attacker.id, ab.when, card.clan)) continue

      const forKey = ab.for ?? ''
      if (forKey === 'CROSS_RIVER_UNITS' && !crossedRiver(attacker.side, attacker.pos.y)) continue

      const count = Number(ab.count ?? 0)
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
      const splashAb = findAbility(card.abilities, 'SPLASH')
      if (splashAb) {
        const whenType = splashAb.when?.type ?? ''
        const crossed = crossedRiver(attacker.side, attacker.pos.y)
        // Data-driven gate
        if (whenType === 'AFTER_CROSS_RIVER' && !crossed) {
          // not active
        } else {
          const radius = Number(splashAb.radius)
          if (Number.isFinite(radius) && radius > 0) {
            const fixedDamage = Number(splashAb.fixedDamage ?? 0)
            const hasFixed = Number.isFinite(fixedDamage) && fixedDamage > 0
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
                fixedDamage: hasFixed ? Math.floor(fixedDamage) : rawDamage,
              })
            }
          }
        }
      }
    }
  }

  // CHAIN: optionally add a single extra target chosen by UI, within radius of the main target.
  if (attackerSoulId && extraTargetUnitId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      const chainAb = findAbility(card.abilities, 'CHAIN')
      const radius0 = Number(chainAb?.radius ?? 0)
      const sbRadius = Number(sacrificeBuff?.chainRadius ?? 0)
      const radius = Number.isFinite(sbRadius) && sbRadius > 0 ? sbRadius : radius0

      const chainWhen = chainAb?.when
      const chainActive = (() => {
        if (!chainWhen) return true
        if (Number.isFinite(sbRadius) && sbRadius > 0) return true
        if (chainWhen.type !== 'CORPSES_GTE') return true
        const need = Number(chainWhen.count)
        if (!(Number.isFinite(need) && need > 0)) return true
        const corpses = countCorpses(state, attacker.side)
        return corpses >= need
      })()

      const extraId = extraTargetUnitId ?? null
      if (chainActive && extraId && extraId !== target.id && Number.isFinite(radius) && radius > 0) {
        const extra = state.units[extraId]
        if (extra && extra.side !== attacker.side && chebyshev(extra.pos, target.pos) <= radius) {
          const manaCost = Number(chainAb?.manaCost ?? 0)
          if (Number.isFinite(manaCost) && manaCost > 0) {
            cost += Math.floor(manaCost)
          }
          const sbFixed = Number(sacrificeBuff?.chainFixedDamage ?? 0)
          const sbMult = Number(sacrificeBuff?.chainDamageMultiplier ?? 0)
          const dmg = (Number.isFinite(sbFixed) && sbFixed > 0)
            ? Math.floor(sbFixed)
            : (Number.isFinite(sbMult) && sbMult > 0)
              ? Math.max(0, Math.floor(rawDamage * sbMult))
              : rawDamage
          effects.push({ kind: 'CHAIN', byUnitId: attacker.id, targetUnitId: extra.id, fixedDamage: dmg })
        }
      }
    }
  }
  if (bsShotEffect && String(bsShotEffect.type ?? '') === 'CHAIN' && extraTargetUnitId) {
    const requiresManaGte = Number(bsShotEffect.requiresManaGte ?? 0)
    if (!(Number.isFinite(requiresManaGte) && requiresManaGte > 0) || state.resources[attacker.side].mana >= requiresManaGte) {
      const extraId = extraTargetUnitId ?? null
      const radius = Number(bsShotEffect.radius ?? 0)
      if (extraId && extraId !== target.id && Number.isFinite(radius) && radius > 0) {
        const extra = state.units[extraId]
        if (extra && extra.side !== attacker.side && chebyshev(extra.pos, target.pos) <= radius) {
          const manaCost = Number(bsShotEffect.manaCost ?? 0)
          if (Number.isFinite(manaCost) && manaCost > 0) {
            cost += Math.floor(manaCost)
          }
          effects.push({ kind: 'CHAIN', byUnitId: attacker.id, targetUnitId: extra.id, fixedDamage: rawDamage })
        }
      }
    }
  }

  // Mirror current shoot validation effects (effects.ts): IGNORE_BLOCKING gated by CROSS_RIVER.
  if (attackerSoulId) {
    const card = getSoulCard(attackerSoulId)
    if (card) {
      let ignoreAll = false
      let ignoreCount = 0
      for (const ab of card.abilities) {
        if (ab.type !== 'IGNORE_BLOCKING') continue

        const whenType = String(ab.when?.type ?? '')
        const crossed = crossedRiver(attacker.side, attacker.pos.y)
        if (whenType === 'AFTER_CROSS_RIVER' && !crossed) continue

        if (ab.when?.type === 'CORPSES_GTE') {
          const need = Number(ab.when.count)
          if (Number.isFinite(need) && need > 0) {
            const corpses = countCorpses(state, attacker.side)
            if (corpses < need) continue
          }
        }
        const mode = String(ab.mode ?? '')
        if (mode === 'all') {
          ignoreAll = true
        } else {
          const count = Number(ab.count ?? 0)
          if (Number.isFinite(count) && count > ignoreCount) ignoreCount = count
        }
      }
      if (ignoreAll) effects.push({ kind: 'IGNORE_BLOCKING_ALL', byUnitId: attacker.id })
      if (ignoreCount > 0) effects.push({ kind: 'IGNORE_BLOCKING_COUNT', byUnitId: attacker.id, count: ignoreCount })
    }
  }

  if (!suppressPierce && bsShotEffect && String(bsShotEffect.type ?? '') === 'PIERCE') {
    const requiresManaGte = Number(bsShotEffect.requiresManaGte ?? 0)
    if (!(Number.isFinite(requiresManaGte) && requiresManaGte > 0) || state.resources[attacker.side].mana >= requiresManaGte) {
      const manaCost = Number(bsShotEffect.manaCost ?? 0)
      if (Number.isFinite(manaCost) && manaCost > 0) cost += Math.floor(manaCost)
      const mode = String(bsShotEffect.mode ?? '')
      if (mode === 'LINE_ENEMIES') {
        const count = Number(bsShotEffect.count ?? 0)
        if (Number.isFinite(count) && count > 1) {
          const dx = Math.sign(target.pos.x - attacker.pos.x)
          const dy = Math.sign(target.pos.y - attacker.pos.y)
          if ((dx === 0 && dy !== 0) || (dy === 0 && dx !== 0)) {
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
            if (enemies.includes(target.id)) {
              effects.push({ kind: 'PIERCE', byUnitId: attacker.id, mode: 'LINE_ENEMIES', targetUnitIds: enemies, fixedDamage: rawDamage })
            }
          }
        }
      }
    }
  }

  if (bsShotEffect && String(bsShotEffect.type ?? '') === 'IGNORE_BLOCKING') {
    const requiresManaGte = Number(bsShotEffect.requiresManaGte ?? 0)
    if (!(Number.isFinite(requiresManaGte) && requiresManaGte > 0) || state.resources[attacker.side].mana >= requiresManaGte) {
      const manaCost = Number(bsShotEffect.manaCost ?? 0)
      if (Number.isFinite(manaCost) && manaCost > 0) cost += Math.floor(manaCost)
      const mode = String(bsShotEffect.mode ?? '')
      if (mode === 'all') effects.push({ kind: 'IGNORE_BLOCKING_ALL', byUnitId: attacker.id })
      else {
        const count = Number(bsShotEffect.count ?? 0)
        if (Number.isFinite(count) && count > 0) effects.push({ kind: 'IGNORE_BLOCKING_COUNT', byUnitId: attacker.id, count })
      }
    }
  }

  let shared: { toUnitId: string; amount: number } | null = null
  const sharer = findDamageSharer(state, target.side)
  if (sharer && sharer.unitId !== target.id) {
    const shareUnit = state.units[sharer.unitId]
    const want = Math.floor(Number(sharer.amount ?? 0))
    const canFromDamage = Number.isFinite(want) && want > 0 && rawDamage - 1 >= want
    const canFromHp = !!shareUnit && shareUnit.hpCurrent - want >= 1
    if (canFromDamage && canFromHp) {
      shared = { toUnitId: sharer.unitId, amount: want }
      effects.push({ kind: 'DAMAGE_SHARE', byUnitId: sharer.unitId, amount: want })
    }
  }

  const damageToTarget = rawDamage - (shared?.amount ?? 0)

  // Build damage formula for UI display (5-D)
  const isFixedDice = state.rules.diceFixed > 0
  const diceRef = isFixedDice ? state.rules.diceFixed : 1
  const { breakdown: formulaBreakdown } = computeDamageWithBreakdown(state, attacker.id, target.id, diceRef)
  const resultMin = isFixedDice ? rawDamage : computeDamageWithBreakdown(state, attacker.id, target.id, 1).damage
  const resultMax = isFixedDice ? rawDamage : computeDamageWithBreakdown(state, attacker.id, target.id, 6).damage
  const formulaItems: DamageFormulaItem[] = formulaBreakdown.map((item) => {
    if (item.label.startsWith('1d6(')) {
      return {
        label: isFixedDice ? item.label : '1d6',
        amount: isFixedDice ? item.amount : ([1, 6] as [number, number]),
        isBonus: true,
      }
    }
    return { label: item.label, amount: item.amount, isBonus: item.amount > 0 }
  })

  return {
    ok: true,
    attackerId,
    targetUnitId,
    rawDamage,
    damageToTarget,
    shared,
    effects,
    damageFormula: { items: formulaItems, resultMin, resultMax },
    cost,
  }
}
