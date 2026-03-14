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
    "eternal_night_elephant_mingguxiang": 275,
    "death_oath_knight_nihun": 190,
    "styx_knight_yanling": 166,
    "styx_rook_mingyanche": 183,
    "eternal_night_elephant_gulingxiang": 220,
    "gold_merc_rook_caifa": 202,
    "iron_guard_rook_tieche": 194,
    "eternal_night_rook_guhua": 204,
    "eternal_night_knight_xuegu": 165,
    "iron_guard_elephant_tiegu": 194,
    "eternal_night_cannon_suigu": 185,
    "dark_moon_advisor_yingji": 219,
    "gold_merc_rook_luejin": 179,
    "styx_cannon_baoyan": 116,
    "styx_knight_xueyan": 184,
    "death_oath_advisor_moming": 202,
    "gold_merc_advisor_bishi": 185,
    "dark_moon_cannon_fenghua": 184,
    "iron_guard_rook_junhua": 180,
    "gold_merc_advisor_caihun": 172,
    "gold_merc_cannon_caiyan": 168,
    "death_oath_cannon_nupo": 162,
    "death_oath_advisor_tieshi": 192,
    "iron_guard_knight_qibingling": 150,
    "death_oath_elephant_jueyu": 134,
    "gold_merc_knight_biying": 124,
    "dark_moon_knight_wuying": 171,
    "dark_moon_cannon_yehua": 162,
    "dark_moon_rook_lanhua": 164,
    "styx_rook_feiyan": 141,
    "dark_moon_knight_yingzi": 150,
    "eternal_night_rook_minggouche": 126,
    "death_oath_rook_chiyun": 150,
    "eternal_night_cannon_minggupao": 174,
    "iron_guard_knight_lianjunma": 161,
    "dark_moon_elephant_youji": 156,
    "iron_guard_elephant_junlingxiang": 159,
    "death_oath_elephant_fenhun": 152,
    "gold_merc_elephant_caishi": 115,
    "dark_moon_elephant_yueji": 156,
    "death_oath_rook_xuelie": 163,
    "gold_merc_cannon_jinyan": 98,
    "dark_moon_rook_yinghua": 114,
    "dark_moon_advisor_yeji": 151,
    "gold_merc_knight_jinshi": 98,
    "iron_guard_advisor_zhaoshi": 139,
    "death_oath_cannon_yanshi": 134,
    "styx_advisor_yanshi": 135,
    "iron_guard_cannon_paobinghua": 135,
    "gold_merc_elephant_shoujin": 137,
    "eternal_night_advisor_hunshi": 138,
    "styx_elephant_mingleixiang": 134,
    "iron_guard_advisor_junhu": 126,
    "styx_cannon_mingleipao": 123,
    "styx_advisor_minghu": 146,
    "styx_elephant_mingyanxiang": 137,
    "death_oath_knight_mingyan": 83,
    "eternal_night_advisor_guhu": 114,
    "iron_guard_cannon_baobingpao": 75,
    "eternal_night_knight_hunling": 98
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -376
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -252,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "eternal_night_elephant_mingguxiang": 264,
    "iron_guard_rook_tieche": 190,
    "dark_moon_rook_lanhua": 186,
    "eternal_night_rook_guhua": 201,
    "styx_knight_xueyan": 183,
    "eternal_night_elephant_gulingxiang": 214,
    "eternal_night_cannon_minggupao": 191,
    "styx_rook_mingyanche": 180,
    "gold_merc_rook_caifa": 193,
    "iron_guard_rook_junhua": 185,
    "iron_guard_advisor_junhu": 154,
    "death_oath_cannon_yanshi": 150,
    "iron_guard_advisor_zhaoshi": 159,
    "iron_guard_elephant_tiegu": 186,
    "eternal_night_cannon_suigu": 174,
    "gold_merc_cannon_caiyan": 165,
    "iron_guard_elephant_junlingxiang": 173,
    "iron_guard_knight_lianjunma": 179,
    "death_oath_advisor_tieshi": 196,
    "gold_merc_advisor_caihun": 167,
    "dark_moon_advisor_yingji": 211,
    "styx_cannon_baoyan": 105,
    "gold_merc_rook_luejin": 168,
    "dark_moon_knight_yingzi": 163,
    "styx_knight_yanling": 143,
    "iron_guard_knight_qibingling": 158,
    "gold_merc_knight_jinshi": 108,
    "death_oath_rook_xuelie": 180,
    "death_oath_rook_chiyun": 152,
    "death_oath_cannon_nupo": 163,
    "death_oath_elephant_jueyu": 123,
    "death_oath_advisor_moming": 194,
    "dark_moon_rook_yinghua": 113,
    "gold_merc_advisor_bishi": 172,
    "dark_moon_knight_wuying": 168,
    "dark_moon_cannon_fenghua": 174,
    "gold_merc_knight_biying": 111,
    "iron_guard_cannon_paobinghua": 151,
    "eternal_night_knight_xuegu": 139,
    "death_oath_knight_nihun": 147,
    "dark_moon_advisor_yeji": 157,
    "styx_advisor_yanshi": 141,
    "gold_merc_elephant_shoujin": 144,
    "styx_cannon_mingleipao": 130,
    "eternal_night_advisor_guhu": 125,
    "death_oath_elephant_fenhun": 156,
    "dark_moon_elephant_youji": 151,
    "styx_rook_feiyan": 131,
    "eternal_night_knight_hunling": 113,
    "dark_moon_elephant_yueji": 154,
    "styx_advisor_minghu": 157,
    "death_oath_knight_mingyan": 83,
    "eternal_night_rook_minggouche": 114,
    "dark_moon_cannon_yehua": 157,
    "styx_elephant_mingyanxiang": 136,
    "eternal_night_advisor_hunshi": 134,
    "gold_merc_cannon_jinyan": 89,
    "styx_elephant_mingleixiang": 126,
    "gold_merc_elephant_caishi": 102,
    "iron_guard_cannon_baobingpao": 80
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -376
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
