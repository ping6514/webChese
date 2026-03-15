/**
 * guards.ts — 所有行動的前置條件驗證
 *
 * 每個 canXxx() 回傳 { ok: true } 或 { ok: false, reason: string }
 * reduce() 呼叫 guard 後再修改 state，確保 state 永遠合法。
 */

import type { GameState, Unit, Pos } from './state'

export type GuardResult =
  | { ok: true }
  | { ok: false; reason: string }

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function fail(reason: string): GuardResult { return { ok: false, reason } }
const ok: GuardResult = { ok: true }

function getUnit(state: GameState, unitId: string): Unit | undefined {
  return state.units[unitId]
}

/** 曼哈頓距離（格棋盤移動）*/
export function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** Chebyshev 距離（八方向，技能範圍判斷）*/
export function chebyshev(a: Pos, b: Pos): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/** BFS 可走路徑長度（考慮地圖可通行格）*/
export function pathLength(state: GameState, from: Pos, to: Pos): number {
  const { cells, width, height } = state.floor
  if (!cells[to.y]?.[to.x]?.passable) return Infinity

  const visited = new Set<string>()
  const queue: Array<{ pos: Pos; dist: number }> = [{ pos: from, dist: 0 }]
  const key = (p: Pos) => `${p.x},${p.y}`
  visited.add(key(from))

  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ]

  while (queue.length > 0) {
    const { pos, dist } = queue.shift()!
    if (pos.x === to.x && pos.y === to.y) return dist

    for (const d of dirs) {
      const nx = pos.x + d.x
      const ny = pos.y + d.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const cell = cells[ny][nx]
      if (!cell.passable) continue
      const nk = `${nx},${ny}`
      if (visited.has(nk)) continue
      visited.add(nk)
      queue.push({ pos: { x: nx, y: ny }, dist: dist + 1 })
    }
  }
  return Infinity  // 無法到達
}

/** 直線視線（簡易 Bresenham，遇 blockLineOfSight = true 的格子則阻擋）*/
export function hasLineOfSight(state: GameState, from: Pos, to: Pos): boolean {
  const { cells } = state.floor
  let x = from.x, y = from.y
  const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1
  let err = dx - dy

  while (!(x === to.x && y === to.y)) {
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx)  { err += dx; y += sy }
    if (x === to.x && y === to.y) break
    if (cells[y]?.[x]?.blockLineOfSight) return false
  }
  return true
}

// ─── 是否輪到該單位行動 ────────────────────────────────────────────────────────

export function canAct(state: GameState, unitId: string): GuardResult {
  if (state.timeline.pendingUnitId !== unitId)
    return fail(`不是 ${unitId} 的行動回合`)
  const unit = getUnit(state, unitId)
  if (!unit) return fail('單位不存在')
  if (unit.isDead) return fail('單位已死亡')
  const entry = state.timeline.entries.find(e => e.unitId === unitId)
  if (!entry) return fail('ATB 條目不存在')
  if (entry.castRemaining > 0) return fail('正在讀條中')
  if (entry.recoveryRemaining > 0) return fail('正在硬直中')
  return ok
}

// ─── 移動 ─────────────────────────────────────────────────────────────────────

export function canMove(state: GameState, unitId: string, to: Pos): GuardResult {
  const actResult = canAct(state, unitId)
  if (!actResult.ok) return actResult

  const unit = state.units[unitId]!
  const { cells, width, height } = state.floor

  if (to.x < 0 || to.y < 0 || to.x >= width || to.y >= height)
    return fail('目標格超出地圖邊界')
  if (!cells[to.y][to.x].passable)
    return fail('目標格不可通行')

  // 檢查目標格是否有其他單位佔據
  const occupant = Object.values(state.units).find(
    u => u.id !== unitId && !u.isDead && u.pos.x === to.x && u.pos.y === to.y
  )
  if (occupant) return fail('目標格已有單位')

  const dist = pathLength(state, unit.pos, to)
  if (dist > unit.moveRange) return fail(`移動距離 ${dist} 超過 moveRange ${unit.moveRange}`)

  return ok
}

// ─── 武器攻擊 ─────────────────────────────────────────────────────────────────

export function canUseWeapon(
  state: GameState,
  unitId: string,
  weaponSlot: number,
  targetPos: Pos
): GuardResult {
  const actResult = canAct(state, unitId)
  if (!actResult.ok) return actResult

  const unit = state.units[unitId]!
  const weapon = unit.weapons[weaponSlot]
  if (!weapon) return fail(`武器槽 ${weaponSlot} 為空`)

  // 冷卻檢查
  const cdUntil = unit.weaponCooldownUntil[weaponSlot] ?? 0
  if (cdUntil > state.timeline.tick) return fail(`武器冷卻中（到期: ${cdUntil}ms）`)

  // 資源檢查
  if (weapon.spCostFinal > unit.currentSP)
    return fail(`SP 不足（需要 ${weapon.spCostFinal}，現有 ${unit.currentSP}）`)
  if (weapon.mpCostFinal > unit.currentMP)
    return fail(`MP 不足（需要 ${weapon.mpCostFinal}，現有 ${unit.currentMP}）`)

  // 範圍檢查（根據 actionId 的 range）
  const range = getActionRange(weapon.actionId)
  const dist = chebyshev(unit.pos, targetPos)
  if (dist > range) return fail(`目標超出攻擊範圍（距離 ${dist}，範圍 ${range}）`)

  // LOS 檢查（遠程武器）
  if (isRangedAction(weapon.actionId)) {
    if (!hasLineOfSight(state, unit.pos, targetPos))
      return fail('無視線（被障礙物遮擋）')
  }

  return ok
}

// ─── 技能使用 ─────────────────────────────────────────────────────────────────

export function canUseSkill(
  state: GameState,
  unitId: string,
  skillId: string,
  targetPos: Pos
): GuardResult {
  const actResult = canAct(state, unitId)
  if (!actResult.ok) return actResult

  const unit = state.units[unitId]!
  const cdUntil = (unit.skillCooldownUntil ?? {})[skillId] ?? 0
  if (cdUntil > state.timeline.tick) return fail(`技能 ${skillId} 冷卻中（到期: ${cdUntil}ms）`)

  // TODO: 技能範圍/資源檢查（讀 wolf_skills.json 等定義）
  void targetPos  // 暫時不檢查範圍，等 skillDefs 載入系統完成
  return ok
}

// ─── 拾取 ─────────────────────────────────────────────────────────────────────

export function canPickupLoot(
  state: GameState,
  unitId: string,
  lootId: string
): GuardResult {
  const actResult = canAct(state, unitId)
  if (!actResult.ok) return actResult

  const unit = state.units[unitId]!
  const loot = state.floor.loot.find(l => l.id === lootId)
  if (!loot) return fail('掉落物不存在')

  const dist = manhattan(unit.pos, loot.pos)
  if (dist > 1) return fail('距離掉落物太遠（需相鄰格）')

  return ok
}

// ─── ActionDef 工具（MVP1 內嵌，未來可改成讀 JSON）────────────────────────────

/** 根據 actionId 查詢攻擊範圍 */
export function getActionRange(actionId: string): number {
  const rangeMap: Record<string, number> = {
    'single_melee':        1,
    'single_melee_reach':  2,
    'frontal_sweep':       1,
    'frontal_wide_sweep':  1,
    'line_pierce':         3,
    'line_no_pierce':      2,
    'burst_small':         1,
    'burst_medium':        2,
    'ranged_single':       6,
    'ranged_single_nlos':  5,
    'ranged_aoe_small':    5,
    'ranged_aoe_medium':   4,
    'circle_small':        3,
    'circle_large':        3,
  }
  return rangeMap[actionId] ?? 1
}

/** 是否為需要 LOS 的遠程動作 */
export function isRangedAction(actionId: string): boolean {
  return actionId.startsWith('ranged_') || actionId === 'circle_small' || actionId === 'circle_large'
}

/** 根據 actionId 取得命中格清單（相對施法者的 offset 陣列）*/
export function getHitCells(
  actionId: string,
  casterPos: Pos,
  targetPos: Pos,
  facing: 'up' | 'down' | 'left' | 'right'
): Pos[] {
  switch (actionId) {
    case 'single_melee':
    case 'single_melee_reach':
    case 'ranged_single':
    case 'ranged_single_nlos':
      return [targetPos]

    case 'frontal_sweep': {
      // 施法者前方扇形 3 格：正前方 + 斜前左 + 斜前右
      const front = moveDelta(facing)
      const left  = rotateCCW(front)
      const right = rotateCW(front)
      return [
        { x: casterPos.x + front.x,           y: casterPos.y + front.y           },
        { x: casterPos.x + front.x + left.x,  y: casterPos.y + front.y + left.y  },
        { x: casterPos.x + front.x + right.x, y: casterPos.y + front.y + right.y },
      ]
    }

    case 'frontal_wide_sweep': {
      // 前方 180° 扇形（正前 + 斜前左 + 斜前右 + 正左 + 正右）
      const front = moveDelta(facing)
      const left  = rotateCCW(front)
      const right = rotateCW(front)
      return [
        { x: casterPos.x + front.x,           y: casterPos.y + front.y           },
        { x: casterPos.x + front.x + left.x,  y: casterPos.y + front.y + left.y  },
        { x: casterPos.x + front.x + right.x, y: casterPos.y + front.y + right.y },
        { x: casterPos.x + left.x,            y: casterPos.y + left.y            },
        { x: casterPos.x + right.x,           y: casterPos.y + right.y           },
      ]
    }

    case 'line_pierce':
    case 'line_no_pierce': {
      // 直線從施法者到 targetPos 方向
      const range = actionId === 'line_pierce' ? 3 : 2
      const dx = Math.sign(targetPos.x - casterPos.x)
      const dy = Math.sign(targetPos.y - casterPos.y)
      const cells: Pos[] = []
      for (let i = 1; i <= range; i++) {
        cells.push({ x: casterPos.x + dx * i, y: casterPos.y + dy * i })
      }
      return cells
    }

    case 'burst_small':
      return getCircleCells(casterPos, 1)

    case 'burst_medium':
      return getCircleCells(casterPos, 2)

    case 'ranged_aoe_small':
    case 'circle_small':
      return getCircleCells(targetPos, 1)

    case 'ranged_aoe_medium':
    case 'circle_large':
      return getCircleCells(targetPos, 2)

    default:
      return [targetPos]
  }
}

// ─── 幾何工具 ─────────────────────────────────────────────────────────────────

function moveDelta(facing: 'up' | 'down' | 'left' | 'right'): { x: number; y: number } {
  switch (facing) {
    case 'up':    return { x:  0, y: -1 }
    case 'down':  return { x:  0, y:  1 }
    case 'left':  return { x: -1, y:  0 }
    case 'right': return { x:  1, y:  0 }
  }
}

function rotateCW(d: { x: number; y: number }): { x: number; y: number } {
  return { x: -d.y, y: d.x }
}

function rotateCCW(d: { x: number; y: number }): { x: number; y: number } {
  return { x: d.y, y: -d.x }
}

function getCircleCells(center: Pos, radius: number): Pos[] {
  const cells: Pos[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= radius * 1.5)  // 近似圓形
        cells.push({ x: center.x + dx, y: center.y + dy })
    }
  }
  return cells
}
