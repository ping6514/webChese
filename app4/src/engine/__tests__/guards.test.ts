// Guard 驗證測試：非法行動應被拒絕

import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { reduce } from '../reduce'
import { canDispatch } from '../guards'
import type { GameState } from '../state'

const CONFIG = {
  rngSeed: 99,
  p1Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
  p2Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
}

function advanceTo(state: GameState, player: 'p1' | 'p2', phases: number): GameState {
  let s = state
  for (let i = 0; i < phases; i++) {
    const r = reduce(s, player, { type: 'NEXT_PHASE' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

describe('玩家輪換 guard', () => {
  it('非當前玩家不能 NEXT_PHASE', () => {
    const s = createInitialState(CONFIG)
    expect(s.currentPlayer).toBe('p1')
    const g = canDispatch(s, 'p2', { type: 'NEXT_PHASE' })
    expect(g.ok).toBe(false)
  })

  it('reduce 返回 ok:false 而不拋出', () => {
    const s = createInitialState(CONFIG)
    const r = reduce(s, 'p2', { type: 'NEXT_PHASE' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('非法行動')
  })
})

describe('階段 guard', () => {
  it('非 draw 階段不能 DRAW_CARD', () => {
    let s = createInitialState(CONFIG)
    s = advanceTo(s, 'p1', 1)  // → main
    expect(s.phase).toBe('main')
    const g = canDispatch(s, 'p1', { type: 'DRAW_CARD' })
    expect(g.ok).toBe(false)
  })

  it('非 action 階段不能 START_BG_ACTION', () => {
    const s = createInitialState(CONFIG)
    expect(s.phase).toBe('draw')
    const g = canDispatch(s, 'p1', { type: 'START_BG_ACTION', bgId: 'p1_ATK' })
    expect(g.ok).toBe(false)
  })

  it('非 action 階段不能 DO_ATTACK', () => {
    const s = createInitialState(CONFIG)
    const g = canDispatch(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_ATK' })
    expect(g.ok).toBe(false)
  })
})

describe('行動順序 guard', () => {
  it('沒有 actingBGId 時不能 MOVE_BG', () => {
    let s = createInitialState(CONFIG)
    s = advanceTo(s, 'p1', 2)  // → action
    expect(s.actingBGId).toBeNull()
    const g = canDispatch(s, 'p1', { type: 'MOVE_BG', toZone: 'plaza' })
    expect(g.ok).toBe(false)
  })

  it('不能攻擊自己的 BG', () => {
    let s = createInitialState(CONFIG)
    s = advanceTo(s, 'p1', 2)  // → action
    const r = reduce(s, 'p1', { type: 'START_BG_ACTION', bgId: 'p1_ATK' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    // 攻擊自己的 BG
    const g = canDispatch(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p1_BLC' })
    expect(g.ok).toBe(false)
  })

  it('已執行通常動作後不能再攻擊', () => {
    let s = createInitialState(CONFIG)
    s = advanceTo(s, 'p1', 2)  // → action
    // 手動設 doneNormalAction = true
    const r = reduce(s, 'p1', { type: 'START_BG_ACTION', bgId: 'p1_ATK' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    s.bgs['p1_ATK'].doneNormalAction = true
    const g = canDispatch(s, 'p1', { type: 'DO_ATTACK', targetBGId: 'p2_ATK' })
    expect(g.ok).toBe(false)
  })
})

describe('遊戲結束 guard', () => {
  it('遊戲結束後任何行動都被拒絕', () => {
    let s = createInitialState(CONFIG)
    const r = reduce(s, 'p1', { type: 'SURRENDER' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    expect(s.winner).toBe('p2')

    const actions = [
      canDispatch(s, 'p1', { type: 'NEXT_PHASE' }),
      canDispatch(s, 'p2', { type: 'NEXT_PHASE' }),
      canDispatch(s, 'p1', { type: 'DRAW_CARD' }),
    ]
    for (const g of actions) {
      expect(g.ok).toBe(false)
      expect(g.ok ? '' : g.reason).toContain('已結束')
    }
  })
})

describe('ReduceResult union type', () => {
  it('成功行動 ok=true 且有 state 與 events', () => {
    const s = createInitialState(CONFIG)
    const r = reduce(s, 'p1', { type: 'NEXT_PHASE' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state).toBeDefined()
      expect(Array.isArray(r.events)).toBe(true)
    }
  })

  it('失敗行動 ok=false 且有 error 字串', () => {
    const s = createInitialState(CONFIG)
    const r = reduce(s, 'p2', { type: 'DRAW_CARD' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(typeof r.error).toBe('string')
      expect(r.error.length).toBeGreaterThan(0)
    }
  })
})
