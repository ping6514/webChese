// ─── 座標 ────────────────────────────────────────────────────────────────────

export type HexPos = { q: number; r: number }

export function hexKey(pos: HexPos): string {
  return `${pos.q},${pos.r}`
}

// offset 座標（odd-r：奇數 row 向右偏移半格）→ 轉 cube 座標計算距離
export function hexDistance(a: HexPos, b: HexPos): number {
  const ax = a.q - (a.r - (a.r & 1)) / 2
  const az = a.r
  const ay = -ax - az
  const bx = b.q - (b.r - (b.r & 1)) / 2
  const bz = b.r
  const by = -bx - bz
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz))
}

// ─── Tag 系統 ────────────────────────────────────────────────────────────────

export type UnitTag = 'heavy' | 'light' | 'cavalry' | 'infantry' | 'archer' | 'anti_cavalry' | 'anti_heavy' | 'anti_archer' | 'siege'

// ─── 異常累積 ────────────────────────────────────────────────────────────────

export type StatusType = 'poison' | 'armorBreak' | 'slow'

export type StatusBuildup = {
  poison: number
  armorBreak: number
  slow: number
}

export type ActiveStatus = {
  type: StatusType
  expiresAtTick: number
}

// ─── 從者定義（設計時靜態資料）────────────────────────────────────────────────

export type FollowerDef = {
  id: string
  name: string
  unitType: 'infantry' | 'cavalry' | 'heavy' | 'lightRanged' | 'heavyRanged' | 'support'
  cost: number
  defTags: UnitTag[]
  atkTags: UnitTag[]
  stats: {
    hp: number
    atk: number
    atbSpeed: number
    moveSpeed: number
    def: number
    range: number
    blockPriority: number
    reviveDelay: number
    captureRate: number
  }
  statusBuildup: StatusBuildup
  synergyDesc?: string
}

// ─── 隊長定義（設計時靜態資料）────────────────────────────────────────────────

export type CaptainDef = {
  id: string
  name: string
  unitType: 'infantry' | 'cavalry' | 'heavy' | 'lightRanged' | 'heavyRanged' | 'support'
  maxFollowerSlots: number
  defTags: UnitTag[]
  atkTags: UnitTag[]
  stats: {
    hp: number
    atk: number
    atbSpeed: number
    moveSpeed: number
    def: number
    range: number
    blockPriority: number
    reviveDelay: number
    captureRate: number
    commandCooldown: number
  }
  statusBuildup: StatusBuildup
  spSkillId: string
  spSkillName: string
  spSkillDesc: string
  passive1Desc: string
  passive2Desc: string
}

// ─── 技能插槽 ─────────────────────────────────────────────────────────────────

export type SkillDef = {
  id: string
  name: string
  desc: string
  type: 'stackable' | 'triggered' | 'teamBenefit'
  canUpgradeInBattle: boolean
  maxLevel: number
}

export type InstalledSkill = {
  skillId: string
  level: number // 1~maxLevel
}

// ─── AI 策略設定 ──────────────────────────────────────────────────────────────

export type MoveTarget =
  | 'player_base'
  | 'front_upper'
  | 'front_mid'
  | 'front_lower'
  | 'gate'
  | 'dungeon_upper'
  | 'dungeon_mid'
  | 'dungeon_lower'
  | 'enemy_base'

export type AlertRange = 1 | 2 | 3

export type TargetPriority = 'nearest' | 'lowest_hp' | 'most_members'

export type ActionPriority = 'attack' | 'capture' | 'move'

export type AIConfig = {
  moveSequence: MoveTarget[]
  loopSequence: boolean
  alertRange: AlertRange
  targetPriority: TargetPriority[]  // 排序，第一個優先
  actionPriority: ActionPriority[]  // 排序，第一個優先
  autoSP: boolean
}

// ─── 戰場成員實例 ─────────────────────────────────────────────────────────────

export type MemberInstance = {
  instanceId: string
  defId: string          // 指向 FollowerDef.id 或 CaptainDef.id
  isCaptain: boolean
  hp: number
  maxHp: number
  atb: number            // 0~100，滿了就攻擊
  statusEffects: ActiveStatus[]
  buildupAccum: StatusBuildup
  isDead: boolean
  blockPriority: number
}

// ─── 小隊實例 ────────────────────────────────────────────────────────────────

export type SquadTeam = 'player' | 'enemy'

export type SquadState =
  | 'moving'
  | 'fighting'
  | 'capturing'
  | 'idle'
  | 'retreating'    // 敗退中，前往復活點

export type SquadInstance = {
  squadId: string
  team: SquadTeam
  captainDefId: string
  followerDefIds: string[]   // 設計時決定的從者列表
  members: MemberInstance[]  // 含隊長+從者，runtime 用
  pos: HexPos                // 小隊中心格
  state: SquadState
  sp: number                 // 0~100
  aiConfig: AIConfig
  installedSkills: InstalledSkill[]  // 最多 3 個
  // SP buff 狀態
  spBuffActive: boolean
  spBuffType: string | null
  commandCooldownRemaining: number
  reviveAtTick: number | null  // 敗退後多久復活
  manualTargetPos: HexPos | null  // 玩家戰鬥中指定的移動目標格，null = 依 moveSequence
  spawnPos: HexPos              // 出生格，復活時回到這裡
}

// ─── DDZ（延遲傷害區域）────────────────────────────────────────────────────────

export type DDZ = {
  id: string
  positions: HexPos[]
  damage: number
  triggerAtTick: number
  sourceSquadId: string
  team: SquadTeam
}

// ─── 地圖格子 ─────────────────────────────────────────────────────────────────

export type TerrainType = 'normal' | 'highGround' | 'forest' | 'river' | 'bridge' | 'wall' | 'impassable'

export type BuildingType = 'tower' | 'outpost' | 'barracks' | 'spring' | 'workshop' | 'altar' | 'teleport' | 'gate' | 'mainBase'

export type BuildingInstance = {
  buildingId: string
  type: BuildingType
  team: SquadTeam | 'neutral'
  captureHP: number
  maxCaptureHP: number
  hp?: number
  maxHp?: number
}

export type MapCell = {
  pos: HexPos
  terrain: TerrainType
  passable: boolean
  building?: BuildingInstance
}

// ─── 遊戲整體狀態 ────────────────────────────────────────────────────────────

export type BattlePhase = 'prep' | 'running' | 'player_won' | 'enemy_won'

export type GameState = {
  phase: BattlePhase
  tick: number              // ATB 全域時間 tick
  squads: Record<string, SquadInstance>
  cells: Record<string, MapCell>
  ddzList: DDZ[]
  playerBase: { hp: number; maxHp: number }
  enemyBase: { hp: number; maxHp: number }
  log: string[]
}
