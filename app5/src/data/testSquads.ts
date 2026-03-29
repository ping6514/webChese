import type { CaptainDef, FollowerDef } from '../engine/types'

// 數值設計基準（步兵為 100）：
//   同等素質 1v1 → 3~5 擊擊破
//   淨傷 = atk - def ≈ atk × 28~35%
//   重甲 def 高但 atk 低，5~10 擊可打完
//   HP 單位：隊長 ~300，從者 ~100

export const captainDefs: CaptainDef[] = [
  {
    id: 'captain_infantry_a',
    name: '衝鋒隊長',
    unitType: 'infantry',
    maxFollowerSlots: 3,
    defTags: ['infantry'],
    atkTags: [],
    stats: {
      hp: 300,
      atk: 120,
      atbSpeed: 1.0,
      moveSpeed: 1.0,
      def: 75,     // 淨傷 45，HP300 → 約 6~7 擊（有從者擋槍）
      range: 1,
      blockPriority: 5,
      reviveDelay: 10,
      captureRate: 10,
      commandCooldown: 20,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
    spSkillId: 'charge_roar',
    spSkillName: '戰吼衝鋒',
    spSkillDesc: '小隊立即向當前目標衝鋒，抵達後第一擊傷害 +50%',
    passive1Desc: '對特化目標傷害加成提升',
    passive2Desc: '每消滅一個敵方從者，攻擊速度 +5%（最多 3 層）',
  },
  {
    id: 'captain_infantry_b',
    name: '防守隊長',
    unitType: 'infantry',
    maxFollowerSlots: 3,
    defTags: ['infantry'],
    atkTags: [],
    stats: {
      hp: 300,
      atk: 100,
      atbSpeed: 0.9,
      moveSpeed: 0.9,
      def: 80,     // 防禦型稍高，淨傷 20
      range: 1,
      blockPriority: 6,
      reviveDelay: 8,
      captureRate: 15,
      commandCooldown: 25,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
    spSkillId: 'iron_wall',
    spSkillName: '鐵甲壁壘',
    spSkillDesc: '小隊進入防禦陣型，防禦力翻倍，不主動移動，持續一段時間',
    passive1Desc: '被近戰攻擊時有機率立即反擊一次（不消耗 ATB）',
    passive2Desc: '小隊靜止時 captureRate 大幅提升',
  },
  {
    id: 'captain_cavalry_a',
    name: '衝擊騎士',
    unitType: 'cavalry',
    maxFollowerSlots: 3,
    defTags: ['cavalry', 'light'],
    atkTags: ['anti_cavalry'],
    stats: {
      hp: 270,
      atk: 110,
      atbSpeed: 1.2,
      moveSpeed: 1.6,
      def: 65,     // 輕甲，淨傷 45
      range: 1,
      blockPriority: 6,
      reviveDelay: 15,
      captureRate: 5,
      commandCooldown: 18,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
    spSkillId: 'trample',
    spSkillName: '鐵騎踐踏',
    spSkillDesc: '衝撞效果擴大至目標格周圍 2 格，對範圍內所有敵方單位造成衝撞傷害',
    passive1Desc: '衝撞/踐踏傷害大幅提升',
    passive2Desc: '衝撞後 ATB 立即部分回復，加快下次出手',
  },
]

export const followerDefs: FollowerDef[] = [
  {
    id: 'follower_infantry_a',
    name: '反騎步兵',
    unitType: 'infantry',
    cost: 3,
    defTags: ['infantry'],
    atkTags: ['anti_cavalry'],
    stats: {
      hp: 100,
      atk: 100,
      atbSpeed: 1.0,
      moveSpeed: 1.0,
      def: 70,     // 淨傷 30，HP100 → 3~4 擊
      range: 1,
      blockPriority: 5,
      reviveDelay: 0,
      captureRate: 10,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
    synergyDesc: '隊長是步兵型 → anti_騎士加成提升至 +60%',
  },
  {
    id: 'follower_infantry_white',
    name: '白板步兵',
    unitType: 'infantry',
    cost: 1,
    defTags: ['infantry'],
    atkTags: [],
    stats: {
      hp: 100,
      atk: 100,
      atbSpeed: 1.0,
      moveSpeed: 1.0,
      def: 70,
      range: 1,
      blockPriority: 5,
      reviveDelay: 0,
      captureRate: 10,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
  },
  {
    id: 'follower_cavalry_a',
    name: '白板騎士',
    unitType: 'cavalry',
    cost: 3,
    defTags: ['cavalry', 'light'],
    atkTags: ['anti_archer'],
    stats: {
      hp: 90,
      atk: 90,
      atbSpeed: 1.2,
      moveSpeed: 1.6,
      def: 60,     // 輕甲，淨傷 30
      range: 1,
      blockPriority: 6,
      reviveDelay: 0,
      captureRate: 5,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
  },
  {
    id: 'follower_heavy_a',
    name: '白板重甲兵',
    unitType: 'heavy',
    cost: 3,
    defTags: ['heavy', 'infantry'],
    atkTags: ['anti_cavalry'],
    stats: {
      hp: 160,
      atk: 110,
      atbSpeed: 0.6,
      moveSpeed: 0.5,
      def: 90,     // 重甲特化，淨傷 10~30（視攻擊方兵種），5~10 擊
      range: 1,
      blockPriority: 9,
      reviveDelay: 0,
      captureRate: 5,
    },
    statusBuildup: { poison: 0, armorBreak: 0, slow: 0 },
  },
]

export const DEFAULT_AI_CONFIG = {
  moveSequence: ['front_mid', 'center', 'enemy_base'] as const,
  loopSequence: false,
  alertRange: 2 as const,
  targetPriority: ['nearest', 'lowest_hp', 'most_members'] as const,
  actionPriority: ['attack', 'capture', 'move'] as const,
  autoSP: false,
}
