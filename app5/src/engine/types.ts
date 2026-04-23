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

// ─── 兵種類型 ─────────────────────────────────────────────────────────────────

export type CaptainType   = 'infantry' | 'cavalry' | 'heavy' | 'ranged' | 'siege'
export type FollowerType  = 'infantry' | 'cavalry' | 'heavy' | 'ranged' | 'siege'

// ─── 屬性傷害類型 ─────────────────────────────────────────────────────────────
// phys:   普通物理近戰（步兵、騎兵、重甲）
// pierce: 穿透遠程攻擊（弓兵、攻城）
// magic:  魔法（保留，未來 Buff/Trait 用）

export type DamageType = 'phys' | 'pierce' | 'magic'

// ─── 異常狀態 ─────────────────────────────────────────────────────────────────

export type StatusType = 'poison' | 'armorBreak' | 'slow'

export type ActiveStatus = {
  type: StatusType
  expiresAtTick: number
}

// ─── 從者定義（靜態資料）─────────────────────────────────────────────────────

export type FollowerDef = {
  id: string
  name: string
  type: FollowerType
  shieldHp: number        // 作為護盾層時的耐久值
  stats: {
    atk: number
    physDef:   number     // 物理防禦（抵抗近戰）
    pierceDef: number     // 穿透防禦（抵抗遠程）
    magDef:    number     // 魔法防禦（保留）
    atbSpeed: number
    moveSpeed: number     // 影響小隊整體移速（取平均）
    range: number
  }
  productionCost: number  // 生產費用（靈力）
  productionTicks: number // 生產時間
  splashRange?: number    // 攻城兵濺射格數（1 = 周圍 1 格）
  blockPriority: number   // 擋槍優先值，高者優先承傷
}

// ─── 隊長技能樹節點 ───────────────────────────────────────────────────────────

export type TechBranch = 'base' | 'A' | 'B'

export type TechEffect = {
  atkBonus?: number         // ATK 加成（乘數，例 0.15 = +15%）
  defBonus?: number
  hpBonus?: number
  atbBonus?: number
  moveBonus?: number
  captureBonus?: number
  shieldHpBonus?: number    // 從者護盾 HP 加成
  followerSlotsUp?: boolean // 解鎖額外從者槽
  upgradesSP?: boolean      // 此節點解鎖升級版 SP 招式
  counterBonus?: number     // 相剋傷害額外加成
  description: string       // 效果文字（UI 顯示用）
}

export type TechTreeNode = {
  id: string
  name: string
  branch: TechBranch
  tier: 1 | 2              // base: 1/2；A/B: 1/2
  experienceCost: number
  effect: TechEffect
  requires?: string        // 需要先解鎖哪個 nodeId
}

// ─── 隊長定義（靜態資料）─────────────────────────────────────────────────────

export type CaptainDef = {
  id: string
  name: string
  type: CaptainType
  stats: {
    hp: number
    atk: number
    physDef:   number     // 物理防禦
    pierceDef: number     // 穿透防禦
    magDef:    number     // 魔法防禦
    atbSpeed: number
    moveSpeed: number
    range: number
    reviveDelay: number   // 陣亡後幾 tick 復活（裸體，從者不跟）
    captureRate: number   // 每 tick 貢獻的佔領進度
    spGainPerHit: number  // 每次攻擊獲得的 SP
  }
  baseFollowerSlots: number  // 初始從者槽（預設 2）
  spSkillId: string
  spSkillName: string
  spSkillDesc: string
  techTree: TechTreeNode[]
}

// ─── 隊長卡（玩家裝備的卡片）────────────────────────────────────────────────

export type PassiveDef = {
  id: string
  name: string
  desc: string
}

export type CaptainCard = {
  id: string
  captainDefId: string
  // 抽兵偏好權重（加成值，例 40 = 機率 +40%）
  followerWeights: Partial<Record<FollowerType, number>>
  innatePassive: PassiveDef          // 固有被動（全場生效，天生擁有）
  unlockablePassive: PassiveDef      // 開通被動（戰中消耗經驗解鎖）
  unlockablePassiveCost: number      // 解鎖經驗花費
}

// ─── 召喚師裝備卡 ────────────────────────────────────────────────────────────

export type SummonerEffectType =
  | 'productionSpeed'      // 所有從者生產速度 +X%
  | 'followerTypeSpeed'    // 特定兵種生產速度 +X%
  | 'inventoryCapacity'    // 庫存上限 +X
  | 'tacticSpeed'          // 計策輸送帶速度 +X%
  | 'tacticHandSize'       // 計策手牌上限 +X
  | 'facilityAtk'          // 防禦塔攻擊力 +X%
  | 'facilityOutput'       // 採集站產出 +X%
  | 'facilityHeal'         // 急救站回血量 +X%
  | 'buildCostReduction'   // 建造費用 -X%
  | 'initialMana'          // 開局初始靈力 +X
  | 'initialTacticCard'    // 開局初始計策牌 +X 張
  | 'pauseCooldown'        // 手動暫停 CD -X%

export type SummonerEffect = {
  type: SummonerEffectType
  value: number
  targetType?: FollowerType  // 僅 followerTypeSpeed 需要
}

export type SummonerCard = {
  id: string
  name: string
  desc: string
  effects: SummonerEffect[]
}

// ─── 計策牌定義（靜態資料）──────────────────────────────────────────────────

export type TacticTargetType = 'squad' | 'cell' | 'none'

export type TacticCardDef = {
  id: string
  name: string
  desc: string
  targetType: TacticTargetType
}

// ─── AI 策略設定（v2 簡化版）────────────────────────────────────────────────

export type AIBehavior    = 'aggressive' | 'capture' | 'defend' | 'idle'
export type TargetPriority = 'nearest' | 'lowest_hp' | 'strongest_threat'
export type SPMode         = 'auto' | 'manual'
export type RouteAssign    = string   // 路線 ID，由地圖模板決定（不限三路）

export type AIConfig = {
  behavior:       AIBehavior
  targetPriority: TargetPriority
  spMode:         SPMode
  route:          RouteAssign
  alertRange:     1 | 2 | 3
}

// ─── 路線定義（由地圖模板產生，存入 GameState）─────────────────────────────
export type LaneDef = {
  id:        string       // 路線唯一 ID（如 'top', 'mid', 'upper_mid'…）
  label:     string       // 顯示名稱（如 '上路', '上中路'…）
  row:       number       // 最終目標所在的 r 值（用來尋找敵/我方主堡格）
  sequence:  string[]     // AI 依序前往的 zone/named-zone ID 列表
  waypoints?: HexPos[]   // 跨路移動路點（依序抵達後再進入 sequence 邏輯）
}

// ─── Trait 系統 ───────────────────────────────────────────────────────────────

export type TraitType = 'Charge' | 'Splash' | 'Block' | 'Pierce' | 'LifeSteal' | 'Taunt'

export type TraitDef = {
  id:   TraitType
  name: string
  desc: string
  icon: string
}

export type TraitCard = {
  instanceId: string
  traitId:    TraitType
}

export type TraitBeltState = {
  hand:          TraitCard[]
  maxHand:       number
  cooldownTicks: number
  intervalTicks: number
  pool:          TraitType[]
  upcoming:      TraitCard[]
  upcomingSize:  number
}

// ─── 暫存區（從者帶手牌放入後在此等待疊 Trait 再召喚）──────────────────────

export type StagedFollower = {
  instanceId:   string
  followerCard: FollowerCard  // 原始從者牌
  traits:       TraitType[]   // 已疊加的 Trait
  maxTraits:    number        // 最多疊幾層（預設 2）
}

export type StagingArea = {
  slots:    StagedFollower[]
  maxSlots: number
}

// ─── 護盾層（已部署的從者）──────────────────────────────────────────────────

export type ShieldLayer = {
  instanceId: string
  followerDefId: string
  hp: number
  maxHp: number
  atb: number               // 0~100，滿了就攻擊
  isDead: boolean
  statusEffects: ActiveStatus[]
  traits:      TraitType[]  // 攜帶的 Trait 列表
  chargeReady: boolean      // Charge trait：移動後首擊旗標
}

// ─── 小隊實例（v2）──────────────────────────────────────────────────────────

export type SquadTeam = 'player' | 'enemy'

export type SquadState =
  | 'moving'
  | 'fighting'
  | 'capturing'
  | 'idle'
  | 'retreating'     // 陣亡後返回出生點等待復活

export type SquadInstance = {
  squadId: string
  team: SquadTeam
  captainCardId: string     // 對應 CaptainCard.id（敵方小隊可為空）
  captainDefId: string      // 對應 CaptainDef.id

  // ── 隊長狀態 ───────────────────────────────────────────────────────────
  hp: number
  maxHp: number
  atb: number               // 0~100
  sp: number                // 0~100，累積後可發動 SP 招式
  statusEffects: ActiveStatus[]
  spBuffActive: boolean
  spBuffType: string | null

  // ── 護盾層（已部署的從者）────────────────────────────────────────────
  shieldLayers: ShieldLayer[]
  maxShieldSlots: number    // 預設 2，技能樹可升至 3

  // ── 技能樹 ────────────────────────────────────────────────────────────
  unlockedNodes: string[]   // TechTreeNode.id 列表
  passiveUnlocked: boolean  // 開通被動是否已解鎖

  // ── 位置與行動 ────────────────────────────────────────────────────────
  pos: HexPos
  spawnPos: HexPos
  state: SquadState
  aiConfig: AIConfig

  // ── 復活 ──────────────────────────────────────────────────────────────
  reviveAtTick: number | null

  // ── 入場排程 ──────────────────────────────────────────────────────────
  deployAtTick: number | null  // null = 已在場上；數字 = 該 tick 入場
}

// ─── 從者帶（conveyor belt）────────────────────────────────────────────────

export type FollowerCard = {
  instanceId:   string   // 每張牌唯一 ID
  followerDefId: string
}

export type FollowerBeltState = {
  hand:          FollowerCard[]   // 目前手牌
  maxHand:       number           // 上限（預設 4），滿了帶停
  cooldownTicks: number           // 倒數到下一張牌推出
  intervalTicks: number           // 每幾 tick 推一張牌
  pool:          string[]         // 可抽的 followerDefId 清單
  upcoming:      FollowerCard[]   // 預覽佇列（下幾張牌，已預先決定）
  upcomingSize:  number           // 預覽數量（預設 3）
}

// ─── 從者生產系統 ────────────────────────────────────────────────────────────

export type ProductionItem = {
  instanceId: string
  followerDefId: string
  completesAtTick: number
}

export type ProductionState = {
  current: ProductionItem | null   // 目前正在生產的從者
  inventory: string[]              // 庫存中的 followerDefId 列表
  maxInventory: number             // 上限（預設 3，召喚師卡可提升）
  rerollCooldownEndsAtTick: number | null  // 重骰停工冷卻
}

// ─── 計策手牌系統 ────────────────────────────────────────────────────────────

export type TacticHand = {
  cards: string[]              // TacticCardDef.id 列表（手牌）
  maxSize: number              // 手牌上限（預設 3）
  conveyorProgress: number     // 0~100，滿了生成一張計策牌
  conveyorMax: number          // 進度滿值（滿足就生成，通常 = 100）
}

// ─── 資源狀態 ────────────────────────────────────────────────────────────────

export type ResourceState = {
  mana: number            // 靈力（主貨幣）
  experience: number      // 經驗（共享池）
  destinyPoints: number   // 命運點（計策輸送帶能量）
}

// ─── DDZ（延遲傷害區域）────────────────────────────────────────────────────────

export type DDZ = {
  id: string
  positions: HexPos[]
  damage: number
  triggerAtTick: number
  team: SquadTeam
}

// ─── 地圖格子 ─────────────────────────────────────────────────────────────────

export type TerrainType =
  | 'normal'
  | 'highGround'   // 遠程射程 +1
  | 'forest'       // 移速 ×0.7
  | 'river'        // 不可通行
  | 'bridge'       // 移速 ×0.8，卡點
  | 'wall'         // 不可通行
  | 'impassable'   // 地圖邊界

export type NodeType =
  | 'outpost'      // 一般前哨站
  | 'barracks'     // 軍營（加速造兵）
  | 'highGround'   // 高地節點
  | 'gate'         // 城門（可破壞）
  | 'playerBase'   // 玩家主堡
  | 'enemyBase'    // 敵方主堡
  | 'enemyTower'   // 敵方防禦塔（地圖固定）

// 可佔領區域的節點型別（用於 ZoneState）
export type ZoneNodeType = 'outpost' | 'barracks' | 'highGround'

// ─── 區域狀態（共享跨格的佔領區，如前哨站）─────────────────────────────────
export type ZoneState = {
  zoneId:       string
  nodeType:     ZoneNodeType
  team:         SquadTeam | 'neutral'
  captureHp:    number
  maxCaptureHp: number
  cells:        HexPos[]       // 隸屬於此區域的格子
  facility?:    FacilityType   // 未來：區域建築（採集站、防禦塔…）
}

export type FacilityType =
  | 'collectStation'   // 採集站
  | 'defenseTower'     // 防禦塔
  | 'healStation'      // 急救站
  | 'recruitStation'   // 徵兵所（軍營專屬）
  | 'watchtower'       // 瞭望台（高地專屬）

export type BuildingInstance = {
  buildingId: string
  nodeType: NodeType
  team: SquadTeam | 'neutral'
  captureHp: number       // 佔領進度（歸零即完成佔領）
  maxCaptureHp: number
  hp?: number             // 可摧毀建築的耐久（城門/主堡）
  maxHp?: number
  facility?: FacilityType // 已建造的設施（undefined = 尚未建造）
}

export type MapCell = {
  pos: HexPos
  terrain: TerrainType
  passable: boolean
  building?: BuildingInstance  // 單格建築（主堡、城門…）
  zoneId?: string              // 所屬區域 ID（前哨站等多格區域）
}

// ─── 戰鬥事件（每 tick 清空，由 renderer 消費）─────────────────────────────

export type AttackFXType = 'slash' | 'stab' | 'arrow' | 'cannonball'

export type BattleEvent =
  | { type: 'damage'; targetId: string; pos: HexPos; amount: number }
  | { type: 'death';  targetId: string; pos: HexPos }
  | { type: 'revive'; squadId: string;  pos: HexPos }   // 復活（玩家）
  | { type: 'spawn';  squadId: string;  pos: HexPos }   // 首次入場
  | { type: 'attack'; fromPos: HexPos; toPos: HexPos; fxType: AttackFXType }

// ─── 遊戲整體狀態（v2）──────────────────────────────────────────────────────

export type BattlePhase = 'prep' | 'running' | 'player_won' | 'enemy_won'

export type GameState = {
  phase: BattlePhase
  tick: number
  maxTicks: number                       // 時間限制（超時後以優勢判定勝負）
  playerBaseHp: number                  // 玩家主堡生命（歸零即敗）
  enemyBaseHp: number                   // 敵方主堡生命（歸零即勝）
  squads: Record<string, SquadInstance>
  cells: Record<string, MapCell>
  zones: Record<string, ZoneState>       // 可佔領區域（前哨站等）
  lanes: LaneDef[]                       // 路線定義（由地圖模板產生）
  resources: ResourceState
  followerBelt: FollowerBeltState        // 從者運輸帶
  traitBelt:   TraitBeltState            // Trait 運輸帶（第二條）
  stagingArea: StagingArea               // 暫存區（疊 Trait 後召喚）
  production: ProductionState
  tacticHand: TacticHand
  ddzList: DDZ[]
  events: BattleEvent[]
  log: string[]
}
