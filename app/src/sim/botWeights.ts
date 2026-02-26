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
    "styx_knight_xueyan": 75,
    "eternal_night_cannon_suigu": 171,
    "dark_moon_rook_lanhua": 207,
    "styx_rook_feiyan": 193,
    "eternal_night_knight_hunling": 73,
    "dark_moon_knight_yingzi": 81,
    "eternal_night_elephant_gulingxiang": 166,
    "dark_moon_advisor_yingji": 212,
    "dark_moon_cannon_yehua": 178,
    "styx_rook_mingyanche": 190,
    "eternal_night_knight_xuegu": 105,
    "styx_cannon_mingleipao": 135,
    "dark_moon_elephant_youji": 181,
    "eternal_night_rook_minggouche": 147,
    "eternal_night_advisor_guhu": 163,
    "styx_elephant_mingleixiang": 132,
    "dark_moon_advisor_yeji": 169,
    "styx_elephant_mingyanxiang": 149,
    "dark_moon_cannon_fenghua": 160,
    "styx_advisor_minghu": 164,
    "dark_moon_elephant_yueji": 169,
    "eternal_night_cannon_minggupao": 142,
    "dark_moon_rook_yinghua": 126,
    "eternal_night_advisor_hunshi": 148,
    "eternal_night_elephant_mingguxiang": 156,
    "eternal_night_rook_guhua": 164,
    "styx_cannon_baoyan": 126,
    "styx_knight_yanling": 30,
    "dark_moon_knight_wuying": 17,
    "styx_advisor_yanshi": 127
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -354
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
    "eternal_night_cannon_minggupao": 162,
    "styx_rook_mingyanche": 204,
    "eternal_night_rook_guhua": 198,
    "dark_moon_knight_wuying": 57,
    "eternal_night_knight_xuegu": 113,
    "eternal_night_elephant_mingguxiang": 181,
    "styx_knight_xueyan": 97,
    "dark_moon_advisor_yingji": 216,
    "styx_cannon_mingleipao": 145,
    "styx_knight_yanling": 88,
    "dark_moon_knight_yingzi": 62,
    "dark_moon_rook_yinghua": 159,
    "styx_cannon_baoyan": 161,
    "styx_rook_feiyan": 176,
    "dark_moon_elephant_youji": 182,
    "styx_advisor_yanshi": 152,
    "dark_moon_rook_lanhua": 189,
    "dark_moon_elephant_yueji": 177,
    "eternal_night_cannon_suigu": 140,
    "styx_advisor_minghu": 163,
    "eternal_night_rook_minggouche": 143,
    "dark_moon_cannon_yehua": 161,
    "eternal_night_advisor_guhu": 152,
    "dark_moon_advisor_yeji": 159,
    "dark_moon_cannon_fenghua": 161,
    "eternal_night_advisor_hunshi": 148,
    "eternal_night_elephant_gulingxiang": 137,
    "styx_elephant_mingleixiang": 110,
    "styx_elephant_mingyanxiang": 136,
    "eternal_night_knight_hunling": 40
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -355
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
