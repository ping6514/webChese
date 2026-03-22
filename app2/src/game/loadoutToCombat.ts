/**
 * 配裝轉換為戰鬥單位
 * 
 * 將配裝系統的資料轉換為戰鬥引擎可用的 CombatUnit
 */

import type { Loadout } from './loadoutSystem'
import type { BloodlineDef, WeaponDef, GeneDef } from './schema'
import type { SlotModule } from './slotModules'
import type { CombatUnit, HexPos, FacingDir } from '../engine/state'
import { mergeModuleEffects } from './slotModules'

/**
 * 從配裝創建戰鬥單位
 */
export function createCombatUnitFromLoadout(
  loadout: Loadout,
  bloodline: BloodlineDef,
  weapons: WeaponDef[],
  genes: GeneDef[],
  modules: SlotModule[],
  options: {
    unitId: string
    unitName: string
    team: 'player' | 'enemy'
    pos: HexPos
    facing: FacingDir
  }
): CombatUnit {
  // 1. 取得血統基礎數值
  const baseStats = bloodline.baseStats
  
  // 2. 計算基因加成
  const geneEffects = calculateGeneEffects(loadout.equippedGeneIds, genes, bloodline)
  
  // 3. 計算最終屬性
  const finalHp = Math.round(baseStats.hp * (1 + (geneEffects.hpMult || 0)))
  const finalMove = baseStats.move
  const finalStr = baseStats.str
  const finalAgi = baseStats.agi
  const finalInt = baseStats.int
  
  // 4. 計算武器傷害（使用第一個武器作為主武器）
  let baseDamage = 30 // 預設傷害
  let baseInterrupt = 10 // 預設打斷值
  
  if (loadout.equippedWeapons.length > 0) {
    const firstWeapon = weapons.find(w => w.id === loadout.equippedWeapons[0].weaponId)
    if (firstWeapon) {
      baseDamage = firstWeapon.baseDamage
      baseInterrupt = firstWeapon.baseInterrupt
      
      // 應用模組效果
      const weaponModules = getWeaponModules(
        loadout.equippedWeapons[0].slotConfig,
        modules
      )
      const mergedEffects = mergeModuleEffects(weaponModules)
      
      // 應用傷害倍率
      if (mergedEffects.damageModifiers.damageMult) {
        baseDamage = Math.round(baseDamage * mergedEffects.damageModifiers.damageMult)
      }
      
      // 應用打斷加成
      if (mergedEffects.interruptEffects.interruptBonus) {
        baseInterrupt += mergedEffects.interruptEffects.interruptBonus
      }
    }
  }
  
  // 應用基因的傷害加成
  if (geneEffects.damageMult) {
    baseDamage = Math.round(baseDamage * (1 + geneEffects.damageMult))
  }
  
  // 5. 創建戰鬥單位
  const unit: CombatUnit = {
    id: options.unitId,
    name: options.unitName,
    team: options.team,
    bloodlineId: loadout.bloodlineId,
    pos: options.pos,
    facing: options.facing,
    
    // 屬性
    hp: finalHp,
    maxHp: finalHp,
    speed: 100, // 預設速度
    move: finalMove,
    damage: baseDamage,
    interrupt: baseInterrupt,
    
    // 狀態
    isDead: false,
    blocksCell: true,
    
    // 異常積蓄
    buildup: {
      burn: { accum: 0, threshold: 100, baseThreshold: 100 },
      poison: { accum: 0, threshold: 100, baseThreshold: 100 },
      paralyze: { accum: 0, threshold: 100, baseThreshold: 100 },
      sleep: { accum: 0, threshold: 100, baseThreshold: 100 },
      freeze: { accum: 0, threshold: 100, baseThreshold: 100 },
    },
    
    buildupResist: {
      burn: 0,
      poison: 0,
      paralyze: 0,
      sleep: 0,
      freeze: 0,
    },
    
    statusEffects: [],
  }
  
  return unit
}

/**
 * 計算基因效果
 */
function calculateGeneEffects(
  equippedGeneIds: string[],
  allGenes: GeneDef[],
  bloodline: BloodlineDef
) {
  let hpMult = 0
  let damageMult = 0
  let protectValueMult = 0
  
  for (const geneId of equippedGeneIds) {
    const gene = allGenes.find(g => g.id === geneId)
    if (!gene) continue
    
    // 應用基礎效果
    if (gene.baseEffect.hpMult) {
      hpMult += gene.baseEffect.hpMult
    }
    if (gene.baseEffect.damageMult) {
      damageMult += gene.baseEffect.damageMult
    }
    if (gene.baseEffect.protectValueMult) {
      protectValueMult += gene.baseEffect.protectValueMult
    }
    
    // 檢查協同效果
    const hasCompatibleFamily = gene.compatibleFamilies.includes(bloodline.family)
    if (hasCompatibleFamily && gene.synergyEffect) {
      // 應用協同效果（簡化版）
      if (gene.synergyEffect.teamDamageBuff) {
        damageMult += gene.synergyEffect.teamDamageBuff
      }
    }
  }
  
  return {
    hpMult,
    damageMult,
    protectValueMult,
  }
}

/**
 * 取得武器的所有模組
 */
function getWeaponModules(
  slotConfig: { tempoModules: string[]; tacticalModules: string[]; enchantModules: string[] },
  allModules: SlotModule[]
): SlotModule[] {
  const moduleIds = [
    ...slotConfig.tempoModules,
    ...slotConfig.tacticalModules,
    ...slotConfig.enchantModules,
  ]
  
  return moduleIds
    .map(id => allModules.find(m => m.id === id))
    .filter((m): m is SlotModule => m !== undefined)
}

/**
 * 批量創建戰鬥單位
 */
export function createCombatUnitsFromLoadouts(
  loadouts: Loadout[],
  bloodlines: BloodlineDef[],
  weapons: WeaponDef[],
  genes: GeneDef[],
  modules: SlotModule[],
  team: 'player' | 'enemy',
  startPos: HexPos,
  facing: FacingDir = 0
): CombatUnit[] {
  return loadouts.map((loadout, index) => {
    const bloodline = bloodlines.find(b => b.id === loadout.bloodlineId)
    if (!bloodline) {
      throw new Error(`找不到血統卡: ${loadout.bloodlineId}`)
    }
    
    return createCombatUnitFromLoadout(
      loadout,
      bloodline,
      weapons,
      genes,
      modules,
      {
        unitId: `${team}_${index}`,
        unitName: loadout.name,
        team,
        pos: { q: startPos.q + index, r: startPos.r },
        facing,
      }
    )
  })
}

/**
 * 取得配裝的完整效果摘要
 */
export function getLoadoutEffectSummary(
  loadout: Loadout,
  bloodline: BloodlineDef,
  weapons: WeaponDef[],
  genes: GeneDef[],
  modules: SlotModule[]
) {
  const geneEffects = calculateGeneEffects(loadout.equippedGeneIds, genes, bloodline)
  
  const weaponEffects = loadout.equippedWeapons.map(equippedWeapon => {
    const weapon = weapons.find(w => w.id === equippedWeapon.weaponId)
    if (!weapon) return null
    
    const weaponModules = getWeaponModules(equippedWeapon.slotConfig, modules)
    const mergedEffects = mergeModuleEffects(weaponModules)
    
    return {
      weaponName: weapon.name,
      baseDamage: weapon.baseDamage,
      finalDamage: Math.round(
        weapon.baseDamage * (mergedEffects.damageModifiers.damageMult || 1)
      ),
      modules: weaponModules.map(m => m.name),
      effects: mergedEffects,
    }
  }).filter(e => e !== null)
  
  return {
    bloodline: {
      name: bloodline.name,
      family: bloodline.family,
      baseHp: bloodline.baseStats.hp,
      finalHp: Math.round(bloodline.baseStats.hp * (1 + geneEffects.hpMult)),
    },
    genes: {
      equipped: loadout.equippedGeneIds.map(id => {
        const gene = genes.find(g => g.id === id)
        return gene?.name || id
      }),
      effects: geneEffects,
    },
    weapons: weaponEffects,
  }
}
