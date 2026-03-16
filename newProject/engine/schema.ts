export type CertFamily = 'fang' | 'membrane' | 'weave'

export type CertTier = 1 | 2 | 3

export type CombatRole = 'striker' | 'protector' | 'controller' | 'boss'

export type RaceTag =
  | 'has_claws'
  | 'has_tail'
  | 'has_wings'
  | 'gel_body'
  | 'has_horns'
  | 'forest_apex'

export type WeaponStyleTag =
  | 'dash'
  | 'backstab'
  | 'guard'
  | 'bind'
  | 'shot'
  | 'blast'
  | 'interrupt_heavy'
  | 'interrupt_projectile'

export type InterruptTag =
  | 'light_cast'
  | 'heavy_cast'
  | 'projectile_cast'
  | 'zone_cast'
  | 'guard_cast'

export type DamageType =
  | 'slash'
  | 'pierce'
  | 'impact'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'wind'
  | 'light'
  | 'shadow'

export type ScalingStat = 'STR' | 'AGI' | 'INT'

export type WeaponModeKind = 'base_mode' | 'perfect_match_mode'

export type GeneType = 'exclusive' | 'generic'

export type ToolType = 'burst' | 'defense' | 'utility' | 'control' | 'tempo'

export type StatusId =
  | 'burn'
  | 'shock'
  | 'chill'
  | 'bind'
  | 'vulnerable'
  | 'expose_slash'
  | 'expose_pierce'
  | 'expose_impact'
  | 'guarded'
  | 'intercept'
  | 'slow'
  | 'guard_break'

export type CertStats = {
  hp: number
  move: number
  str: number
  agi: number
  int: number
}

export type WeaponSlotProfile = {
  tempo: number
  tactical: number
  enchant: number
}

export type EffectModifierSet = {
  damageMult?: number
  hpMult?: number
  slashDamageMult?: number
  pierceDamageMult?: number
  impactDamageMult?: number
  zoneDamageMult?: number
  castMult?: number
  recoveryMult?: number
  protectValueMult?: number
  frontDamageReduction?: number
  projectileDamageReduction?: number
  burnResist?: number
  bindResist?: number
  shockResist?: number
  healAfterOwnAction?: number
  extraHealAfterProtect?: number
  interruptAdd?: number
  onBackHitDamageBonus?: number
  zoneDurationAdd?: number
  exposeSlashOnHitChance?: number
  exposeImpactOnHitChance?: number
  interruptBonusVs?: InterruptTag[]
  removeStatuses?: StatusId[]
  applyStatus?: StatusId
  extraStatuses?: StatusId[]
  shieldValue?: number
  teamDamageBuff?: number
  durationActions?: number
}

export type CertDef = {
  id: string
  name: string
  family: CertFamily
  tier: CertTier
  raceTags: RaceTag[]
  combatRole: CombatRole
  baseStats: CertStats
  weaponSlots: number
  exclusiveGeneOptions: string[]
  genericGeneSlots: number
  toolSlots: number
  specializedInterruptTags: InterruptTag[]
  weaponStyleTags: WeaponStyleTag[]
  notes?: string
}

export type WeaponModeEffect = {
  damageMult?: number
  enableSelfAdvance?: boolean
  enablePush?: boolean
  enableSwap?: boolean
  enableProtectNeighbor?: boolean
  enableZoneBonus?: boolean
  extraInterruptTags?: InterruptTag[]
  extraStatuses?: StatusId[]
}

export type WeaponDef = {
  id: string
  name: string
  familyHint?: CertFamily
  weaponType: string
  damageType: DamageType
  elementType: DamageType | 'none'
  statScaling: ScalingStat
  actionTags: WeaponStyleTag[]
  requiredTags: RaceTag[]
  preferredFamilies: CertFamily[]
  preferredTags: RaceTag[]
  baseCast: number
  baseRecovery: number
  baseDamage: number
  baseInterrupt: number
  baseMode: WeaponModeEffect
  perfectMatchMode: WeaponModeEffect
  slotProfile: WeaponSlotProfile
  notes?: string
}

export type GeneDef = {
  id: string
  name: string
  geneType: GeneType
  ownerCertId?: string
  compatibleFamilies: CertFamily[]
  baseEffect: EffectModifierSet
  synergyEffect: EffectModifierSet | null
  notes?: string
}

export type ToolDef = {
  id: string
  name: string
  toolType: ToolType
  charges: number
  timing: 'combat' | 'run'
  effectSummary: EffectModifierSet
  notes?: string
}

export type LoadoutContext = {
  cert: CertDef
  equippedGeneIds: string[]
  equippedToolIds: string[]
}

export type WeaponMatchResult = {
  mode: WeaponModeKind
  matchedFamily: boolean
  matchedTags: RaceTag[]
  missingRequiredTags: RaceTag[]
  effect: WeaponModeEffect
}

export type ResolvedGeneEffect = {
  geneId: string
  geneType: GeneType
  baseEffect: EffectModifierSet
  synergyEffect: EffectModifierSet | null
  finalEffect: EffectModifierSet
  synergyApplied: boolean
}

export type LoadoutResolution = {
  certId: string
  resolvedWeapons: Array<{
    weaponId: string
    match: WeaponMatchResult
  }>
  resolvedGenes: ResolvedGeneEffect[]
  resolvedTools: ToolDef[]
}
