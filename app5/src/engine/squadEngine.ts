import type {
  GameState, SquadInstance, MemberInstance, HexPos, DDZ
} from './types'
import { hexDistance, hexKey } from './types'
import { captainDefs, followerDefs } from '../data/testSquads'
import { findPath, nearestInZone } from './pathfind'
import { NAMED_ZONES } from './mapData'

// ─── 常數 ─────────────────────────────────────────────────────────────────────

export const ATB_MAX   = 100
export const MOVE_ACCUM_PER_TICK = 0.08   // 每 tick 累積移動點，滿 1.0 走一格
                                            // moveSpeed=1.0 → 每 12~13 tick 走一格

// ─── 工具：取隊長/從者 def ─────────────────────────────────────────────────────

function getCaptainDef(id: string) { return captainDefs.find(c => c.id === id)! }
function getFollowerDef(id: string) { return followerDefs.find(f => f.id === id)! }

function getMemberDef(m: MemberInstance) {
  return m.isCaptain ? getCaptainDef(m.defId) : getFollowerDef(m.defId)
}

// ─── 擋槍判斷 ─────────────────────────────────────────────────────────────────

export function getBlockingMember(squad: SquadInstance): MemberInstance | null {
  const alive = squad.members.filter(m => !m.isDead)
  if (!alive.length) return null
  return alive.reduce((a, b) => a.blockPriority >= b.blockPriority ? a : b)
}

// ─── 小隊存活（隊長還活著） ───────────────────────────────────────────────────

export function isSquadAlive(squad: SquadInstance): boolean {
  return squad.members.some(m => m.isCaptain && !m.isDead)
}

// ─── 小隊的平均 moveSpeed（全體存活成員取平均）────────────────────────────────

function squadMoveSpeed(squad: SquadInstance): number {
  const alive = squad.members.filter(m => !m.isDead)
  if (!alive.length) return 0
  const total = alive.reduce((sum, m) => sum + getMemberDef(m).stats.moveSpeed, 0)
  return total / alive.length
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
  const captain = squad.members.find(m => m.isCaptain)
  if (!captain) return []
  const maxRange = Math.max(
    ...squad.members
      .filter(m => !m.isDead)
      .map(m => getMemberDef(m).stats.range)
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
    for (const prio of squad.aiConfig.targetPriority) {
      if (prio === 'nearest') {
        const d = hexDistance(squad.pos, a.pos) - hexDistance(squad.pos, b.pos)
        if (d !== 0) return d
      }
      if (prio === 'lowest_hp') {
        const hpA = a.members.find(m => m.isCaptain)?.hp ?? 0
        const hpB = b.members.find(m => m.isCaptain)?.hp ?? 0
        if (hpA !== hpB) return hpA - hpB
      }
      if (prio === 'most_members') {
        const cntA = a.members.filter(m => !m.isDead).length
        const cntB = b.members.filter(m => !m.isDead).length
        if (cntA !== cntB) return cntB - cntA
      }
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

// ─── 對目標小隊施加傷害（擋槍邏輯） ──────────────────────────────────────────

// 回傳是否造成擊殺
function applyDamage(
  attacker: SquadInstance,
  attackerMember: MemberInstance,
  target: SquadInstance,
  log: string[]
): boolean {
  const atkDef = getMemberDef(attackerMember)
  const blocker = getBlockingMember(target)
  if (!blocker) return false

  const defDef = getMemberDef(blocker)

  let tagBonus = 0
  for (const atag of atkDef.atkTags) {
    if (defDef.defTags.includes(atag as any)) tagBonus += 30
  }

  const dmg = Math.max(1, atkDef.stats.atk - defDef.stats.def + tagBonus)
  blocker.hp = Math.max(0, blocker.hp - dmg)

  if (blocker.hp === 0) {
    blocker.isDead = true
    const who = blocker.isCaptain ? '隊長' : '從者'
    log.push(`⚔️ ${getCaptainDef(attacker.captainDefId).name} 擊殺 ${getCaptainDef(target.captainDefId).name} 的${who}`)
    return blocker.isCaptain
  }
  // 一般傷害不記錄，只記擊殺
  return false
}

// ─── DDZ 觸發 ────────────────────────────────────────────────────────────────

function triggerDDZ(ddz: DDZ, state: GameState): void {
  const posSet = new Set(ddz.positions.map(p => hexKey(p)))
  Object.values(state.squads).forEach(squad => {
    if (squad.team === ddz.team) return
    if (!posSet.has(hexKey(squad.pos))) return
    const blocker = getBlockingMember(squad)
    if (!blocker) return
    blocker.hp = Math.max(0, blocker.hp - ddz.damage)
    if (blocker.hp === 0) blocker.isDead = true
    if (blocker.isDead) state.log.push(`[DDZ] 命中 ${getCaptainDef(squad.captainDefId).name}`)
  })
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
    // 警戒範圍有敵但射程外 → 靠近
    squad.state = 'moving'
  } else if (squad.manualTargetPos) {
    // 玩家手動指定目標 → 強制移動
    squad.state = 'moving'
  } else {
    // 無敵人 → 依 actionPriority 順序找到第一個可執行的動作
    // attack 但無敵可打 → 跳過，繼續看下一個
    const ap = squad.aiConfig.actionPriority
    const hasSeq = squad.aiConfig.moveSequence.length > 0
    if (ap.includes('capture')) squad.state = 'capturing'
    else if (hasSeq) squad.state = 'moving'
    else squad.state = 'idle'
  }

  // ② 移動
  if (squad.state === 'moving') {
    tickMove(squad, state, enemies)
  }

  // ③ 攻擊（ATB 充能 + 出手）
  tickATB(squad, state, inRange)

  // ④ commandCooldown 遞減
  if (squad.commandCooldownRemaining > 0) squad.commandCooldownRemaining--
}

// ─── 移動 tick ────────────────────────────────────────────────────────────────

// 每個 squad 掛一個 moveAccum，用 Map 存（避免污染 GameState 型別）
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
  if (accum < 1.0) return           // 還沒到移動一格的門檻
  moveAccumMap.set(squad.squadId, accum - 1.0)

  // 決定移動目標格
  let goal: HexPos | null = null

  if (squad.manualTargetPos) {
    // 玩家手動指定座標，優先走這個
    goal = squad.manualTargetPos
    // 到達後清除
    if (hexDistance(squad.pos, goal) === 0) {
      squad.manualTargetPos = null
      return
    }
  } else if (alertEnemies.length > 0) {
    // 往最優先的敵方靠近
    const target = sortByPriority(squad, alertEnemies)[0]
    goal = target.pos
  } else {
    // 走移動序列
    const seq = squad.aiConfig.moveSequence
    if (!seq.length) return
    const seqIdx = (squad as any)._seqIdx ?? 0
    const zoneName = seq[seqIdx]
    const zone = NAMED_ZONES[zoneName]
    if (!zone) return

    const zoneGoal = nearestInZone(squad.pos, zone)
    if (hexDistance(squad.pos, zoneGoal) === 0) {
      let next = seqIdx + 1
      if (next >= seq.length) {
        if (squad.aiConfig.loopSequence) next = 0
        else return
      }
      ;(squad as any)._seqIdx = next
      return
    }
    goal = zoneGoal
  }

  if (!goal) return

  const blocked = getBlockedKeys(squad.squadId, state.squads)
  const path = findPath(squad.pos, goal, state.cells, blocked)
  if (path.length > 0) {
    squad.pos = path[0]   // 走路徑第一步
  }
}

// ─── ATB + 攻擊 tick ──────────────────────────────────────────────────────────

function tickATB(
  squad: SquadInstance,
  state: GameState,
  inRange: SquadInstance[]
): void {
  squad.members.forEach(member => {
    if (member.isDead) return
    const def = getMemberDef(member)
    member.atb = Math.min(ATB_MAX, member.atb + def.stats.atbSpeed * 2)

    if (member.atb >= ATB_MAX && inRange.length > 0) {
      member.atb = 0
      const target = sortByPriority(squad, inRange)[0]
      // 確認攻擊者射程能打到目標
      if (hexDistance(squad.pos, target.pos) <= def.stats.range) {
        applyDamage(squad, member, target, state.log)
        // SP 充能（造成傷害）
        squad.sp = Math.min(100, squad.sp + 8)
      }
    }
  })
}

// ─── 主 tick 步進 ────────────────────────────────────────────────────────────

export function stepGame(state: GameState): GameState {
  if (state.phase !== 'running') return state

  const next = JSON.parse(JSON.stringify(state)) as GameState
  next.tick++

  // 0. 復活檢查（先於其他邏輯）
  for (const squad of Object.values(next.squads)) {
    if (squad.state === 'retreating' && squad.reviveAtTick !== null && next.tick >= squad.reviveAtTick) {
      for (const m of squad.members) {
        m.hp = m.maxHp
        m.isDead = false
        m.atb = 0
      }
      squad.pos = { ...squad.spawnPos }
      squad.state = 'idle'
      squad.reviveAtTick = null
      next.log.push(`✨ ${getCaptainDef(squad.captainDefId).name} 復活`)
    }
  }

  // 1. DDZ
  next.ddzList = next.ddzList.filter(ddz => {
    if (ddz.triggerAtTick <= next.tick) { triggerDDZ(ddz, next); return false }
    return true
  })

  // 2. 各小隊 tick（依 actionPriority 決定行為）
  for (const squad of Object.values(next.squads)) {
    tickSquad(squad, next)
  }

  // 3. 隊長陣亡 → 標記 retreating，玩家小隊設定復活倒計時
  for (const squad of Object.values(next.squads)) {
    if (!isSquadAlive(squad) && squad.state !== 'retreating') {
      squad.state = 'retreating'
      const captainDef = getCaptainDef(squad.captainDefId)
      if (squad.team === 'player') {
        squad.reviveAtTick = next.tick + captainDef.stats.reviveDelay
        next.log.push(`💀 ${captainDef.name} 敗退，${captainDef.stats.reviveDelay} tick 後復活`)
      } else {
        next.log.push(`💀 ${captainDef.name} 敗退`)
      }
    }
  }

  // 4. 勝敗判斷
  // 玩家：只要有任何存活或等待復活的小隊就繼續
  const playerActive = Object.values(next.squads).some(
    s => s.team === 'player' && (isSquadAlive(s) || s.reviveAtTick !== null)
  )
  const enemyAlive = Object.values(next.squads).some(s => s.team === 'enemy' && isSquadAlive(s))
  if (!playerActive) next.phase = 'enemy_won'
  else if (!enemyAlive) next.phase = 'player_won'

  return next
}
