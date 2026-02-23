import type { GameState, Unit } from './state'
import type { Pos } from './types'
import { isOnBoard } from './types'
import { getUnitAt } from './state'

function isEmpty(state: GameState, pos: Pos): boolean {
  return !getUnitAt(state, pos)
}

function palaceContains(side: Unit['side'], pos: Pos): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function crossedRiver(side: Unit['side'], y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function addIfEmpty(state: GameState, out: Pos[], pos: Pos) {
  if (!isOnBoard(pos)) return
  if (!isEmpty(state, pos)) return
  out.push(pos)
}

function isPathClearOrthogonal(state: GameState, from: Pos, to: Pos): boolean {
  if (from.x !== to.x && from.y !== to.y) return false
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)
  let x = from.x + dx
  let y = from.y + dy
  while (x !== to.x || y !== to.y) {
    if (getUnitAt(state, { x, y })) return false
    x += dx
    y += dy
  }
  return true
}

export function getLegalMoves(state: GameState, unitId: string): Pos[] {
  const unit = state.units[unitId]
  if (!unit) return []

  const out: Pos[] = []
  const { x, y } = unit.pos

  switch (unit.base) {
    case 'rook':
    case 'cannon': {
      // movement for both rook and cannon is orthogonal, any distance, cannot pass through units.
      // (cannon special shooting/capture is handled elsewhere)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        let cx = x + dx
        let cy = y + dy
        while (isOnBoard({ x: cx, y: cy })) {
          if (!isEmpty(state, { x: cx, y: cy })) break
          out.push({ x: cx, y: cy })
          cx += dx
          cy += dy
        }
      }
      return out
    }
    case 'knight': {
      // xiangqi knight: blocked by the adjacent orthogonal 'leg'
      const candidates = [
        { to: { x: x + 1, y: y + 2 }, leg: { x, y: y + 1 } },
        { to: { x: x - 1, y: y + 2 }, leg: { x, y: y + 1 } },
        { to: { x: x + 1, y: y - 2 }, leg: { x, y: y - 1 } },
        { to: { x: x - 1, y: y - 2 }, leg: { x, y: y - 1 } },
        { to: { x: x + 2, y: y + 1 }, leg: { x: x + 1, y } },
        { to: { x: x + 2, y: y - 1 }, leg: { x: x + 1, y } },
        { to: { x: x - 2, y: y + 1 }, leg: { x: x - 1, y } },
        { to: { x: x - 2, y: y - 1 }, leg: { x: x - 1, y } },
      ]

      for (const c of candidates) {
        if (!isOnBoard(c.to)) continue
        if (!isEmpty(state, c.to)) continue
        if (getUnitAt(state, c.leg)) continue
        out.push(c.to)
      }
      return out
    }
    case 'elephant': {
      // xiangqi elephant: 2-point diagonal, blocked by 'eye', cannot cross river
      const candidates = [
        { to: { x: x + 2, y: y + 2 }, eye: { x: x + 1, y: y + 1 } },
        { to: { x: x - 2, y: y + 2 }, eye: { x: x - 1, y: y + 1 } },
        { to: { x: x + 2, y: y - 2 }, eye: { x: x + 1, y: y - 1 } },
        { to: { x: x - 2, y: y - 2 }, eye: { x: x - 1, y: y - 1 } },
      ]

      for (const c of candidates) {
        if (!isOnBoard(c.to)) continue
        if (!isEmpty(state, c.to)) continue
        if (getUnitAt(state, c.eye)) continue

        // river rule
        if (unit.side === 'red' && c.to.y <= 4) continue
        if (unit.side === 'black' && c.to.y >= 5) continue

        out.push(c.to)
      }
      return out
    }
    case 'advisor': {
      // advisor: 1-point diagonal within palace
      const deltas = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ] as const
      for (const [dx, dy] of deltas) {
        const to = { x: x + dx, y: y + dy }
        if (!palaceContains(unit.side, to)) continue
        addIfEmpty(state, out, to)
      }
      return out
    }
    case 'king': {
      // king: 1-point orthogonal within palace
      const deltas = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
      for (const [dx, dy] of deltas) {
        const to = { x: x + dx, y: y + dy }
        if (!palaceContains(unit.side, to)) continue
        if (!isOnBoard(to)) continue
        if (!isEmpty(state, to)) continue
        out.push(to)
      }
      return out
    }
    case 'soldier': {
      const forwardDy = unit.side === 'red' ? -1 : 1
      addIfEmpty(state, out, { x, y: y + forwardDy })

      if (crossedRiver(unit.side, y)) {
        addIfEmpty(state, out, { x: x + 1, y })
        addIfEmpty(state, out, { x: x - 1, y })
      }
      return out
    }
    default: {
      return []
    }
  }
}

export function isLegalMove(state: GameState, unitId: string, to: Pos): boolean {
  return getLegalMoves(state, unitId).some((p) => p.x === to.x && p.y === to.y)
}

export function isLegalRookLikeMove(state: GameState, from: Pos, to: Pos): boolean {
  if (!isOnBoard(to)) return false
  if (!isEmpty(state, to)) return false
  return isPathClearOrthogonal(state, from, to)
}
