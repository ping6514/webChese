// 攻城與勝利條件測試

import { describe, it, expect } from 'vitest'
import { createInitialState } from '../state'
import { reduce } from '../reduce'
import { canDispatch } from '../guards'
import type { GameState } from '../state'

const CONFIG = {
  rngSeed: 42,
  p1Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
  p2Cards: { BOM: 'xiabai', ATK: 'qiancong', SHT: 'aoliwei', BLC: 'xiluo' },
}

function toActionPhase(state: GameState, player: 'p1' | 'p2'): GameState {
  let s = state
  for (let i = 0; i < 2; i++) {
    const r = reduce(s, player, { type: 'NEXT_PHASE' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

/** 將 p1 的 BG 移到 p2_base（越過磚堆阻擋：直接設 zone） */
function teleportBGTo(state: GameState, bgId: string, zone: 'p1_base' | 'plaza' | 'p2_base'): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState
  s.bgs[bgId].zone = zone
  return s
}

/** 清空指定磚堆區域的所有磚 */
function clearBrickArea(state: GameState, areaId: string): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState
  ;(s.brickAreas as Record<string, { slots: unknown[] }>)[areaId].slots = []
  return s
}

describe('攻城 guard', () => {
  it('不在 action 階段不能攻城', () => {
    const s = createInitialState(CONFIG)
    // draw 階段
    const g = canDispatch(s, 'p1', { type: 'DO_SIEGE' })
    expect(g.ok).toBe(false)
  })

  it('BG 不在敵主堡不能攻城', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    // START_BG_ACTION，BG 在 p1_base
    const r = reduce(s, 'p1', { type: 'START_BG_ACTION', bgId: 'p1_ATK' })
    if (!r.ok) throw new Error(r.error)
    s = r.state
    const g = canDispatch(s, 'p1', { type: 'DO_SIEGE' })
    expect(g.ok).toBe(false)
    expect(g.ok ? '' : g.reason).toContain('敵主堡')
  })

  it('磚堆阻擋時不能攻城', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    // 將 ATK 移到 p2_base（teleport）
    s = teleportBGTo(s, 'p1_ATK', 'p2_base')
    s.actingBGId = 'p1_ATK'
    // p2_base 磚堆預設有 2 張（阻擋攻城）
    const g = canDispatch(s, 'p1', { type: 'DO_SIEGE' })
    expect(g.ok).toBe(false)
    expect(g.ok ? '' : g.reason).toContain('磚堆')
  })
})

describe('攻城效果', () => {
  it('成功攻城減少城牆 1 格', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    s = teleportBGTo(s, 'p1_ATK', 'p2_base')
    s.actingBGId = 'p1_ATK'
    s = clearBrickArea(s, 'p2_base')
    s = clearBrickArea(s, 'p2_plaza')

    const wallsBefore = s.cityWalls.p2
    const r = reduce(s, 'p1', { type: 'DO_SIEGE' })
    if (!r.ok) throw new Error(r.error)
    expect(r.state.cityWalls.p2).toBe(wallsBefore - 1)
    expect(r.state.winner).toBeNull()
  })

  it('城牆為 0 再攻城 → p1 獲勝', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    s = teleportBGTo(s, 'p1_ATK', 'p2_base')
    s.actingBGId = 'p1_ATK'
    s = clearBrickArea(s, 'p2_base')
    s = clearBrickArea(s, 'p2_plaza')
    s.cityWalls.p2 = 0

    const r = reduce(s, 'p1', { type: 'DO_SIEGE' })
    if (!r.ok) throw new Error(r.error)
    expect(r.state.winner).toBe('p1')
  })

  it('攻城產生 siege 事件', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    s = teleportBGTo(s, 'p1_ATK', 'p2_base')
    s.actingBGId = 'p1_ATK'
    s = clearBrickArea(s, 'p2_base')
    s = clearBrickArea(s, 'p2_plaza')

    const r = reduce(s, 'p1', { type: 'DO_SIEGE' })
    if (!r.ok) throw new Error(r.error)
    const siegeEvent = r.events.find(e => e.type === 'siege')
    expect(siegeEvent).toBeDefined()
  })

  it('城牆降至 0 時產生 walls_destroyed 事件', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    s = teleportBGTo(s, 'p1_ATK', 'p2_base')
    s.actingBGId = 'p1_ATK'
    s = clearBrickArea(s, 'p2_base')
    s = clearBrickArea(s, 'p2_plaza')
    s.cityWalls.p2 = 1

    const r = reduce(s, 'p1', { type: 'DO_SIEGE' })
    if (!r.ok) throw new Error(r.error)
    const destroyEvent = r.events.find(e => e.type === 'walls_destroyed')
    expect(destroyEvent).toBeDefined()
    expect(r.state.cityWalls.p2).toBe(0)
    expect(r.state.winner).toBeNull()  // 城牆歸 0 但還未再次攻城
  })
})

describe('清磚', () => {
  it('BG 在廣場可清除敵方廣場磚堆', () => {
    let s = createInitialState(CONFIG)
    s = toActionPhase(s, 'p1')
    s = teleportBGTo(s, 'p1_ATK', 'plaza')
    s.actingBGId = 'p1_ATK'

    const slotsBefore = s.brickAreas['p2_plaza'].slots.length
    expect(slotsBefore).toBeGreaterThan(0)

    const r = reduce(s, 'p1', { type: 'DO_CLEAR_BRICK', areaId: 'p2_plaza' })
    if (!r.ok) throw new Error(r.error)
    expect(r.state.brickAreas['p2_plaza'].slots.length).toBe(slotsBefore - 1)
  })
})
