import type { CaptainDef, FollowerDef, CaptainCard, SummonerCard, AIConfig, TraitDef } from '../engine/types'

// ─── 從者定義（5 種）────────────────────────────────────────────────────────

export const followerDefs: FollowerDef[] = [
  {
    id: 'follower_infantry',
    name: '步兵',
    type: 'infantry',
    shieldHp: 200,
    //               physDef pierceDef magDef
    stats: { atk: 200, physDef: 80, pierceDef: 55, magDef: 50, atbSpeed: 1.0, moveSpeed: 1.0, range: 1 },
    productionCost: 4,
    productionTicks: 25,
    blockPriority: 5,
  },
  {
    id: 'follower_cavalry',
    name: '騎兵',
    type: 'cavalry',
    shieldHp: 180,
    stats: { atk: 230, physDef: 65, pierceDef: 50, magDef: 45, atbSpeed: 1.2, moveSpeed: 1.6, range: 1 },
    productionCost: 6,
    productionTicks: 30,
    blockPriority: 6,
  },
  {
    id: 'follower_heavy',
    name: '重甲兵',
    type: 'heavy',
    shieldHp: 360,
    stats: { atk: 180, physDef: 130, pierceDef: 80, magDef: 60, atbSpeed: 0.6, moveSpeed: 0.5, range: 1 },
    productionCost: 8,
    productionTicks: 40,
    blockPriority: 9,
  },
  {
    id: 'follower_ranged',
    name: '弓兵',
    type: 'ranged',
    shieldHp: 140,
    stats: { atk: 210, physDef: 50, pierceDef: 45, magDef: 40, atbSpeed: 1.0, moveSpeed: 0.9, range: 3 },
    productionCost: 6,
    productionTicks: 30,
    blockPriority: 2,
  },
  {
    id: 'follower_siege',
    name: '攻城兵',
    type: 'siege',
    shieldHp: 220,
    stats: { atk: 280, physDef: 70, pierceDef: 55, magDef: 50, atbSpeed: 0.4, moveSpeed: 0.7, range: 4 },
    productionCost: 10,
    productionTicks: 50,
    splashRange: 1,
    blockPriority: 3,
  },
]

// ─── 隊長定義（5 種）────────────────────────────────────────────────────────

export const captainDefs: CaptainDef[] = [
  {
    id: 'captain_infantry',
    name: '衝鋒隊長',
    type: 'infantry',
    stats: {
      hp: 600, atk: 280, physDef: 80, pierceDef: 55, magDef: 50,
      atbSpeed: 1.0, moveSpeed: 1.0, range: 1,
      reviveDelay: 10, captureRate: 10, spGainPerHit: 8,
    },
    baseFollowerSlots: 2,
    spSkillId: 'charge_roar',
    spSkillName: '戰吼衝鋒',
    spSkillDesc: '立即向當前目標衝鋒，抵達後第一擊傷害 +60%，目標 ATB 清零',
    techTree: [
      { id: 'inf_base1', name: '近戰強化 Lv1', branch: 'base', tier: 1, experienceCost: 5,
        effect: { atkBonus: 0.15, description: 'ATK +15%' } },
      { id: 'inf_base2', name: '近戰強化 Lv2', branch: 'base', tier: 2, experienceCost: 8,
        requires: 'inf_base1',
        effect: { atkBonus: 0.15, followerSlotsUp: true, description: 'ATK +15%，解鎖第二從者槽' } },
      { id: 'inf_a1', name: '破壞者', branch: 'A', tier: 1, experienceCost: 12,
        requires: 'inf_base2',
        effect: { atkBonus: 0.20, description: 'ATK +20%，衝撞傷害 ×1.5' } },
      { id: 'inf_a2', name: '終結', branch: 'A', tier: 2, experienceCost: 20,
        requires: 'inf_a1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：衝鋒後連續攻擊 3 次，解鎖第三從者槽' } },
      { id: 'inf_b1', name: '鬥士', branch: 'B', tier: 1, experienceCost: 12,
        requires: 'inf_base2',
        effect: { description: '衝撞後自身 ATB +30，受傷時 ATB 不清零' } },
      { id: 'inf_b2', name: '不屈', branch: 'B', tier: 2, experienceCost: 20,
        requires: 'inf_b1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：HP < 30% 時 ATK +50%，解鎖第三從者槽' } },
    ],
  },
  {
    id: 'captain_heavy',
    name: '防守隊長',
    type: 'heavy',
    stats: {
      hp: 800, atk: 220, physDef: 120, pierceDef: 80, magDef: 55,
      atbSpeed: 0.9, moveSpeed: 0.9, range: 1,
      reviveDelay: 8, captureRate: 15, spGainPerHit: 6,
    },
    baseFollowerSlots: 2,
    spSkillId: 'iron_wall',
    spSkillName: '鐵甲壁壘',
    spSkillDesc: '小隊進入防禦陣型：DEF ×2，移速歸零，持續 60 tick',
    techTree: [
      { id: 'hvy_base1', name: '防禦強化 Lv1', branch: 'base', tier: 1, experienceCost: 5,
        effect: { defBonus: 0.15, description: 'DEF +15%' } },
      { id: 'hvy_base2', name: '防禦強化 Lv2', branch: 'base', tier: 2, experienceCost: 8,
        requires: 'hvy_base1',
        effect: { defBonus: 0.15, followerSlotsUp: true, description: 'DEF +15%，解鎖第二從者槽' } },
      { id: 'hvy_a1', name: '堡壘', branch: 'A', tier: 1, experienceCost: 12,
        requires: 'hvy_base2',
        effect: { hpBonus: 0.20, shieldHpBonus: 0.30, description: 'HP +20%，護盾層 HP +30%' } },
      { id: 'hvy_a2', name: '不動', branch: 'A', tier: 2, experienceCost: 20,
        requires: 'hvy_a1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：防禦陣型期間護盾層自動回復，解鎖第三從者槽' } },
      { id: 'hvy_b1', name: '反制', branch: 'B', tier: 1, experienceCost: 12,
        requires: 'hvy_base2',
        effect: { description: '被攻擊時 25% 機率立即反擊（不消耗 ATB）' } },
      { id: 'hvy_b2', name: '荊棘', branch: 'B', tier: 2, experienceCost: 20,
        requires: 'hvy_b1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：防禦陣型期間每次受攻擊反傷 ATK×30%，解鎖第三從者槽' } },
    ],
  },
  {
    id: 'captain_cavalry',
    name: '騎士隊長',
    type: 'cavalry',
    stats: {
      hp: 520, atk: 300, physDef: 70, pierceDef: 55, magDef: 45,
      atbSpeed: 1.2, moveSpeed: 1.6, range: 1,
      reviveDelay: 15, captureRate: 5, spGainPerHit: 10,
    },
    baseFollowerSlots: 2,
    spSkillId: 'trample',
    spSkillName: '鐵騎踐踏',
    spSkillDesc: '向目標位置衝鋒，對路徑上所有單位造成衝撞傷害，抵達後範圍 1 格內敵方 ATB 全部清零',
    techTree: [
      { id: 'cav_base1', name: '機動強化 Lv1', branch: 'base', tier: 1, experienceCost: 5,
        effect: { moveBonus: 0.20, description: '移速 +20%，衝撞傷害 +20%' } },
      { id: 'cav_base2', name: '機動強化 Lv2', branch: 'base', tier: 2, experienceCost: 8,
        requires: 'cav_base1',
        effect: { atbBonus: 0.15, followerSlotsUp: true, description: 'ATB速度 +15%，解鎖第二從者槽' } },
      { id: 'cav_a1', name: '突擊手', branch: 'A', tier: 1, experienceCost: 12,
        requires: 'cav_base2',
        effect: { description: '衝撞後立即獲得 50% ATB（可連衝）' } },
      { id: 'cav_a2', name: '鐵騎', branch: 'A', tier: 2, experienceCost: 20,
        requires: 'cav_a1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：衝鋒範圍擴大至周圍 2 格，解鎖第三從者槽' } },
      { id: 'cav_b1', name: '統帥', branch: 'B', tier: 1, experienceCost: 12,
        requires: 'cav_base2',
        effect: { description: '小隊警戒範圍 +1，所有從者移速 +20%' } },
      { id: 'cav_b2', name: '先鋒', branch: 'B', tier: 2, experienceCost: 20,
        requires: 'cav_b1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：衝鋒路徑上的敵方 ATB 全部清零，解鎖第三從者槽' } },
    ],
  },
  {
    id: 'captain_ranged',
    name: '弓手隊長',
    type: 'ranged',
    stats: {
      hp: 450, atk: 260, physDef: 55, pierceDef: 45, magDef: 45,
      atbSpeed: 1.1, moveSpeed: 0.9, range: 3,
      reviveDelay: 8, captureRate: 8, spGainPerHit: 7,
    },
    baseFollowerSlots: 2,
    spSkillId: 'arrow_rain',
    spSkillName: '箭雨',
    spSkillDesc: '對當前目標格及周圍 1 格所有敵方造成 ATK×150% 傷害，施加破甲累積值',
    techTree: [
      { id: 'rng_base1', name: '遠程強化 Lv1', branch: 'base', tier: 1, experienceCost: 5,
        effect: { atkBonus: 0.10, description: '射程 +1，ATK +10%' } },
      { id: 'rng_base2', name: '遠程強化 Lv2', branch: 'base', tier: 2, experienceCost: 8,
        requires: 'rng_base1',
        effect: { followerSlotsUp: true, description: '破甲累積速度 +30%，解鎖第二從者槽' } },
      { id: 'rng_a1', name: '狙擊手', branch: 'A', tier: 1, experienceCost: 12,
        requires: 'rng_base2',
        effect: { atkBonus: 0.35, description: '攻擊對單一目標傷害 +35%，忽視護盾層直傷隊長' } },
      { id: 'rng_a2', name: '貫穿', branch: 'A', tier: 2, experienceCost: 20,
        requires: 'rng_a1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：箭雨穿透護盾層直接傷害所有敵方隊長，解鎖第三從者槽' } },
      { id: 'rng_b1', name: '毒箭師', branch: 'B', tier: 1, experienceCost: 12,
        requires: 'rng_base2',
        effect: { description: '攻擊附帶毒素累積，觸發後每 10 tick 扣 HP×5%，持續 50 tick' } },
      { id: 'rng_b2', name: '瘟疫', branch: 'B', tier: 2, experienceCost: 20,
        requires: 'rng_b1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：箭雨對範圍內所有目標施加滿量毒素累積，解鎖第三從者槽' } },
    ],
  },
  {
    id: 'captain_siege',
    name: '攻城隊長',
    type: 'siege',
    stats: {
      hp: 580, atk: 380, physDef: 75, pierceDef: 60, magDef: 50,
      atbSpeed: 0.7, moveSpeed: 0.8, range: 4,
      reviveDelay: 12, captureRate: 25, spGainPerHit: 6,
    },
    baseFollowerSlots: 2,
    spSkillId: 'breach',
    spSkillName: '破城突擊',
    spSkillDesc: '集中攻擊當前最近建築，造成 ATK×300% 傷害；若目標是城門，佔領進度直接推進 20%',
    techTree: [
      { id: 'sge_base1', name: '攻城強化 Lv1', branch: 'base', tier: 1, experienceCost: 5,
        effect: { captureBonus: 0.20, description: '對建築傷害 +20%，佔領速率 +20%' } },
      { id: 'sge_base2', name: '攻城強化 Lv2', branch: 'base', tier: 2, experienceCost: 8,
        requires: 'sge_base1',
        effect: { followerSlotsUp: true, description: '濺射範圍擴大（主格 + 周圍 2 格），解鎖第二從者槽' } },
      { id: 'sge_a1', name: '破城者', branch: 'A', tier: 1, experienceCost: 12,
        requires: 'sge_base2',
        effect: { captureBonus: 0.30, description: '城門/主堡受傷額外 +40%，佔領速率 +30%' } },
      { id: 'sge_a2', name: '猛攻', branch: 'A', tier: 2, experienceCost: 20,
        requires: 'sge_a1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：對目標建築造成 ATK×500% 傷害，解鎖第三從者槽' } },
      { id: 'sge_b1', name: '工程師', branch: 'B', tier: 1, experienceCost: 12,
        requires: 'sge_base2',
        effect: { description: '我方佔領設施 HP +50%，建造費用 -20%' } },
      { id: 'sge_b2', name: '陣地', branch: 'B', tier: 2, experienceCost: 20,
        requires: 'sge_b1',
        effect: { followerSlotsUp: true, upgradesSP: true, description: 'SP 升級：在當前格建立臨時工事阻擋敵方 60 tick，解鎖第三從者槽' } },
    ],
  },
]

// ─── 隊長卡（暫時：每個隊長一張基礎卡）────────────────────────────────────

export const captainCards: CaptainCard[] = captainDefs.map(def => ({
  id: `card_${def.id}`,
  captainDefId: def.id,
  followerWeights: {},  // 均等機率
  innatePassive: {
    id: `${def.id}_innate`,
    name: '待設計',
    desc: '（固有被動待設計）',
  },
  unlockablePassive: {
    id: `${def.id}_unlock`,
    name: '待設計',
    desc: '（開通被動待設計）',
  },
  unlockablePassiveCost: 15,
}))

// ─── 召喚師裝備卡（MVP 範例）────────────────────────────────────────────────

export const summonerCards: SummonerCard[] = [
  {
    id: 'summoner_assault',
    name: '衝鋒體質',
    desc: '前線優先，開局資源充足',
    effects: [
      { type: 'initialMana',       value: 10 },
      { type: 'productionSpeed',   value: 15 },
    ],
  },
  {
    id: 'summoner_fortress',
    name: '要塞體質',
    desc: '防禦設施更強，建造費用降低',
    effects: [
      { type: 'facilityAtk',        value: 25 },
      { type: 'buildCostReduction', value: 20 },
    ],
  },
  {
    id: 'summoner_logistics',
    name: '後勤體質',
    desc: '生產加速，初始多一張計策牌',
    effects: [
      { type: 'productionSpeed',   value: 25 },
      { type: 'initialTacticCard', value: 1  },
    ],
  },
  {
    id: 'summoner_cavalry',
    name: '騎兵體質',
    desc: '騎兵生產速度大幅提升',
    effects: [
      { type: 'followerTypeSpeed', value: 40, targetType: 'cavalry' },
      { type: 'initialMana',       value: 5 },
    ],
  },
  {
    id: 'summoner_siege',
    name: '攻城體質',
    desc: '攻城兵生產加速，採集站產出提升',
    effects: [
      { type: 'followerTypeSpeed', value: 40, targetType: 'siege'   },
      { type: 'facilityOutput',    value: 20 },
    ],
  },
  {
    id: 'summoner_tactician',
    name: '謀士體質',
    desc: '計策手牌上限 +1，輸送帶加速',
    effects: [
      { type: 'tacticHandSize', value: 1  },
      { type: 'tacticSpeed',    value: 30 },
    ],
  },
]

// ─── Trait 定義（6 種 MVP Trait）─────────────────────────────────────────────

export const traitDefs: TraitDef[] = [
  {
    id: 'Charge',
    name: '衝鋒',
    desc: '移動後首擊傷害 +50%，目標 ATB 清零',
    icon: '⚡',
  },
  {
    id: 'Splash',
    name: '濺射',
    desc: '攻擊時對目標周圍 1 格的敵方造成 40% 濺射傷害',
    icon: '💥',
  },
  {
    id: 'Block',
    name: '格擋',
    desc: '受攻擊時 30% 機率傷害減半',
    icon: '🛡',
  },
  {
    id: 'Pierce',
    name: '穿透',
    desc: '攻擊無視目標 40% 防禦',
    icon: '🔱',
  },
  {
    id: 'LifeSteal',
    name: '吸血',
    desc: '每次攻擊吸取傷害 20% 為隊長回血',
    icon: '🩸',
  },
  {
    id: 'Taunt',
    name: '嘲諷',
    desc: '強制成為敵方優先攻擊目標',
    icon: '😤',
  },
]

// ─── 預設 AI 設定 ─────────────────────────────────────────────────────────

export const DEFAULT_AI_CONFIG: AIConfig = {
  behavior: 'aggressive',
  targetPriority: 'nearest',
  spMode: 'auto',
  route: 'mid',
  alertRange: 2,
}

/** 依隊長型別返回建議 alertRange */
export function captainAlertRange(type: string): 1 | 2 | 3 {
  if (type === 'siege' || type === 'ranged') return 3
  return 2
}
