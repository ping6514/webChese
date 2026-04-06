import type {
  GameState, SquadInstance, HexPos
} from './types'
import { hexDistance, hexKey, COUNTER_TABLE } from './types'
import { captainDefs, followerDefs } from '../data/testSquads'
import { findPath, nearestInZone } from './pathfind'
import { NAMED_ZONES } from './mapData'

// ─── 常數 ─────────────────────────────────────────────────────────────────────

export const ATB_MAX   = 100
export const MOVE_ACCUM_PER_TICK = 0.08

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function getCaptainDef(id: string) { return captainDefs.find(c => c.id === id)! }
function getFollowerDef(id: string) { return followerDefs.find(f => f.id === id)! }

// ─── 小隊存活（隊長 HP > 0 且不在撤退）──────────────────────────────────────

export function isSquadAlive(squad: SquadInstance): boolean {
  return squad.hp > 0 && squad.state !== 'retreating'
}

// ─── 小隊實際移速（隊長基礎速度 + 從者平均移速）─────────────────────────────

function squadMoveSpeed(squad: SquadInstance): number {
  const capDef = getCaptainDef(squad.captainDefId)
  const aliveShields = squad.shieldLayers.filter(s => !s.isDead)
  if (!aliveShields.length) return capDef.stats.moveSpeed

  const followerAvg = aliveShields.reduce((sum, s) => {
    return sum + getFollowerDef(s.followerDefId).stats.moveSpeed
  }, 0) / aliveShields.length

  return (capDef.stats.moveSpeed + followerAvg) / 2
}

// ─── 警戒範圍內的敵方小隊 ────────────────────────────────────────────────────

function getEnemiesInAlert(
  squad: SquadInstance,
  allSquads: Record<string, SquadInstance>
): SquadInstance[] {
  return Object.values(allSquads).filter(other =>
    other.team !== squad.team &&
    isSquadAlive(other) &&
    hexDistance(squad.pos, other.pos) <= squad.aiConfig.alertRange
  )
}

// ─── 射程內可攻擊的敵方小隊 ──────────────────────────────────────────────────

function getEnemiesInRange(
  squad: SquadInstance,
  allSquads: Record<string, SquadInstance>
): SquadInstance[] {
  const capDef = getCaptainDef(squad.captainDefId)
  // 取隊長射程與所有存活從者射程的最大值
  const maxRange = Math.max(
    capDef.stats.range,
    ...squad.shieldLayers
      .filter(s => !s.isDead)
      .map(s => getFollowerDef(s.followerDefId).stats.range)
  )
  return Object.values(allSquads).filter(other =>
    other.team !== squad.team &&
    isSquadAlive(other) &&
    hexDistance(squad.pos, other.pos) <= maxRange
  )
}

// ─── 依 targetPriority 排序敵方列表 ──────────────────────────────────────────

function sortByPriority(
  squad: SquadInstance,
  enemies: SquadInstance[]
): SquadInstance[] {
  return [...enemies].sort((a, b) => {
    const prio = squad.aiConfig.targetPriority
    if (prio === 'nearest') {
      const d = hexDistance(squad.pos, a.pos) - hexDistance(squad.pos, b.pos)
      if (d !== 0) return d
    }
    if (prio === 'lowest_hp') {
      if (a.hp !== b.hp) return a.hp - b.hp
    }
    if (prio === 'strongest_threat') {
      const aCap = getCaptainDef(a.captainDefId)
      const bCap = getCaptainDef(b.captainDefId)
      if (aCap.stats.atk !== bCap.stats.atk) return bCap.stats.atk - aCap.stats.atk
    }
    return 0
  })
}

// ─── 取得其他小隊占用的格子 ───────────────────────────────────────────────────

function getBlockedKeys(
  selfId: string,
  squads: Record<string, SquadInstance>
): Set<string> {
  const blocked = new Set<string>()
  for (const [id, sq] of Object.entries(squads)) {
    if (id !== selfId && isSquadAlive(sq)) blocked.add(hexKey(sq.pos))
  }
  return blocked
}

// ─── 承傷邏輯（護盾層優先，護盾破後才傷隊長）────────────────────────────────

function applyDamage(
  attacker: SquadInstance,
  isAttackerCaptain: boolean,
  attackerAtk: number,
  target: SquadInstance,
  log: string[]
): boolean {
  const capDef   = getCaptainDef(attacker.captainDefId)
  const tgtDef   = getCaptainDef(target.captainDefId)

  // 相剋加成：攻擊方隊長兵種對防守方隊長兵種是否有相剋
  const counters = COUNTER_TABLE[capDef.type] ?? []
  const counterBonus = counters.includes(tgtDef.type) ? 1.35 : 1.0

  // 找護盾層中擋槍優先值最高的存活從者
  const activeShields = target.shieldLayers.filter(s => !s.isDead)
  if (activeShields.length > 0) {
    const blocker = activeShields.reduce((a, b) => {
      const aDef = getFollowerDef(a.followerDefId)
      const bDef = getFollowerDef(b.followerDefId)
      return aDef.blockPriority >= bDef.blockPriority ? a : b
    })
    const blockerDef = getFollowerDef(blocker.followerDefId)
    const dmg = Math.max(1, Math.floor(attackerAtk * counterBonus - blockerDef.stats.def))
    blocker.hp = Math.max(0, blocker.hp - dmg)
    if (blocker.hp === 0) {
      blocker.isDead = true
      log.push(`🛡️ ${capDef.name} 擊破 ${tgtDef.name} 的護盾（${blockerDef.name}）`)
    }
    return false
  }

  // 無護盾層，直接傷隊長
  const tgtCapDef = getCaptainDef(target.captainDefId)
  const dmg = Math.max(1, Math.floor(attackerAtk * counterBonus - tgtCapDef.stats.def))
  target.hp = Math.max(0, target.hp - dmg)

  if (target.hp === 0) {
    const who = isAttackerCaptain ? capDef.name : `${capDef.name}的從者`
    log.push(`⚔️ ${who} 擊敗 ${tgtDef.name}`)
    return true
  }
  return false
}

// ─── 小隊 tick 邏輯 ──────────────────────────────────────────────────────────

function tickSquad(squad: SquadInstance, state: GameState): void {
  if (!isSquadAlive(squad)) return

  const enemies = getEnemiesInAlert(squad, state.squads)
  const inRange = getEnemiesInRange(squad, state.squads)

  // ① 決定 state
  if (inRange.length > 0) {
    squad.state = 'fighting'
  } else if (enemies.length > 0) {
    squad.state = 'moving'
  } else {
    switch (squad.aiConfig.behavior) {
      case 'aggressive': squad.state = 'moving';    break
      case 'capture':    squad.state = 'capturing'; break
      case 'defend':     squad.state = 'idle';      break
      default:           squad.state = 'idle'
    }
  }

  // ② 移動
  if (squad.state === 'moving') tickMove(squad, state, enemies)

  // ③ 攻擊
  tickATB(squad, state, inRange)

  // ④ 佔領
  if (squad.state === 'capturing') tickCapture(squad, state)
}

// ─── 移動 tick ────────────────────────────────────────────────────────────────

const moveAccumMap = new Map<string, number>()

function tickMove(
  squad: SquadInstance,
  state: GameState,
  alertEnemies: SquadInstance[]
): void {
  const spd = squadMoveSpeed(squad)
  const prev = moveAccumMap.get(squad.squadId) ?? 0
  const accum = prev + spd * MOVE_ACCUM_PER_TICK
  moveAccumMap.set(squad.squadId, accum)
  if (accum < 1.0) return
  moveAccumMap.set(squad.squadId, accum - 1.0)

  let goal: HexPos | null = null

  if (alertEnemies.length > 0) {
    // 靠近最優先敵方
    goal = sortByPriority(squad, alertEnemies)[0].pos
  } else {
    // 依路線走向下一個目標節點
    const routeZones: Record<string, string[]> = {
      top:    ['front_upper', 'gate', 'dungeon_upper', 'enemy_base'],
      mid:    ['front_mid',   'gate', 'dungeon_mid',   'enemy_base'],
      bottom: ['front_lower', 'gate', 'dungeon_lower', 'enemy_base'],
    }
    const seq = routeZones[squad.aiConfig.route] ?? routeZones['mid']
    const seqIdx = (squad as any)._seqIdx ?? 0
    const zoneName = seq[seqIdx]
    const zone = NAMED_ZONES[zoneName]
    if (!zone) return

    const zoneGoal = nearestInZone(squad.pos, zone)
    if (hexDistance(squad.pos, zoneGoal) === 0) {
      let next = seqIdx + 1
      if (next >= seq.length) return
      ;(squad as any)._seqIdx = next
      return
    }
    goal = zoneGoal
  }

  if (!goal) return

  const blocked = getBlockedKeys(squad.squadId, state.squads)
  const path = findPath(squad.pos, goal, state.cells, blocked)
  if (path.length > 0) {
    const nextKey = hexKey(path[0])
    if (!blocked.has(nextKey)) squad.pos = path[0]
  }
}

// ─── 佔領 tick ───────────────────────────────────────────────────────────────

function tickCapture(squad: SquadInstance, state: GameState): void {
  const capDef = getCaptainDef(squad.captainDefId)
  const cellKey = hexKey(squad.pos)
  const cell = state.cells[cellKey]
  if (!cell?.building) return
  const b = cell.building
  if (b.team === squad.team) return

  b.captureHp = Math.max(0, b.captureHp - capDef.stats.captureRate)
  if (b.captureHp === 0) {
    b.team = squad.team
    b.captureHp = b.maxCaptureHp
    state.log.push(`🏴 ${capDef.name} 佔領 ${b.buildingId}`)
    // 佔領獎勵
    state.resources.mana += 10
    state.resources.experience += 5
  }
}

// ─── ATB + 攻擊 tick ──────────────────────────────────────────────────────────

function tickATB(
  squad: SquadInstance,
  state: GameState,
  inRange: SquadInstance[]
): void {
  const capDef = getCaptainDef(squad.captainDefId)

  // 隊長 ATB
  squad.atb = Math.min(ATB_MAX, squad.atb + capDef.stats.atbSpeed * 2)
  if (squad.atb >= ATB_MAX && inRange.length > 0) {
    squad.atb = 0
    const target = sortByPriority(squad, inRange)[0]
    if (hexDistance(squad.pos, target.pos) <= capDef.stats.range) {
      applyDamage(squad, true, capDef.stats.atk, target, state.log)
      squad.sp = Math.min(100, squad.sp + capDef.stats.spGainPerHit)
    }
  }

  // 從者 ATB（各自獨立出手）
  for (const shield of squad.shieldLayers) {
    if (shield.isDead) continue
    const fDef = getFollowerDef(shield.followerDefId)
    shield.atb = Math.min(ATB_MAX, shield.atb + fDef.stats.atbSpeed * 2)
    if (shield.atb >= ATB_MAX && inRange.length > 0) {
      shield.atb = 0
      const target = sortByPriority(squad, inRange)[0]
      if (hexDistance(squad.pos, target.pos) <= fDef.stats.range) {
        applyDamage(squad, false, fDef.stats.atk, target, state.log)
      }
    }
  }
}

// ─── 靈力自然產出 ────────────────────────────────────────────────────────────

function tickResources(state: GameState): void {
  // 主堡基礎產出
  state.resources.mana += 0.5

  // 佔領節點加成
  for (const cell of Object.values(state.cells)) {
    if (!cell.building) continue
    const b = cell.building
    if (b.team !== 'player') continue
    switch (b.nodeType) {
      case 'outpost':    state.resources.mana += 0.3; break
      case 'barracks':   state.resources.mana += 0.2; break
      case 'highGround': state.resources.mana += 0.1; break
    }
  }
}

// ─── 主 tick 步進 ────────────────────────────────────────────────────────────

export function stepGame(state: GameState): GameState {
  if (state.phase !== 'running') return state

  const next = JSON.parse(JSON.stringify(state)) as GameState
  next.tick++

  // 0. 資源自然產出
  tickResources(next)

  // 1. 復活檢查
  for (const squad of Object.values(next.squads)) {
    if (squad.state === 'retreating' && squad.reviveAtTick !== null && next.tick >= squad.reviveAtTick) {
      const capDef = getCaptainDef(squad.captainDefId)
      squad.hp = capDef.stats.hp
      squad.atb = 0
      squad.sp = 0
      squad.shieldLayers = []  // 裸體復活，從者消耗品不跟
      squad.pos = { ...squad.spawnPos }
      squad.state = 'idle'
      squad.reviveAtTick = null
      ;(squad as any)._seqIdx = 0
      next.log.push(`✨ ${capDef.name} 復活`)
    }
  }

  // 2. DDZ
  next.ddzList = next.ddzList.filter(ddz => {
    if (ddz.triggerAtTick <= next.tick) {
      const posSet = new Set(ddz.positions.map(p => hexKey(p)))
      Object.values(next.squads).forEach(squad => {
        if (squad.team === ddz.team) return
        if (!posSet.has(hexKey(squad.pos))) return
        // 護盾優先承傷
        const alive = squad.shieldLayers.filter(s => !s.isDead)
        if (alive.length > 0) {
          alive[0].hp = Math.max(0, alive[0].hp - ddz.damage)
          if (alive[0].hp === 0) alive[0].isDead = true
        } else {
          squad.hp = Math.max(0, squad.hp - ddz.damage)
        }
        next.log.push(`[DDZ] 命中 ${getCaptainDef(squad.captainDefId).name}`)
      })
      return false
    }
    return true
  })

  // 3. 各小隊 tick
  for (const squad of Object.values(next.squads)) {
    tickSquad(squad, next)
  }

  // 4. 隊長陣亡 → retreating
  for (const squad of Object.values(next.squads)) {
    if (squad.hp <= 0 && squad.state !== 'retreating') {
      squad.state = 'retreating'
      const capDef = getCaptainDef(squad.captainDefId)
      if (squad.team === 'player') {
        squad.reviveAtTick = next.tick + capDef.stats.reviveDelay
        next.log.push(`💀 ${capDef.name} 敗退，${capDef.stats.reviveDelay} tick 後復活`)
      } else {
        next.log.push(`💀 ${capDef.name} 敗退`)
      }
    }
  }

  // 5. 勝敗判斷
  const playerActive = Object.values(next.squads).some(
    s => s.team === 'player' && (isSquadAlive(s) || s.reviveAtTick !== null)
  )
  const enemyAlive = Object.values(next.squads).some(s => s.team === 'enemy' && isSquadAlive(s))
  if (!playerActive) next.phase = 'enemy_won'
  else if (!enemyAlive) next.phase = 'player_won'

  return next
}
