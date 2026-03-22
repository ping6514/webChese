import type { SlotModule } from './slotModules'

/**
 * 模組資料庫
 * 
 * 包含所有可用的插槽模組：
 * - Tempo 模組（時序孔）
 * - Tactical 模組（戰術孔）
 * - Enchant 模組（附魔孔）
 */

// ==================== TEMPO 模組 ====================

export const tempoModules: SlotModule[] = [
  {
    id: 'tempo_quick_strike',
    name: '疾速打擊',
    slotType: 'tempo',
    description: '犧牲部分威力，換取更快的出手速度',
    timingModifiers: {
      castMult: 0.7,      // -30% 施法時間
      recoveryMult: 0.8,  // -20% 恢復時間
    },
    damageModifiers: {
      damageMult: 0.85,   // -15% 傷害
    },
    rarity: 'common',
  },
  
  {
    id: 'tempo_heavy_charge',
    name: '重力蓄能',
    slotType: 'tempo',
    description: '蓄力攻擊，威力大幅提升但施法時間較長',
    timingModifiers: {
      castMult: 1.5,      // +50% 施法時間
      recoveryMult: 1.0,
    },
    damageModifiers: {
      damageMult: 1.4,    // +40% 傷害
    },
    tacticalEffects: {
      enablePush: true,   // 解鎖推擊
    },
    rarity: 'rare',
  },
  
  {
    id: 'tempo_guard_break',
    name: '破招突襲',
    slotType: 'tempo',
    description: '專門打斷敵人施法，對施法中的目標有額外傷害',
    timingModifiers: {
      castMult: 1.2,
      recoveryMult: 1.3,
    },
    interruptEffects: {
      interruptBonus: 10,
      extraInterruptTags: ['heavy_cast', 'guard_cast'],
    },
    rarity: 'rare',
  },
  
  {
    id: 'tempo_combo_rhythm',
    name: '連擊節奏',
    slotType: 'tempo',
    description: '快速連擊，適合持續輸出',
    timingModifiers: {
      castMult: 1.0,
      recoveryMult: 0.6,  // -40% 恢復時間
    },
    damageModifiers: {
      damageMult: 0.7,    // -30% 單次傷害
    },
    rarity: 'common',
  },
  
  {
    id: 'tempo_delayed_burst',
    name: '延遲爆發',
    slotType: 'tempo',
    description: '攻擊後延遲爆發，給予敵人閃避時間但傷害更高',
    timingModifiers: {
      castMult: 0.9,
      recoveryMult: 1.0,
    },
    damageModifiers: {
      damageMult: 1.3,    // +30% 傷害（延遲觸發）
    },
    rarity: 'rare',
  },
  
  {
    id: 'tempo_instant_critical',
    name: '瞬發爆擊',
    slotType: 'tempo',
    description: '瞬間出手的爆發攻擊，但冷卻時間很長',
    timingModifiers: {
      castMult: 0.5,      // -50% 施法時間
      recoveryMult: 2.0,  // +100% 恢復時間
    },
    damageModifiers: {
      criticalChance: 0.3,    // +30% 暴擊率
      criticalDamage: 0.5,    // +50% 暴擊傷害
    },
    rarity: 'epic',
  },
  
  {
    id: 'tempo_balanced',
    name: '平衡節奏',
    slotType: 'tempo',
    description: '平衡的攻擊節奏，沒有明顯優缺點',
    timingModifiers: {
      castMult: 1.0,
      recoveryMult: 1.0,
    },
    damageModifiers: {
      damageMult: 1.1,    // +10% 傷害
    },
    rarity: 'common',
  },
  
  {
    id: 'tempo_sustained',
    name: '持續壓制',
    slotType: 'tempo',
    description: '持續施壓，恢復時間極短',
    timingModifiers: {
      castMult: 1.1,
      recoveryMult: 0.5,  // -50% 恢復時間
    },
    damageModifiers: {
      damageMult: 0.8,    // -20% 傷害
    },
    rarity: 'rare',
  },
]

// ==================== TACTICAL 模組 ====================

export const tacticalModules: SlotModule[] = [
  {
    id: 'tactical_dash_strike',
    name: '突進斬擊',
    slotType: 'tactical',
    description: '攻擊前向目標突進，移動距離越遠傷害越高',
    tacticalEffects: {
      enableSelfAdvance: true,
    },
    damageModifiers: {
      damageMult: 1.15,   // +15% 基礎傷害
    },
    rarity: 'common',
  },
  
  {
    id: 'tactical_push_back',
    name: '推擊退敵',
    slotType: 'tactical',
    description: '命中後將目標推開 1 格，撞牆時造成額外傷害',
    tacticalEffects: {
      enablePush: true,
    },
    rarity: 'common',
  },
  
  {
    id: 'tactical_pull_control',
    name: '拉扯控制',
    slotType: 'tactical',
    description: '將目標拉近 1 格並施加易傷狀態',
    tacticalEffects: {
      enablePull: true,
    },
    statusEffects: {
      applyStatuses: ['vulnerable'],
      applyChance: 0.6,
    },
    rarity: 'rare',
  },
  
  {
    id: 'tactical_position_swap',
    name: '換位突襲',
    slotType: 'tactical',
    description: '命中後與目標交換位置',
    tacticalEffects: {
      enableSwap: true,
    },
    rarity: 'rare',
  },
  
  {
    id: 'tactical_protective_stance',
    name: '守護姿態',
    slotType: 'tactical',
    description: '攻擊後進入守護姿態，為相鄰友軍承受部分傷害',
    tacticalEffects: {
      enableProtectNeighbor: true,
    },
    rarity: 'rare',
  },
  
  {
    id: 'tactical_piercing_shot',
    name: '穿透射擊',
    slotType: 'tactical',
    description: '投射物可穿透最多 2 個目標，每次穿透傷害遞減',
    tacticalEffects: {
      piercing: true,
      maxPierceTargets: 2,
    },
    requireAttackClass: 'projectile',
    rarity: 'rare',
  },
  
  {
    id: 'tactical_wide_sweep',
    name: '範圍橫掃',
    slotType: 'tactical',
    description: '擴大攻擊範圍為前方扇形，但傷害略降',
    tacticalEffects: {
      areaExpansion: 'front_arc_3',
    },
    damageModifiers: {
      damageMult: 0.8,    // -20% 傷害
    },
    rarity: 'common',
  },
  
  {
    id: 'tactical_precision_snipe',
    name: '精準狙擊',
    slotType: 'tactical',
    description: '單體精準攻擊，大幅提升傷害和暴擊率',
    damageModifiers: {
      damageMult: 1.3,    // +30% 傷害
      criticalChance: 0.2,
    },
    rarity: 'epic',
  },
  
  {
    id: 'tactical_zone_control',
    name: '區域壓制',
    slotType: 'tactical',
    description: '在目標位置創建持續傷害區域',
    tacticalEffects: {
      areaExpansion: 'radius_1',
    },
    rarity: 'rare',
  },
  
  {
    id: 'tactical_backstab_mastery',
    name: '背刺專精',
    slotType: 'tactical',
    description: '大幅強化背刺傷害',
    damageModifiers: {
      damageMult: 1.2,    // 背刺時額外加成
    },
    rarity: 'epic',
  },
  
  {
    id: 'tactical_intercept_counter',
    name: '攔截反制',
    slotType: 'tactical',
    description: '高機率攔截投射物並反彈給攻擊者',
    tacticalEffects: {
      enableIntercept: true,
    },
    requireAttackClass: 'projectile',
    rarity: 'epic',
  },
  
  {
    id: 'tactical_chain_attack',
    name: '連鎖攻擊',
    slotType: 'tactical',
    description: '攻擊可跳躍到附近目標，最多連鎖 2 次',
    tacticalEffects: {
      chainAttack: true,
      maxChains: 2,
    },
    damageModifiers: {
      damageMult: 0.9,    // -10% 基礎傷害
    },
    rarity: 'epic',
  },
]

// ==================== ENCHANT 模組 ====================

export const enchantModules: SlotModule[] = [
  {
    id: 'enchant_fire',
    name: '烈焰附魔',
    slotType: 'enchant',
    description: '附加火焰傷害，有機率點燃目標',
    damageModifiers: {
      elementType: 'fire',
      elementRatio: 0.3,
    },
    statusEffects: {
      applyStatuses: ['burn'],
      applyChance: 0.6,
    },
    rarity: 'common',
  },
  
  {
    id: 'enchant_ice',
    name: '寒冰附魔',
    slotType: 'enchant',
    description: '附加冰霜傷害，減緩目標移動速度',
    damageModifiers: {
      elementType: 'ice',
      elementRatio: 0.3,
    },
    statusEffects: {
      applyStatuses: ['chill'],
      applyChance: 0.7,
    },
    rarity: 'common',
  },
  
  {
    id: 'enchant_lightning',
    name: '雷電附魔',
    slotType: 'enchant',
    description: '附加雷電傷害，有機率連鎖到附近敵人',
    damageModifiers: {
      elementType: 'lightning',
      elementRatio: 0.3,
    },
    statusEffects: {
      applyStatuses: ['shock'],
      applyChance: 0.5,
    },
    tacticalEffects: {
      chainAttack: true,
      maxChains: 1,
    },
    rarity: 'rare',
  },
  
  {
    id: 'enchant_wind',
    name: '疾風附魔',
    slotType: 'enchant',
    description: '附加風元素傷害，提升攻擊速度',
    damageModifiers: {
      elementType: 'wind',
      elementRatio: 0.25,
    },
    timingModifiers: {
      castMult: 0.9,
      recoveryMult: 0.9,
    },
    rarity: 'common',
  },
  
  {
    id: 'enchant_light',
    name: '神聖附魔',
    slotType: 'enchant',
    description: '附加神聖傷害，對暗屬性敵人有額外傷害',
    damageModifiers: {
      elementType: 'light',
      elementRatio: 0.3,
    },
    rarity: 'rare',
  },
  
  {
    id: 'enchant_shadow',
    name: '暗影附魔',
    slotType: 'enchant',
    description: '附加暗影傷害，降低目標命中率',
    damageModifiers: {
      elementType: 'shadow',
      elementRatio: 0.3,
    },
    rarity: 'rare',
  },
  
  {
    id: 'enchant_vulnerable',
    name: '易傷詛咒',
    slotType: 'enchant',
    description: '施加易傷狀態，使目標受到更多傷害',
    statusEffects: {
      applyStatuses: ['vulnerable'],
      applyChance: 0.8,
    },
    rarity: 'rare',
  },
  
  {
    id: 'enchant_expose_slash',
    name: '斬擊破綻',
    slotType: 'enchant',
    description: '降低目標斬擊抗性',
    statusEffects: {
      applyStatuses: ['expose_slash'],
      applyChance: 0.7,
    },
    rarity: 'common',
  },
  
  {
    id: 'enchant_expose_pierce',
    name: '穿刺破綻',
    slotType: 'enchant',
    description: '降低目標穿刺抗性',
    statusEffects: {
      applyStatuses: ['expose_pierce'],
      applyChance: 0.7,
    },
    rarity: 'common',
  },
  
  {
    id: 'enchant_expose_impact',
    name: '衝擊破綻',
    slotType: 'enchant',
    description: '降低目標衝擊抗性',
    statusEffects: {
      applyStatuses: ['expose_impact'],
      applyChance: 0.7,
    },
    rarity: 'common',
  },
]

// ==================== 匯出所有模組 ====================

export const allModules: SlotModule[] = [
  ...tempoModules,
  ...tacticalModules,
  ...enchantModules,
]

// ==================== 輔助函數 ====================

/**
 * 根據 ID 取得模組
 */
export function getModuleById(id: string): SlotModule | undefined {
  return allModules.find(m => m.id === id)
}

/**
 * 根據插槽類型取得模組
 */
export function getModulesBySlotType(slotType: 'tempo' | 'tactical' | 'enchant'): SlotModule[] {
  return allModules.filter(m => m.slotType === slotType)
}

/**
 * 根據稀有度取得模組
 */
export function getModulesByRarity(rarity: 'common' | 'rare' | 'epic' | 'legendary'): SlotModule[] {
  return allModules.filter(m => m.rarity === rarity)
}

/**
 * 取得可用於特定武器的模組
 */
export function getModulesForWeapon(
  weaponAttackClass: string,
  slotType: 'tempo' | 'tactical' | 'enchant'
): SlotModule[] {
  return allModules.filter(m => {
    if (m.slotType !== slotType) return false
    if (m.requireAttackClass && m.requireAttackClass !== weaponAttackClass) return false
    return true
  })
}
