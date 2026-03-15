/**
 * weapons.ts — 武器 resolve 工具
 *
 * resolveWeapon(base, affixDefs, appliedAffixes) → ResolvedWeapon
 *
 * 職責：將 WeaponBase JSON + 已附加的詞條 → 計算出實際數值快照。
 * 怪物內嵌武器（weapon inline）也走同一套流程，idHash 為 null。
 */

import type { ResolvedWeapon, HitMode } from './state'

// ─── 原始 JSON 型別（從 data/weapons/bases/ 讀入）───────────────────────────

export type WeaponBaseData = {
  id: string
  name: string
  requiredTags: string[]
  requiredTagCount?: number
  statScaling: 'STR' | 'AGI' | 'INT'
  atkBase: number
  spCost?: number
  mpCost?: number
  castTimeBase: number
  recoveryTimeBase: number
  cooldownBase?: number        // 預設 0（無冷卻）
  actionId: string
  hitMode: HitMode
  actionTags: string[]
  slot1Default?: string
  slot1Pool?: string[]
  slot2Default?: string
  slot2Pool?: string[]
  slot3Pool?: string[]
  slot4Pool?: string[]
  slot5Pool?: string[]
}

export type AffixAbilityData = {
  key: string
  value: number
  valueExpr?: string
  condition?: {
    damageType?: string
    actionTag?: string
    scalingStat?: string
  }
}

export type AffixCostsData = {
  sp_plus?: number
  mp_plus?: number
  cast_time_add?: number
  recovery_time_add?: number
  cooldown_time_add?: number
}

export type AffixDefData = {
  id: string
  name: string
  usedTags: string[]
  abilities: AffixAbilityData[]
  costs?: AffixCostsData
}

export type AppliedAffixInput = {
  id: string
  overwrite?: Record<string, number | string>
}

// ─── resolveWeapon ───────────────────────────────────────────────────────────

/**
 * 將 WeaponBase + 詞條定義 + 已附加詞條 → ResolvedWeapon
 *
 * @param base        weapons/bases/*.json 中的基底定義
 * @param affixDefs   所有詞條定義的查找表（id → AffixDefData）
 * @param applied     slot1~slot5 已附加的詞條（可為空陣列）
 * @param idHash      武器實例 hash，怪物內嵌武器傳 null
 * @param dungeonQuality 用於 valueExpr 的替換變數（預設 1.0）
 */
export function resolveWeapon(
  base: WeaponBaseData,
  affixDefs: Record<string, AffixDefData>,
  applied: AppliedAffixInput[],
  idHash: string | null = null,
  dungeonQuality = 1.0
): ResolvedWeapon {
  // 1. 基礎數值
  let spCost = base.spCost ?? 0
  let mpCost = base.mpCost ?? 0
  let castTime = base.castTimeBase
  let recoveryTime = base.recoveryTimeBase
  let cooldown = base.cooldownBase ?? 0

  // 2. 收集 FormulaKeySet 乘法節點（影響 atkFinal）
  let baseMultiplier = 1.0

  // 3. 依序套用各詞條
  const appliedAffixIds: string[] = []
  for (const ap of applied) {
    if (!ap.id) continue
    const def = affixDefs[ap.id]
    if (!def) continue
    appliedAffixIds.push(ap.id)

    // 套用 costs（只在 base 有使用對應資源時才累加）
    if (def.costs) {
      if (base.spCost !== undefined && def.costs.sp_plus)
        spCost += def.costs.sp_plus
      if (base.mpCost !== undefined && def.costs.mp_plus)
        mpCost += def.costs.mp_plus
      if (def.costs.cast_time_add)
        castTime += def.costs.cast_time_add
      if (def.costs.recovery_time_add)
        recoveryTime += def.costs.recovery_time_add
      if (def.costs.cooldown_time_add)
        cooldown += def.costs.cooldown_time_add
    }

    // 套用 abilities — 只收集 base_multiplier（其餘在攻擊時展開）
    for (const ab of def.abilities) {
      const rawValue = ap.overwrite?.[ab.key] !== undefined
        ? Number(ap.overwrite[ab.key])
        : evalAbilityValue(ab, dungeonQuality)

      if (ab.key === 'base_multiplier') {
        baseMultiplier += rawValue
      }
    }
  }

  // 4. atkFinal = base.atkBase × baseMultiplier
  const atkFinal = base.atkBase * baseMultiplier

  // 5. 確定 slot1（元素）與 slot2（模式）
  const element = resolveSlot(base.slot1Default, base.slot1Pool, applied, 0) ?? 'slash'
  const attackMode = resolveSlot(base.slot2Default, base.slot2Pool, applied, 1) ?? 'mode_slash'
  const enchant = resolveSlot(undefined, base.slot5Pool, applied, 4) ?? null

  return {
    idHash,
    baseId: base.id,
    name: base.name,
    actionId: base.actionId,
    hitMode: base.hitMode,
    actionTags: [...base.actionTags],
    statScaling: base.statScaling,
    atkFinal,
    spCostFinal: spCost,
    mpCostFinal: mpCost,
    castTimeFinal: castTime,
    recoveryTimeFinal: recoveryTime,
    cooldownMs: cooldown,
    element,
    attackMode,
    enchant,
    appliedAffixIds,
  }
}

// ─── 怪物內嵌武器（inline weapon JSON → ResolvedWeapon）─────────────────────

export type MonsterWeaponData = {
  id: string
  name: string
  actionId: string
  hitMode: HitMode
  statScaling: 'STR' | 'AGI' | 'INT'
  atkBase: number
  actionTags?: string[]
  slot1?: string
  slot2?: string
  cooldownBase?: number
  // slot3~slot5 怪物通常用 spawner 覆蓋，不在這裡處理
}

/**
 * 怪物內嵌武器直接轉為 ResolvedWeapon（無詞條系統，atkBase 直接當 atkFinal）
 */
export function resolveMonsterWeapon(weapon: MonsterWeaponData): ResolvedWeapon {
  return {
    idHash: null,
    baseId: weapon.id,
    name: weapon.name,
    actionId: weapon.actionId,
    hitMode: weapon.hitMode,
    actionTags: weapon.actionTags ?? ['物理', '即發'],
    statScaling: weapon.statScaling,
    atkFinal: weapon.atkBase,
    spCostFinal: 0,
    mpCostFinal: 0,
    castTimeFinal: 0,
    recoveryTimeFinal: 0,
    cooldownMs: weapon.cooldownBase ?? 0,
    element: weapon.slot1 ?? 'slash',
    attackMode: weapon.slot2 ?? 'mode_slash',
    enchant: null,
    appliedAffixIds: [],
  }
}

// ─── 內部工具 ─────────────────────────────────────────────────────────────────

function evalAbilityValue(ab: AffixAbilityData, dungeonQuality: number): number {
  if (!ab.valueExpr) return ab.value
  // 簡易 valueExpr 求值：只支援 "N * dungeonQuality" 形式
  const expr = ab.valueExpr.replace(/dungeonQuality/g, String(dungeonQuality))
  try {
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${expr})`)() as number
  } catch {
    return ab.value
  }
}

/** 取某個 slot 的值：優先 Default，其次看 applied[slotIndex] */
function resolveSlot(
  defaultVal: string | undefined,
  _pool: string[] | undefined,
  applied: AppliedAffixInput[],
  slotIndex: number
): string | null {
  if (defaultVal) return defaultVal
  // applied 陣列對應 slot1~slot5，slotIndex 0-based
  const ap = applied[slotIndex]
  if (ap?.id) return ap.id  // 詞條 id 即 slot 值（slot1~slot5 的 id 就是元素/模式名稱）
  return null
}
