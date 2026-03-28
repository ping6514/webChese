// 戰鬥機制測試：攻擊 / 暈眩 / KO

import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { reduce } from '../reduce'
import type { GameState } from '../state'

// 卡牌實際數值：
//   qiancong (ATK): hp=3, atk=2, sup=1  — 有自動反擊技能，測試時不作攻擊目標
//   xiluo (BLC):    hp=5, atk=2, sup=2  — 無反擊
//   aoliwei (SHT):  hp=3, atk=2, sup=3  — 無反擊
//   xiabai (BOM):   hp=4, atk=2, sup=2  — 無反擊
const CONFIG = {
  rngSeed: 42,
  p1Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
  p2Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
}

function clone<T>(x: T): T { return JSON.parse(JSON.stringify(x)) }

function toActionPhase(state: GameState, player: 'p1' | 'p2'): GameState {
  let s = state
  for (let i = 0; i < 2; i++) {
    const r = reduce(s, player, { type: 'NEXT_PHASE' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

function teleport(state: GameState, bgId: string, zone: 'p1_base' | 'plaza' | 'p2_base'): GameState {
  const s = clone(state) as GameState
  s.bgs[bgId].zone = zone
  return s
}

/** 清空磚堆（防止 city_gate / block 干擾） */
function clearBricks(state: GameState): GameState {
  const s = clone(state) as GameState
  for (const area of Object.values(s.brickAreas)) {
    (area as { slots: unknown[] }).slots = []
  }
  return s
}

/** 準備：action 階段，p1 的 bgId 傳送到 p2_base，START_BG_ACTION */
function setupAttack(bgId: string, extra?: (s: GameState) => GameState): GameState {
  let s = createInitialState(CONFIG)
  s = toActionPhase(s, 'p1')
  s = clearBricks(s)
  s = teleport(s, bgId, 'p2_base')
  if (extra) s = extra(s)
  const r = reduce(s, 'p1', { type: 'START_BG_ACTION', bgId })
  if (!r.ok) throw new Error(r.error)
  return r.state
}

describe('攻擊基本（使用 xiluo/BLC 做目標，無反擊技能）', () => {
  it('攻擊值(2) <= 目標 HP(5) → HP 下降，不暈眩', () => {
    const s = setupAttack('p1_ATK')
    // p1_ATK(qiancong atk=2) 攻擊 p2_BLC(xiluo hp=5)
    const hpBefore = s.bgs['p2_BLC'].hpCurrent  // 5

    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    const target = ra.state.bgs['p2_BLC']
    expect(target.state).toBe('normal')
    expect(target.hpCurrent).toBe(hpBefore - 2)  // 5 - 2 = 3
  })

  it('攻擊值(2) > 目標 HP(1) 且 <= 2*HP(2) → 暈眩', () => {
    // 將 p2_BLC hpCurrent=1：2 > 1 → stun；2 <= 2 → 不 KO
    const s = setupAttack('p1_ATK', st => {
      const c = clone(st) as GameState
      c.bgs['p2_BLC'].hpCurrent = 1
      return c
    })

    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.state.bgs['p2_BLC'].state).toBe('stunned')
  })

  it('攻擊值(2) > 2*目標 HP(0) → 直接 KO', () => {
    // 將 p2_BLC hpCurrent=0（normal 狀態）：effectiveHP=0, 2 > 0 → KO
    const s = setupAttack('p1_ATK', st => {
      const c = clone(st) as GameState
      c.bgs['p2_BLC'].hpCurrent = 0
      return c
    })

    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.state.bgs['p2_BLC'].state).toBe('ko')
  })

  it('攻擊已暈眩目標 → 直接 KO', () => {
    const s = setupAttack('p1_ATK', st => {
      const c = clone(st) as GameState
      c.bgs['p2_BLC'].state = 'stunned'
      return c
    })

    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.state.bgs['p2_BLC'].state).toBe('ko')
  })
})

describe('攻擊事件', () => {
  it('DO_ATTACK 產生 do_attack 事件', () => {
    const s = setupAttack('p1_ATK')
    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.events.find(e => e.type === 'do_attack')).toBeDefined()
  })

  it('暈眩時產生 bg_stunned 事件', () => {
    const s = setupAttack('p1_ATK', st => {
      const c = clone(st) as GameState
      c.bgs['p2_BLC'].hpCurrent = 1
      return c
    })
    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.events.find(e => e.type === 'bg_stunned')).toBeDefined()
  })

  it('受傷時產生 take_damage 事件', () => {
    const s = setupAttack('p1_ATK')
    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    if (!ra.ok) throw new Error(ra.error)
    expect(ra.events.find(e => e.type === 'take_damage')).toBeDefined()
  })
})

describe('攻擊禁止：KO 目標', () => {
  it('guard 拒絕攻擊已 KO 的目標', () => {
    const s = setupAttack('p1_ATK', st => {
      const c = clone(st) as GameState
      c.bgs['p2_BLC'].state = 'ko'
      return c
    })
    const ra = reduce(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_BLC' })
    expect(ra.ok).toBe(false)
  })
})
