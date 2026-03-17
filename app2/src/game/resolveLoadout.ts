import type {
  CertDef,
  EffectModifierSet,
  GeneDef,
  LoadoutContext,
  LoadoutResolution,
  RaceTag,
  ResolvedGeneEffect,
  ToolDef,
  WeaponDef,
  WeaponMatchResult,
  WeaponModeEffect,
} from './schema'

function mergeEffectModifierSets(
  base: EffectModifierSet,
  extra: EffectModifierSet | null | undefined,
): EffectModifierSet {
  if (!extra) return { ...base }

  return {
    damageMult: (base.damageMult ?? 0) + (extra.damageMult ?? 0) || undefined,
    hpMult: (base.hpMult ?? 0) + (extra.hpMult ?? 0) || undefined,
    slashDamageMult: (base.slashDamageMult ?? 0) + (extra.slashDamageMult ?? 0) || undefined,
    pierceDamageMult: (base.pierceDamageMult ?? 0) + (extra.pierceDamageMult ?? 0) || undefined,
    impactDamageMult: (base.impactDamageMult ?? 0) + (extra.impactDamageMult ?? 0) || undefined,
    arcaneDamageMult: (base.arcaneDamageMult ?? 0) + (extra.arcaneDamageMult ?? 0) || undefined,
    zoneDamageMult: (base.zoneDamageMult ?? 0) + (extra.zoneDamageMult ?? 0) || undefined,
    castMult: (base.castMult ?? 0) + (extra.castMult ?? 0) || undefined,
    recoveryMult: (base.recoveryMult ?? 0) + (extra.recoveryMult ?? 0) || undefined,
    protectValueMult: (base.protectValueMult ?? 0) + (extra.protectValueMult ?? 0) || undefined,
    frontCoreDamageReduction: (base.frontCoreDamageReduction ?? 0) + (extra.frontCoreDamageReduction ?? 0) || undefined,
    frontFlankDamageReduction: (base.frontFlankDamageReduction ?? 0) + (extra.frontFlankDamageReduction ?? 0) || undefined,
    projectileDamageReduction: (base.projectileDamageReduction ?? 0) + (extra.projectileDamageReduction ?? 0) || undefined,
    slashResist: (base.slashResist ?? 0) + (extra.slashResist ?? 0) || undefined,
    pierceResist: (base.pierceResist ?? 0) + (extra.pierceResist ?? 0) || undefined,
    impactResist: (base.impactResist ?? 0) + (extra.impactResist ?? 0) || undefined,
    arcaneResist: (base.arcaneResist ?? 0) + (extra.arcaneResist ?? 0) || undefined,
    fireResist: (base.fireResist ?? 0) + (extra.fireResist ?? 0) || undefined,
    iceResist: (base.iceResist ?? 0) + (extra.iceResist ?? 0) || undefined,
    lightningResist: (base.lightningResist ?? 0) + (extra.lightningResist ?? 0) || undefined,
    windResist: (base.windResist ?? 0) + (extra.windResist ?? 0) || undefined,
    lightResist: (base.lightResist ?? 0) + (extra.lightResist ?? 0) || undefined,
    shadowResist: (base.shadowResist ?? 0) + (extra.shadowResist ?? 0) || undefined,
    burnResist: (base.burnResist ?? 0) + (extra.burnResist ?? 0) || undefined,
    bindResist: (base.bindResist ?? 0) + (extra.bindResist ?? 0) || undefined,
    shockResist: (base.shockResist ?? 0) + (extra.shockResist ?? 0) || undefined,
    healAfterOwnAction: (base.healAfterOwnAction ?? 0) + (extra.healAfterOwnAction ?? 0) || undefined,
    extraHealAfterProtect: (base.extraHealAfterProtect ?? 0) + (extra.extraHealAfterProtect ?? 0) || undefined,
    interruptAdd: (base.interruptAdd ?? 0) + (extra.interruptAdd ?? 0) || undefined,
    onBackHitDamageBonus: (base.onBackHitDamageBonus ?? 0) + (extra.onBackHitDamageBonus ?? 0) || undefined,
    zoneDurationAdd: (base.zoneDurationAdd ?? 0) + (extra.zoneDurationAdd ?? 0) || undefined,
    exposeSlashOnHitChance: (base.exposeSlashOnHitChance ?? 0) + (extra.exposeSlashOnHitChance ?? 0) || undefined,
    exposePierceOnHitChance: (base.exposePierceOnHitChance ?? 0) + (extra.exposePierceOnHitChance ?? 0) || undefined,
    exposeImpactOnHitChance: (base.exposeImpactOnHitChance ?? 0) + (extra.exposeImpactOnHitChance ?? 0) || undefined,
    interruptBonusVs: [...(base.interruptBonusVs ?? []), ...(extra.interruptBonusVs ?? [])],
    removeStatuses: [...(base.removeStatuses ?? []), ...(extra.removeStatuses ?? [])],
    applyStatus: extra.applyStatus ?? base.applyStatus,
    extraStatuses: [...(base.extraStatuses ?? []), ...(extra.extraStatuses ?? [])],
    evadeNextHit: extra.evadeNextHit || base.evadeNextHit || undefined,
    evadeNextProjectile: extra.evadeNextProjectile || base.evadeNextProjectile || undefined,
    negateNextDamage: extra.negateNextDamage || base.negateNextDamage || undefined,
    reduceNextHitBy: (base.reduceNextHitBy ?? 0) + (extra.reduceNextHitBy ?? 0) || undefined,
    interceptProjectileChance: (base.interceptProjectileChance ?? 0) + (extra.interceptProjectileChance ?? 0) || undefined,
    shieldValue: (base.shieldValue ?? 0) + (extra.shieldValue ?? 0) || undefined,
    teamDamageBuff: (base.teamDamageBuff ?? 0) + (extra.teamDamageBuff ?? 0) || undefined,
    durationActions: (base.durationActions ?? 0) + (extra.durationActions ?? 0) || undefined,
    area: extra.area ?? base.area,
  }
}

function mergeWeaponModeEffects(base: WeaponModeEffect, extra: WeaponModeEffect): WeaponModeEffect {
  return {
    damageMult: (base.damageMult ?? 1) * (extra.damageMult ?? 1),
    enableSelfAdvance: !!(base.enableSelfAdvance || extra.enableSelfAdvance),
    enablePush: !!(base.enablePush || extra.enablePush),
    enableSwap: !!(base.enableSwap || extra.enableSwap),
    enableProtectNeighbor: !!(base.enableProtectNeighbor || extra.enableProtectNeighbor),
    enableZoneBonus: !!(base.enableZoneBonus || extra.enableZoneBonus),
    extraInterruptTags: [...(base.extraInterruptTags ?? []), ...(extra.extraInterruptTags ?? [])],
    extraStatuses: [...(base.extraStatuses ?? []), ...(extra.extraStatuses ?? [])],
  }
}

function collectMatchedTags(cert: CertDef, preferredTags: RaceTag[]): RaceTag[] {
  return preferredTags.filter((tag) => cert.raceTags.includes(tag))
}

function buildBaseWeaponMode(def: WeaponDef): WeaponModeEffect {
  return {
    damageMult: def.baseMode.damageMult ?? 1,
    enableSelfAdvance: def.baseMode.enableSelfAdvance ?? false,
    enablePush: def.baseMode.enablePush ?? false,
    enableSwap: def.baseMode.enableSwap ?? false,
    enableProtectNeighbor: def.baseMode.enableProtectNeighbor ?? false,
    enableZoneBonus: def.baseMode.enableZoneBonus ?? false,
    extraInterruptTags: [...(def.baseMode.extraInterruptTags ?? [])],
    extraStatuses: [...(def.baseMode.extraStatuses ?? [])],
  }
}

export function resolveWeaponMatch(cert: CertDef, weapon: WeaponDef): WeaponMatchResult {
  const missingRequiredTags = weapon.requiredTags.filter((tag) => !cert.raceTags.includes(tag))
  const matchedFamily = weapon.preferredFamilies.includes(cert.family)
  const matchedTags = collectMatchedTags(cert, weapon.preferredTags)
  const baseEffect = buildBaseWeaponMode(weapon)

  const isPerfectMatch =
    missingRequiredTags.length === 0
    && matchedFamily
    && (weapon.preferredTags.length === 0 || matchedTags.length > 0)

  if (!isPerfectMatch) {
    return {
      mode: 'base_mode',
      matchedFamily,
      matchedTags,
      missingRequiredTags,
      effect: baseEffect,
    }
  }

  return {
    mode: 'perfect_match_mode',
    matchedFamily,
    matchedTags,
    missingRequiredTags: [],
    effect: mergeWeaponModeEffects(baseEffect, weapon.perfectMatchMode),
  }
}

export function resolveGeneEffect(cert: CertDef, gene: GeneDef): ResolvedGeneEffect {
  const synergyApplied = gene.compatibleFamilies.includes(cert.family) && !!gene.synergyEffect
  const finalEffect = synergyApplied
    ? mergeEffectModifierSets(gene.baseEffect, gene.synergyEffect)
    : { ...gene.baseEffect }

  return {
    geneId: gene.id,
    geneType: gene.geneType,
    baseEffect: { ...gene.baseEffect },
    synergyEffect: gene.synergyEffect ? { ...gene.synergyEffect } : null,
    finalEffect,
    synergyApplied,
  }
}

export function resolveGeneEffects(cert: CertDef, genes: GeneDef[]): ResolvedGeneEffect[] {
  return genes.map((gene) => resolveGeneEffect(cert, gene))
}

export function resolveLoadout(
  context: LoadoutContext,
  weapons: WeaponDef[],
  genes: GeneDef[],
  tools: ToolDef[],
): LoadoutResolution {
  return {
    certId: context.cert.id,
    resolvedWeapons: weapons.map((weapon) => ({
      weaponId: weapon.id,
      match: resolveWeaponMatch(context.cert, weapon),
    })),
    resolvedGenes: resolveGeneEffects(context.cert, genes),
    resolvedTools: tools,
  }
}
