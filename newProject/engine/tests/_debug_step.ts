import { reduce } from '../reduce'
import { makeWarrior, makeWolf } from './fixtures'

const player = makeWarrior('player_1', { x: 3, y: 3 })
const wolf = makeWolf('wolf_1', { x: 5, y: 3 })
const cells: any[][] = Array.from({ length: 10 }, () =>
  Array.from({ length: 10 }, () => ({ type: 'floor' as const, height: 1 as const, passable: true, blockLineOfSight: false, terrain: 'normal' as const }))
)
const hazard: any = { id: 'h2', ownerId: 'wolf_1', pos: { x: 4, y: 3 }, expiresAt: 99999, triggerOn: 'step_on', triggersUsed: 0, effectId: 'vine_entangle', maxTriggers: 3 }
const state: any = {
  floor: { width: 10, height: 10, cells, seed: 't', floorNumber: 1, pathType: 'safe', theme: 'forest', objective: { type: 'reach_exit', exitPos: { x: 9, y: 9 } }, hazards: { h2: hazard }, projectiles: [], loot: [] },
  units: { player_1: player, wolf_1: wolf },
  timeline: { tick: 1000, pendingUnitId: 'player_1', entries: [{ unitId: 'player_1', atb: 100, castRemaining: 0, recoveryRemaining: 0 }, { unitId: 'wolf_1', atb: 50, castRemaining: 0, recoveryRemaining: 0 }] },
  turnFlags: { actingUnitId: null },
  run: { runSeed: 't', difficulty: 1, theme: 'forest', floorNumber: 1, maxFloors: 10, pathHistory: [], trialFloorCount: 0, dungeonQuality: 1.0, lootQuality: 1.0, status: 'active' },
}
const result = reduce(state, { type: 'MOVE', unitId: 'player_1', to: { x: 4, y: 3 } }, { allAffixDefs: {} })
console.log('events:', result.events.map((e: any) => e.type).join(',') || '(none)')
console.log('player pos:', JSON.stringify(result.state.units['player_1']?.pos))
console.log('hazard h2:', JSON.stringify(result.state.floor.hazards['h2']))
