/**
 * damage.ts — 統一傷害計算模組
 *
 * 輸入：攻擊者、目標、ResolvedWeapon、所有已裝備詞條的 AffixDefData[]
 * 輸出：DamageResult（最終扣血量 + 每個分組件細節 + 是否爆擊）
 */

import type { Unit, FormulaKeySet, ResolvedWeapon } from './state'
import type { AffixDefData } from './weapons'

// ─── 傷害組件 ─────────────────────────────────────────────────────────────────

export type DamageType =
  | 'slash' | 'crush' | 'pierce'
  | 'fire'  | 'water' | 'wood'
  | 'light' | 'dark'

export type DamageComponent = {
  type: DamageType
  rawAmount: number      // 套用抗性/防禦前
  finalAmount: number    // max(1, rawAmount × (1 − resist) − defFlat)
  canCrit: boolean
  isCrit: boolean
}

export type DamageResult = {
  components: DamageComponent[]
  totalFinal: number
  isCrit: boolean
}

// ─── buildFormulaKeySet ───────────────────────────────────────────────────────

/**
 * 根據本次攻擊屬性，從攻擊者身上所有詞條收集 FormulaKeySet。
 *
 * @param attacker      攻擊者 Unit
 * @param weapon        已 resolve 的武器
 * @param allAffixDefs  所有詞條定義的查找表（id → AffixDefData）
 * @param dungeonQuality 縮放係數（valueExpr 用）
 */
export function buildFormulaKeySet(
  attacker: Unit,
  weapon: ResolvedWeapon,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality = 1.0
): FormulaKeySet {
  const fks: FormulaKeySet = {}

  const attackDamageTypes = [weapon.element] as string[]
  const attackActionTags = weapon.actionTags

  // 遍歷攻擊者武器和防具的所有已附加詞條
  const allAffixIds = collectAllAffixIds(attacker, weapon)

  for (const affixId of allAffixIds) {
    const def = allAffixDefs[affixId]
    if (!def) continue

    for (const ab of def.abilities) {
      // 檢查 condition
      if (ab.condition) {
        const { damageType, actionTag, scalingStat } = ab.condition
        if (damageType && !attackDamageTypes.includes(damageType)) continue
        if (actionTag && !attackActionTags.includes(actionTag)) continue
        if (scalingStat && weapon.statScaling !== scalingStat) continue
      }

      const val = evalValue(ab.value, ab.valueExpr, dungeonQuality)
      fks[ab.key] = (fks[ab.key] ?? 0) + val
    }
  }

  return fks
}

// ─── calcDamage ───────────────────────────────────────────────────────────────

/**
 * 計算最終傷害結果。
 *
 * @param attacker      攻擊者
 * @param target        被攻擊者
 * @param weapon        已 resolve 的武器
 * @param allAffixDefs  詞條定義查找表
 * @param dungeonQuality 地城品質係數
 */
export function calcDamage(
  attacker: Unit,
  target: Unit,
  weapon: ResolvedWeapon,
  allAffixDefs: Record<string, AffixDefData>,
  dungeonQuality = 1.0
): DamageResult {
  const fks = buildFormulaKeySet(attacker, weapon, allAffixDefs, dungeonQuality)
  const stat = getScalingStat(attacker, weapon.statScaling)

  // ── 爆擊判定（全局一次）──
  const baseCrit = fks['base_crit'] ?? 0
  const critAdd = fks['crit_chance_add'] ?? 0
  const lckCritMult = fks['lck_crit_mult'] ?? 0.005
  const critChance = Math.min(0.95, baseCrit + critAdd + attacker.stats.lck * lckCritMult)
  const isCrit = Math.random() < critChance
  const critDamageMult = fks['crit_damage_mult'] ?? 1.5

  // ── 主傷害組件（slot1 元素）──
  const baseMultiplier = fks['base_multiplier'] ?? 1.0
  const elementKey = weapon.element
  const elementIncrease = fks[`${elementKey}_increase`] ?? 0
  const elementPlus = fks[`${elementKey}_damage_plus`] ?? 0

  let mainRaw = weapon.atkFinal * stat * baseMultiplier * (1 + elementIncrease) + elementPlus
  if (isCrit) mainRaw *= critDamageMult

  const components: DamageComponent[] = [
    buildComponent(elementKey as DamageType, mainRaw, true, isCrit, target),
  ]

  // ── 附加傷害組件（其他 [type]_base > 0 的元素）──
  const extraElements: DamageType[] = ['fire', 'water', 'wood', 'light', 'dark', 'slash', 'crush', 'pierce']
  for (const el of extraElements) {
    if (el === elementKey) continue
    const base = fks[`${el}_base`] ?? 0
    if (base <= 0) continue
    const inc = fks[`${el}_increase`] ?? 0
    let raw = base * (1 + inc)
    const critAffects = fks[`crit_affects_${el}`] ?? 0
    if (isCrit && critAffects > 0) raw *= critDamageMult
    components.push(buildComponent(el as DamageType, raw, false, isCrit && critAffects > 0, target))
  }

  const passiveMult = attacker.passiveAtkMult ?? 1.0
  const totalFinal = Math.ceil(components.reduce((sum, c) => sum + c.finalAmount, 0) * passiveMult)

  return { components, totalFinal, isCrit }
}

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

function buildComponent(
  type: DamageType,
  rawAmount: number,
  canCrit: boolean,
  isCrit: boolean,
  target: Unit
): DamageComponent {
  const resist = target.resistances[type] ?? 0
  const defFlat = target.defenses[type] ?? 0
  const finalAmount = Math.max(1, rawAmount * (1 - resist) - defFlat)
  return { type, rawAmount, finalAmount, canCrit, isCrit }
}

function getScalingStat(unit: Unit, scaling: 'STR' | 'AGI' | 'INT'): number {
  switch (scaling) {
    case 'STR': return unit.stats.str
    case 'AGI': return unit.stats.agi
    case 'INT': return unit.stats.int
  }
}

function collectAllAffixIds(unit: Unit, weapon: ResolvedWeapon): string[] {
  // 武器詞條 + 防具詞條（Unit 未來會有 equipment 欄位，MVP1 先只收武器詞條）
  return [...weapon.appliedAffixIds]
}

function evalValue(value: number, expr: string | undefined, dungeonQuality: number): number {
  if (!expr) return value
  const replaced = expr.replace(/dungeonQuality/g, String(dungeonQuality))
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${replaced})`)() as number
  } catch {
    return value
  }
}
