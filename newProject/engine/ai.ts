/**
 * ai.ts — 怪物 AI 決策
 *
 * decideTurn(state, unitId, skillRegistry?) → Action
 *
 * 支援四種 AI 模式：
 *   chase  → 追擊最近的玩家，進入攻擊範圍後使用武器（技能優先）
 *   guard  → 玩家進入感知範圍才追擊，否則原地等待
 *   patrol → 沿固定路徑巡邏（MVP1 簡化：玩家接近則 chase，否則待機）
 *   boss   → 同 chase，但技能池更大、優先度更高
 */

import type { GameState, Unit, Pos } from './state'
import type { Action } from './actions'
import type { SkillRegistry } from './skills'
import { checkAiTrigger } from './skills'
import { getActionRange, chebyshev } from './guards'

// ─── 主函數 ───────────────────────────────────────────────────────────────────

export function decideTurn(
  state: GameState,
  unitId: string,
  skillRegistry?: SkillRegistry
): Action {
  const unit = state.units[unitId]
  if (!unit || unit.isDead) return { type: 'END_TURN', unitId }

  switch (unit.ai) {
    case 'chase':
    case 'boss':
      return decideChase(state, unit, skillRegistry)

    case 'guard':
      return decideGuard(state, unit, skillRegistry)

    case 'patrol':
      return decidePatrol(state, unit, skillRegistry)

    default:
      return { type: 'END_TURN', unitId }
  }
}

// ─── chase AI ────────────────────────────────────────────────────────────────

function decideChase(state: GameState, unit: Unit, skillRegistry?: SkillRegistry): Action {
  const target = findNearestPlayer(state, unit)
  if (!target) return { type: 'END_TURN', unitId: unit.id }

  // 1. 優先嘗試技能（依 skillPool 順序，找到第一個滿足 aiTrigger 且不在冷卻的技能）
  const skillAction = trySkill(state, unit, target, skillRegistry)
  if (skillAction) return skillAction

  // 2. 嘗試武器攻擊
  const weapon = unit.weapons[0]
  if (weapon) {
    const range = getActionRange(weapon.actionId)
    if (chebyshev(unit.pos, target.pos) <= range) {
      return {
        type: 'QUEUE_WEAPON',
        unitId: unit.id,
        weaponSlot: 0,
        targetPos: target.pos,
      }
    }
  }

  // 3. 移動靠近
  const moveTarget = findBestMoveToward(state, unit, target.pos)
  if (moveTarget) {
    return { type: 'MOVE', unitId: unit.id, to: moveTarget }
  }

  return { type: 'END_TURN', unitId: unit.id }
}

// ─── guard AI ────────────────────────────────────────────────────────────────

const GUARD_DETECT_RANGE = 5

function decideGuard(state: GameState, unit: Unit, skillRegistry?: SkillRegistry): Action {
  const target = findNearestPlayer(state, unit)
  if (!target) return { type: 'END_TURN', unitId: unit.id }

  // 超出感知範圍 → 原地等待
  if (chebyshev(unit.pos, target.pos) >= GUARD_DETECT_RANGE) {
    return { type: 'END_TURN', unitId: unit.id }
  }

  // 進入感知範圍 → 同 chase 邏輯
  return decideChase(state, unit, skillRegistry)
}

// ─── patrol AI（MVP1：原地等待，不走路徑）────────────────────────────────────

function decidePatrol(state: GameState, unit: Unit, skillRegistry?: SkillRegistry): Action {
  // TODO: 載入 patrolPath 後沿路徑移動
  // 若玩家進入視野範圍，切換 chase 模式
  const target = findNearestPlayer(state, unit)
  if (target && chebyshev(unit.pos, target.pos) <= 3) {
    return decideChase(state, unit, skillRegistry)
  }
  return { type: 'END_TURN', unitId: unit.id }
}

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

/** 找最近的活著玩家 */
function findNearestPlayer(state: GameState, unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let minDist = Infinity

  for (const u of Object.values(state.units)) {
    if (u.kind !== 'player' || u.isDead) continue
    const dist = chebyshev(unit.pos, u.pos)
    if (dist < minDist) {
      minDist = dist
      nearest = u
    }
  }
  return nearest
}

/**
 * 在 moveRange 內找一個格子，讓怪物盡量靠近目標。
 * 策略：BFS 展開 moveRange 格內的可走格，選最接近目標的一格。
 */
function findBestMoveToward(state: GameState, unit: Unit, targetPos: Pos): Pos | null {
  const { cells, width, height } = state.floor
  const visited = new Set<string>()
  const queue: Array<{ pos: Pos; dist: number }> = [{ pos: unit.pos, dist: 0 }]
  const key = (p: Pos) => `${p.x},${p.y}`
  visited.add(key(unit.pos))

  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 },
    { x: 0, y: 1 }, { x: 0, y: -1 },
  ]

  let bestPos: Pos | null = null
  let bestDist = Infinity

  // 已佔用的格子（其他活著的單位）
  const occupied = new Set<string>()
  for (const u of Object.values(state.units)) {
    if (u.id !== unit.id && !u.isDead) {
      occupied.add(key(u.pos))
    }
  }

  while (queue.length > 0) {
    const { pos, dist } = queue.shift()!

    // 不移動（dist=0）跳過
    if (dist > 0) {
      // 這個格子是可選的移動目標（不是起點）
      const distToTarget = chebyshev(pos, targetPos)
      if (distToTarget < bestDist) {
        bestDist = distToTarget
        bestPos = pos
      }
    }

    if (dist >= unit.moveRange) continue

    for (const d of dirs) {
      const nx = pos.x + d.x
      const ny = pos.y + d.y
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const cell = cells[ny][nx]
      if (!cell.passable) continue
      const nk = `${nx},${ny}`
      if (visited.has(nk)) continue
      if (occupied.has(nk)) continue
      visited.add(nk)
      queue.push({ pos: { x: nx, y: ny }, dist: dist + 1 })
    }
  }

  // 若找到的最好格子比待在原地還遠，就不移動
  if (!bestPos) return null
  const currentDist = chebyshev(unit.pos, targetPos)
  if (chebyshev(bestPos, targetPos) >= currentDist) return null

  return bestPos
}

/**
 * 嘗試使用技能：依 unit.skillPool（未來從 spawner 載入）遍歷，
 * 找第一個不在冷卻且 aiTrigger 條件滿足的技能，回傳 QUEUE_SKILL action。
 * MVP1：從 unit.monsterId 的已知技能列表查找。
 */
function trySkill(
  state: GameState,
  unit: Unit,
  _target: Unit,
  skillRegistry?: SkillRegistry
): Action | null {
  if (!skillRegistry) return null

  // 從 registry 掃描所有技能，過濾冷卻中的
  const nowMs = state.timeline.tick
  const candidateIds = Object.keys(skillRegistry).filter(id => {
    const cdUntil = (unit.skillCooldownUntil ?? {})[id] ?? 0
    return cdUntil <= nowMs
  })

  for (const skillId of candidateIds) {
    const skill = skillRegistry[skillId]!
    if (!checkAiTrigger(state, unit, skill.aiTrigger)) continue

    // 找技能的目標格（以最近敵人為目標）
    const enemy = findNearestEnemy(state, unit)
    if (!enemy) continue

    const range = skill.actionOverride?.range ?? 4
    if (chebyshev(unit.pos, enemy.pos) > range) continue

    return {
      type: 'QUEUE_SKILL',
      unitId: unit.id,
      skillId,
      targetPos: enemy.pos,
    }
  }

  return null
}

function findNearestEnemy(state: GameState, unit: Unit): Unit | null {
  let nearest: Unit | null = null
  let minDist = Infinity
  for (const u of Object.values(state.units)) {
    if (u.kind === unit.kind || u.isDead) continue
    const dist = chebyshev(unit.pos, u.pos)
    if (dist < minDist) { minDist = dist; nearest = u }
  }
  return nearest
}

/**
 * 取得怪物移動到某格後，到達目標的最短路徑格數（用於 guard 射程預判）
 * （簡化版：直接用 Chebyshev 距離估算）
 */
export function estimateDistanceAfterMove(
  _state: GameState,
  unit: Unit,
  afterMovePos: Pos,
  targetPos: Pos
): number {
  void unit  // 未來可以用 BFS 精確計算
  return chebyshev(afterMovePos, targetPos)
}
