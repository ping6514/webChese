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
    "death_oath_rook_xuelie": 200,
    "iron_guard_elephant_junlingxiang": 208,
    "iron_guard_knight_qibingling": 143,
    "dark_moon_advisor_yingji": 227,
    "styx_rook_feiyan": 179,
    "gold_merc_cannon_caiyan": 168,
    "eternal_night_cannon_minggupao": 177,
    "iron_guard_rook_junhua": 192,
    "eternal_night_rook_guhua": 210,
    "dark_moon_rook_lanhua": 197,
    "eternal_night_knight_xuegu": 186,
    "iron_guard_advisor_junhu": 187,
    "iron_guard_elephant_tiegu": 197,
    "eternal_night_elephant_mingguxiang": 174,
    "gold_merc_knight_biying": 165,
    "gold_merc_rook_luejin": 196,
    "dark_moon_knight_wuying": 177,
    "death_oath_advisor_tieshi": 161,
    "death_oath_rook_chiyun": 173,
    "iron_guard_cannon_baobingpao": 153,
    "dark_moon_cannon_yehua": 128,
    "gold_merc_rook_caifa": 140,
    "death_oath_advisor_moming": 195,
    "iron_guard_knight_lianjunma": 143,
    "styx_cannon_mingleipao": 190,
    "death_oath_cannon_nupo": 156,
    "eternal_night_knight_hunling": 160,
    "iron_guard_cannon_paobinghua": 145,
    "styx_rook_mingyanche": 120,
    "styx_advisor_minghu": 181,
    "gold_merc_advisor_bishi": 184,
    "eternal_night_rook_minggouche": 162,
    "eternal_night_elephant_gulingxiang": 167,
    "gold_merc_advisor_caihun": 170,
    "death_oath_elephant_jueyu": 110,
    "gold_merc_cannon_jinyan": 106,
    "dark_moon_advisor_yeji": 160,
    "dark_moon_elephant_yueji": 173,
    "styx_knight_xueyan": 134,
    "gold_merc_elephant_caishi": 126,
    "gold_merc_knight_jinshi": 123,
    "dark_moon_elephant_youji": 139,
    "eternal_night_advisor_guhu": 146,
    "death_oath_cannon_yanshi": 140,
    "styx_advisor_yanshi": 124,
    "styx_elephant_mingyanxiang": 168,
    "styx_elephant_mingleixiang": 163,
    "iron_guard_rook_tieche": 86,
    "styx_cannon_baoyan": 96,
    "styx_knight_yanling": 95,
    "dark_moon_rook_yinghua": 112,
    "death_oath_knight_nihun": 114,
    "eternal_night_advisor_hunshi": 157,
    "dark_moon_cannon_fenghua": 158,
    "gold_merc_elephant_shoujin": 122,
    "death_oath_elephant_fenhun": 118,
    "death_oath_knight_mingyan": 59,
    "eternal_night_cannon_suigu": 86,
    "dark_moon_knight_yingzi": 65,
    "iron_guard_advisor_zhaoshi": 76
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -367
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -254,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "styx_cannon_mingleipao": 209,
    "gold_merc_rook_luejin": 204,
    "eternal_night_rook_guhua": 215,
    "eternal_night_cannon_minggupao": 172,
    "death_oath_rook_xuelie": 191,
    "iron_guard_elephant_tiegu": 200,
    "gold_merc_knight_jinshi": 151,
    "dark_moon_advisor_yingji": 226,
    "death_oath_knight_nihun": 134,
    "eternal_night_elephant_gulingxiang": 172,
    "eternal_night_knight_hunling": 173,
    "death_oath_rook_chiyun": 172,
    "gold_merc_elephant_caishi": 137,
    "gold_merc_advisor_bishi": 189,
    "eternal_night_knight_xuegu": 177,
    "iron_guard_rook_junhua": 182,
    "eternal_night_rook_minggouche": 173,
    "death_oath_cannon_yanshi": 160,
    "iron_guard_elephant_junlingxiang": 203,
    "death_oath_advisor_moming": 192,
    "dark_moon_rook_lanhua": 197,
    "dark_moon_elephant_yueji": 178,
    "styx_advisor_minghu": 181,
    "eternal_night_advisor_hunshi": 168,
    "iron_guard_advisor_junhu": 180,
    "gold_merc_advisor_caihun": 173,
    "styx_rook_feiyan": 164,
    "dark_moon_elephant_youji": 143,
    "dark_moon_cannon_fenghua": 175,
    "styx_elephant_mingyanxiang": 176,
    "styx_elephant_mingleixiang": 171,
    "gold_merc_cannon_caiyan": 149,
    "iron_guard_knight_lianjunma": 141,
    "gold_merc_rook_caifa": 128,
    "dark_moon_advisor_yeji": 165,
    "death_oath_elephant_fenhun": 135,
    "iron_guard_cannon_baobingpao": 141,
    "dark_moon_knight_wuying": 168,
    "eternal_night_elephant_mingguxiang": 162,
    "styx_knight_yanling": 97,
    "eternal_night_advisor_guhu": 146,
    "dark_moon_rook_yinghua": 118,
    "death_oath_cannon_nupo": 154,
    "gold_merc_knight_biying": 158,
    "styx_knight_xueyan": 135,
    "iron_guard_cannon_paobinghua": 140,
    "iron_guard_knight_qibingling": 110,
    "gold_merc_elephant_shoujin": 133,
    "styx_advisor_yanshi": 117,
    "death_oath_advisor_tieshi": 136,
    "styx_rook_mingyanche": 111,
    "gold_merc_cannon_jinyan": 93,
    "styx_cannon_baoyan": 92,
    "death_oath_elephant_jueyu": 91,
    "eternal_night_cannon_suigu": 93,
    "iron_guard_rook_tieche": 73,
    "dark_moon_knight_yingzi": 72,
    "death_oath_knight_mingyan": 52,
    "iron_guard_advisor_zhaoshi": 87,
    "dark_moon_cannon_yehua": 90
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -365
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -252,
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
