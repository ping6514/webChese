// BG Card Game — Bot 操作權重定義
// 由 train.ts 訓練後自動更新 DYNAMIC_WEIGHTS

export type ActionCategory =
  | 'siege'         // 攻城
  | 'clear_front'   // 在敵主堡清磚
  | 'attack_joint'  // 聯合攻擊
  | 'attack'        // 普通攻擊
  | 'skill_s2'      // 使用S2技能（通用fallback）
  | 'skill_s1'      // 使用S1技能（通用fallback）
  | 'ally_skill'    // 聯合ally的技能
  | 'clear_plaza'   // 廣場清磚
  | 'move_forward'  // 前進
  | 'end_early'     // 提前結束BG行動

export type BotWeights = {
  // 宏觀行動優先得分（越高越優先選擇）
  siege: number
  clear_front: number
  attack_joint: number
  attack: number
  skill_s2: number      // 個別技能未訓練時的通用fallback
  skill_s1: number
  ally_skill: number
  clear_plaza: number
  move_forward: number
  end_early: number
  // 手牌保留門檻：使用S2/S1前，手牌至少要剩 N 張（故意留手牌）
  s2MinHand: number
  s1MinHand: number
  // 個別 BG 技能權重（key = `${cardId}_s${skillIndex}`，如 "dake_s0"）
  // 有值時覆蓋通用 skill_s1/s2 fallback
  skillWeights: Record<string, number>
  // 卡片使用權重（事件卡/建築卡/反應卡 id → 優先分）
  // 有值時覆蓋 bot.ts 內建的 DEFAULT_CARD_WEIGHTS
  cardWeights: Record<string, number>
}

/** 手動調整的基礎權重 */
export const BASE_WEIGHTS: BotWeights = {
  siege: 10,
  clear_front: 8,
  attack_joint: 7,
  attack: 6,
  skill_s2: 5,
  skill_s1: 4,
  ally_skill: 3,
  clear_plaza: 3,
  move_forward: 2,
  end_early: 0.5,
  s2MinHand: 2,
  s1MinHand: 0,
  skillWeights: {},
  cardWeights: {},
}

/** 訓練後動態更新的權重（train.ts 直接修改此物件） */
export const DYNAMIC_WEIGHTS: BotWeights = {
  siege: 14.7917,
  clear_front: 7.9185,
  attack_joint: 5.6761,
  attack: 5.5940,
  skill_s2: 4.9884,
  skill_s1: 3.8840,
  ally_skill: 2.9998,
  clear_plaza: 2.4869,
  move_forward: 2.0605,
  end_early: 0.4800,
  s2MinHand: 1.0000,
  s1MinHand: 0.0000,
  skillWeights: {
    'aimela_s0': 3.8418,
    'aimela_s1': 4.3416,
    'akuya_s0': 3.6277,
    'akuya_s1': 5.1253,
    'aoliwei_s0': 3.9528,
    'aoliwei_s1': 4.1943,
    'baijin_s0': 4.6930,
    'baijin_s1': 6.6225,
    'dake_s0': 3.8602,
    'dake_s1': 5.7456,
    'jingqing_s0': 3.5733,
    'jingqing_s1': 3.9011,
    'migua_s0': 4.1705,
    'migua_s1': 5.5264,
    'pain_s0': 4.3005,
    'pain_s1': 5.2703,
    'pulasi_s0': 4.0359,
    'pulasi_s1': 3.9271,
    'pulun_s0': 4.4783,
    'pulun_s1': 5.5896,
    'qiamo_s0': 3.7986,
    'qiamo_s1': 5.1314,
    'qiancong_s0': 3.7884,
    'qiancong_s1': 4.8545,
    'saifiya_s0': 3.7246,
    'saifiya_s1': 4.6915,
    'tiehuo_s0': 3.7024,
    'tiehuo_s1': 4.9092,
    'xiabai_s0': 4.3713,
    'xiabai_s1': 6.0647,
    'xiahei_s0': 2.8450,
    'xiahei_s1': 3.4303,
    'xiaochu_s0': 4.4439,
    'xiaochu_s1': 5.1117,
    'xiaohui_s0': 3.9840,
    'xiaohui_s1': 5.0339,
    'xiaozi_s0': 4.1536,
    'xiaozi_s1': 4.3960,
    'xiluo_s0': 4.1508,
    'xiluo_s1': 6.6296,
  },
  cardWeights: {
    'agile': 3.5446,
    'best_partner': 2.6116,
    'block': 3.2208,
    'call_friends': 1.7995,
    'calm_thinking': 3.0833,
    'city_gate': 2.6879,
    'dodge': 3.6291,
    'fighting_spirit': 2.5180,
    'go_home': 1.6670,
    'intimidate': 3.5975,
    'joystick_fail': 2.8949,
    'mislead': 2.5509,
    'mob_group': 1.8641,
    'mutual_destruction': 3.6006,
    'reaction_master': 1.5161,
    'relay_point': 3.0744,
    'see_through': 2.0609,
  },
}

/** 對手權重：上一輪的 DYNAMIC_WEIGHTS（train.ts 在每 Phase 結束後輪替） */
export let OPPONENT_WEIGHTS: BotWeights = { ...BASE_WEIGHTS, skillWeights: {}, cardWeights: {} }
