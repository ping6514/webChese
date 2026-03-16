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
    zoneDamageMult: (base.zoneDamageMult ?? 0) + (extra.zoneDamageMult ?? 0) || undefined,
    castMult: (base.castMult ?? 0) + (extra.castMult ?? 0) || undefined,
    recoveryMult: (base.recoveryMult ?? 0) + (extra.recoveryMult ?? 0) || undefined,
    protectValueMult: (base.protectValueMult ?? 0) + (extra.protectValueMult ?? 0) || undefined,
    frontDamageReduction: (base.frontDamageReduction ?? 0) + (extra.frontDamageReduction ?? 0) || undefined,
    projectileDamageReduction: (base.projectileDamageReduction ?? 0) + (extra.projectileDamageReduction ?? 0) || undefined,
    burnResist: (base.burnResist ?? 0) + (extra.burnResist ?? 0) || undefined,
    bindResist: (base.bindResist ?? 0) + (extra.bindResist ?? 0) || undefined,
    shockResist: (base.shockResist ?? 0) + (extra.shockResist ?? 0) || undefined,
    healAfterOwnAction: (base.healAfterOwnAction ?? 0) + (extra.healAfterOwnAction ?? 0) || undefined,
    extraHealAfterProtect: (base.extraHealAfterProtect ?? 0) + (extra.extraHealAfterProtect ?? 0) || undefined,
    interruptAdd: (base.interruptAdd ?? 0) + (extra.interruptAdd ?? 0) || undefined,
    onBackHitDamageBonus: (base.onBackHitDamageBonus ?? 0) + (extra.onBackHitDamageBonus ?? 0) || undefined,
    zoneDurationAdd: (base.zoneDurationAdd ?? 0) + (extra.zoneDurationAdd ?? 0) || undefined,
    exposeSlashOnHitChance: (base.exposeSlashOnHitChance ?? 0) + (extra.exposeSlashOnHitChance ?? 0) || undefined,
    exposeImpactOnHitChance: (base.exposeImpactOnHitChance ?? 0) + (extra.exposeImpactOnHitChance ?? 0) || undefined,
    interruptBonusVs: [...(base.interruptBonusVs ?? []), ...(extra.interruptBonusVs ?? [])],
    removeStatuses: [...(base.removeStatuses ?? []), ...(extra.removeStatuses ?? [])],
    applyStatus: extra.applyStatus ?? base.applyStatus,
    extraStatuses: [...(base.extraStatuses ?? []), ...(extra.extraStatuses ?? [])],
    shieldValue: (base.shieldValue ?? 0) + (extra.shieldValue ?? 0) || undefined,
    teamDamageBuff: (base.teamDamageBuff ?? 0) + (extra.teamDamageBuff ?? 0) || undefined,
    durationActions: (base.durationActions ?? 0) + (extra.durationActions ?? 0) || undefined,
  }
}

function mergeWeaponModeEffects(base: WeaponModeEffect, extra: WeaponModeEffect): WeaponModeEffect {
  return {
    damageMult: (base.damageMult ?? 1) * (extra.damageMult ?? 1),
    enableSelfAdvance: base.enableSelfAdvance || extra.enableSelfAdvance,
    enablePush: base.enablePush || extra.enablePush,
    enableSwap: base.enableSwap || extra.enableSwap,
    enableProtectNeighbor: base.enableProtectNeighbor || extra.enableProtectNeighbor,
    enableZoneBonus: base.enableZoneBonus || extra.enableZoneBonus,
    extraInterruptTags: [...(base.extraInterruptTags ?? []), ...(extra.extraInterruptTags ?? [])],
    extraStatuses: [...(base.extraStatuses ?? []), ...(extra.extraStatuses ?? [])],
  }
}

function hasAllRequiredTags(cert: CertDef, requiredTags: RaceTag[]): boolean {
  return requiredTags.every((tag) => cert.raceTags.includes(tag))
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
    missingRequiredTags.length === 0 &&
    matchedFamily &&
    (weapon.preferredTags.length === 0 || matchedTags.length > 0)

  if (!hasAllRequiredTags(cert, weapon.requiredTags)) {
    return {
      mode: 'base_mode',
      matchedFamily,
      matchedTags,
      missingRequiredTags,
      effect: baseEffect,
    }
  }

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
