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
  siege: 13.6094,
  clear_front: 7.4876,
  attack_joint: 5.7241,
  attack: 5.1843,
  skill_s2: 5.1970,
  skill_s1: 3.9936,
  ally_skill: 3.1924,
  clear_plaza: 2.5874,
  move_forward: 2.1112,
  end_early: 0.5007,
  s2MinHand: 1.0000,
  s1MinHand: 0.0000,
  skillWeights: {
    'aimela_s0': 3.8892,
    'aimela_s1': 4.6425,
    'akuya_s0': 3.9832,
    'akuya_s1': 5.3060,
    'aoliwei_s0': 3.8385,
    'aoliwei_s1': 4.6131,
    'baijin_s0': 4.4325,
    'baijin_s1': 6.1697,
    'dake_s0': 3.9293,
    'dake_s1': 5.4364,
    'jingqing_s0': 3.6577,
    'jingqing_s1': 3.9794,
    'migua_s0': 3.9894,
    'migua_s1': 5.3979,
    'pain_s0': 4.4046,
    'pain_s1': 6.4310,
    'pulasi_s0': 3.9357,
    'pulasi_s1': 4.1411,
    'pulun_s0': 4.5917,
    'pulun_s1': 5.9932,
    'qiamo_s0': 3.7888,
    'qiamo_s1': 5.3620,
    'qiancong_s0': 3.6663,
    'qiancong_s1': 4.8044,
    'saifiya_s0': 3.7464,
    'saifiya_s1': 4.7914,
    'tiehuo_s0': 3.7667,
    'tiehuo_s1': 5.0769,
    'xiabai_s0': 4.2140,
    'xiabai_s1': 5.7950,
    'xiahei_s0': 2.8823,
    'xiahei_s1': 3.6608,
    'xiaochu_s0': 3.9841,
    'xiaochu_s1': 4.7056,
    'xiaohui_s0': 3.8652,
    'xiaohui_s1': 5.0280,
    'xiaozi_s0': 3.8574,
    'xiaozi_s1': 4.6943,
    'xiluo_s0': 4.6827,
    'xiluo_s1': 7.8071,
  },
  cardWeights: {
    'agile': 3.6411,
    'best_partner': 2.5305,
    'block': 3.2306,
    'call_friends': 1.7502,
    'calm_thinking': 3.1575,
    'city_gate': 2.5763,
    'dodge': 3.6369,
    'fighting_spirit': 2.4784,
    'go_home': 1.6670,
    'intimidate': 3.5983,
    'joystick_fail': 2.8087,
    'mislead': 2.6753,
    'mob_group': 1.8568,
    'mutual_destruction': 3.6863,
    'reaction_master': 1.4811,
    'relay_point': 3.0140,
    'see_through': 2.0626,
  },
}

/** 對手權重：上一輪的 DYNAMIC_WEIGHTS（train.ts 在每 Phase 結束後輪替） */
export let OPPONENT_WEIGHTS: BotWeights = { ...BASE_WEIGHTS, skillWeights: {}, cardWeights: {} }
