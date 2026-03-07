// app/src/sim/botWeights.ts

// ─── 基礎權重（手動預設，長期穩定值） ─────────────────────────────────────
// Keys 使用 soul card 的 id 欄位格式（英文，如 eternal_night_rook_guhua）
export const BASE_WEIGHTS = {
  buyPriority: {
    'eternal_night_rook_guhua': 120,
    'eternal_night_knight_hunling': 95,
    'blood_bone_knight': 110,
    'styx_rook_mingyanche': 70,
    'dark_moon_rook_lanhua': 65,
    'styx_knight_yanling': 60,
    'dark_moon_knight_yingzi': 55,
    'styx_rook_feiyan': 50,
    // ── 鐵衛氏族初始權重 ──────────────────────────────────────────
    'iron_guard_elephant_junlingxiang': 95,  // 全軍 ATK 氣場：核心強度
    'iron_guard_elephant_tiegu': 90,          // 全軍減傷氣場：防禦核心
    'iron_guard_rook_tieche': 88,             // 無視阻擋 + 免費射擊
    'iron_guard_cannon_baobingpao': 85,       // 高 ATK + 宮內傷害
    'iron_guard_rook_junhua': 82,             // 軍勢傷害 + 軍援
    'iron_guard_cannon_paobinghua': 80,       // 連鎖 + 傷害加成
    'iron_guard_knight_lianjunma': 75,        // 移動後射擊 + 相鄰卒加傷
    'iron_guard_knight_qibingling': 70,       // 軍援
    'iron_guard_advisor_junhu': 62,           // 整編（免費移動卒）
    'iron_guard_advisor_zhaoshi': 62,         // 後勤（免費復活卒）
    default: 30,
  } as Record<string, number>,

  shootScoring: {
    targetIsKing: -15000,
    targetIsHighValueBase: -8000,
    targetHasHighPrioritySoul: -5000,
    targetHpPerPoint: -80,
    myCorpsesBonusPer10: -300,
    canPierceExtra: -600,
    canChainExtra: -500,
    ignoreBlockingBonus: -400,
  } as Record<string, number>,

  moveScoring: {
    distanceToEnemyKingPerTile: 60,
    distanceToAnyEnemyPerTile: 40,
    corpsesNearbyBonusPerCorpse: -35,
    palaceSafetyBonus: -250,
    avoidEnemyRangeMalus: 300,
  } as Record<string, number>,
}

// ─── 動態權重（從 report JSON 訓練後更新，由 updateDynamicWeights.js 寫入） ─
// 初始為空，等第一次模擬後自動填入
export const DYNAMIC_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "iron_guard_rook_tieche": 219,
    "iron_guard_cannon_baobingpao": 197,
    "iron_guard_knight_qibingling": 190,
    "iron_guard_advisor_junhu": 196,
    "iron_guard_rook_junhua": 202,
    "iron_guard_knight_lianjunma": 165,
    "eternal_night_knight_xuegu": 167,
    "styx_knight_yanling": 150,
    "dark_moon_advisor_yingji": 224,
    "iron_guard_elephant_tiegu": 210,
    "iron_guard_advisor_zhaoshi": 187,
    "styx_rook_feiyan": 191,
    "styx_rook_mingyanche": 130,
    "iron_guard_cannon_paobinghua": 176,
    "dark_moon_rook_lanhua": 179,
    "iron_guard_elephant_junlingxiang": 194,
    "eternal_night_elephant_mingguxiang": 152,
    "eternal_night_cannon_minggupao": 155,
    "eternal_night_knight_hunling": 127,
    "eternal_night_rook_guhua": 184,
    "eternal_night_cannon_suigu": 167,
    "dark_moon_advisor_yeji": 175,
    "dark_moon_elephant_yueji": 173,
    "eternal_night_rook_minggouche": 170,
    "styx_elephant_mingleixiang": 164,
    "styx_advisor_minghu": 170,
    "styx_cannon_baoyan": 127,
    "eternal_night_elephant_gulingxiang": 138,
    "styx_knight_xueyan": 114,
    "dark_moon_knight_yingzi": 118,
    "styx_elephant_mingyanxiang": 169,
    "dark_moon_cannon_yehua": 147,
    "dark_moon_knight_wuying": 143,
    "styx_advisor_yanshi": 126,
    "eternal_night_advisor_hunshi": 143,
    "dark_moon_cannon_fenghua": 149,
    "eternal_night_advisor_guhu": 143,
    "dark_moon_rook_yinghua": 85,
    "dark_moon_elephant_youji": 98,
    "styx_cannon_mingleipao": 79
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -379
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -260,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "iron_guard_elephant_tiegu": 223,
    "iron_guard_advisor_zhaoshi": 196,
    "iron_guard_knight_qibingling": 182,
    "iron_guard_knight_lianjunma": 160,
    "iron_guard_elephant_junlingxiang": 208,
    "styx_rook_feiyan": 198,
    "eternal_night_rook_guhua": 201,
    "dark_moon_rook_lanhua": 192,
    "iron_guard_cannon_baobingpao": 190,
    "iron_guard_cannon_paobinghua": 186,
    "iron_guard_rook_junhua": 198,
    "eternal_night_cannon_minggupao": 161,
    "eternal_night_rook_minggouche": 190,
    "dark_moon_cannon_yehua": 161,
    "dark_moon_advisor_yingji": 218,
    "iron_guard_rook_tieche": 182,
    "iron_guard_advisor_junhu": 176,
    "dark_moon_knight_wuying": 156,
    "dark_moon_advisor_yeji": 174,
    "dark_moon_cannon_fenghua": 164,
    "dark_moon_knight_yingzi": 128,
    "eternal_night_advisor_guhu": 159,
    "styx_cannon_baoyan": 130,
    "styx_knight_yanling": 129,
    "eternal_night_knight_xuegu": 151,
    "styx_elephant_mingyanxiang": 173,
    "eternal_night_elephant_mingguxiang": 142,
    "dark_moon_elephant_yueji": 165,
    "eternal_night_elephant_gulingxiang": 136,
    "styx_advisor_minghu": 166,
    "styx_knight_xueyan": 112,
    "eternal_night_cannon_suigu": 163,
    "styx_rook_mingyanche": 111,
    "dark_moon_elephant_youji": 115,
    "eternal_night_advisor_hunshi": 144,
    "styx_elephant_mingleixiang": 153,
    "styx_advisor_yanshi": 124,
    "dark_moon_rook_yinghua": 93,
    "eternal_night_knight_hunling": 108,
    "styx_cannon_mingleipao": 80
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -378
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -258,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 合併函數 ──────────────────────────────────────────────────────────────────
// blend: 70% dynamic + 30% base（讓動態訓練主導，但保留基礎穩定性）
export function getMergedWeights(mode: 'base' | 'dynamic' | 'blend' | 'opponent' = 'blend'): typeof BASE_WEIGHTS {
  if (mode === 'base') return BASE_WEIGHTS
  if (mode === 'dynamic') return DYNAMIC_WEIGHTS
  if (mode === 'opponent') return OPPONENT_WEIGHTS

  const dynToBlend = DYNAMIC_WEIGHTS
  const blended: typeof BASE_WEIGHTS = {
    buyPriority: {} as Record<string, number>,
    shootScoring: {} as Record<string, number>,
    moveScoring: {} as Record<string, number>,
  }

  const sections = ['buyPriority', 'shootScoring', 'moveScoring'] as const
  for (const section of sections) {
    const baseSection = BASE_WEIGHTS[section]
    const dynSection = dynToBlend[section]
    const merged: Record<string, number> = {}

    // Base keys
    for (const k of Object.keys(baseSection)) {
      const baseVal = baseSection[k] ?? 0
      const dynVal = dynSection[k] ?? baseVal
      merged[k] = Math.round(0.7 * dynVal + 0.3 * baseVal)
    }
    // Dynamic-only keys (new cards from training)
    for (const k of Object.keys(dynSection)) {
      if (!(k in baseSection)) {
        merged[k] = dynSection[k] ?? 0
      }
    }

    blended[section] = merged as any
  }

  return blended
}
