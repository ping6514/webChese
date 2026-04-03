/**
 * 靈魂卡 & 道具卡能力的完整 TypeScript 型別定義。
 * 以辨別聯合（discriminated union）表示，消除引擎代碼中的 `as any`。
 */

// ─── 條件型別（when / targetWhen / per 欄位）──────────────────────────────

export type SoulAbilityCondition =
  | { type: 'AFTER_CROSS_RIVER' }
  | { type: 'MOVED_THIS_TURN' }
  | { type: 'RESONANCE_ACTIVE' }
  | { type: 'ATTACKER_IN_PALACE' }
  | { type: 'SOURCE_IN_PALACE' }
  | { type: 'CORPSES_GTE'; count: number }
  | { type: 'CORPSES_PER'; count: number }
  | { type: 'SOLDIERS_GTE'; count: number }
  | { type: 'ENEMY_KILLED_THIS_TURN_GTE'; count: number }
  | { type: 'ALLIES_IN_PALACE_GTE'; count: number }
  | { type: 'TARGET_CROSS_RIVER' }
  | { type: 'TARGET_IN_PALACE' }

// ─── 輔助共用型別 ──────────────────────────────────────────────────────────

export type DefBonus = { key: 'phys' | 'magic'; value: number }

export type SacrificeBuffShape = {
  ignoreBlockingAll?: boolean
  damageBonusPerCorpsesCap?: number
  chainRadius?: number
  chainDamageMultiplier?: number
}

/** COUNTER 技能的目標描述子 */
export type CounterTarget =
  | { type: 'SELF' }
  | { type: 'ALLY_BASE'; base: string }

/** AURA_STAT_BONUS 的加成結構 */
export type AuraStatBonus = {
  hp?: number
  healCurrent?: boolean
  atk?: number | { key: string; value: number }
  def?: number | DefBonus[]
}

// ─── 靈魂卡能力主聯合型別 ─────────────────────────────────────────────────

export type SoulAbility =
  // 攻擊加成
  | { type: 'ATK_BONUS'; amount: number; when?: SoulAbilityCondition }
  | { type: 'DAMAGE_BONUS'; amount: number; when?: SoulAbilityCondition; targetWhen?: SoulAbilityCondition }
  | { type: 'DAMAGE_MODIFIER'; amount: number; when?: SoulAbilityCondition; targetWhen?: SoulAbilityCondition }
  | { type: 'DAMAGE_BONUS_PER_ADJACENT_SOLDIER'; radius: number; amountPer: number; max: number }

  // 移動 / 射擊技能
  | { type: 'IGNORE_BLOCKING'; mode?: 'count' | 'all'; count?: number; when?: SoulAbilityCondition }
  | { type: 'IGNORE_PATH_BLOCKING'; for: string; count?: number; when?: SoulAbilityCondition }
  | { type: 'EXTRA_SHOT'; perTurn: number; when?: SoulAbilityCondition }
  | { type: 'FREE_SHOOT'; perTurn: number; when?: SoulAbilityCondition }
  | { type: 'MOVE_THEN_SHOOT'; perTurn?: number; when?: SoulAbilityCondition }
  | { type: 'CROSS_RIVER' }  // 標記型能力，無額外欄位

  // 彈道技能
  | { type: 'SPLASH'; radius: number; perTurn: number; fixedDamage?: number; when?: SoulAbilityCondition }
  | { type: 'PIERCE'; mode: 'LINE_ENEMIES' | 'CANNON_SCREEN_AND_TARGET'; count?: number; requiresManaGte?: number; manaCost?: number; when?: SoulAbilityCondition }
  | { type: 'CHAIN'; radius: number; perTurn: number; manaCost?: number; when?: SoulAbilityCondition }

  // 防禦技能
  | { type: 'FIRST_DAMAGED_REDUCTION'; amount: number; perTurn: number }
  | { type: 'BELOW_MAX_HP_DEFENSE_BONUS'; defBonus: DefBonus[] }
  | { type: 'DAMAGE_SHARE'; amount: number; when?: SoulAbilityCondition }
  | { type: 'COUNTER'; targets: CounterTarget[]; damage: { dice: number; atkKey: string; atkValue: number }; perTurn: number }

  // 資源技能
  | { type: 'KILL_MANA_GAIN'; amount: number }
  | { type: 'KILL_GOLD_GAIN'; amount: number }
  | { type: 'INCOME_BONUS'; amount: number }
  | { type: 'GOLD_FOR_DAMAGE'; goldCost: number; damageBonus: number }
  | { type: 'GOLD_THRESHOLD_ATK'; threshold: number; atkBonus?: number; scope?: 'self' | 'global'; defBonus?: { phys?: number; magic?: number } }
  | { type: 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD'; scope: 'self' | 'global'; threshold: number; amount: number; perTurn: number }
  | { type: 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD'; threshold: number; amount: number; perTurn: number }
  | { type: 'ITEM_COUNT_ATK_BONUS' }
  | { type: 'ITEM_VALUE_ATK_BONUS'; threshold: number; atkBonus: number }
  | { type: 'ITEM_VALUE_AURA'; threshold: number; scope: 'self' | 'global'; bonus: { atk?: number | { key: string; value: number }; def?: { phys?: number; magic?: number } } }

  // 光環技能
  | { type: 'AURA_DAMAGE_BONUS'; amount?: number; amountPer?: number; when?: SoulAbilityCondition; for?: string | string[]; clan?: string; excludeBase?: string; per?: SoulAbilityCondition }
  | { type: 'AURA_DAMAGE_MODIFIER'; amount?: number; when?: SoulAbilityCondition; for?: string | string[]; clan?: string }
  | { type: 'AURA_DEF_BONUS'; amount: number; key: 'phys' | 'magic'; when?: SoulAbilityCondition; for?: string; clan?: string; excludeBase?: string }
  | { type: 'AURA_IGNORE_BLOCKING'; count: number; perTurn: number; when?: SoulAbilityCondition; for?: string }
  | { type: 'AURA_GRANT_FREE_SHOOT'; amount: number; perTurn: number; when?: SoulAbilityCondition }
  | { type: 'AURA_GRANT_FREE_MOVE'; amount: number; perTurn: number; when?: SoulAbilityCondition }
  | { type: 'AURA_STAT_BONUS'; for: string | string[]; when?: SoulAbilityCondition; bonus: AuraStatBonus }
  | { type: 'UNDERDOG_AURA'; scope: 'self' | 'global'; stages: Array<{ margin: number; atkBonus: number }> }
  | { type: 'BLOOD_RAGE_AURA'; scope: 'self' | 'global'; stages: Array<{ threshold: number; atkBonus: number }> }
  | { type: 'UNIT_COUNT_ADVANTAGE_AURA'; scope: 'self' | 'global'; margin: number; defBonus: DefBonus[] }
  | { type: 'UNIT_COUNT_UNDERDOG_AURA'; scope: 'self' | 'global'; margin: number; atkBonus: number }
  | { type: 'SOLDIERS_TIERED_DAMAGE_BONUS'; tiers: Array<{ count: number; amount: number }> }
  | { type: 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS'; tiers: Array<{ count: number; amount: number }> }
  | { type: 'SOLDIERS_TIERED_DMG_REDUCTION_AURA'; tiers: Array<{ count: number; amount: number }> }

  // 目標削弱
  | { type: 'TARGET_DEF_MINUS'; key: 'phys' | 'magic'; amount?: number; per?: SoulAbilityCondition; amountPer?: number; minDef: number; onlyIfAtkKey: string }

  // 觸發技能
  | { type: 'ON_DEATH_FIXED_DAMAGE'; amount: number; radius: number; targets: 'enemies' | 'allies' | 'all'; ignoreDef?: boolean }
  | { type: 'HEAL_SELF_AND_KING_ON_KILL'; selfAmount: number; kingAmount: number }
  | { type: 'HEAL_KING_ON_KILL'; amount: number }
  | { type: 'BLOOD_TITHE_ON_KILL'; amount: number }
  | { type: 'COUNTER_ON_KING_DAMAGED'; damage: { fixed: number }; perTurn: number }

  // 血祭技能
  | { type: 'BLOOD_SACRIFICE'; hpCost: number; onActivate: { type: 'CHAIN'; radius: number; perTurn?: number } | { type: 'DAMAGE_BONUS'; amount: number } | { type: 'FREE_SHOOT'; perTurn: number } | { type: 'PIERCE'; mode: string; count?: number } | { type: 'MOVE_THEN_SHOOT' } }

  // 永夜：獻祭
  | { type: 'SACRIFICE_SHOT_BUFF'; range: number; target: 'ally'; requiresMovedThisTurn: boolean; buff: SacrificeBuffShape }
  | { type: 'SACRIFICE_SELF_APPLY_STATUS'; status: string }

  // 共鳴標記
  | { type: 'RESONANCE'; need: number; clan: string }

  // 鐵衛：陣型
  | { type: 'ARMY_RALLY' }
  | { type: 'FORMATION_COMMAND'; perTurn: number }
  | { type: 'PALACE_GUARD'; amount: number; perTurn: number }
  | { type: 'LOGISTICS_REVIVE'; perTurn: number }
  | { type: 'DEATH_COUNTER' }

  // 預留 / 傳承型能力（UI 顯示用，尚未實作或已棄用）
  | { type: 'MINGLEI' }
  | { type: 'PALACE_ONLY' }
  | { type: 'AURA_HP_REGEN_ON_KILL' }
  | { type: 'FREE_SHOOT_DRAIN' }

// ─── 道具卡能力聯合型別 ──────────────────────────────────────────────────

/** 道具目標描述子 */
export type ItemAbilityTarget =
  | { type: 'ALLY_UNIT' }
  | { type: 'ENEMY_UNIT'; excludeKing?: boolean }
  | { type: 'ALLY_ENCHANTED_UNIT' }
  | { type: 'ENEMY_ENCHANTED_UNIT' }
  | { type: 'ALLY_CORPSE_AT_POS' }
  | { type: 'ALLY_CAGE' }
  | { type: 'ENEMY_CAGE' }

/** 道具使用限制描述子 */
export type ItemAbilityRestrict =
  | { type: 'UNIT_NOT_SHOT_THIS_TURN' }
  | { type: 'LAST_STAND_NO_ENCHANT_THIS_TURN' }

export type ItemAbility =
  | { type: 'HEAL_UNIT'; amount: number; target: ItemAbilityTarget; capToMaxHp: boolean }
  | { type: 'GRANT_FREE_SHOOT'; amount: number; restrict?: ItemAbilityRestrict }
  | { type: 'REMOVE_CORPSE'; target: ItemAbilityTarget }
  | { type: 'CHOICE_GAIN_RESOURCE'; options: Array<{ resource: 'gold' | 'mana'; amount: number }> }
  | { type: 'REFRESH_ITEM_DISPLAY' }
  | { type: 'REFRESH_SOUL_DISPLAY_ALL' }
  | { type: 'GRANT_REVIVE_BONUS'; amount: number; revive: { free?: boolean; ignoreNecroActionLimit?: boolean }; apply: ItemAbilityRestrict }
  | { type: 'GAIN_NECRO_ACTION'; amount: number }
  | { type: 'ENCHANT_GOLD_DISCOUNT'; amount: number; scope: 'NEXT_ENCHANT' | 'ALL' }
  | { type: 'ON_KILL_GAIN_RESOURCE'; resource: 'gold' | 'mana'; amount: number; perTurnCap: number }
  | { type: 'DISABLE_UNIT_ACTIONS'; target: ItemAbilityTarget; until: 'TURN_END' | 'NEXT_TURN_START'; disable: { move?: boolean; shoot?: boolean } }
  | { type: 'PLUNDER_CAGE_SOUL'; amount: number; random: boolean }
  | { type: 'DETACH_SOUL'; target: ItemAbilityTarget; returnTo: ItemAbilityTarget; resetUnit: { toBaseStats?: boolean; healToFull?: boolean } }

// ─── 工具函式 ───────────────────────────────────────────────────────────────

/**
 * 在 abilities 陣列中找到指定 type 的第一個能力，回傳型別安全的結果。
 * 使用 TypeScript Extract<> 讓呼叫端不需要 as any。
 *
 * @example
 *   const ab = findAbility(card.abilities, 'FREE_SHOOT')
 *   if (ab) ab.perTurn  // 型別安全，不需要強轉
 */
export function findAbility<T extends SoulAbility['type']>(
  abilities: SoulAbility[],
  type: T,
): Extract<SoulAbility, { type: T }> | undefined {
  return abilities.find((a): a is Extract<SoulAbility, { type: T }> => a.type === type)
}
