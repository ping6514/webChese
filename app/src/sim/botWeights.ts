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
    "iron_guard_cannon_baobingpao": 190,
    "eternal_night_cannon_suigu": 144,
    "eternal_night_advisor_guhu": 155,
    "iron_guard_cannon_paobinghua": 184,
    "styx_rook_mingyanche": 177,
    "iron_guard_rook_junhua": 173,
    "iron_guard_elephant_junlingxiang": 203,
    "iron_guard_elephant_tiegu": 192,
    "eternal_night_advisor_hunshi": 163,
    "dark_moon_advisor_yingji": 175,
    "eternal_night_elephant_gulingxiang": 150,
    "dark_moon_rook_lanhua": 153,
    "eternal_night_cannon_minggupao": 147,
    "styx_rook_feiyan": 176,
    "dark_moon_elephant_youji": 157,
    "iron_guard_rook_tieche": 173,
    "styx_knight_yanling": 82,
    "styx_advisor_yanshi": 150,
    "styx_elephant_mingyanxiang": 129,
    "dark_moon_rook_yinghua": 113,
    "iron_guard_advisor_junhu": 181,
    "eternal_night_rook_minggouche": 131,
    "eternal_night_rook_guhua": 165,
    "styx_cannon_baoyan": 145,
    "iron_guard_advisor_zhaoshi": 186,
    "styx_advisor_minghu": 146,
    "dark_moon_cannon_yehua": 160,
    "dark_moon_cannon_fenghua": 155,
    "eternal_night_elephant_mingguxiang": 119,
    "dark_moon_elephant_yueji": 153,
    "dark_moon_advisor_yeji": 156,
    "styx_cannon_mingleipao": 119,
    "styx_elephant_mingleixiang": 103
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
    "palaceSafetyBonus": -257,
    "avoidEnemyRangeMalus": 300
  }
}

// ─── 對手權重（訓練時黑方使用，每輪前由 updateDynamicWeights.js 更新為上輪的 DYNAMIC） ─
// 初始等同 BASE，第一輪訓練後自動更新為上一輪的 DYNAMIC_WEIGHTS
export const OPPONENT_WEIGHTS: typeof BASE_WEIGHTS = {
  "buyPriority": {
    "default": 30,
    "dark_moon_rook_yinghua": 121,
    "iron_guard_rook_tieche": 199,
    "iron_guard_cannon_baobingpao": 178,
    "iron_guard_advisor_zhaoshi": 217,
    "eternal_night_knight_hunling": 94,
    "iron_guard_cannon_paobinghua": 159,
    "styx_elephant_mingleixiang": 144,
    "iron_guard_advisor_junhu": 199,
    "styx_rook_mingyanche": 167,
    "styx_cannon_baoyan": 156,
    "iron_guard_elephant_junlingxiang": 194,
    "dark_moon_rook_lanhua": 165,
    "iron_guard_elephant_tiegu": 187,
    "dark_moon_cannon_yehua": 170,
    "eternal_night_rook_minggouche": 141,
    "eternal_night_rook_guhua": 175,
    "styx_advisor_yanshi": 148,
    "eternal_night_elephant_mingguxiang": 136,
    "dark_moon_advisor_yeji": 172,
    "eternal_night_cannon_minggupao": 154,
    "styx_rook_feiyan": 176,
    "styx_cannon_mingleipao": 153,
    "dark_moon_elephant_yueji": 156,
    "iron_guard_rook_junhua": 145,
    "styx_elephant_mingyanxiang": 131,
    "dark_moon_elephant_youji": 149,
    "dark_moon_cannon_fenghua": 156,
    "dark_moon_advisor_yingji": 156,
    "eternal_night_cannon_suigu": 106,
    "styx_advisor_minghu": 138,
    "eternal_night_elephant_gulingxiang": 136,
    "eternal_night_advisor_hunshi": 122
  },
  "shootScoring": {
    "targetIsKing": -15000,
    "targetIsHighValueBase": -8000,
    "targetHasHighPrioritySoul": -5000,
    "targetHpPerPoint": -80,
    "canPierceExtra": -600,
    "canChainExtra": -500,
    "ignoreBlockingBonus": -400,
    "myCorpsesBonusPer10": -375
  },
  "moveScoring": {
    "distanceToEnemyKingPerTile": 60,
    "distanceToAnyEnemyPerTile": 40,
    "corpsesNearbyBonusPerCorpse": -35,
    "palaceSafetyBonus": -256,
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
