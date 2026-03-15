/**
 * armor.ts — 防具詞條解析
 *
 * resolveArmorStats()：將 FrozenArmor.affixIds + dungeonQuality 轉成
 * 可套用到 Unit 的 ArmorStatDelta（純函數，無副作用）。
 *
 * 設計原則：
 *   - 只處理能直接影響 Unit 數值的詞條（str/agi/int/lck/HP/SP/MP/resistances/defenses）
 *   - 條件型效果（slash_increase、sp_on_hit 等）及特殊旗標保存到 passiveKeys[] 供外部處理
 *   - valueExpr 支援 `dungeonQuality*N`、`N` 兩種格式
 */

// ─── 詞條原始定義（對應 armor_affixes.json）──────────────────────────────────

export type ArmorAffixAbility = {
  key: string
  /** 固定數值（與 valueExpr 擇一）*/
  value?: number
  /** 運算式（如 "dungeonQuality*3"，目前僅支援乘法）*/
  valueExpr?: string
  /** 條件（conditional bonus，保留供外部使用）*/
  condition?: Record<string, string>
  /** 地形列表（terrain_penalty_immune 用）*/
  terrains?: string[]
}

export type ArmorAffixDef = {
  id: string
  name: string
  rarity: 'common' | 'rare' | 'elite'
  slot: string
  usedTags: string[]
  abilities: ArmorAffixAbility[]
}

// ─── 解析結果 ──────────────────────────────────────────────────────────────

/**
 * 將 FrozenArmor 的 affixIds 解析為可套用到 Unit 的數值增量。
 *
 * 直接數值欄位（str/agi/int/lck/maxHP/maxSP/maxMP/moveRange）：
 *   累加到 Unit 對應欄位。
 *
 * resistances / defenses：
 *   累加到 Unit.resistances[element] 或 Unit.defenses[element]。
 *
 * passiveKeys：
 *   條件型/旗標型效果的 key 清單，供裝備系統做進一步處理
 *   （如 `slash_increase`, `crit_chance_add`, `stealth_in_forest` 等）。
 */
export type ArmorStatDelta = {
  str: number
  agi: number
  int: number
  lck: number
  maxHP: number
  maxSP: number
  maxMP: number
  moveRange: number
  /** element → 抗性加成（0–1，累加）*/
  resistances: Record<string, number>
  /** element → 防禦 flat 加成（dungeonQuality 已 bake）*/
  defenses: Record<string, number>
  /**
   * 條件型/旗標型效果的原始 key，供裝備系統進一步處理。
   * e.g. 'crit_chance_add:0.06', 'sp_on_hit:5', 'stealth_in_forest'
   */
  passiveKeys: string[]
}

export function emptyDelta(): ArmorStatDelta {
  return {
    str: 0, agi: 0, int: 0, lck: 0,
    maxHP: 0, maxSP: 0, maxMP: 0, moveRange: 0,
    resistances: {}, defenses: {}, passiveKeys: [],
  }
}

// ─── 主函數 ───────────────────────────────────────────────────────────────────

/**
 * 將 affixIds 解析為 ArmorStatDelta。
 *
 * @param affixIds      FrozenArmor.affixIds（來自 armor_affixes.json 的 id 清單）
 * @param armorAffixes  全域詞條定義（armor_affixes.json 載入後）
 * @param dungeonQuality 地城品質（用於 valueExpr 計算）
 */
export function resolveArmorStats(
  affixIds: string[],
  armorAffixes: ArmorAffixDef[],
  dungeonQuality: number
): ArmorStatDelta {
  const delta = emptyDelta()
  const affixMap = new Map(armorAffixes.map(a => [a.id, a]))

  for (const id of affixIds) {
    const def = affixMap.get(id)
    if (!def) continue

    for (const ability of def.abilities) {
      applyAbility(delta, ability, dungeonQuality)
    }
  }

  return delta
}

// ─── 內部：套用單一 ability ───────────────────────────────────────────────────

function applyAbility(
  delta: ArmorStatDelta,
  ability: ArmorAffixAbility,
  dungeonQuality: number
): void {
  const { key, value, valueExpr, condition, terrains } = ability

  // 計算數值（valueExpr 優先，格式：'dungeonQuality*N' 或 'N'）
  const resolvedValue = valueExpr !== undefined
    ? evalSimpleExpr(valueExpr, dungeonQuality)
    : (value ?? 0)

  switch (key) {
    // ── 屬性 ──
    case 'str_plus':        delta.str      += resolvedValue; break
    case 'agi_plus':        delta.agi      += resolvedValue; break
    case 'int_plus':        delta.int      += resolvedValue; break
    case 'lck_plus':        delta.lck      += resolvedValue; break

    // ── 資源 ──
    case 'hp_plus':         delta.maxHP    += resolvedValue; break
    case 'sp_plus_stat':    delta.maxSP    += resolvedValue; break
    case 'mp_plus_stat':    delta.maxMP    += resolvedValue; break

    // ── 移動 ──
    case 'move_range_plus': delta.moveRange += resolvedValue; break

    // ── 抗性（resist = 0–1）──
    case 'slash_resist_plus':   addResist(delta, 'slash',   resolvedValue); break
    case 'pierce_resist_plus':  addResist(delta, 'pierce',  resolvedValue); break
    case 'crush_resist_plus':   addResist(delta, 'crush',   resolvedValue); break
    case 'fire_resist_plus':    addResist(delta, 'fire',    resolvedValue); break
    case 'water_resist_plus':   addResist(delta, 'water',   resolvedValue); break
    case 'dark_resist_plus':    addResist(delta, 'dark',    resolvedValue); break
    case 'wood_resist_plus':    addResist(delta, 'wood',    resolvedValue); break

    // ── 防禦 flat（已 bake dungeonQuality）──
    case 'slash_defense_flat':  addDefense(delta, 'slash', resolvedValue); break
    case 'fire_defense_flat':   addDefense(delta, 'fire',  resolvedValue); break

    // ── 條件型 / 旗標型（保存到 passiveKeys）──
    case 'crit_chance_add':
      delta.passiveKeys.push(`crit_chance_add:${resolvedValue}`); break
    case 'crit_damage_mult':
      delta.passiveKeys.push(`crit_damage_mult:${resolvedValue}`); break
    case 'slash_increase':
      delta.passiveKeys.push(`slash_increase:${resolvedValue}`); break
    case 'pierce_increase':
      delta.passiveKeys.push(`pierce_increase:${resolvedValue}`); break
    case 'sp_on_hit':
      delta.passiveKeys.push(`sp_on_hit:${resolvedValue}`); break
    case 'move_cast_reduce':
      delta.passiveKeys.push(`move_cast_reduce:${resolvedValue}`); break
    case 'stealth_in_forest':
      delta.passiveKeys.push('stealth_in_forest'); break
    case 'terrain_penalty_immune':
      if (terrains) {
        for (const t of terrains) delta.passiveKeys.push(`terrain_penalty_immune:${t}`)
      }
      break
    case 'consumable_slot_plus':
      delta.passiveKeys.push(`consumable_slot_plus:${resolvedValue}`); break
    case 'loot_carry_plus':
      delta.passiveKeys.push(`loot_carry_plus:${resolvedValue}`); break
    case 'supply_floor_rate_plus':
      delta.passiveKeys.push(`supply_floor_rate_plus:${resolvedValue}`); break

    default:
      // 未知 key：保留到 passiveKeys 供外部處理
      delta.passiveKeys.push(`${key}:${resolvedValue}`)
  }
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function addResist(delta: ArmorStatDelta, element: string, value: number) {
  delta.resistances[element] = (delta.resistances[element] ?? 0) + value
}

function addDefense(delta: ArmorStatDelta, element: string, value: number) {
  delta.defenses[element] = (delta.defenses[element] ?? 0) + value
}

/**
 * 支援簡單的 valueExpr 格式：
 *   - `dungeonQuality*N`（如 "dungeonQuality*3"）
 *   - 純數字字串（如 "5"）
 */
function evalSimpleExpr(expr: string, dungeonQuality: number): number {
  const trimmed = expr.trim()

  // dungeonQuality*N
  const dqMult = trimmed.match(/^dungeonQuality\s*\*\s*([\d.]+)$/)
  if (dqMult) return dungeonQuality * parseFloat(dqMult[1]!)

  // N*dungeonQuality
  const multDq = trimmed.match(/^([\d.]+)\s*\*\s*dungeonQuality$/)
  if (multDq) return parseFloat(multDq[1]!) * dungeonQuality

  // 純數字
  const num = parseFloat(trimmed)
  return isNaN(num) ? 0 : num
}
