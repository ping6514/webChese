import type {
  CertDef,
  GeneDef,
  ToolDef,
  WeaponDef,
} from './schema'

export const demoCerts: CertDef[] = [
  {
  id: 'cert_wolf_guard',
  name: '狼衛證',
  family: 'fang',
  tier: 2,
  raceTags: ['has_claws', 'has_tail', 'forest_apex'],
  combatRole: 'protector',
  baseStats: {
    hp: 140,
    move: 4,
    str: 12,
    agi: 9,
    int: 5,
  },
  weaponSlots: 2,
  exclusiveGeneOptions: ['gene_pack_guard', 'gene_predator_step'],
  genericGeneSlots: 2,
  toolSlots: 2,
  specializedInterruptTags: ['guard_cast', 'heavy_cast'],
  weaponStyleTags: ['guard', 'dash', 'interrupt_heavy'],
  notes: '偏前排、反打、護衛隊友。',
  },
  {
    id: 'cert_moth_oracle',
    name: '蛾翼司祭證',
    family: 'membrane',
    tier: 2,
    raceTags: ['has_wings'],
    combatRole: 'controller',
    baseStats: {
      hp: 108,
      move: 5,
      str: 5,
      agi: 10,
      int: 13,
    },
    weaponSlots: 2,
    exclusiveGeneOptions: ['gene_dust_prayer'],
    genericGeneSlots: 2,
    toolSlots: 2,
    specializedInterruptTags: ['light_cast', 'zone_cast'],
    weaponStyleTags: ['shot', 'blast'],
    notes: '偏後排與場控。',
  },
]

export const demoCert = demoCerts[0]

export const demoWeapons: WeaponDef[] = [
  {
    id: 'weapon_fang_halberd',
    name: '獵牙戟',
    familyHint: 'fang',
    weaponType: 'halberd',
    damageType: 'slash',
    elementType: 'none',
    attackClass: 'melee',
    statScaling: 'STR',
    actionTags: ['guard', 'interrupt_heavy'],
    requiredTags: ['has_tail'],
    preferredFamilies: ['fang'],
    preferredTags: ['has_claws'],
    baseCast: 0,
    baseRecovery: 18,
    baseDamage: 32,
    baseInterrupt: 18,
    baseMode: {
      damageMult: 1,
      enableProtectNeighbor: false,
      extraInterruptTags: ['heavy_cast'],
    },
    perfectMatchMode: {
      damageMult: 1.2,
      enableProtectNeighbor: true,
      extraStatuses: ['guarded'],
    },
    slotProfile: {
      tempo: 1,
      tactical: 2,
      enchant: 1,
    },
  },
  {
    id: 'weapon_web_lance',
    name: '蛛縛槍',
    familyHint: 'weave',
    weaponType: 'lance',
    damageType: 'pierce',
    elementType: 'shadow',
    attackClass: 'projectile',
    statScaling: 'AGI',
    actionTags: ['bind', 'shot'],
    requiredTags: ['has_tail'],
    preferredFamilies: ['weave'],
    preferredTags: ['has_wings'],
    baseCast: 6,
    baseRecovery: 20,
    baseDamage: 28,
    baseInterrupt: 10,
    baseMode: {
      damageMult: 0.9,
      enablePush: false,
    },
    perfectMatchMode: {
      damageMult: 1.25,
      enablePush: true,
      extraStatuses: ['bind'],
    },
    slotProfile: {
      tempo: 1,
      tactical: 2,
      enchant: 1,
    },
  },
  {
    id: 'weapon_moth_dust_fan',
    name: '鱗粉儀扇',
    familyHint: 'membrane',
    weaponType: 'fan',
    damageType: 'arcane',
    elementType: 'light',
    attackClass: 'arcane_cast',
    statScaling: 'INT',
    actionTags: ['shot', 'blast'],
    requiredTags: ['has_wings'],
    preferredFamilies: ['membrane'],
    preferredTags: ['has_wings'],
    baseCast: 8,
    baseRecovery: 16,
    baseDamage: 24,
    baseInterrupt: 12,
    baseMode: {
      damageMult: 1,
      enableZoneBonus: true,
      extraInterruptTags: ['zone_cast'],
    },
    perfectMatchMode: {
      damageMult: 1.18,
      extraStatuses: ['slow'],
    },
    slotProfile: {
      tempo: 1,
      tactical: 1,
      enchant: 2,
    },
  },
]

export const demoGenes: GeneDef[] = [
  {
    id: 'gene_pack_guard',
    name: '群獵護核',
    geneType: 'exclusive',
    ownerCertId: 'cert_wolf_guard',
    compatibleFamilies: ['fang'],
    baseEffect: {
      hpMult: 0.12,
      protectValueMult: 0.15,
    },
    synergyEffect: {
      extraHealAfterProtect: 6,
      frontCoreDamageReduction: 0.08,
      frontFlankDamageReduction: 0.04,
    },
  },
  {
    id: 'gene_pierce_focus',
    name: '穿刺導向',
    geneType: 'generic',
    compatibleFamilies: ['fang', 'weave'],
    baseEffect: {
      pierceDamageMult: 0.1,
    },
    synergyEffect: {
      interruptAdd: 4,
    },
  },
  {
    id: 'gene_dust_prayer',
    name: '磷粉禱式',
    geneType: 'exclusive',
    ownerCertId: 'cert_moth_oracle',
    compatibleFamilies: ['membrane'],
    baseEffect: {
      castMult: -0.08,
      zoneDurationAdd: 1,
    },
    synergyEffect: {
      applyStatus: 'slow',
      teamDamageBuff: 0.08,
    },
  },
]

export const demoTools: ToolDef[] = [
  {
    id: 'tool_howl_banner',
    name: '狼嚎戰旗',
    toolType: 'tempo',
    charges: 2,
    timing: 'combat',
    effectSummary: {
      teamDamageBuff: 0.12,
      durationActions: 2,
    },
  },
  {
    id: 'tool_bark_shield',
    name: '樹皮護幕',
    toolType: 'defense',
    charges: 1,
    timing: 'combat',
    effectSummary: {
      shieldValue: 24,
      removeStatuses: ['burn'],
    },
  },
  {
    id: 'tool_dust_lantern',
    name: '粉燈浮標',
    toolType: 'utility',
    charges: 2,
    timing: 'combat',
    effectSummary: {
      zoneDurationAdd: 1,
      applyStatus: 'slow',
    },
  },
]

export const demoEquippedGeneIds = demoGenes.map((gene) => gene.id)
export const demoEquippedToolIds = demoTools.map((tool) => tool.id)
