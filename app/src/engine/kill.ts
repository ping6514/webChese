import type { Event } from './events'
import type { GameState } from './state'
import { getSoulCard } from './cards'
import { getDefValueInState } from './stats'

export function killUnit(s: GameState, unitId: string, events: Event[], killerId?: string): GameState {
  const u = s.units[unitId]
  if (!u) return s

  const deadId = u.id
  const deadSide = u.side
  const deadPos = { ...u.pos }
  const deadSoulId = u.enchant?.soulId ?? null

  const posKey = `${u.pos.x},${u.pos.y}`
  const corpse = {
    ownerSide: u.side,
    base: u.base,
  }
  const stack = s.corpsesByPos[posKey] ? [...s.corpsesByPos[posKey]] : []
  stack.push(corpse)
  s.corpsesByPos[posKey] = stack

  if (u.enchant?.soulId) {
    s.graveyard[u.side] = [u.enchant.soulId, ...s.graveyard[u.side]]
  }

  delete s.units[u.id]
  events.push({ type: 'UNIT_KILLED', unitId: u.id })

  // DEATH_COUNTER: counter-attack the killer using the dying unit's own ATK
  if (deadSoulId && killerId) {
    const card = getSoulCard(deadSoulId)
    const hasCounter = card?.abilities.some((a) => String((a as any).type ?? '') === 'DEATH_COUNTER')
    if (hasCounter) {
      const killer = s.units[killerId]
      if (killer && killer.side !== deadSide) {
        // u.atk is still accessible even though u was removed from s.units
        const counterAtkKey = u.atk.key
        const counterAtkValue = u.atk.value
        const defValue = getDefValueInState(s, killer, counterAtkKey)
        const raw = Math.max(1, 1 + counterAtkValue - defValue)
        const killerNextHp = killer.hpCurrent - raw
        s.units[killerId] = { ...killer, hpCurrent: killerNextHp }
        events.push({ type: 'ABILITY_TRIGGERED', unitId: deadId, text: '最後一搏' })
        events.push({ type: 'DAMAGE_DEALT', attackerId: deadId, targetUnitId: killerId, amount: raw })
        if (killerNextHp <= 0) {
          s = killUnit(s, killerId, events)
        }
      }
    }
  }

  // On-death abilities (e.g. Eternal Night: 冥土歸還)
  if (deadSoulId) {
    const card = getSoulCard(deadSoulId)
    if (card) {
      for (const ab of card.abilities) {
        if (String((ab as any).type ?? '') !== 'ON_DEATH_FIXED_DAMAGE') continue

        const amount = Math.floor(Number((ab as any).amount ?? 0))
        const radius = Math.floor(Number((ab as any).radius ?? 0))
        const targets = String((ab as any).targets ?? '')
        const ignoreDef = !!(ab as any).ignoreDef

        if (!(Number.isFinite(amount) && amount > 0)) continue
        if (!(Number.isFinite(radius) && radius >= 0)) continue
        if (!ignoreDef) continue
        if (targets !== 'enemies') continue

        const victims = Object.values(s.units)
          .filter((t) => t.side !== deadSide)
          .filter((t) => Math.max(Math.abs(t.pos.x - deadPos.x), Math.abs(t.pos.y - deadPos.y)) <= radius)
          .sort((a, b) => a.id.localeCompare(b.id))

        for (const v0 of victims) {
          const v = s.units[v0.id]
          if (!v) continue

          if (v.base === 'king' && s.status.kingInvincibleSide === v.side) {
            continue
          }
          const nextHp = v.hpCurrent - amount
          s.units[v.id] = { ...v, hpCurrent: nextHp }
          events.push({ type: 'DAMAGE_DEALT', attackerId: deadId, targetUnitId: v.id, amount })
          if (nextHp <= 0) {
            s = killUnit(s, v.id, events)
          }
        }
      }
    }
  }

  return s
}
