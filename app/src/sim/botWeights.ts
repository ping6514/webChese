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
    "eternal_night_rook_minggouche": 198,
    "iron_guard_rook_junhua": 201,
    "gold_merc_knight_jinshi": 116,
    "dark_moon_advisor_yingji": 231,
    "iron_guard_cannon_paobinghua": 164,
    "styx_cannon_mingleipao": 198,
    "dark_moon_rook_lanhua": 202,
    "iron_guard_knight_qibingling": 159,
    "iron_guard_elephant_tiegu": 199,
    "eternal_night_elephant_mingguxiang": 183,
    "gold_merc_elephant_caishi": 153,
    "eternal_night_cannon_minggupao": 163,
    "iron_guard_cannon_baobingpao": 162,
    "gold_merc_cannon_jinyan": 131,
    "iron_guard_elephant_junlingxiang": 195,
    "styx_rook_feiyan": 177,
    "gold_merc_advisor_caihun": 199,
    "eternal_night_knight_xuegu": 176,
    "dark_moon_rook_yinghua": 130,
    "dark_moon_cannon_fenghua": 171,
    "styx_advisor_minghu": 174,
    "eternal_night_knight_hunling": 177,
    "eternal_night_rook_guhua": 198,
    "death_oath_rook_xuelie": 177,
    "gold_merc_rook_caifa": 147,
    "death_oath_elephant_jueyu": 135,
    "styx_elephant_mingyanxiang": 188,
    "gold_merc_rook_luejin": 184,
    "iron_guard_advisor_junhu": 163,
    "iron_guard_knight_lianjunma": 127,
    "gold_merc_cannon_caiyan": 152,
    "eternal_night_cannon_suigu": 163,
    "styx_advisor_yanshi": 155,
    "death_oath_knight_nihun": 139,
    "styx_cannon_baoyan": 132,
    "eternal_night_advisor_guhu": 147,
    "death_oath_rook_chiyun": 145,
    "gold_merc_advisor_bishi": 179,
    "dark_moon_advisor_yeji": 140,
    "dark_moon_elephant_youji": 152,
    "death_oath_advisor_tieshi": 140,
    "gold_merc_knight_biying": 149,
    "dark_moon_elephant_yueji": 165,
    "styx_rook_mingyanche": 128,
    "eternal_night_elephant_gulingxiang": 141,
    "dark_moon_cannon_yehua": 115,
    "dark_moon_knight_wuying": 156,
    "death_oath_advisor_moming": 167,
    "eternal_night_advisor_hunshi": 157,
    "styx_elephant_mingleixiang": 158,
    "death_oath_knight_mingyan": 76,
    "gold_merc_elephant_shoujin": 117,
    "iron_guard_advisor_zhaoshi": 98,
    "styx_knight_xueyan": 109,
    "death_oath_elephant_fenhun": 97,
    "iron_guard_rook_tieche": 79,
    "death_oath_cannon_yanshi": 66,
    "death_oath_cannon_nupo": 69,
    "styx_knight_yanling": 70,
    "dark_moon_knight_yingzi": 46
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
    "palaceSafetyBonus": -253,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "death_oath_rook_xuelie": 193,
    "eternal_night_rook_guhua": 211,
    "eternal_night_knight_hunling": 190,
    "iron_guard_elephant_tiegu": 201,
    "death_oath_advisor_moming": 191,
    "iron_guard_knight_qibingling": 154,
    "gold_merc_rook_luejin": 197,
    "iron_guard_rook_junhua": 187,
    "styx_elephant_mingyanxiang": 189,
    "dark_moon_advisor_yingji": 228,
    "eternal_night_knight_xuegu": 184,
    "gold_merc_advisor_caihun": 199,
    "death_oath_knight_nihun": 150,
    "styx_cannon_baoyan": 136,
    "gold_merc_cannon_jinyan": 120,
    "styx_cannon_mingleipao": 192,
    "iron_guard_elephant_junlingxiang": 200,
    "eternal_night_cannon_suigu": 174,
    "dark_moon_rook_lanhua": 196,
    "eternal_night_elephant_mingguxiang": 177,
    "eternal_night_rook_minggouche": 178,
    "death_oath_elephant_jueyu": 128,
    "iron_guard_cannon_baobingpao": 162,
    "styx_rook_feiyan": 181,
    "eternal_night_elephant_gulingxiang": 155,
    "styx_rook_mingyanche": 147,
    "gold_merc_knight_biying": 162,
    "gold_merc_advisor_bishi": 189,
    "dark_moon_knight_wuying": 173,
    "gold_merc_elephant_caishi": 143,
    "eternal_night_cannon_minggupao": 155,
    "gold_merc_cannon_caiyan": 154,
    "dark_moon_elephant_youji": 156,
    "iron_guard_advisor_junhu": 159,
    "eternal_night_advisor_hunshi": 164,
    "gold_merc_rook_caifa": 132,
    "styx_advisor_minghu": 164,
    "dark_moon_cannon_fenghua": 156,
    "iron_guard_rook_tieche": 101,
    "dark_moon_rook_yinghua": 104,
    "eternal_night_advisor_guhu": 139,
    "styx_advisor_yanshi": 147,
    "death_oath_knight_mingyan": 81,
    "gold_merc_elephant_shoujin": 127,
    "styx_elephant_mingleixiang": 166,
    "iron_guard_knight_lianjunma": 116,
    "death_oath_rook_chiyun": 144,
    "styx_knight_xueyan": 121,
    "gold_merc_knight_jinshi": 83,
    "dark_moon_elephant_yueji": 161,
    "dark_moon_advisor_yeji": 123,
    "death_oath_elephant_fenhun": 107,
    "dark_moon_cannon_yehua": 105,
    "styx_knight_yanling": 85,
    "iron_guard_cannon_paobinghua": 126,
    "iron_guard_advisor_zhaoshi": 93,
    "death_oath_advisor_tieshi": 122,
    "death_oath_cannon_yanshi": 68,
    "death_oath_cannon_nupo": 65,
    "dark_moon_knight_yingzi": 38
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
