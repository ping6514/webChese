// 基本遊戲流程測試：回合推進 & 階段切換

import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { reduce } from '../reduce'
import { canDispatch } from '../guards'

const SEED = 1

function freshState() {
  return createInitialState({ rngSeed: SEED })
}

describe('初始狀態', () => {
  it('p1 先手、draw 階段、turn=1', () => {
    const s = freshState()
    expect(s.currentPlayer).toBe('p1')
    expect(s.phase).toBe('draw')
    expect(s.turn).toBe(1)
    expect(s.winner).toBeNull()
  })

  it('每位玩家初始有 4 個 BG', () => {
    const s = freshState()
    const p1bgs = Object.values(s.bgs).filter(b => b.owner === 'p1')
    const p2bgs = Object.values(s.bgs).filter(b => b.owner === 'p2')
    expect(p1bgs).toHaveLength(4)
    expect(p2bgs).toHaveLength(4)
  })

  it('城牆初始值為 5', () => {
    const s = freshState()
    expect(s.cityWalls.p1).toBe(5)
    expect(s.cityWalls.p2).toBe(5)
  })
})

describe('回合推進', () => {
  function advanceToMain(state: ReturnType<typeof createInitialState>) {
    const r = reduce(state, 'p1', { type: 'NEXT_PHASE' })
    if (!r.ok) throw new Error(r.error)
    return r.state
  }

  it('draw → main 階段', () => {
    const s = advanceToMain(freshState())
    expect(s.phase).toBe('main')
    expect(s.currentPlayer).toBe('p1')
  })

  it('main → action 階段', () => {
    let s = advanceToMain(freshState())
    const r = reduce(s, 'p1', { type: 'NEXT_PHASE' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    expect(s.phase).toBe('action')
  })

  it('end 後切換到 p2 draw 回合', () => {
    let s = freshState()
    // draw → main → action → react → end → p2 draw
    for (let i = 0; i < 5; i++) {
      const r = reduce(s, s.currentPlayer, { type: 'NEXT_PHASE' })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    expect(s.currentPlayer).toBe('p2')
    expect(s.phase).toBe('draw')
    expect(s.turn).toBe(2)
  })

  it('NEXT_PHASE 回傳 ok:true 且包含 events', () => {
    const s = freshState()
    const r = reduce(s, 'p1', { type: 'NEXT_PHASE' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Array.isArray(r.events)).toBe(true)
    }
  })
})

describe('非法行動 guard', () => {
  it('p2 在 p1 回合不能 NEXT_PHASE', () => {
    const s = freshState()
    const g = canDispatch(s, 'p2', { type: 'NEXT_PHASE' })
    expect(g.ok).toBe(false)
  })

  it('draw 階段超過補充次數上限', () => {
    let s = freshState()
    // 使用 2 次 DRAW_CARD（最多 2 次）
    for (let i = 0; i < 2; i++) {
      const r = reduce(s, 'p1', { type: 'DRAW_CARD' })
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    const g = canDispatch(s, 'p1', { type: 'DRAW_CARD' })
    expect(g.ok).toBe(false)
    expect(g.ok ? '' : g.reason).toContain('已用完')
  })

  it('reduce 回傳 ok:false 而非拋出錯誤（guard 失敗）', () => {
    const s = freshState()
    // p2 嘗試在 p1 回合行動
    const r = reduce(s, 'p2', { type: 'NEXT_PHASE' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(typeof r.error).toBe('string')
    }
  })
})

describe('SURRENDER', () => {
  it('投降後對方獲勝', () => {
    const s = freshState()
    const r = reduce(s, 'p1', { type: 'SURRENDER' })
    if (!r.ok) throw new Error(r.error)
    expect(r.state.winner).toBe('p2')
  })

  it('遊戲結束後不能繼續行動', () => {
    let s = freshState()
    const r = reduce(s, 'p1', { type: 'SURRENDER' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    const g = canDispatch(s, 'p2', { type: 'NEXT_PHASE' })
    expect(g.ok).toBe(false)
    expect(g.ok ? '' : g.reason).toContain('已結束')
  })
})
