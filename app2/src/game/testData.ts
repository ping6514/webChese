/**
 * 測試資料集
 * 
 * 整合所有測試用資料，供戰鬥沙盒使用
 */

import type { Loadout } from './loadoutSystem'
import { createLoadout } from './loadoutSystem'
import { demoBloodlines, demoWeapons, demoGenes, demoTools } from './mockData'
import { allModules } from './moduleDatabase'

// 匯出所有可用資料
export { demoBloodlines, demoWeapons, demoGenes, demoTools, allModules }

/**
 * 預設測試配裝
 */
export const testLoadouts: Loadout[] = [
  // 配裝 1: 狼衛 - 重擊守護型
  {
    id: 'loadout_wolf_heavy_guard',
    name: '狼衛 - 重擊守護',
    bloodlineId: 'cert_wolf_guard',
    equippedWeapons: [
      {
        weaponId: 'weapon_fang_halberd',
        slotConfig: {
          weaponId: 'weapon_fang_halberd',
          tempoModules: ['tempo_heavy_charge'],
          tacticalModules: ['tactical_protective_stance', 'tactical_push_back'],
          enchantModules: ['enchant_fire'],
        },
      },
    ],
    equippedGeneIds: ['gene_pack_guard', 'gene_pierce_focus'],
    equippedToolIds: ['tool_howl_banner', 'tool_bark_shield'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // 配裝 2: 狼衛 - 疾速突進型
  {
    id: 'loadout_wolf_quick_dash',
    name: '狼衛 - 疾速突進',
    bloodlineId: 'cert_wolf_guard',
    equippedWeapons: [
      {
        weaponId: 'weapon_fang_halberd',
        slotConfig: {
          weaponId: 'weapon_fang_halberd',
          tempoModules: ['tempo_quick_strike'],
          tacticalModules: ['tactical_dash_strike', 'tactical_backstab_mastery'],
          enchantModules: ['enchant_vulnerable'],
        },
      },
    ],
    equippedGeneIds: ['gene_pack_guard', 'gene_pierce_focus'],
    equippedToolIds: ['tool_howl_banner'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // 配裝 3: 蛾翼司祭 - 區域控制型
  {
    id: 'loadout_moth_zone_control',
    name: '蛾翼司祭 - 區域控制',
    bloodlineId: 'cert_moth_oracle',
    equippedWeapons: [
      {
        weaponId: 'weapon_moth_dust_fan',
        slotConfig: {
          weaponId: 'weapon_moth_dust_fan',
          tempoModules: ['tempo_sustained'],
          tacticalModules: ['tactical_zone_control'],
          enchantModules: ['enchant_ice', 'enchant_vulnerable'],
        },
      },
    ],
    equippedGeneIds: ['gene_dust_prayer'],
    equippedToolIds: ['tool_dust_lantern'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // 配裝 4: 狼衛 - 連擊爆發型
  {
    id: 'loadout_wolf_combo_burst',
    name: '狼衛 - 連擊爆發',
    bloodlineId: 'cert_wolf_guard',
    equippedWeapons: [
      {
        weaponId: 'weapon_fang_halberd',
        slotConfig: {
          weaponId: 'weapon_fang_halberd',
          tempoModules: ['tempo_combo_rhythm'],
          tacticalModules: ['tactical_chain_attack', 'tactical_wide_sweep'],
          enchantModules: ['enchant_lightning'],
        },
      },
    ],
    equippedGeneIds: ['gene_pack_guard', 'gene_pierce_focus'],
    equippedToolIds: ['tool_howl_banner', 'tool_bark_shield'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },

  // 配裝 5: 蛛縛槍 - 穿透控制型
  {
    id: 'loadout_web_pierce_control',
    name: '蛛縛槍 - 穿透控制',
    bloodlineId: 'cert_wolf_guard',
    equippedWeapons: [
      {
        weaponId: 'weapon_web_lance',
        slotConfig: {
          weaponId: 'weapon_web_lance',
          tempoModules: ['tempo_balanced'],
          tacticalModules: ['tactical_piercing_shot', 'tactical_pull_control'],
          enchantModules: ['enchant_expose_pierce'],
        },
      },
    ],
    equippedGeneIds: ['gene_pack_guard', 'gene_pierce_focus'],
    equippedToolIds: ['tool_bark_shield'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

/**
 * 快速創建測試配裝
 */
export function createQuickTestLoadout(
  name: string,
  bloodlineId: string,
  weaponId: string,
  tempoModule?: string,
  tacticalModules?: string[],
  enchantModule?: string,
): Loadout {
  const loadout = createLoadout(name, bloodlineId)
  
  loadout.equippedWeapons = [
    {
      weaponId,
      slotConfig: {
        weaponId,
        tempoModules: tempoModule ? [tempoModule] : [],
        tacticalModules: tacticalModules || [],
        enchantModules: enchantModule ? [enchantModule] : [],
      },
    },
  ]
  
  return loadout
}

/**
 * 取得所有測試資料的摘要
 */
export function getTestDataSummary() {
  return {
    bloodlines: demoBloodlines.length,
    weapons: demoWeapons.length,
    genes: demoGenes.length,
    tools: demoTools.length,
    modules: {
      total: allModules.length,
      tempo: allModules.filter(m => m.slotType === 'tempo').length,
      tactical: allModules.filter(m => m.slotType === 'tactical').length,
      enchant: allModules.filter(m => m.slotType === 'enchant').length,
    },
    testLoadouts: testLoadouts.length,
  }
}

/**
 * 驗證測試資料完整性
 */
export function validateTestData(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // 檢查血統卡
  if (demoBloodlines.length === 0) {
    errors.push('沒有可用的血統卡')
  }
  
  // 檢查武器
  if (demoWeapons.length === 0) {
    errors.push('沒有可用的武器')
  }
  
  // 檢查模組
  if (allModules.length === 0) {
    errors.push('沒有可用的模組')
  }
  
  // 檢查測試配裝
  for (const loadout of testLoadouts) {
    // 檢查血統卡存在
    const bloodline = demoBloodlines.find(b => b.id === loadout.bloodlineId)
    if (!bloodline) {
      errors.push(`配裝 ${loadout.name} 的血統卡不存在: ${loadout.bloodlineId}`)
      continue
    }
    
    // 檢查武器存在
    for (const equippedWeapon of loadout.equippedWeapons) {
      const weapon = demoWeapons.find(w => w.id === equippedWeapon.weaponId)
      if (!weapon) {
        errors.push(`配裝 ${loadout.name} 的武器不存在: ${equippedWeapon.weaponId}`)
        continue
      }
      
      // 檢查模組存在
      const allModuleIds = [
        ...equippedWeapon.slotConfig.tempoModules,
        ...equippedWeapon.slotConfig.tacticalModules,
        ...equippedWeapon.slotConfig.enchantModules,
      ]
      
      for (const moduleId of allModuleIds) {
        const module = allModules.find(m => m.id === moduleId)
        if (!module) {
          errors.push(`配裝 ${loadout.name} 的模組不存在: ${moduleId}`)
        }
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

// 初始化時驗證資料
const validation = validateTestData()
if (!validation.valid) {
  console.warn('測試資料驗證失敗:', validation.errors)
} else {
  console.log('✅ 測試資料驗證通過')
  console.log('📊 測試資料摘要:', getTestDataSummary())
}
