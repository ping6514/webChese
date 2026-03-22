export type BloodlineFamily = 'fang' | 'membrane' | 'weave'

export type BloodlineTier = 1 | 2 | 3

export type CombatRole = 'striker' | 'protector' | 'controller' | 'boss'

export type RaceTag =
  | 'has_claws'
  | 'has_tail'
  | 'has_wings'
  | 'gel_body'
  | 'has_horns'
  | 'has_shell'
  | 'has_venom'
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
  | 'arcane'

export type ElementType =
  | 'none'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'wind'
  | 'light'
  | 'shadow'

export type AttackClass =
  | 'melee'
  | 'projectile'
  | 'zone'
  | 'breath'
  | 'arcane_cast'

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

export type FacingSector =
  | 'front_core'
  | 'front_flank'
  | 'side'
  | 'rear'
  | 'rear_core'

export type AreaPattern =
  | 'front_1'
  | 'front_arc_3'
  | 'line_2'
  | 'radius_1'
  | 'cross_1'

export type AreaKind =
  | 'directed_attack'
  | 'ground_hazard'

export type AreaCell = {
  q: number
  r: number
}

export type DirectedAttackArea = {
  kind: 'directed_attack'
  origin: AreaCell
  facing: number
  pattern: AreaPattern
  warningCells: AreaCell[]
}

export type GroundHazardArea = {
  kind: 'ground_hazard'
  center: AreaCell
  pattern: AreaPattern
  warningCells: AreaCell[]
  durationMs?: number
  tickMs?: number
}

export type DamageArea = DirectedAttackArea | GroundHazardArea

export type BloodlineStats = {
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
  arcaneDamageMult?: number
  zoneDamageMult?: number
  castMult?: number
  recoveryMult?: number
  protectValueMult?: number
  frontCoreDamageReduction?: number
  frontFlankDamageReduction?: number
  projectileDamageReduction?: number
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
  burnResist?: number
  bindResist?: number
  shockResist?: number
  healAfterOwnAction?: number
  extraHealAfterProtect?: number
  interruptAdd?: number
  onBackHitDamageBonus?: number
  zoneDurationAdd?: number
  exposeSlashOnHitChance?: number
  exposePierceOnHitChance?: number
  exposeImpactOnHitChance?: number
  interruptBonusVs?: InterruptTag[]
  removeStatuses?: StatusId[]
  applyStatus?: StatusId
  extraStatuses?: StatusId[]
  evadeNextHit?: boolean
  evadeNextProjectile?: boolean
  negateNextDamage?: boolean
  reduceNextHitBy?: number
  interceptProjectileChance?: number
  shieldValue?: number
  teamDamageBuff?: number
  durationActions?: number
  area?: 'small' | 'medium' | 'large'
}

export type BloodlineDef = {
  id: string
  name: string
  family: BloodlineFamily
  tier: BloodlineTier
  raceTags: RaceTag[]
  combatRole: CombatRole
  baseStats: BloodlineStats
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
  description?: string
  familyHint?: BloodlineFamily
  weaponType: string
  damageType: DamageType
  elementType: ElementType
  attackClass: AttackClass
  statScaling: ScalingStat
  actionTags: WeaponStyleTag[]
  requiredTags: RaceTag[]
  preferredFamilies: BloodlineFamily[]
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
  description?: string
  geneType: GeneType
  ownerBloodlineId?: string
  compatibleFamilies: BloodlineFamily[]
  baseEffect: EffectModifierSet
  synergyEffect: EffectModifierSet | null
  notes?: string
}

export type ToolDef = {
  id: string
  name: string
  description?: string
  toolType: ToolType
  charges: number
  timing: 'combat' | 'run'
  effectSummary: EffectModifierSet
  notes?: string
}

export type LoadoutContext = {
  bloodline: BloodlineDef
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
  bloodlineId: string
  resolvedWeapons: Array<{
    weaponId: string
    match: WeaponMatchResult
  }>
  resolvedGenes: ResolvedGeneEffect[]
  resolvedTools: ToolDef[]
}
