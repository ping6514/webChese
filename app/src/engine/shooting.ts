import type { GameState } from './state'
import { getUnitAt } from './state'
import { getEffectHandlers } from './effects'
import { getSoulCard } from './cards'
import { countCorpses } from './corpses'

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

export type ShootCheckOk = { ok: true }

export type ShootRulesOverride = {
  ignoreBlockingCount?: number
  ignoreBlockingAll?: boolean
  manaCostOverride?: number
}

function countBetweenOrthogonal(state: GameState, a: { x: number; y: number }, b: { x: number; y: number }): number | null {
  if (a.x !== b.x && a.y !== b.y) return null
  let count = 0
  if (a.x === b.x) {
    const x = a.x
    const y1 = Math.min(a.y, b.y)
    const y2 = Math.max(a.y, b.y)
    for (let y = y1 + 1; y <= y2 - 1; y++) {
      if (getUnitAt(state, { x, y })) count++
    }
  } else {
    const y = a.y
    const x1 = Math.min(a.x, b.x)
    const x2 = Math.max(a.x, b.x)
    for (let x = x1 + 1; x <= x2 - 1; x++) {
      if (getUnitAt(state, { x, y })) count++
    }
  }
  return count
}

function isLegalShootByBase(
  state: GameState,
  attackerId: string,
  targetId: string,
  rules?: ShootRulesOverride,
): ShootCheck {
  const attacker = state.units[attackerId]
  const target = state.units[targetId]
  if (!attacker || !target) return { ok: false, error: 'Unit not found' }

  const ax = attacker.pos.x
  const ay = attacker.pos.y
  const tx = target.pos.x
  const ty = target.pos.y

  switch (attacker.base) {
    case 'rook': {
      const between = countBetweenOrthogonal(state, attacker.pos, target.pos)
      if (between === null) return { ok: false, error: 'Out of range' }

      const ignoreAll = !!rules?.ignoreBlockingAll
      const ignoreCount = rules?.ignoreBlockingCount ?? 0
      const ok = ignoreAll ? true : between <= ignoreCount
      return ok ? { ok: true } : { ok: false, error: 'Blocked' }
    }
    case 'cannon': {
      const between = countBetweenOrthogonal(state, attacker.pos, target.pos)
      if (between === null) return { ok: false, error: 'Out of range' }

      const ignoreAll = !!rules?.ignoreBlockingAll
      const ignoreCount = rules?.ignoreBlockingCount ?? 0
      if (ignoreAll || ignoreCount > 0) {
        // When ignoring blocking, cannon can still shoot normally (1 screen) and may also shoot directly (0 screen).
        return between === 0 || between === 1 ? { ok: true } : { ok: false, error: 'Blocked' }
      }

      return between === 1 ? { ok: true } : { ok: false, error: 'Need screen' }
    }
    case 'king': {
      // palace 1 step (orthogonal)
      const dx = Math.abs(tx - ax)
      const dy = Math.abs(ty - ay)
      if (dx + dy !== 1) return { ok: false, error: 'Out of range' }
      if (!palaceContains(attacker.side, target.pos)) return { ok: false, error: 'Out of range' }
      return { ok: true }
    }
    case 'advisor': {
      // diagonal 1
      const dx = Math.abs(tx - ax)
      const dy = Math.abs(ty - ay)
      if (dx !== 1 || dy !== 1) return { ok: false, error: 'Out of range' }
      return { ok: true }
    }
    case 'elephant': {
      // 2-diagonal with eye block
      const dx = tx - ax
      const dy = ty - ay
      if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) return { ok: false, error: 'Out of range' }

      const eye = { x: ax + dx / 2, y: ay + dy / 2 }
      if (getUnitAt(state, eye)) return { ok: false, error: 'Blocked' }
      return { ok: true }
    }
    case 'knight': {
      // L-shape with leg block
      const dx = tx - ax
      const dy = ty - ay
      const adx = Math.abs(dx)
      const ady = Math.abs(dy)
      if (!((adx === 1 && ady === 2) || (adx === 2 && ady === 1))) return { ok: false, error: 'Out of range' }

      const leg = adx === 2 ? { x: ax + dx / 2, y: ay } : { x: ax, y: ay + dy / 2 }
      if (getUnitAt(state, leg)) return { ok: false, error: 'Blocked' }
      return { ok: true }
    }
    case 'soldier': {
      // forward 1
      const forwardDy = attacker.side === 'red' ? -1 : 1
      if (tx !== ax || ty !== ay + forwardDy) return { ok: false, error: 'Out of range' }
      return { ok: true }
    }
    default: {
      return { ok: false, error: 'Out of range' }
    }
  }
}
export type ShootCheckErr = { ok: false; error: string }
export type ShootCheck = ShootCheckOk | ShootCheckErr

function isClearSameFile(state: GameState, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  if (a.x !== b.x) return false
  const x = a.x
  const y1 = Math.min(a.y, b.y)
  const y2 = Math.max(a.y, b.y)
  for (let y = y1 + 1; y <= y2 - 1; y++) {
    if (getUnitAt(state, { x, y })) return false
  }
  return true
}

export function canShoot(state: GameState, attackerId: string, targetUnitId: string, rules?: ShootRulesOverride): ShootCheck {
  const attacker = state.units[attackerId]
  if (!attacker) return { ok: false, error: 'Attacker not found' }
  const target = state.units[targetUnitId]
  if (!target) return { ok: false, error: 'Target not found' }

  if (state.turn.phase !== 'combat') return { ok: false, error: 'Not in combat phase' }
  if (attacker.side !== state.turn.side) return { ok: false, error: 'Not your turn' }
  if (target.side === attacker.side) return { ok: false, error: 'Cannot target ally' }

  const cost = Number.isFinite(rules?.manaCostOverride as any) ? Math.max(0, Math.floor(rules?.manaCostOverride as number)) : state.rules.shootManaCost
  const r = state.resources[state.turn.side]
  if (r.mana < cost) return { ok: false, error: 'Not enough mana' }

  if (state.turnFlags.shotUsed[attackerId]) {
    const soulId = attacker.enchant?.soulId
    const card = soulId ? getSoulCard(soulId) : undefined
    const ab = card?.abilities.find((a) => a.type === 'MOVE_THEN_SHOOT')
    const when = (ab as any)?.when
    if (when && String(when.type ?? '') === 'CORPSES_GTE') {
      const need = Number(when.count ?? 0)
      if (Number.isFinite(need) && need > 0) {
        const corpses = countCorpses(state, attacker.side)
        if (corpses < need) return { ok: false, error: 'Already shot this turn' }
      }
    }
    const perTurn = Number((ab as any)?.perTurn ?? 0)
    const moved = !!state.turnFlags.movedThisTurn?.[attackerId]
    const key = `${attackerId}:MOVE_THEN_SHOOT`
    const used = Number(state.turnFlags.abilityUsed?.[key] ?? 0)
    const canExtra = moved && Number.isFinite(perTurn) && perTurn > 0 && used < perTurn
    if (!canExtra) return { ok: false, error: 'Already shot this turn' }
  }

  // base range/blocking rules
  const baseCheck = isLegalShootByBase(state, attackerId, targetUnitId, rules)
  if (!baseCheck.ok) return baseCheck

  // facing-kings rule as an active shot: king can shoot enemy king only if same file and unblocked
  if (attacker.base === 'king' && target.base === 'king') {
    if (!isClearSameFile(state, attacker.pos, target.pos)) return { ok: false, error: 'Kings not in line' }
  }

  return { ok: true }
}

export function getShootableTargetIds(state: GameState, attackerId: string): string[] {
  const attacker = state.units[attackerId]
  if (!attacker) return []

  const out: string[] = []
  const handlers = getEffectHandlers(state)
  for (const t of Object.values(state.units)) {
    if (t.side === attacker.side) continue

    const shootRules = {
      ignoreBlockingCount: 0,
      ignoreBlockingAll: false,
      manaCostOverride: undefined,
    }

    let vetoed = false

    for (const h of handlers) {
      const res = h.onBeforeShootValidate?.({ state, attackerId, targetUnitId: t.id, shootRules })
      if (res && !res.ok) {
        // if an effect blocks this shot specifically, treat as not shootable
        vetoed = true
        break
      }
    }

    if (vetoed) continue

    const check = canShoot(state, attackerId, t.id, shootRules)
    if (check.ok) out.push(t.id)
  }
  return out
}
