// BG Card Game Engine — 遊戲狀態

import type { PlayerId, ZoneId, BGClass, BGState, Phase, BrickAreaId } from './types'
import { homeZone, opponentOf, plazaBrickId, baseBrickId } from './types'
import { bgsByClass, bgCardById } from '../data/bg-cards'
import { allReactionIds } from '../data/reactions'
import { allEventIds } from '../data/events'
import { allBuildingIds } from '../data/buildings'

// ── BG 實例 ─────────────────────────────────────

export type BGInstance = {
  id: string          // 唯一實例 ID (如 'p1_ATK')
  cardId: string      // 對應卡牌定義 ID
  name: string
  owner: PlayerId
  bgClass: BGClass
  zone: ZoneId
  state: BGState

  hpBase: number      // 基礎堅韌度
  hpCurrent: number   // 當前堅韌度（含臨時加成，回合開始重置）

  attack: number      // 基礎對敵力
  support: number     // 基礎協助力

  // 臨時加成（回合結束清除）
  tempHpBonus: number
  tempAttackBonus: number
  tempSupportBonus: number

  // 技能冷卻（CD 制：使用後需等 cd 回合才能再用，每回合開始 -1）
  skillCooldowns: [number, number]

  // 回合行動旗標（每 BG 行動後清除）
  actedThisPhase: boolean      // 本行動階段已行動過
  movedThisAction: boolean     // 本次 BG 行動已移動
  usedSkillThisAction: boolean
  doneNormalAction: boolean    // 本次 BG 行動已執行通常動作（攻擊/清磚/攻城）

  // 多回合狀態
  cantMoveNextTurn: boolean     // 下回合不能移動（某些技能施加）
  cantMoveThisTurn: boolean     // 本回合不能移動
  freeMovePending: boolean      // 靈動反應：下次行動可額外移動一次（無視磚堆阻擋）
  damageReduction: number       // 每次受到對敵 -N
  damageReductionTurns: number  // 傷害減免剩餘回合數
  attackBonusNextSkill: number  // 下次技能對敵 +N（愛的輪迴）
  directKONextSkill: boolean    // 下次技能造成暈眩時直接 KO（愛的輪迴）
  darkModeActive: boolean       // 黑暗元素模式（大可）
  darkModeTurns: number
  immuneThisTurn: boolean       // 1回合免疫所有對敵
  immuneFirstAttack: boolean    // 免疫第1次對敵（其阿莫）
  firstAttackImmunityUsed: boolean

  // 反應卡（安裝在此 BG 下）
  reactionCard: string | null

  // KO/暈眩恢復倒計時（每次此玩家回合開始時 -1）
  recoveryCountdown: number   // 1=暈眩（下回合恢復），2=KO（2回合後恢復）
}

// ── 磚堆區 ───────────────────────────────────────

export type BrickSlot = {
  cardId: string        // 蓋牌時為任意卡 ID；建築卡時有特殊效果
  isBuilding: boolean   // true = 建築卡（面朝上，有效果）
  durability?: number   // 建築耐久度（每次被清磚動作命中 -1，降至 0 時移除並送棄牌區）
}

export type BrickArea = {
  slots: BrickSlot[]
  maxSlots: number    // 通常為 2；蜜瓜技能可臨時設為 3
}

// ── 玩家牌組狀態 ─────────────────────────────────

export type PlayerState = {
  hand: string[]
  deck: string[]
  graveyard: string[]
}

// ── 延遲效果 ─────────────────────────────────────

export type PendingEffect = {
  uid: string
  turnsLeft: number    // 0 = 在本回合開始/結束時觸發
  type: string
  payload: Record<string, unknown>
}

// ── 遊戲狀態 ─────────────────────────────────────

export type GameState = {
  turn: number
  phase: Phase
  currentPlayer: PlayerId

  bgs: Record<string, BGInstance>
  players: Record<PlayerId, PlayerState>
  brickAreas: Record<BrickAreaId, BrickArea>
  cityWalls: Record<PlayerId, number>

  // 行動階段追蹤
  bgActionsUsed: number
  bgActionsMax: number
  actingBGId: string | null
  jointAllyId: string | null  // 聯合攻擊宣告對象（ally 先施放技能時鎖定）

  // 補充階段追蹤
  drawActionsUsed: number
  drawBrickUsed: boolean  // 1 回合只能補磚 1 次

  // 主要階段追蹤
  mainBuildingPlayed: boolean

  // RUSH TIME 一場只能用一次
  rushTimeUsed: boolean

  pendingEffects: PendingEffect[]
  pendingEffectCounter: number  // UID 生成器

  rngSeed: number
  winner: PlayerId | null
  winReason: string | null
}

// ── 初始化工具 ───────────────────────────────────

function seededRNG(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 建立預設牌組（約 36 張） */
function makeDefaultDeck(rng: () => number): string[] {
  const cards: string[] = []
  // 反應卡各 2 張
  for (const id of allReactionIds) cards.push(id, id)
  // 事件卡各 2 張
  for (const id of allEventIds) cards.push(id, id)
  // 建築卡各 2 張
  for (const id of allBuildingIds) cards.push(id, id)
  return shuffle(cards, rng)
}

function makeBGInstance(
  id: string,
  cardId: string,
  owner: PlayerId,
): BGInstance {
  const def = bgCardById[cardId]
  return {
    id,
    cardId,
    name: def.name,
    owner,
    bgClass: def.bgClass,
    zone: homeZone(owner),
    state: 'normal',
    hpBase: def.hp,
    hpCurrent: def.hp,
    attack: def.attack,
    support: def.support,
    tempHpBonus: 0,
    tempAttackBonus: 0,
    tempSupportBonus: 0,
    actedThisPhase: false,
    movedThisAction: false,
    usedSkillThisAction: false,
    doneNormalAction: false,
    cantMoveNextTurn: false,
    cantMoveThisTurn: false,
    freeMovePending: false,
    damageReduction: 0,
    damageReductionTurns: 0,
    attackBonusNextSkill: 0,
    directKONextSkill: false,
    darkModeActive: false,
    darkModeTurns: 0,
    immuneThisTurn: false,
    immuneFirstAttack: false,
    firstAttackImmunityUsed: false,
    skillCooldowns: [0, 0],
    reactionCard: null,
    recoveryCountdown: 0,
  }
}

export type GameConfig = {
  p1Cards?: Partial<Record<BGClass, string>>  // class → card ID
  p2Cards?: Partial<Record<BGClass, string>>
  rngSeed?: number
}

export function createInitialState(config?: GameConfig): GameState {
  const seed = config?.rngSeed ?? 42
  const rng = seededRNG(seed)

  // 每個職業隨機選一張 BG（若 config 未指定）
  function pickBGs(overrides?: Partial<Record<BGClass, string>>): Record<BGClass, string> {
    const classes: BGClass[] = ['BOM', 'ATK', 'SHT', 'BLC']
    const picks = {} as Record<BGClass, string>
    for (const cls of classes) {
      if (overrides?.[cls]) {
        picks[cls] = overrides[cls]!
      } else {
        const pool = bgsByClass[cls]
        picks[cls] = pool[Math.floor(rng() * pool.length)].id
      }
    }
    return picks
  }

  const p1Picks = pickBGs(config?.p1Cards)
  const p2Picks = pickBGs(config?.p2Cards)

  const bgs: Record<string, BGInstance> = {}
  for (const cls of ['BOM', 'ATK', 'SHT', 'BLC'] as BGClass[]) {
    bgs[`p1_${cls}`] = makeBGInstance(`p1_${cls}`, p1Picks[cls], 'p1')
    bgs[`p2_${cls}`] = makeBGInstance(`p2_${cls}`, p2Picks[cls], 'p2')
  }

  const p1Deck = makeDefaultDeck(rng)
  const p2Deck = makeDefaultDeck(rng)

  // 開局手牌：先攻4張，後攻7張（後攻手牌補償）
  const p1Hand = p1Deck.splice(0, 4)
  const p2Hand = p2Deck.splice(0, 7)

  const players: Record<PlayerId, PlayerState> = {
    p1: { hand: p1Hand, deck: p1Deck, graveyard: [] },
    p2: { hand: p2Hand, deck: p2Deck, graveyard: [] },
  }

  // 初始磚堆：各區各 2 張（從牌組底部取，模擬蓋牌）
  function takeBricks(ps: PlayerState, count: number): BrickSlot[] {
    const slots: BrickSlot[] = []
    for (let i = 0; i < count; i++) {
      const card = ps.deck.pop() ?? 'unknown'
      slots.push({ cardId: card, isBuilding: false })
    }
    return slots
  }

  // P1=2+2=4磚，P2=2+2=4磚（對稱磚數，後攻補償靠手牌：P2多3張）
  const brickAreas: Record<BrickAreaId, BrickArea> = {
    p1_plaza: { slots: takeBricks(players.p1, 2), maxSlots: 2 },
    p1_base:  { slots: takeBricks(players.p1, 2), maxSlots: 2 },
    p2_plaza: { slots: takeBricks(players.p2, 2), maxSlots: 2 },
    p2_base:  { slots: takeBricks(players.p2, 2), maxSlots: 2 },
  }

  return {
    turn: 1,
    phase: 'draw',
    currentPlayer: 'p1',
    bgs,
    players,
    brickAreas,
    cityWalls: { p1: 4, p2: 4 },
    bgActionsUsed: 0,
    bgActionsMax: 2,
    actingBGId: null,
    jointAllyId: null,
    drawActionsUsed: 0,
    drawBrickUsed: false,
    mainBuildingPlayed: false,
    rushTimeUsed: false,
    pendingEffects: [],
    pendingEffectCounter: 0,
    rngSeed: seed,
    winner: null,
    winReason: null,
  }
}

// ── 輔助查詢 ─────────────────────────────────────

export function getBGsInZone(state: GameState, zone: ZoneId): BGInstance[] {
  return Object.values(state.bgs).filter(bg => bg.zone === zone)
}

export function getEnemyBGsInZone(state: GameState, zone: ZoneId, fromPlayer: PlayerId): BGInstance[] {
  return getBGsInZone(state, zone).filter(bg => bg.owner !== fromPlayer)
}

export function getAllyBGsInZone(state: GameState, zone: ZoneId, fromPlayer: PlayerId): BGInstance[] {
  return getBGsInZone(state, zone).filter(bg => bg.owner === fromPlayer)
}

export function getBrickArea(state: GameState, areaId: BrickAreaId): BrickArea {
  return state.brickAreas[areaId]
}

export function hasBricks(state: GameState, areaId: BrickAreaId): boolean {
  return state.brickAreas[areaId].slots.some(s => !s.isBuilding)
}

/** 敵廣場磚堆是否阻止我方進入敵主堡 */
export function isPlazaBlocked(state: GameState, mover: PlayerId): boolean {
  const enemy = opponentOf(mover)
  return hasBricks(state, plazaBrickId(enemy))
}

/** 敵主堡磚堆是否阻止攻城 */
export function isSiegeBlocked(state: GameState, attacker: PlayerId): boolean {
  const enemy = opponentOf(attacker)
  return hasBricks(state, baseBrickId(enemy))
}

/** 計算 BG 有效攻擊力（含臨時加成） */
export function effectiveAttack(bg: BGInstance): number {
  return bg.attack + bg.tempAttackBonus + (bg.darkModeActive ? 2 : 0)
}

/** 計算 BG 有效協助力（含臨時加成） */
export function effectiveSupport(bg: BGInstance): number {
  return bg.support + bg.tempSupportBonus + (bg.darkModeActive ? 1 : 0)
}

/** 計算 BG 有效堅韌度（含臨時加成） */
export function effectiveHP(bg: BGInstance): number {
  return bg.hpCurrent + bg.tempHpBonus
}

/** 抽牌（若牌組空則先洗墓地） */
export function drawCard(ps: PlayerState, rng?: () => number): string | null {
  if (ps.deck.length === 0) {
    if (ps.graveyard.length === 0) return null
    const r = rng ?? (() => Math.random())
    ps.deck = shuffle([...ps.graveyard], r)
    ps.graveyard = []
  }
  return ps.deck.shift() ?? null
}
