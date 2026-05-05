import type {
  GameState, SquadInstance, HexPos, BattleEvent, AttackFXType, CaptainType, FollowerType, LaneDef,
  TraitType, TraitCard, ShieldLayer, DamageType, ZoneState, MapCell, WaveSpawner
} from './types'
import { hexDistance, hexKey } from './types'
import { captainDefs, followerDefs, basicCaptainDefs } from '../data/testSquads'
import { findPath, nearestInZone, neighbors } from './pathfind'

// ─── 常數 ─────────────────────────────────────────────────────────────────────

export const ATB_MAX   = 100
export const MOVE_ACCUM_PER_TICK = 0.08

// ─── FX 型別映射 ──────────────────────────────────────────────────────────────

function toFXType(type: CaptainType | FollowerType): AttackFXType {
  if (type === 'ranged')   return 'arrow'
  if (type === 'siege')    return 'cannonball'
  if (type === 'cavalry')  return 'stab'
  return 'slash'  // infantry, heavy
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function getCaptainDef(id: string) {
  return captainDefs.find(c => c.id === id) ?? basicCaptainDefs.find(c => c.id === id)!
}
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

// ─── 地形加成 ────────────────────────────────────────────────────────────────

function terrainRangeBonus(squad: SquadInstance, state: GameState): number {
  // 高地：射程 +1
  return state.cells[hexKey(squad.pos)]?.terrain === 'highGround' ? 1 : 0
}

function terrainSpeedMult(squad: SquadInstance, state: GameState): number {
  // 森林：移速 ×0.65
  return state.cells[hexKey(squad.pos)]?.terrain === 'forest' ? 0.65 : 1.0
}

// ─── 射程內可攻擊的敵方小隊 ──────────────────────────────────────────────────

function getEnemiesInRange(
  squad: SquadInstance,
  allSquads: Record<string, SquadInstance>,
  state: GameState
): SquadInstance[] {
  const capDef = getCaptainDef(squad.captainDefId)
  const rangeBonus = terrainRangeBonus(squad, state)
  // 取隊長射程與所有存活從者射程的最大值，再加高地加成
  const maxRange = Math.max(
    capDef.stats.range,
    ...squad.shieldLayers
      .filter(s => !s.isDead)
      .map(s => getFollowerDef(s.followerDefId).stats.range)
  ) + rangeBonus
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

// ─── 屬性傷害 ─────────────────────────────────────────────────────────────────
// 步兵/騎兵/重甲 → 物理；弓兵/攻城 → 穿透；魔法保留給未來 Buff/Trait

function getDamageType(type: CaptainType | FollowerType): DamageType {
  if (type === 'ranged' || type === 'siege') return 'pierce'
  return 'phys'
}

function getDefValue(
  stats: { physDef: number; pierceDef: number; magDef: number },
  dmgType: DamageType
): number {
  if (dmgType === 'phys')   return stats.physDef
  if (dmgType === 'pierce') return stats.pierceDef
  return stats.magDef
}

// ─── 濺射傷害（Splash trait 輔助）───────────────────────────────────────────

function applySplashDamage(
  attacker: SquadInstance,
  splashAtk: number,
  primaryTarget: SquadInstance,
  state: GameState,
  events: BattleEvent[]
): void {
  for (const squad of Object.values(state.squads)) {
    if (squad.squadId === primaryTarget.squadId) continue
    if (squad.team === attacker.team) continue
    if (!isSquadAlive(squad)) continue
    if (hexDistance(squad.pos, primaryTarget.pos) > 1) continue

    const dmg = Math.max(1, splashAtk)
    const alive = squad.shieldLayers.filter(s => !s.isDead)
    if (alive.length > 0) {
      alive[0].hp = Math.max(0, alive[0].hp - dmg)
      if (alive[0].hp === 0) alive[0].isDead = true
    } else {
      squad.hp = Math.max(0, squad.hp - dmg)
    }
    events.push({ type: 'damage', targetId: squad.squadId, pos: { ...squad.pos }, amount: dmg })
  }
}

// ─── 承傷邏輯（護盾層優先 + 屬性傷害 + Trait 效果）─────────────────────────

function applyDamage(
  attacker: SquadInstance,
  isAttackerCaptain: boolean,
  attackerUnitType: CaptainType | FollowerType,
  attackerAtk: number,
  target: SquadInstance,
  log: string[],
  events: BattleEvent[],
  state: GameState,
  attackerTraits: TraitType[] = []
): boolean {
  const capDef  = getCaptainDef(attacker.captainDefId)
  const tgtDef  = getCaptainDef(target.captainDefId)
  const dmgType = getDamageType(attackerUnitType)
  const baseAtk = attackerAtk   // 屬性傷害透過抗性體現，不額外乘倍率
  // iron_wall：目標防禦 ×2
  const ironWallMult = (target.spBuffActive && target.spBuffType === 'iron_wall') ? 2 : 1

  // ── 護盾層優先承傷 ────────────────────────────────────────────────────
  const activeShields = target.shieldLayers.filter(s => !s.isDead)
  if (activeShields.length > 0) {
    // Taunt：嘲諷護盾額外提高擋槍優先值
    const blocker = activeShields.reduce((a, b) => {
      const aPrio = getFollowerDef(a.followerDefId).blockPriority + (a.traits.includes('Taunt') ? 100 : 0)
      const bPrio = getFollowerDef(b.followerDefId).blockPriority + (b.traits.includes('Taunt') ? 100 : 0)
      return aPrio >= bPrio ? a : b
    })
    const blockerDef = getFollowerDef(blocker.followerDefId)

    // Pierce：忽視 40% 對應抗性；iron_wall：×2 防禦
    const rawDef = getDefValue(blockerDef.stats, dmgType) * ironWallMult
    const effectiveDef = attackerTraits.includes('Pierce') ? rawDef * 0.6 : rawDef

    let dmg = Math.max(1, Math.floor(baseAtk - effectiveDef))

    // Block：30% 機率傷害減半
    if (blocker.traits.includes('Block') && Math.random() < 0.3) {
      dmg = Math.max(1, Math.floor(dmg / 2))
    }

    blocker.hp = Math.max(0, blocker.hp - dmg)
    if (blocker.hp === 0) {
      blocker.isDead = true
      log.push(`🛡️ ${capDef.name} 擊破 ${tgtDef.name} 的護盾（${blockerDef.name}）`)
    }
    events.push({ type: 'damage', targetId: target.squadId, pos: { ...target.pos }, amount: dmg })

    // LifeSteal：回復隊長 HP
    if (attackerTraits.includes('LifeSteal')) {
      const attackerCapDef = getCaptainDef(attacker.captainDefId)
      attacker.hp = Math.min(attackerCapDef.stats.hp, attacker.hp + Math.floor(dmg * 0.2))
    }
    // Splash：濺射鄰格敵方
    if (attackerTraits.includes('Splash')) {
      applySplashDamage(attacker, Math.floor(baseAtk * 0.4), target, state, events)
    }
    return false
  }

  // ── 無護盾，直接傷隊長 ───────────────────────────────────────────────
  const tgtCapDef    = getCaptainDef(target.captainDefId)
  const rawCapDef    = getDefValue(tgtCapDef.stats, dmgType) * ironWallMult
  const effectiveDef = attackerTraits.includes('Pierce') ? rawCapDef * 0.6 : rawCapDef

  const dmg = Math.max(1, Math.floor(baseAtk - effectiveDef))
  target.hp = Math.max(0, target.hp - dmg)
  events.push({ type: 'damage', targetId: target.squadId, pos: { ...target.pos }, amount: dmg })

  if (attackerTraits.includes('LifeSteal')) {
    const attackerCapDef = getCaptainDef(attacker.captainDefId)
    attacker.hp = Math.min(attackerCapDef.stats.hp, attacker.hp + Math.floor(dmg * 0.2))
  }
  if (attackerTraits.includes('Splash')) {
    applySplashDamage(attacker, Math.floor(baseAtk * 0.4), target, state, events)
  }

  if (target.hp === 0) {
    const who = isAttackerCaptain ? capDef.name : `${capDef.name}的從者`
    log.push(`⚔️ ${who} 擊敗 ${tgtDef.name}`)
    events.push({ type: 'death', targetId: target.squadId, pos: { ...target.pos } })
    return true
  }
  return false
}

// ─── 跨路路點計算（無狀態：以 q 軸閾值判斷是否已通過）─────────────────────
// Player 往右（q 遞增），Enemy 往左（q 遞減）
// waypoints 需依行進方向排序（player: q 由小到大；enemy: q 由大到小）
function getCurrentWaypoint(squad: SquadInstance, lane: LaneDef): HexPos | null {
  if (!lane.waypoints || lane.waypoints.length === 0) return null
  if (squad.team === 'player') {
    return lane.waypoints.find(wp => wp.q > squad.pos.q) ?? null
  } else {
    return lane.waypoints.find(wp => wp.q < squad.pos.q) ?? null
  }
}

// ─── 目標計算（三國志大戰式：行為驅動 + 跨路路點）──────────────────────────

function getGoal(
  squad: SquadInstance,
  state: GameState,
  alertEnemies: SquadInstance[],
): HexPos | null {
  // 有警戒範圍內的敵人 → 靠近優先目標
  if (alertEnemies.length > 0) {
    return sortByPriority(squad, alertEnemies)[0].pos
  }

  const lane = state.lanes.find(l => l.id === squad.aiConfig.route)
    ?? state.lanes[Math.floor(state.lanes.length / 2)]

  // 跨路路點優先：尚未通過的路點作為下一個目標
  const wp = getCurrentWaypoint(squad, lane)
  if (wp) return wp

  // capture 行為：前往本路線序列中第一個未佔領的區域
  if (squad.aiConfig.behavior === 'capture') {
    for (const zoneId of lane.sequence) {
      const zone = state.zones[zoneId]
      if (!zone || zone.team === squad.team) continue
      return nearestInZone(squad.pos, zone.cells)
    }
    // 所有區域都佔了 → 和 aggressive 一樣直推主堡
  }

  // aggressive（或 capture 全佔後）：直推敵方主堡
  const targetNodeType = squad.team === 'player' ? 'enemyBase' : 'playerBase'
  for (const cell of Object.values(state.cells)) {
    if (cell.building?.nodeType === targetNodeType && cell.pos.r === lane.row) {
      return cell.pos
    }
  }
  return null
}

// ─── 小隊 tick 邏輯 ──────────────────────────────────────────────────────────

function tickSquad(squad: SquadInstance, state: GameState): void {
  if (!isSquadAlive(squad)) return

  const enemies = getEnemiesInAlert(squad, state.squads)
  const inRange = getEnemiesInRange(squad, state.squads, state)

  // 判斷當前格是否有未佔領的可佔領區域（且屬於當前路線）
  const lane = state.lanes.find(l => l.id === squad.aiConfig.route)
    ?? state.lanes[Math.floor(state.lanes.length / 2)]
  const cell = state.cells[hexKey(squad.pos)]
  const zoneHere = cell?.zoneId ? state.zones[cell.zoneId] : null
  // zone 必須在當前路線的 sequence 內才算「應佔的目標」
  const zoneInRoute = !!(cell?.zoneId && lane.sequence.includes(cell.zoneId))
  const onCapturable = (zoneInRoute && !!(zoneHere && zoneHere.team !== squad.team))
    || !!(cell?.building && cell.building.team !== squad.team
      && (cell.building.nodeType === 'enemyBase' || cell.building.nodeType === 'playerBase'))

  // ① 決定 state
  if (inRange.length > 0) {
    squad.state = 'fighting'
  } else if (enemies.length > 0) {
    squad.state = 'moving'
  } else if (squad.aiConfig.behavior === 'capture' && onCapturable) {
    squad.state = 'capturing'   // 在當前路線應佔的格子 → 停下來佔
  } else if (squad.aiConfig.behavior === 'defend') {
    squad.state = 'idle'
  } else {
    squad.state = 'moving'     // aggressive，或 capture 路線切換後立即離開
  }

  // ② 移動（iron_wall 防禦陣型期間移速歸零）
  const isIronWall = squad.spBuffActive && squad.spBuffType === 'iron_wall'
  if (squad.state === 'moving' && !isIronWall) tickMove(squad, state, enemies)

  // ③ 攻擊
  tickATB(squad, state, inRange, state.events)

  // ④ 佔領（任何 state 都執行，aggressive 踏過時也能推進進度）
  tickCapture(squad, state)
}

// ─── 移動 tick ────────────────────────────────────────────────────────────────

const moveAccumMap = new Map<string, number>()

function tickMove(
  squad: SquadInstance,
  state: GameState,
  alertEnemies: SquadInstance[]
): void {
  const spd  = squadMoveSpeed(squad) * terrainSpeedMult(squad, state)
  const prev = moveAccumMap.get(squad.squadId) ?? 0
  const accum = prev + spd * MOVE_ACCUM_PER_TICK
  moveAccumMap.set(squad.squadId, accum)
  if (accum < 1.0) return
  moveAccumMap.set(squad.squadId, accum - 1.0)

  const goal = getGoal(squad, state, alertEnemies)
  if (!goal) return

  const blocked = getBlockedKeys(squad.squadId, state.squads)
  const path = findPath(squad.pos, goal, state.cells, blocked)

  let moved = false
  if (path.length > 0) {
    const nextKey = hexKey(path[0])
    if (!blocked.has(nextKey)) {
      squad.pos = path[0]
      moved = true
    }
  }

  // 路被友軍完全堵死：貪婪嘗試任何能讓自己更接近目標的可通行鄰格
  if (!moved) {
    const currentDist = hexDistance(squad.pos, goal)
    const best = neighbors(squad.pos)
      .filter(nb => {
        const k = hexKey(nb)
        const c = state.cells[k]
        return c && c.passable && !blocked.has(k)
      })
      .sort((a, b) => hexDistance(a, goal) - hexDistance(b, goal))
      .find(nb => hexDistance(nb, goal) < currentDist)
    if (best) { squad.pos = best; moved = true }
  }

  // Charge trait：移動後設定首擊旗標
  if (moved) {
    for (const shield of squad.shieldLayers) {
      if (!shield.isDead && shield.traits.includes('Charge')) {
        shield.chargeReady = true
      }
    }
  }
}

// ─── 佔領 tick ───────────────────────────────────────────────────────────────

function tickCapture(squad: SquadInstance, state: GameState): void {
  const capDef = getCaptainDef(squad.captainDefId)
  const cellKey = hexKey(squad.pos)
  const cell = state.cells[cellKey]
  if (!cell) return

  // ── 區域佔領（前哨站等多格區域）──────────────────────────────────────
  if (cell.zoneId) {
    const zone = state.zones[cell.zoneId]
    if (!zone || zone.team === squad.team) return

    // 佔領打斷：敵方小隊在同一 zone 內 → 凍結進度
    const contested = Object.values(state.squads).some(other =>
      other.team !== squad.team &&
      isSquadAlive(other) &&
      zone.cells.some(zc => zc.q === other.pos.q && zc.r === other.pos.r)
    )
    if (contested) return

    zone.captureHp = Math.max(0, zone.captureHp - capDef.stats.captureRate)
    if (zone.captureHp === 0) {
      zone.team = squad.team
      zone.captureHp = zone.maxCaptureHp
      state.log.push(`🏴 ${capDef.name} 佔領 ${zone.zoneId}`)
      state.resources.mana += 10
      state.resources.experience += 5
      // barracks 佔領：玩家獲得 wave spawner
      if (zone.nodeType === 'barracks' && squad.team === 'player' && state.playerWaveRotation.length > 0) {
        const spawnCell = zone.cells[0]
        state.waveSpawners.push({
          spawnerId:     `player_barracks_${zone.zoneId}`,
          team:          'player',
          spawnPos:      spawnCell,
          route:         squad.aiConfig.route,
          rotation:      state.playerWaveRotation,
          rotationIndex: 0,
          intervalTicks: 350,
          nextSpawnTick: state.tick + 350,
          maxActiveWaves: 2,
        })
        state.log.push(`🏗️ 兵營啟動，開始派遣波次小隊`)
      }
    }
    return
  }

  // ── 單格建築佔領（城門等可佔建築）──────────────────────────────────
  // 主堡（playerBase / enemyBase）不走佔領邏輯，改由 stepGame HP 損耗決定勝敗
  if (!cell.building) return
  const b = cell.building
  if (b.nodeType === 'playerBase' || b.nodeType === 'enemyBase') return
  if (b.team === squad.team) return

  // 佔領打斷：敵方小隊站在同格 → 凍結進度
  const buildingContested = Object.values(state.squads).some(other =>
    other.team !== squad.team &&
    isSquadAlive(other) &&
    other.pos.q === squad.pos.q && other.pos.r === squad.pos.r
  )
  if (buildingContested) return

  b.captureHp = Math.max(0, b.captureHp - capDef.stats.captureRate)
  if (b.captureHp === 0) {
    b.team = squad.team
    b.captureHp = b.maxCaptureHp
    state.log.push(`🏴 ${capDef.name} 佔領 ${b.buildingId}`)
    state.resources.mana += 10
    state.resources.experience += 5
  }
}

// ─── SP 技能觸發 ─────────────────────────────────────────────────────────────

function applyShieldOrCaptainDmg(
  target: SquadInstance, dmg: number, events: BattleEvent[]
): void {
  const alive = target.shieldLayers.filter(s => !s.isDead)
  if (alive.length > 0) {
    alive[0].hp = Math.max(0, alive[0].hp - dmg)
    if (alive[0].hp === 0) alive[0].isDead = true
  } else {
    target.hp = Math.max(0, target.hp - dmg)
    if (target.hp === 0)
      events.push({ type: 'death', targetId: target.squadId, pos: { ...target.pos } })
  }
  events.push({ type: 'damage', targetId: target.squadId, pos: { ...target.pos }, amount: dmg })
}

function triggerSPSkill(
  squad: SquadInstance,
  state: GameState,
  inRange: SquadInstance[],
  events: BattleEvent[]
): void {
  const capDef = getCaptainDef(squad.captainDefId)
  squad.sp = 0
  events.push({ type: 'sp_skill', squadId: squad.squadId, skillName: capDef.spSkillName, pos: { ...squad.pos } })
  state.log.push(`✨ ${capDef.name}【${capDef.spSkillName}】`)

  switch (capDef.spSkillId) {

    // ── 戰吼衝鋒（步兵）：下一擊 ×1.6 + 目標 ATB 清零 ─────────────────────
    case 'charge_roar':
      squad.spBuffActive = true
      squad.spBuffType = 'charge_roar'
      squad.spBuffTicksRemaining = 0  // 不計時，由 tickATB 在出手時清除
      break

    // ── 鐵甲壁壘（重甲）：60 tick 防禦 ×2、移速歸零 ────────────────────────
    case 'iron_wall':
      squad.spBuffActive = true
      squad.spBuffType = 'iron_wall'
      squad.spBuffTicksRemaining = 60
      break

    // ── 鐵騎踐踏（騎兵）：對警戒範圍所有敵方 ATK×0.8 + ATB 清零 ──────────
    case 'trample': {
      const enemies = getEnemiesInAlert(squad, state.squads)
      const dmg = Math.max(1, Math.floor(capDef.stats.atk * 0.8))
      for (const e of enemies) {
        applyShieldOrCaptainDmg(e, dmg, events)
        e.atb = 0
      }
      break
    }

    // ── 箭雨（弓手）：對主目標周圍 1 格所有敵方 ATK×1.5 ───────────────────
    case 'arrow_rain': {
      const targets = sortByPriority(squad, inRange)
      if (targets.length === 0) break
      const primary = targets[0]
      const dmg = Math.max(1, Math.floor(capDef.stats.atk * 1.5))
      for (const e of Object.values(state.squads)) {
        if (e.team === squad.team || !isSquadAlive(e)) continue
        if (hexDistance(e.pos, primary.pos) > 1) continue
        applyShieldOrCaptainDmg(e, dmg, events)
      }
      break
    }

    // ── 破城突擊（攻城）：推進最近未佔領區域/主堡 captureHp 20% ────────────
    case 'breach': {
      // 找最近未佔領的 zone
      let bestZone: ZoneState | null = null
      let bestZoneDist = Infinity
      for (const zone of Object.values(state.zones)) {
        if (zone.team === squad.team) continue
        for (const zPos of zone.cells) {
          const d = hexDistance(squad.pos, zPos)
          if (d < bestZoneDist) { bestZoneDist = d; bestZone = zone }
        }
      }
      // 找最近敵方主堡格
      const targetNodeType = squad.team === 'player' ? 'enemyBase' : 'playerBase'
      let bestBaseCell: MapCell | null = null
      let bestBaseDist = Infinity
      for (const cell of Object.values(state.cells)) {
        if (!cell.building || cell.building.nodeType !== targetNodeType) continue
        const d = hexDistance(squad.pos, cell.pos)
        if (d < bestBaseDist) { bestBaseDist = d; bestBaseCell = cell }
      }
      // 優先推進較近的目標
      if (bestZone !== null && bestZoneDist <= bestBaseDist) {
        const push = bestZone.maxCaptureHp * 0.2
        bestZone.captureHp = Math.max(0, bestZone.captureHp - push)
        if (bestZone.captureHp === 0) {
          bestZone.team = squad.team
          bestZone.captureHp = bestZone.maxCaptureHp
          state.log.push(`🏴 破城突擊佔領 ${bestZone.zoneId}`)
        }
      } else if (bestBaseCell?.building) {
        const push = bestBaseCell.building.maxCaptureHp * 0.2
        bestBaseCell.building.captureHp = Math.max(0, bestBaseCell.building.captureHp - push)
        if (bestBaseCell.building.captureHp === 0) {
          bestBaseCell.building.team = squad.team
          bestBaseCell.building.captureHp = bestBaseCell.building.maxCaptureHp
          state.log.push(`🏴 破城突擊佔領主堡`)
        }
      }
      break
    }
  }
}

// ─── ATB + 攻擊 tick ──────────────────────────────────────────────────────────

function tickATB(
  squad: SquadInstance,
  state: GameState,
  inRange: SquadInstance[],
  events: BattleEvent[]
): void {
  const capDef    = getCaptainDef(squad.captainDefId)
  const rangeBonus = terrainRangeBonus(squad, state)

  // 隊長 ATB（隊長無 Trait）
  squad.atb = Math.min(ATB_MAX, squad.atb + capDef.stats.atbSpeed * 2)
  if (squad.atb >= ATB_MAX && inRange.length > 0) {
    squad.atb = 0
    const target = sortByPriority(squad, inRange)[0]
    if (hexDistance(squad.pos, target.pos) <= capDef.stats.range + rangeBonus) {
      // charge_roar：消費 buff，本次攻擊 ×1.6 + 清目標 ATB
      let capAtkMult = 1.0
      if (squad.spBuffActive && squad.spBuffType === 'charge_roar') {
        capAtkMult = 1.6
        target.atb = 0
        squad.spBuffActive = false
        squad.spBuffType = null
      }
      events.push({ type: 'attack', fromPos: { ...squad.pos }, toPos: { ...target.pos }, fxType: toFXType(capDef.type) })
      applyDamage(squad, true, capDef.type, Math.floor(capDef.stats.atk * capAtkMult), target, state.log, events, state)
      squad.sp = Math.min(100, squad.sp + capDef.stats.spGainPerHit)
      // SP 技能觸發（auto 模式，且目前沒有持續型 buff 佔用）
      if (squad.sp >= 100 && squad.aiConfig.spMode !== 'manual' && !squad.spBuffActive) {
        triggerSPSkill(squad, state, inRange, events)
      }
    }
  }

  // 從者 ATB（各自獨立出手，帶 Trait 效果）
  for (const shield of squad.shieldLayers) {
    if (shield.isDead) continue
    const fDef = getFollowerDef(shield.followerDefId)
    shield.atb = Math.min(ATB_MAX, shield.atb + fDef.stats.atbSpeed * 2)
    if (shield.atb >= ATB_MAX && inRange.length > 0) {
      shield.atb = 0
      const target = sortByPriority(squad, inRange)[0]
      if (hexDistance(squad.pos, target.pos) <= fDef.stats.range + rangeBonus) {
        // Charge：移動後首擊 +50% 傷害，清除目標 ATB
        let atkMult = 1.0
        if (shield.traits.includes('Charge') && shield.chargeReady) {
          atkMult = 1.5
          shield.chargeReady = false
          target.atb = 0
        }
        events.push({ type: 'attack', fromPos: { ...squad.pos }, toPos: { ...target.pos }, fxType: toFXType(fDef.type) })
        applyDamage(squad, false, fDef.type, Math.floor(fDef.stats.atk * atkMult), target, state.log, events, state, shield.traits)
      }
    }
  }
}

// ─── 從者帶 tick ─────────────────────────────────────────────────────────────

function makeBeltCard(tick: number, defId: string) {
  return {
    instanceId:    `fc_${tick}_${Math.random().toString(36).slice(2, 6)}`,
    followerDefId: defId,
  }
}

function tickFollowerBelt(state: GameState): void {
  const belt = state.followerBelt
  if (belt.hand.length >= belt.maxHand) return   // 手牌滿，帶停

  belt.cooldownTicks = Math.max(0, belt.cooldownTicks - 1)
  if (belt.cooldownTicks === 0) {
    // 從預覽佇列取第一張推入手牌
    const next = belt.upcoming.shift()
    if (next) {
      belt.hand.push(next)
    } else {
      // 佇列空（初始邊緣情況）直接隨機
      const defId = belt.pool[Math.floor(Math.random() * belt.pool.length)]
      belt.hand.push(makeBeltCard(state.tick, defId))
    }
    // 補充佇列到 upcomingSize
    while (belt.upcoming.length < belt.upcomingSize) {
      const defId = belt.pool[Math.floor(Math.random() * belt.pool.length)]
      belt.upcoming.push(makeBeltCard(state.tick, defId))
    }
    belt.cooldownTicks = belt.intervalTicks
  }
}

// ─── Trait 帶 tick ────────────────────────────────────────────────────────────

function makeTraitCard(tick: number, traitId: TraitType): TraitCard {
  return { instanceId: `tc_${tick}_${Math.random().toString(36).slice(2, 6)}`, traitId }
}

function tickTraitBelt(state: GameState): void {
  const belt = state.traitBelt
  if (belt.hand.length >= belt.maxHand) return   // 手牌滿，帶停

  belt.cooldownTicks = Math.max(0, belt.cooldownTicks - 1)
  if (belt.cooldownTicks === 0) {
    const next = belt.upcoming.shift()
    if (next) {
      belt.hand.push(next)
    } else {
      const traitId = belt.pool[Math.floor(Math.random() * belt.pool.length)]
      belt.hand.push(makeTraitCard(state.tick, traitId))
    }
    while (belt.upcoming.length < belt.upcomingSize) {
      const traitId = belt.pool[Math.floor(Math.random() * belt.pool.length)]
      belt.upcoming.push(makeTraitCard(state.tick, traitId))
    }
    belt.cooldownTicks = belt.intervalTicks
  }
}

// ─── 靈力自然產出 ────────────────────────────────────────────────────────────

function tickResources(state: GameState): void {
  // 主堡基礎產出
  state.resources.mana += 0.5

  // 佔領節點加成（從 zones 讀取，一個區域只算一次）
  for (const zone of Object.values(state.zones)) {
    if (zone.team !== 'player') continue
    switch (zone.nodeType) {
      case 'outpost':    state.resources.mana += 0.3; break
      case 'barracks':   state.resources.mana += 0.2; break
      case 'highGround': state.resources.mana += 0.1; break
    }
  }
}

// ─── 波次小隊建構 ────────────────────────────────────────────────────────────

function buildWaveSquad(spawner: WaveSpawner, tick: number, idx: number): SquadInstance {
  const followerIds = spawner.rotation[spawner.rotationIndex % spawner.rotation.length]
  spawner.rotationIndex++

  const capDef = basicCaptainDefs.find(c => c.id === 'captain_basic_infantry')
    ?? basicCaptainDefs[0]
  // 若全是弓兵，改用弓兵 basic captain（射程正確）
  const isRanged = followerIds.every(id => id === 'follower_ranged')
  const actualCapDef = isRanged
    ? (basicCaptainDefs.find(c => c.id === 'captain_basic_ranged') ?? capDef)
    : capDef

  const shields: ShieldLayer[] = followerIds.map((defId, i) => {
    const fDef = getFollowerDef(defId)
    return {
      instanceId:    `ws_${spawner.spawnerId}_${tick}_${i}`,
      followerDefId: defId,
      hp:            fDef.shieldHp,
      maxHp:         fDef.shieldHp,
      atb:           0,
      isDead:        false,
      statusEffects: [],
      traits:        [],
      chargeReady:   false,
    }
  })

  const squadId = `wave_${spawner.spawnerId}_${tick}_${idx}`
  return {
    squadId,
    team:            spawner.team,
    captainCardId:   '',
    captainDefId:    actualCapDef.id,
    waveSpawnerId:   spawner.spawnerId,
    hp:              actualCapDef.stats.hp,
    maxHp:           actualCapDef.stats.hp,
    atb:             0,
    sp:              0,
    statusEffects:   [],
    spBuffActive:    false,
    spBuffType:      null,
    spBuffTicksRemaining: 0,
    shieldLayers:    shields,
    maxShieldSlots:  actualCapDef.baseFollowerSlots,
    unlockedNodes:   [],
    passiveUnlocked: false,
    pos:             { ...spawner.spawnPos },
    spawnPos:        { ...spawner.spawnPos },
    state:           'idle',
    aiConfig: {
      behavior:       'aggressive',
      targetPriority: 'nearest',
      spMode:         'manual',
      route:          spawner.route,
      alertRange:     2,
    },
    reviveAtTick:  null,
    deployAtTick:  null,
  }
}

// ─── 波次刷兵 tick ───────────────────────────────────────────────────────────

function tickWaveSpawners(state: GameState): void {
  for (const spawner of state.waveSpawners) {
    if (state.tick < spawner.nextSpawnTick) continue

    // 計算此刷兵器的存活 wave 數
    const active = Object.values(state.squads).filter(
      s => s.waveSpawnerId === spawner.spawnerId && isSquadAlive(s)
    ).length
    if (active >= spawner.maxActiveWaves) continue

    const squad = buildWaveSquad(spawner, state.tick, Object.keys(state.squads).length)
    state.squads[squad.squadId] = squad
    state.events.push({ type: 'spawn', squadId: squad.squadId, pos: { ...spawner.spawnPos } })
    state.log.push(`🌊 ${spawner.spawnerId} 派出波次小隊`)
    spawner.nextSpawnTick = state.tick + spawner.intervalTicks
  }
}

// ─── 主 tick 步進 ────────────────────────────────────────────────────────────

export function stepGame(state: GameState): GameState {
  if (state.phase !== 'running') return state

  const next = JSON.parse(JSON.stringify(state)) as GameState
  next.tick++
  next.events = []

  // 0. 資源自然產出 + 運輸帶 + 波次刷兵
  tickResources(next)
  tickFollowerBelt(next)
  tickTraitBelt(next)
  tickWaveSpawners(next)

  // 1. 復活檢查
  for (const squad of Object.values(next.squads)) {
    if (squad.state === 'retreating' && squad.reviveAtTick !== null && next.tick >= squad.reviveAtTick) {
      const capDef = getCaptainDef(squad.captainDefId)
      squad.hp = capDef.stats.hp
      squad.atb = 0
      squad.sp = 0
      squad.shieldLayers = []
      squad.pos = { ...squad.spawnPos }
      squad.state = 'idle'
      squad.reviveAtTick = null
      next.events.push({ type: 'revive', squadId: squad.squadId, pos: { ...squad.spawnPos } })
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

  // 3b. SP Buff 持續時間倒數（iron_wall 等時限型；charge_roar 由 tickATB 清除）
  for (const squad of Object.values(next.squads)) {
    if (!squad.spBuffActive || squad.spBuffType === 'charge_roar') continue
    if (squad.spBuffTicksRemaining > 0) {
      squad.spBuffTicksRemaining--
      if (squad.spBuffTicksRemaining === 0) {
        squad.spBuffActive = false
        squad.spBuffType = null
      }
    }
  }

  // 4. 隊長陣亡：basic tier → 直接刪除；elite/hero → 撤退 + 玩家復活
  const toDelete: string[] = []
  for (const [squadId, squad] of Object.entries(next.squads)) {
    if (squad.hp <= 0 && squad.state !== 'retreating') {
      const capDef = getCaptainDef(squad.captainDefId)
      if (capDef.tier === 'basic') {
        // wave 小隊永久消失
        toDelete.push(squadId)
        next.log.push(`💀 ${capDef.name} 覆滅`)
      } else {
        // elite/hero：撤退
        squad.state = 'retreating'
        if (squad.team === 'player') {
          squad.reviveAtTick = next.tick + capDef.stats.reviveDelay
          next.log.push(`💀 ${capDef.name} 敗退，${capDef.stats.reviveDelay} tick 後復活`)
        } else {
          next.log.push(`💀 ${capDef.name} 敗退`)
        }
      }
    }
  }
  for (const id of toDelete) delete next.squads[id]

  // 5. 主堡 HP 損耗（敵方小隊踏上主堡格時逐步削減）
  // 11 個主堡 cell 共用同一個 HP 池（playerBaseHp / enemyBaseHp）
  // 每支進駐小隊每 tick 造成 2.0 點損耗
  for (const squad of Object.values(next.squads)) {
    if (!isSquadAlive(squad)) continue
    const cell = next.cells[hexKey(squad.pos)]
    if (!cell?.building) continue
    if (squad.team === 'enemy' && cell.building.nodeType === 'playerBase') {
      next.playerBaseHp = Math.max(0, next.playerBaseHp - 2.0)
    } else if (squad.team === 'player' && cell.building.nodeType === 'enemyBase') {
      next.enemyBaseHp = Math.max(0, next.enemyBaseHp - 2.0)
    }
  }

  // 6. 勝敗判斷（主堡共用 HP 歸零 > 計時器佔點數）
  if (next.enemyBaseHp <= 0) {
    next.phase = 'player_won'
    next.log.push('🏆 敵方主堡崩潰！玩家勝利')
  } else if (next.playerBaseHp <= 0) {
    next.phase = 'enemy_won'
    next.log.push('💀 主堡崩潰！敵方勝利')
  } else if (next.tick >= next.maxTicks) {
    // 時間到：比較佔領區域數量
    const playerZones = Object.values(next.zones).filter(z => z.team === 'player').length
    const enemyZones  = Object.values(next.zones).filter(z => z.team === 'enemy').length
    next.log.push(`⏱ 時間到！玩家 ${playerZones} 佔點 vs 敵方 ${enemyZones} 佔點`)
    if (playerZones > enemyZones) {
      next.phase = 'player_won'
      next.log.push('🏆 玩家以佔點優勢獲勝！')
    } else if (enemyZones > playerZones) {
      next.phase = 'enemy_won'
      next.log.push('💀 敵方以佔點優勢獲勝！')
    } else {
      // 佔點平手：比較主堡剩餘 HP
      next.phase = next.playerBaseHp >= next.enemyBaseHp ? 'player_won' : 'enemy_won'
      next.log.push(next.phase === 'player_won'
        ? '🏆 主堡血量優勢：玩家勝！' : '💀 主堡血量劣勢：敵方勝！')
    }
  }

  return next
}
