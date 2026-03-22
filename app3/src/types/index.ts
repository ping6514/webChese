// Beast Conquest - 核心類型定義
// 基於 v3.0 核心規則文檔

// ==================== 基礎類型 ====================

export type RaceType = 'harpy' | 'lamia' | 'dragon' | 'slime' | 'centaur' | 'aquatic'

export type ClassType = 'destroyer' | 'conqueror' | 'commander' | 'guardian'

export type LegionType = 'infantry' | 'cavalry' | 'archer' | 'mage' | 'siege'

export type LegionRank = 'normal' | 'elite' | 'legendary'

export type Tag = 
  // 種族 Tags
  | 'harpy' | 'lamia' | 'dragon' | 'slime' | 'centaur' | 'aquatic'
  // 職業 Tags
  | 'destroyer' | 'conqueror' | 'commander' | 'guardian'
  // 軍團類型 Tags
  | 'infantry' | 'cavalry' | 'archer' | 'mage' | 'siege'
  // 軍團等級 Tags
  | 'normal' | 'elite' | 'legendary'
  // 特殊屬性 Tags
  | 'flying' | 'ranged' | 'melee' | 'magic'
  | 'beast' | 'humanoid' | 'elemental'
  | 'fire' | 'ice' | 'lightning' | 'poison'
  | 'holy' | 'dark'

export type LeaderState = 'normal' | 'stunned' | 'ko' | 'reviving'

export type ZoneId = 'player1_lair' | 'player1_battlefield' | 'player2_battlefield' | 'player2_lair'

export type PlacementZone = 'my_base' | 'my_battlefield' | 'enemy_battlefield' | 'enemy_base'

export type BuildingCategory = 'defense' | 'economy' | 'offense' | 'support' | 'special'

export type EventCategory = 'combat' | 'movement' | 'summon' | 'fortification' | 'draw' | 'control'

export type SkillTiming = 
  // 回合階段時機
  | 'preparation_start' | 'preparation_end'
  | 'main_start' | 'main_end'
  | 'action_start' | 'action_end'
  | 'equipment_start' | 'equipment_end'
  | 'end_start' | 'end_end'
  // 行動時機
  | 'before_move' | 'after_move' | 'on_enemy_move'
  | 'before_attack' | 'after_attack' | 'on_attacked'
  | 'before_siege' | 'after_siege'
  // 觸發時機
  | 'on_draw' | 'on_summon'
  | 'on_damage_dealt' | 'on_damage_taken'
  | 'on_stunned' | 'on_ko' | 'on_revive'
  | 'on_fortification_built' | 'on_fortification_destroyed' | 'on_fortification_attacked'
  | 'on_building_placed' | 'on_building_destroyed'
  | 'on_ally_attacked' | 'on_lair_attacked'

// ==================== 消耗類型 ====================

export interface Cost {
  tech?: number  // 技能點
  any?: number   // 任意資源
  discard?: number  // 丟棄手牌數量
}

// ==================== 效果類型 ====================

export interface Effect {
  type: string
  value?: number
  target?: string
  condition?: string
  duration?: 'instant' | 'turn' | 'permanent'
  tag?: Tag  // 單一 Tag 條件
  tags?: Tag[]  // 多個 Tags 條件
  direction?: string  // 移動方向（用於 force_move 等效果）
  description: string
}

// ==================== 首領卡 ====================

export interface LeaderCard {
  id: string
  name: string
  race: RaceType
  class: ClassType
  
  // 基礎屬性
  baseToughness: number
  baseAttack: number
  baseDefensiveSupport: number  // 防護協助
  baseOffensiveSupport: number  // 攻擊協助
  baseRecovery: number  // 回復力
  
  // Tags 系統
  tags: Tag[]
  
  // 被動能力
  passive: {
    name: string
    description: string
    effect: Effect
  }
  
  // 主動技能
  skill: {
    name: string
    description?: string  // 技能描述（可選）
    timing: SkillTiming[]
    cost: Cost
    cooldown: number
    effect: Effect[]
  }
  
  // 連動支援
  linkSupport?: {
    name: string
    conditionDescription: string
    bonus: {
      attackBonus?: number
      defensiveSupportBonus?: number
      offensiveSupportBonus?: number
      additionalEffects?: Effect[]
    }
  }
  
  // 插槽
  legionSlots: number
  tacticalSlot: 1
  
  // 復活時間
  reviveTime: 1 | 2 | 3
  
  // 卡牌描述
  flavor?: string
}

// ==================== 軍團卡 ====================

export interface LegionCard {
  id: string
  name: string
  race: RaceType
  type: LegionType
  rank: LegionRank
  
  // Tags 系統
  tags: Tag[]
  
  // 屬性加成（堆疊到首領）
  bonusStats: {
    toughness: number
    attack: number
    defensiveSupport: number  // 防護協助加成
    offensiveSupport: number  // 攻擊協助加成
    recovery: number  // 回復力加成
  }
  
  // 召喚需求（升級召喚）
  summonCost?: {
    tributeCount: number
    tributeRace?: RaceType
  }
  
  // 被動能力
  passive: {
    name: string
    description: string
    effect: Effect
  }
  
  // 主動技能（功能性）
  activeSkill?: {
    name: string
    timing: SkillTiming[]
    cost: Cost
    cooldown: number
    effect: Effect
  }
  
  // 犧牲技能
  sacrificeSkill?: {
    name: string
    effect: Effect
  }
  
  // 首領被擊破時的處理
  onLeaderKO?: {
    type: 'discard' | 'keep' | 'choice'
    cost?: Cost
    effect?: Effect
  }
  
  // 卡牌描述
  flavor?: string
}

// ==================== 戰術卡 ====================

export interface TacticalCard {
  id: string
  name: string
  category: 'defense' | 'counter' | 'movement' | 'fortification'
  
  // 觸發時機
  trigger: {
    timing: SkillTiming
    conditionDescription?: string
  }
  
  // Tags 需求
  tagRequirement?: {
    myTags?: Tag[]
    condition?: 'any' | 'all' | 'target'
  }
  
  // 效果
  effect: Effect[]
  
  // 消耗
  cost?: Cost
  
  // 隱藏資訊
  hidden?: true
  
  // 卡牌描述
  description: string
  flavor?: string
}

// ==================== 建築卡 ====================

export interface BuildingCard {
  id: string
  name: string
  category: BuildingCategory
  
  // 代價
  cost?: {
    discardCount?: number
    fortificationCost?: number
  }
  
  // 放置條件
  placementCondition?: {
    myFortification?: {
      min?: number
      max?: number
    }
    enemyFortification?: {
      min?: number
      max?: number
    }
  }
  
  // Tags 需求
  tagRequirement?: {
    myTags?: Tag[]
    condition?: 'any' | 'all'
  }
  
  // 建築耐久度（與首領的「堅韌」區分）
  durability: 1 | 2 | 3
  
  // 放置位置限制
  placement: PlacementZone[]
  
  // 地利效果
  areaEffect: {
    name: string
    description: string
    effect: Effect
    target: 'ally' | 'enemy' | 'all'
  }
  
  // 被動能力（全局效果）
  passive?: {
    name: string
    effect: Effect
  }
  
  // 被破壞時效果
  onDestroy?: Effect
  
  // 卡牌描述
  description: string
  flavor?: string
}

// ==================== 事件卡 ====================

export interface EventCard {
  id: string
  name: string
  category: EventCategory
  
  // 消耗
  cost: Cost
  
  // Tags 參考
  tagRequirement?: {
    myTags?: Tag[]
    enemyTags?: Tag[]
    condition?: 'any' | 'all'
  }
  
  // 效果
  effect: Effect[]
  
  // 額外效果（Tags 條件滿足時）
  bonusEffect?: {
    conditionDescription: string
    effect: Effect[]
  }
  
  // 卡牌描述
  description: string
  flavor?: string
}

// ==================== 卡牌集合 ====================

export interface CardDatabase {
  leaders: LeaderCard[]
  legions: LegionCard[]
  tactical: TacticalCard[]
  buildings: BuildingCard[]
  events: EventCard[]
}
