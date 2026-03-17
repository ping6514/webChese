import type { AttackEvadedEvent, AttackMissedEvent, DamageDealtEvent, Event } from './events'
import type { CombatUnit, FacingDir, GameState, HexPos } from './state'
import type { AttackClass, DamageType, ElementType, FacingSector } from '../game/schema'

export type DamageProfile = {
  baseDamage: number
  damageType: DamageType
  elementType: ElementType
  attackClass: AttackClass
  elementDamageRatio?: number
  canBackstab?: boolean
  guaranteedBackstab?: boolean
  alwaysMiss?: boolean
}

export type OneShotDefenseState = {
  evadeNextHit?: boolean
  evadeNextProjectile?: boolean
  negateNextDamage?: boolean
  reduceNextHitBy?: number
}

export type DefensiveProfile = OneShotDefenseState & {
  frontCoreDamageReduction?: number
  frontFlankDamageReduction?: number
  slashResist?: number
  pierceResist?: number
  impactResist?: number
  arcaneResist?: number
  fireResist?: number
  iceResist?: number
  lightningResist?: number
  windResist?: number
  lightResist?: number
  shadowResist?: number
  vulnerable?: number
  exposeSlash?: number
  exposePierce?: number
  exposeImpact?: number
}

export type DamageBreakdown = {
  physicalBase: number
  physicalAfterFacing: number
  physicalAfterResist: number
  elementBase: number
  elementAfterResist: number
  backstabBonusApplied: number
  mitigatedByOneShotDefense: number
  finalDamage: number
}

export type ResolvedDamage = {
  finalDamage: number
  damageType: DamageType
  elementType: ElementType
  facingSector: FacingSector
  isBackstab: boolean
  targetId: string
  sourceId: string
  outcome: 'hit' | 'evaded' | 'missed'
  breakdown: DamageBreakdown
}

const AXIAL_DIRECTIONS: readonly HexPos[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const

function subtractHex(a: HexPos, b: HexPos): HexPos {
  return { q: a.q - b.q, r: a.r - b.r }
}

function sameHex(a: HexPos, b: HexPos): boolean {
  return a.q === b.q && a.r === b.r
}

function getDirectionIndex(vector: HexPos): FacingDir | null {
  const found = AXIAL_DIRECTIONS.findIndex((dir) => sameHex(dir, vector))
  return found === -1 ? null : (found as FacingDir)
}

function normalizeRelativeDir(targetFacing: FacingDir, attackDir: FacingDir): number {
  return (attackDir - targetFacing + 6) % 6
}

export function getFacingSector(
  targetPos: HexPos,
  targetFacing: FacingDir,
  sourcePos: HexPos,
): FacingSector {
  const attackVector = subtractHex(sourcePos, targetPos)
  const attackDir = getDirectionIndex(attackVector)

  if (attackDir === null) return 'rear'

  const relative = normalizeRelativeDir(targetFacing, attackDir)

  if (relative === 0) return 'front_core'
  if (relative === 1 || relative === 5) return 'front_flank'
  return 'rear'
}

function getFrontReduction(sector: FacingSector, defense: DefensiveProfile): number {
  if (sector === 'front_core') return defense.frontCoreDamageReduction ?? 0
  if (sector === 'front_flank') return defense.frontFlankDamageReduction ?? 0
  return 0
}

function getPrimaryResist(damageType: DamageType, defense: DefensiveProfile): number {
  switch (damageType) {
    case 'slash':
      return defense.slashResist ?? 0
    case 'pierce':
      return defense.pierceResist ?? 0
    case 'impact':
      return defense.impactResist ?? 0
    case 'arcane':
      return defense.arcaneResist ?? 0
  }
}

function getExposeBonus(damageType: DamageType, defense: DefensiveProfile): number {
  switch (damageType) {
    case 'slash':
      return defense.exposeSlash ?? 0
    case 'pierce':
      return defense.exposePierce ?? 0
    case 'impact':
      return defense.exposeImpact ?? 0
    case 'arcane':
      return 0
  }
}

function getElementResist(elementType: ElementType, defense: DefensiveProfile): number {
  switch (elementType) {
    case 'none':
      return 0
    case 'fire':
      return defense.fireResist ?? 0
    case 'ice':
      return defense.iceResist ?? 0
    case 'lightning':
      return defense.lightningResist ?? 0
    case 'wind':
      return defense.windResist ?? 0
    case 'light':
      return defense.lightResist ?? 0
    case 'shadow':
      return defense.shadowResist ?? 0
  }
}

function isProjectileAttack(attackClass: AttackClass): boolean {
  return attackClass === 'projectile'
}

function resolveOneShotDefense(
  profile: DamageProfile,
  defense: DefensiveProfile,
): { cancelled: boolean; reason: 'evaded' | 'negated' | null; reductionFlat: number } {
  if (defense.negateNextDamage) {
    return { cancelled: true, reason: 'negated', reductionFlat: 0 }
  }

  if (defense.evadeNextHit) {
    return { cancelled: true, reason: 'evaded', reductionFlat: 0 }
  }

  if (isProjectileAttack(profile.attackClass) && defense.evadeNextProjectile) {
    return { cancelled: true, reason: 'evaded', reductionFlat: 0 }
  }

  return {
    cancelled: false,
    reason: null,
    reductionFlat: Math.max(0, defense.reduceNextHitBy ?? 0),
  }
}

export function resolveAttackDamage(
  attacker: CombatUnit,
  target: CombatUnit,
  profile: DamageProfile,
  defense: DefensiveProfile = {},
): ResolvedDamage {
  const facingSector = getFacingSector(target.pos, target.facing, attacker.pos)

  if (profile.alwaysMiss) {
    return {
      finalDamage: 0,
      damageType: profile.damageType,
      elementType: profile.elementType,
      facingSector,
      isBackstab: false,
      sourceId: attacker.id,
      targetId: target.id,
      outcome: 'missed',
      breakdown: {
        physicalBase: profile.baseDamage,
        physicalAfterFacing: 0,
        physicalAfterResist: 0,
        elementBase: 0,
        elementAfterResist: 0,
        backstabBonusApplied: 0,
        mitigatedByOneShotDefense: 0,
        finalDamage: 0,
      },
    }
  }

  const defenseResult = resolveOneShotDefense(profile, defense)

  if (defenseResult.cancelled) {
    return {
      finalDamage: 0,
      damageType: profile.damageType,
      elementType: profile.elementType,
      facingSector,
      isBackstab: false,
      sourceId: attacker.id,
      targetId: target.id,
      outcome: defenseResult.reason === 'evaded' ? 'evaded' : 'hit',
      breakdown: {
        physicalBase: profile.baseDamage,
        physicalAfterFacing: 0,
        physicalAfterResist: 0,
        elementBase: 0,
        elementAfterResist: 0,
        backstabBonusApplied: 0,
        mitigatedByOneShotDefense: profile.baseDamage,
        finalDamage: 0,
      },
    }
  }

  const vulnerableBonus = defense.vulnerable ?? 0
  const exposeBonus = getExposeBonus(profile.damageType, defense)
  const frontReduction = getFrontReduction(facingSector, defense)
  const primaryResist = getPrimaryResist(profile.damageType, defense)

  const isBackstab =
    (profile.guaranteedBackstab ?? false)
    || ((profile.canBackstab ?? true) && facingSector === 'rear')

  const backstabBonus = isBackstab ? 0.2 : 0

  const physicalBase = Math.max(0, profile.baseDamage)
  const physicalAfterFacing = physicalBase * (1 - frontReduction)
  const physicalAfterVulnerability = physicalAfterFacing * (1 + vulnerableBonus + exposeBonus + backstabBonus)
  const physicalAfterResist = physicalAfterVulnerability * (1 - primaryResist)

  const elementBase = profile.elementType === 'none'
    ? 0
    : profile.baseDamage * Math.max(0, profile.elementDamageRatio ?? 0)
  const elementAfterResist = elementBase * (1 - getElementResist(profile.elementType, defense))

  const totalBeforeFlatReduction = physicalAfterResist + elementAfterResist
  const finalDamage = Math.max(0, Math.ceil(totalBeforeFlatReduction - defenseResult.reductionFlat))

  return {
    finalDamage,
    damageType: profile.damageType,
    elementType: profile.elementType,
    facingSector,
    isBackstab,
    sourceId: attacker.id,
    targetId: target.id,
    outcome: 'hit',
    breakdown: {
      physicalBase,
      physicalAfterFacing,
      physicalAfterResist,
      elementBase,
      elementAfterResist,
      backstabBonusApplied: isBackstab ? backstabBonus : 0,
      mitigatedByOneShotDefense: defenseResult.reductionFlat,
      finalDamage,
    },
  }
}

export function applyResolvedDamage(
  state: GameState,
  resolved: ResolvedDamage,
): { newState: GameState; events: Event[] } {
  const target = state.units[resolved.targetId]
  if (!target || target.isDead) {
    return { newState: state, events: [] }
  }

  if (resolved.outcome === 'evaded') {
    const evadeEvent: AttackEvadedEvent = {
      type: 'ATTACK_EVADED',
      sourceId: resolved.sourceId,
      targetId: resolved.targetId,
      pos: target.pos,
    }

    return {
      newState: state,
      events: [evadeEvent],
    }
  }

  if (resolved.outcome === 'missed') {
    const missEvent: AttackMissedEvent = {
      type: 'ATTACK_MISSED',
      sourceId: resolved.sourceId,
      targetId: resolved.targetId,
      pos: target.pos,
    }

    return {
      newState: state,
      events: [missEvent],
    }
  }

  const nextHp = Math.max(0, target.hp - resolved.finalDamage)
  const nextUnit: CombatUnit = {
    ...target,
    hp: nextHp,
    isDead: nextHp <= 0,
  }

  const damageEvent: DamageDealtEvent = {
    type: 'DAMAGE_DEALT',
    sourceId: resolved.sourceId,
    targetId: resolved.targetId,
    amount: resolved.finalDamage,
    damageType: resolved.elementType !== 'none'
      ? `${resolved.damageType}+${resolved.elementType}`
      : resolved.damageType,
    isBackstab: resolved.isBackstab,
    pos: target.pos,
  }

  const events: Event[] = [damageEvent]

  if (nextUnit.isDead) {
    events.push({
      type: 'UNIT_DIED',
      unitId: nextUnit.id,
      killedById: resolved.sourceId,
      pos: nextUnit.pos,
    })
  }

  return {
    newState: {
      ...state,
      units: {
        ...state.units,
        [nextUnit.id]: nextUnit,
      },
    },
    events,
  }
}
