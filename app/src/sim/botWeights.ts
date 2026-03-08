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
    "dark_moon_advisor_yingji": 244,
    "iron_guard_elephant_junlingxiang": 230,
    "gold_merc_knight_biying": 175,
    "iron_guard_knight_qibingling": 170,
    "styx_cannon_mingleipao": 196,
    "eternal_night_knight_hunling": 183,
    "gold_merc_cannon_caiyan": 181,
    "death_oath_rook_xuelie": 199,
    "iron_guard_elephant_tiegu": 203,
    "eternal_night_rook_guhua": 203,
    "eternal_night_rook_minggouche": 178,
    "iron_guard_cannon_paobinghua": 178,
    "dark_moon_cannon_yehua": 174,
    "iron_guard_rook_junhua": 191,
    "styx_rook_feiyan": 173,
    "death_oath_knight_nihun": 136,
    "death_oath_elephant_jueyu": 135,
    "death_oath_advisor_moming": 182,
    "death_oath_rook_chiyun": 177,
    "gold_merc_elephant_caishi": 119,
    "iron_guard_rook_tieche": 125,
    "iron_guard_advisor_junhu": 164,
    "dark_moon_rook_yinghua": 133,
    "styx_rook_mingyanche": 117,
    "eternal_night_elephant_mingguxiang": 169,
    "dark_moon_rook_lanhua": 187,
    "styx_advisor_minghu": 159,
    "iron_guard_knight_lianjunma": 126,
    "eternal_night_elephant_gulingxiang": 144,
    "gold_merc_advisor_caihun": 181,
    "eternal_night_advisor_guhu": 153,
    "dark_moon_cannon_fenghua": 163,
    "gold_merc_advisor_bishi": 189,
    "gold_merc_rook_luejin": 170,
    "styx_advisor_yanshi": 134,
    "gold_merc_elephant_shoujin": 127,
    "dark_moon_knight_wuying": 160,
    "eternal_night_knight_xuegu": 152,
    "dark_moon_elephant_yueji": 165,
    "gold_merc_knight_jinshi": 83,
    "dark_moon_elephant_youji": 128,
    "styx_elephant_mingyanxiang": 166,
    "eternal_night_advisor_hunshi": 159,
    "death_oath_advisor_tieshi": 137,
    "eternal_night_cannon_suigu": 137,
    "iron_guard_cannon_baobingpao": 134,
    "styx_cannon_baoyan": 122,
    "eternal_night_cannon_minggupao": 131,
    "iron_guard_advisor_zhaoshi": 114,
    "styx_elephant_mingleixiang": 153,
    "death_oath_elephant_fenhun": 123,
    "death_oath_cannon_nupo": 87,
    "styx_knight_xueyan": 109,
    "gold_merc_rook_caifa": 86,
    "dark_moon_advisor_yeji": 137,
    "death_oath_cannon_yanshi": 73,
    "gold_merc_cannon_jinyan": 84,
    "death_oath_knight_mingyan": 84,
    "styx_knight_yanling": 72,
    "dark_moon_knight_yingzi": 40
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -369
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -255,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "iron_guard_rook_junhua": 207,
    "iron_guard_elephant_junlingxiang": 221,
    "death_oath_rook_chiyun": 183,
    "dark_moon_advisor_yingji": 227,
    "dark_moon_rook_lanhua": 210,
    "styx_cannon_mingleipao": 185,
    "styx_cannon_baoyan": 147,
    "gold_merc_rook_luejin": 192,
    "death_oath_rook_xuelie": 192,
    "death_oath_knight_mingyan": 115,
    "eternal_night_rook_guhua": 195,
    "death_oath_knight_nihun": 126,
    "styx_rook_feiyan": 178,
    "gold_merc_advisor_bishi": 199,
    "iron_guard_elephant_tiegu": 196,
    "eternal_night_cannon_minggupao": 154,
    "iron_guard_cannon_paobinghua": 166,
    "iron_guard_cannon_baobingpao": 160,
    "gold_merc_knight_jinshi": 108,
    "death_oath_advisor_moming": 175,
    "eternal_night_knight_xuegu": 174,
    "gold_merc_advisor_caihun": 190,
    "eternal_night_cannon_suigu": 154,
    "eternal_night_elephant_mingguxiang": 177,
    "dark_moon_cannon_yehua": 163,
    "iron_guard_knight_qibingling": 144,
    "iron_guard_advisor_junhu": 166,
    "dark_moon_knight_wuying": 171,
    "dark_moon_elephant_yueji": 167,
    "styx_elephant_mingleixiang": 163,
    "gold_merc_cannon_caiyan": 158,
    "dark_moon_cannon_fenghua": 162,
    "eternal_night_rook_minggouche": 159,
    "dark_moon_rook_yinghua": 128,
    "styx_elephant_mingyanxiang": 171,
    "eternal_night_advisor_hunshi": 162,
    "styx_advisor_minghu": 153,
    "styx_advisor_yanshi": 124,
    "gold_merc_cannon_jinyan": 106,
    "death_oath_elephant_fenhun": 131,
    "death_oath_elephant_jueyu": 119,
    "gold_merc_knight_biying": 146,
    "dark_moon_advisor_yeji": 153,
    "iron_guard_advisor_zhaoshi": 107,
    "eternal_night_advisor_guhu": 145,
    "iron_guard_rook_tieche": 114,
    "styx_knight_xueyan": 117,
    "eternal_night_knight_hunling": 152,
    "death_oath_cannon_nupo": 91,
    "eternal_night_elephant_gulingxiang": 132,
    "gold_merc_elephant_shoujin": 121,
    "death_oath_advisor_tieshi": 133,
    "dark_moon_elephant_youji": 126,
    "styx_rook_mingyanche": 97,
    "gold_merc_elephant_caishi": 106,
    "iron_guard_knight_lianjunma": 112,
    "death_oath_cannon_yanshi": 76,
    "gold_merc_rook_caifa": 76,
    "styx_knight_yanling": 72,
    "dark_moon_knight_yingzi": 50
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -369
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -254,
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
