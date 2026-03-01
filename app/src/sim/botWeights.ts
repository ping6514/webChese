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
    "iron_guard_cannon_paobinghua": 195,
    "eternal_night_rook_minggouche": 167,
    "eternal_night_knight_hunling": 79,
    "iron_guard_elephant_tiegu": 191,
    "dark_moon_rook_lanhua": 184,
    "eternal_night_rook_guhua": 176,
    "styx_advisor_minghu": 152,
    "iron_guard_elephant_junlingxiang": 186,
    "iron_guard_rook_tieche": 177,
    "iron_guard_rook_junhua": 171,
    "dark_moon_elephant_youji": 154,
    "iron_guard_advisor_zhaoshi": 193,
    "styx_cannon_baoyan": 128,
    "eternal_night_advisor_guhu": 150,
    "styx_rook_feiyan": 173,
    "iron_guard_advisor_junhu": 186,
    "dark_moon_advisor_yingji": 176,
    "eternal_night_cannon_minggupao": 162,
    "iron_guard_cannon_baobingpao": 159,
    "styx_elephant_mingleixiang": 119,
    "styx_knight_xueyan": 134,
    "dark_moon_rook_yinghua": 71,
    "eternal_night_elephant_gulingxiang": 149,
    "styx_rook_mingyanche": 167,
    "styx_cannon_mingleipao": 129,
    "dark_moon_advisor_yeji": 164,
    "styx_elephant_mingyanxiang": 160,
    "dark_moon_cannon_yehua": 152,
    "eternal_night_cannon_suigu": 132,
    "eternal_night_advisor_hunshi": 121,
    "styx_advisor_yanshi": 133,
    "dark_moon_cannon_fenghua": 149,
    "dark_moon_elephant_yueji": 152,
    "eternal_night_elephant_mingguxiang": 125
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
    "palaceSafetyBonus": -256,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "styx_knight_xueyan": 159,
    "styx_rook_mingyanche": 201,
    "eternal_night_cannon_minggupao": 169,
    "eternal_night_rook_minggouche": 150,
    "dark_moon_rook_lanhua": 184,
    "dark_moon_advisor_yeji": 176,
    "iron_guard_advisor_junhu": 205,
    "styx_rook_feiyan": 175,
    "iron_guard_advisor_zhaoshi": 207,
    "iron_guard_cannon_paobinghua": 181,
    "iron_guard_cannon_baobingpao": 179,
    "iron_guard_rook_junhua": 177,
    "styx_elephant_mingyanxiang": 163,
    "iron_guard_elephant_tiegu": 186,
    "eternal_night_rook_guhua": 168,
    "eternal_night_elephant_gulingxiang": 149,
    "iron_guard_elephant_junlingxiang": 176,
    "dark_moon_cannon_yehua": 159,
    "styx_elephant_mingleixiang": 124,
    "styx_cannon_mingleipao": 140,
    "dark_moon_advisor_yingji": 177,
    "dark_moon_elephant_yueji": 167,
    "eternal_night_advisor_guhu": 138,
    "iron_guard_rook_tieche": 167,
    "eternal_night_cannon_suigu": 150,
    "dark_moon_cannon_fenghua": 160,
    "dark_moon_rook_yinghua": 70,
    "dark_moon_elephant_youji": 143,
    "eternal_night_elephant_mingguxiang": 148,
    "eternal_night_knight_xuegu": 36,
    "eternal_night_knight_hunling": 51,
    "styx_advisor_yanshi": 134,
    "styx_cannon_baoyan": 103,
    "eternal_night_advisor_hunshi": 114,
    "styx_advisor_minghu": 112
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -374
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
