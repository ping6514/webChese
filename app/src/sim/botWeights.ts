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
    "dark_moon_knight_yingzi": 186,
    "iron_guard_elephant_tiegu": 216,
    "iron_guard_cannon_baobingpao": 199,
    "iron_guard_rook_junhua": 201,
    "iron_guard_knight_lianjunma": 175,
    "styx_rook_mingyanche": 143,
    "styx_rook_feiyan": 198,
    "dark_moon_rook_lanhua": 199,
    "dark_moon_advisor_yingji": 227,
    "styx_knight_yanling": 151,
    "styx_cannon_baoyan": 153,
    "iron_guard_cannon_paobinghua": 179,
    "iron_guard_elephant_junlingxiang": 190,
    "iron_guard_rook_tieche": 190,
    "iron_guard_advisor_junhu": 186,
    "iron_guard_advisor_zhaoshi": 193,
    "eternal_night_rook_minggouche": 178,
    "styx_advisor_yanshi": 169,
    "iron_guard_knight_qibingling": 160,
    "dark_moon_cannon_yehua": 163,
    "eternal_night_elephant_mingguxiang": 147,
    "dark_moon_cannon_fenghua": 169,
    "dark_moon_rook_yinghua": 104,
    "eternal_night_knight_hunling": 149,
    "eternal_night_cannon_minggupao": 139,
    "eternal_night_advisor_guhu": 143,
    "eternal_night_rook_guhua": 170,
    "eternal_night_cannon_suigu": 159,
    "eternal_night_knight_xuegu": 133,
    "dark_moon_knight_wuying": 159,
    "dark_moon_elephant_yueji": 170,
    "styx_elephant_mingleixiang": 162,
    "eternal_night_elephant_gulingxiang": 138,
    "dark_moon_advisor_yeji": 160,
    "styx_advisor_minghu": 166,
    "styx_elephant_mingyanxiang": 149,
    "dark_moon_elephant_youji": 132,
    "styx_cannon_mingleipao": 111,
    "eternal_night_advisor_hunshi": 145,
    "styx_knight_xueyan": 94
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -381
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -258,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "iron_guard_rook_tieche": 206,
    "iron_guard_knight_qibingling": 177,
    "iron_guard_advisor_zhaoshi": 208,
    "dark_moon_rook_lanhua": 203,
    "iron_guard_advisor_junhu": 199,
    "dark_moon_knight_yingzi": 163,
    "iron_guard_elephant_tiegu": 207,
    "iron_guard_cannon_paobinghua": 187,
    "styx_rook_feiyan": 202,
    "iron_guard_knight_lianjunma": 173,
    "dark_moon_advisor_yingji": 226,
    "iron_guard_cannon_baobingpao": 190,
    "eternal_night_rook_minggouche": 179,
    "eternal_night_rook_guhua": 187,
    "iron_guard_rook_junhua": 188,
    "styx_knight_yanling": 146,
    "eternal_night_elephant_gulingxiang": 143,
    "eternal_night_knight_xuegu": 149,
    "dark_moon_knight_wuying": 170,
    "styx_rook_mingyanche": 121,
    "eternal_night_cannon_minggupao": 147,
    "styx_advisor_minghu": 176,
    "styx_cannon_baoyan": 141,
    "eternal_night_knight_hunling": 150,
    "dark_moon_cannon_fenghua": 162,
    "iron_guard_elephant_junlingxiang": 187,
    "dark_moon_cannon_yehua": 158,
    "eternal_night_cannon_suigu": 169,
    "dark_moon_elephant_youji": 143,
    "styx_cannon_mingleipao": 127,
    "eternal_night_elephant_mingguxiang": 142,
    "eternal_night_advisor_hunshi": 153,
    "styx_knight_xueyan": 119,
    "dark_moon_elephant_yueji": 165,
    "eternal_night_advisor_guhu": 133,
    "styx_elephant_mingyanxiang": 149,
    "styx_elephant_mingleixiang": 154,
    "dark_moon_advisor_yeji": 161,
    "styx_advisor_yanshi": 142,
    "dark_moon_rook_yinghua": 92
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -381
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -260,
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
