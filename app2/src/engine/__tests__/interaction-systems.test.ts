/**
 * 互動系統測試
 * 
 * 測試投射物、打斷、保護三個核心互動系統
 */

import { describe, it, expect } from 'vitest'
import { traceProjectilePath, canProjectileHit } from '../projectile'
import { attemptInterrupt, canBeInterrupted } from '../interrupt'
import { resolveProtection, canProtect } from '../protect'
import { createBuildupData } from '../state'
import type { GameState, CombatUnit } from '../state'
import { hexKey } from '../../game/hex'

// 輔助函數：創建測試用單位
function makeTestUnit(overrides: Partial<CombatUnit> & Pick<CombatUnit, 'id' | 'pos'>): CombatUnit {
  return {
    name: 'Test Unit',
    team: 'player',
    certId: 'test_cert',
    facing: 0,
    hp: 100,
    maxHp: 100,
    speed: 30,
    move: 3,
    damage: 30,
    interrupt: 1,
    isDead: false,
    blocksCell: true,
    revivePending: null,
    buildup: createBuildupData('test_cert'),
    buildupResist: { burn: 0, poison: 0, paralyze: 0, sleep: 0, freeze: 0 },
    statusEffects: [],
    ...overrides,
  }
}

// 輔助函數：創建測試用狀態
function makeTestState(units: CombatUnit[]): GameState {
  const unitRecord: Record<string, CombatUnit> = {}
  for (const unit of units) {
    unitRecord[unit.id] = unit
  }

  return {
    phase: 'running',
    timeline: {
      tick: 0,
      pendingUnitId: null,
      entries: units.map(u => ({
        unitId: u.id,
        atb: 100,
        castRemaining: 0,
        recoveryRemaining: 0,
        speedMult: 1,
      })),
    },
    units: unitRecord,
    cells: {
      [hexKey(0, 0)]: { pos: { q: 0, r: 0 }, terrain: 'normal', passable: true },
      [hexKey(1, 0)]: { pos: { q: 1, r: 0 }, terrain: 'normal', passable: true },
      [hexKey(2, 0)]: { pos: { q: 2, r: 0 }, terrain: 'normal', passable: true },
      [hexKey(3, 0)]: { pos: { q: 3, r: 0 }, terrain: 'normal', passable: true },
      [hexKey(4, 0)]: { pos: { q: 4, r: 0 }, terrain: 'normal', passable: true },
    },
  }
}

describe('投射物系統', () => {
  it('應該追蹤直線路徑', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 } })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 } })
    const state = makeTestState([attacker, target])

    const result = traceProjectilePath(state, attacker.pos, target.id)

    expect(result.blocked).toBe(false)
    expect(result.finalTargetId).toBe(target.id)
    expect(result.path.length).toBeGreaterThan(0)
  })

  it('應該被障礙物阻擋', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 } })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 } })
    const state = makeTestState([attacker, target])
    
    // 添加障礙物
    state.cells[hexKey(1, 0)]!.terrain = 'obstacle'

    const result = traceProjectilePath(state, attacker.pos, target.id)

    expect(result.blocked).toBe(true)
    expect(result.blockedBy).toBe('obstacle')
  })

  it('應該被前排單位攔截', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const protector = makeTestUnit({ id: 'protector', pos: { q: 1, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, protector, target])

    const result = traceProjectilePath(state, attacker.pos, target.id)

    expect(result.blocked).toBe(true)
    expect(result.blockedBy).toBe('unit')
    expect(result.finalTargetId).toBe(protector.id)
  })

  it('穿透模式應該忽略第一個單位', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const blocker = makeTestUnit({ id: 'blocker', pos: { q: 1, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, blocker, target])

    const result = traceProjectilePath(state, attacker.pos, target.id, { piercing: true })

    expect(result.blocked).toBe(false)
    expect(result.finalTargetId).toBe(target.id)
  })

  it('canProjectileHit 應該正確判斷', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 } })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 } })
    const state = makeTestState([attacker, target])

    expect(canProjectileHit(state, attacker.id, target.id, 5)).toBe(true)
    expect(canProjectileHit(state, attacker.id, target.id, 2)).toBe(false)
  })
})

describe('打斷系統', () => {
  it('應該成功打斷讀條中的單位', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, interrupt: 3 })
    const target = makeTestUnit({ id: 'target', pos: { q: 1, r: 0 } })
    const state = makeTestState([attacker, target])
    
    // 設置目標正在讀條
    state.timeline.entries[1]!.castRemaining = 1000

    const result = attemptInterrupt(state, attacker.id, target.id, 3, 'heavy_cast')

    expect(result.interrupted).toBe(true)
    expect(result.reason).toBe('success')
    expect(result.events.length).toBe(1)
    expect(result.events[0]!.type).toBe('INTERRUPT')
  })

  it('打斷值不足時應該失敗', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, interrupt: 1 })
    const target = makeTestUnit({ id: 'target', pos: { q: 1, r: 0 } })
    const state = makeTestState([attacker, target])
    
    state.timeline.entries[1]!.castRemaining = 1000

    const result = attemptInterrupt(state, attacker.id, target.id, 1, 'heavy_cast')

    expect(result.interrupted).toBe(false)
    expect(result.reason).toBe('insufficient_interrupt')
  })

  it('目標未讀條時應該失敗', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, interrupt: 3 })
    const target = makeTestUnit({ id: 'target', pos: { q: 1, r: 0 } })
    const state = makeTestState([attacker, target])

    const result = attemptInterrupt(state, attacker.id, target.id, 3, 'heavy_cast')

    expect(result.interrupted).toBe(false)
    expect(result.reason).toBe('not_casting')
  })

  it('canBeInterrupted 應該正確判斷', () => {
    const target = makeTestUnit({ id: 'target', pos: { q: 1, r: 0 } })
    const state = makeTestState([target])
    
    state.timeline.entries[0]!.castRemaining = 1000

    expect(canBeInterrupted(state, target.id, 3, 'heavy_cast')).toBe(true)
    expect(canBeInterrupted(state, target.id, 1, 'heavy_cast')).toBe(false)
  })
})

describe('保護系統', () => {
  it('應該觸發投射物攔截', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const protector = makeTestUnit({ id: 'protector', pos: { q: 1, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, protector, target])

    const result = resolveProtection(state, attacker.id, target.id, 'projectile')

    expect(result.protected).toBe(true)
    expect(result.protectorId).toBe(protector.id)
    expect(result.finalTargetId).toBe(protector.id)
    expect(result.protectType).toBe('intercept_projectile')
  })

  it('應該觸發近戰阻擋', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const protector = makeTestUnit({ id: 'protector', pos: { q: 2, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, protector, target])

    const result = resolveProtection(state, attacker.id, target.id, 'melee')

    expect(result.protected).toBe(true)
    expect(result.protectorId).toBe(protector.id)
    expect(result.protectType).toBe('body_block')
  })

  it('保護者被控制時不應觸發保護', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const protector = makeTestUnit({ 
      id: 'protector', 
      pos: { q: 1, r: 0 }, 
      team: 'player',
      statusEffects: [{ id: 'paralyze', expiresAt: 5000 }]
    })
    const target = makeTestUnit({ id: 'target', pos: { q: 3, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, protector, target])

    const result = resolveProtection(state, attacker.id, target.id, 'projectile')

    expect(result.protected).toBe(false)
  })

  it('保護者距離過遠時不應觸發保護', () => {
    const attacker = makeTestUnit({ id: 'attacker', pos: { q: 0, r: 0 }, team: 'enemy' })
    const protector = makeTestUnit({ id: 'protector', pos: { q: 1, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 10, r: 0 }, team: 'player' })
    const state = makeTestState([attacker, protector, target])

    const result = resolveProtection(state, attacker.id, target.id, 'projectile')

    expect(result.protected).toBe(false)
  })

  it('canProtect 應該正確判斷', () => {
    const protector = makeTestUnit({ id: 'protector', pos: { q: 1, r: 0 }, team: 'player' })
    const target = makeTestUnit({ id: 'target', pos: { q: 2, r: 0 }, team: 'player' })
    const state = makeTestState([protector, target])

    expect(canProtect(state, protector.id, target.id)).toBe(true)
  })
})
