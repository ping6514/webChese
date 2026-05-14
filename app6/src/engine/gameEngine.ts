import type {
  Pos, Cell, Direction, IceOrientation, Player, Action, GameState, FaceSet, FaceKey
} from './types'
import {
  GRID_SIZE, MAX_TURNS, REPEAT_DRAW_COUNT, MAX_CONSECUTIVE_NO_MOVE,
  INIT_AVAIL_FLOAT, INIT_AVAIL_REFLECT, CROWN_CENTER, CORNERS, faceCount
} from './types'

// ─── Utils ────────────────────────────────────────────────────────────────────

export function posEq(a: Pos, b: Pos): boolean { return a.x === b.x && a.y === b.y }
export function inBounds(x: number, y: number): boolean { return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE }
export function emptyCell(): Cell { return { floatIce: null } }

function nb4(x: number, y: number): Pos[] {
  return ([[x,y-1],[x,y+1],[x-1,y],[x+1,y]] as [number,number][])
    .filter(([nx,ny]) => inBounds(nx,ny))
    .map(([nx,ny]) => ({ x:nx, y:ny }))
}

// ─── Reflection tables ────────────────────────────────────────────────────────

const DIR_DELTA: Record<Direction, [number, number]> = {
  up:[0,-1], down:[0,1], left:[-1,0], right:[1,0]
}

// 角色從方向 d 滑向某格，撞到的是那格的哪個「面」
const APPROACH_FACE: Record<Direction, FaceKey> = {
  right: 'left', left: 'right', up: 'down', down: 'up',
}

const REFLECT_TABLE: Record<IceOrientation, Record<Direction, Direction>> = {
  slash:     { right:'up',   left:'down',  up:'right',  down:'left'  },
  backslash: { right:'down', left:'up',    up:'left',   down:'right' },
}

const DIR_CN: Record<Direction, string> = { up:'↑', down:'↓', left:'←', right:'→' }

// ─── 滑行模擬 ─────────────────────────────────────────────────────────────────

export function simulateSlide(state: GameState, player: Player, dir: Direction): Pos {
  if (!state.posA || !state.posB) return { x:0, y:0 }
  const start  = player === 'A' ? state.posA : state.posB
  const other  = player === 'A' ? state.posB : state.posA
  let pos: Pos = { ...start }
  let curDir   = dir
  let safety   = 100

  while (safety-- > 0) {
    const [dx,dy] = DIR_DELTA[curDir]
    const nx = pos.x + dx, ny = pos.y + dy
    if (!inBounds(nx,ny)) break
    if (other && posEq({x:nx,y:ny}, other)) break

    const fi = state.grid[ny][nx].floatIce
    if (fi !== null) {
      // 有反射面則反射，否則阻擋
      const faceOri = fi.faces[APPROACH_FACE[curDir]]
      if (faceOri !== undefined) { curDir = REFLECT_TABLE[faceOri][curDir]; continue }
      break
    }

    pos = { x:nx, y:ny }
    if (state.crown && posEq(pos, state.crown)) break  // 到達王冠停下（勝利）
  }
  return pos
}

// ─── 推冰模擬（回傳冰塊的最終位置，null = 無法推） ───────────────────────────

export function simulatePushDest(state: GameState, playerPos: Pos, dir: Direction): Pos | null {
  const [dx, dy] = DIR_DELTA[dir]
  const icePos: Pos = { x: playerPos.x + dx, y: playerPos.y + dy }
  if (!inBounds(icePos.x, icePos.y)) return null
  const fi = state.grid[icePos.y][icePos.x].floatIce
  // 只能推「純漂浮冰塊」（無反射面）；冰山不可推
  if (!fi || faceCount(fi.faces) > 0) return null

  let pos = icePos
  while (true) {
    const nx = pos.x + dx, ny = pos.y + dy
    if (!inBounds(nx, ny)) break
    if ((state.posA && posEq({x:nx,y:ny}, state.posA)) ||
        (state.posB && posEq({x:nx,y:ny}, state.posB)) ||
        (state.crown && posEq({x:nx,y:ny}, state.crown))) break
    if (state.grid[ny][nx].floatIce !== null) break
    pos = { x: nx, y: ny }
  }
  return posEq(pos, icePos) ? null : pos  // 無法移動則 null
}

// ─── 回收判定 ─────────────────────────────────────────────────────────────────

export function collectableCells(state: GameState): Pos[] {
  if (!state.crown) return []
  let maxDist = -1
  const result: Pos[] = []
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (state.grid[y][x].floatIce === null) continue
      const dist = Math.abs(x - state.crown.x) + Math.abs(y - state.crown.y)
      if (dist > maxDist)        { maxDist = dist; result.length = 0; result.push({x,y}) }
      else if (dist === maxDist) { result.push({x,y}) }
    }
  }
  return result
}

// ─── 狀態 Hash（用於重複局面偵測）────────────────────────────────────────────

export function hashState(state: GameState): string {
  if (!state.posA || !state.posB || !state.crown) return ''
  let h = `${state.posA.x},${state.posA.y}|${state.posB.x},${state.posB.y}|${state.crown.x},${state.crown.y}|${state.turn}|`
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const fi = state.grid[y][x].floatIce
      if (fi === null) { h += '....'; continue }
      const f = (k: FaceKey) => fi.faces[k] === 'slash' ? '/' : fi.faces[k] === 'backslash' ? '\\' : '.'
      h += f('up') + f('down') + f('left') + f('right')
    }
  }
  return h
}

// ─── 冰山旋轉（順/逆時針，方向及面取向都改變）────────────────────────────────

export function rotateFaces(faces: FaceSet, cw: boolean): FaceSet {
  const flip = (o: IceOrientation): IceOrientation => o === 'slash' ? 'backslash' : 'slash'
  const res: FaceSet = {}
  if (cw) {
    if (faces.up    !== undefined) res.right = flip(faces.up)
    if (faces.right !== undefined) res.down  = flip(faces.right)
    if (faces.down  !== undefined) res.left  = flip(faces.down)
    if (faces.left  !== undefined) res.up    = flip(faces.left)
  } else {
    if (faces.up    !== undefined) res.left  = flip(faces.up)
    if (faces.left  !== undefined) res.down  = flip(faces.left)
    if (faces.down  !== undefined) res.right = flip(faces.down)
    if (faces.right !== undefined) res.up    = flip(faces.right)
  }
  return res
}

// ─── 結束回合（hash + 平局 + 換手） ──────────────────────────────────────────

export function endTurn(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state))

  if (!next.moveActionUsed) next.consecutiveNoMove++
  else                      next.consecutiveNoMove = 0

  next.turnCount++
  next.iceActionUsed  = false
  next.moveActionUsed = false
  next.turn = state.turn === 'A' ? 'B' : 'A'

  const hash = hashState(next)
  next.stateHistory.push(hash)
  const repeats = next.stateHistory.filter(h => h === hash).length
  if (repeats >= REPEAT_DRAW_COUNT ||
      next.consecutiveNoMove >= MAX_CONSECUTIVE_NO_MOVE ||
      next.turnCount >= MAX_TURNS) {
    next.phase  = 'ended'
    next.winner = 'draw'
    next.log.push('🤝 平局')
  }
  trimLog(next)
  return next
}

// ─── 合法動作（依已用子動作過濾） ────────────────────────────────────────────

function isOccupied(state: GameState, x: number, y: number): boolean {
  const p = {x,y}
  return (!!state.posA && posEq(p, state.posA)) ||
         (!!state.posB && posEq(p, state.posB)) ||
         (!!state.crown && posEq(p, state.crown))
}

export function legalActions(state: GameState): Action[] {
  if (state.phase !== 'playing') return []
  const actions: Action[] = []
  const player    = state.turn
  const playerPos = player === 'A' ? state.posA : state.posB

  // ── 冰塊動作（本回合尚未用過） ──────────────────────────────────────────────
  if (!state.iceActionUsed) {
    if (state.availFloat > 0) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          if (!isOccupied(state,x,y) && state.grid[y][x].floatIce === null)
            actions.push({ kind:'placeMountain', pos:{x,y}, faces:{} })
        }
      }
    }
    for (const pos of collectableCells(state))
      actions.push({ kind:'collect', pos })
  }

  // ── 移動動作（本回合尚未用過） ──────────────────────────────────────────────
  if (!state.moveActionUsed && playerPos) {
    for (const dir of ['up','down','left','right'] as Direction[]) {
      // 滑動
      const dest = simulateSlide(state, player, dir)
      if (!posEq(dest, playerPos)) actions.push({ kind:'move', dir })
      // 推冰
      const pushDest = simulatePushDest(state, playerPos, dir)
      if (pushDest) actions.push({ kind:'push', dir })
    }
    // 旋轉（緊鄰且有至少一面反射冰）
    for (const p of nb4(playerPos.x, playerPos.y)) {
      const fi = state.grid[p.y][p.x].floatIce
      if (fi && faceCount(fi.faces) > 0) {
        actions.push({ kind:'rotate', pos:p, cw:true  })
        actions.push({ kind:'rotate', pos:p, cw:false })
      }
    }
  }

  return actions
}

// ─── 套用動作 ─────────────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: Action): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state))

  switch (action.kind) {
    case 'placeMountain': {
      if (next.iceActionUsed) break
      const cost = faceCount(action.faces)
      if (next.availFloat < 1 || next.availReflect < cost) break
      next.grid[action.pos.y][action.pos.x].floatIce = { faces: { ...action.faces } }
      next.availFloat--; next.availReflect -= cost
      next.iceActionUsed = true
      next.log.push(`${state.turn} 放冰 (${action.pos.x},${action.pos.y}) [${cost}面]`)
      break
    }
    case 'collect': {
      if (next.iceActionUsed) break
      const fi = next.grid[action.pos.y][action.pos.x].floatIce
      if (fi) {
        const cost = faceCount(fi.faces)
        next.grid[action.pos.y][action.pos.x].floatIce = null
        next.availFloat++; next.availReflect += cost
        next.iceActionUsed = true
        next.log.push(`${state.turn} 回收 (${action.pos.x},${action.pos.y})`)
      }
      break
    }
    case 'move': {
      if (next.moveActionUsed) break
      const dest = simulateSlide(state, state.turn, action.dir)
      if (state.turn === 'A') next.posA = dest
      else                    next.posB = dest
      next.moveActionUsed = true
      next.log.push(`${state.turn} 移動 ${DIR_CN[action.dir]}`)
      // 勝利判定
      const np = state.turn === 'A' ? next.posA : next.posB
      if (np && next.crown && posEq(np, next.crown)) {
        next.phase = 'ended'; next.winner = state.turn
        next.log.push(`🏆 ${state.turn === 'A' ? '🐧 企鵝' : '🐻 北極熊'} 獲勝！`)
        trimLog(next); return next
      }
      break
    }
    case 'push': {
      if (next.moveActionUsed) break
      const playerPos = state.turn === 'A' ? state.posA : state.posB
      if (!playerPos) break
      const [dx, dy] = DIR_DELTA[action.dir]
      const icePos: Pos = { x: playerPos.x + dx, y: playerPos.y + dy }
      const dest = simulatePushDest(state, playerPos, action.dir)
      if (!dest) break
      next.grid[dest.y][dest.x].floatIce = next.grid[icePos.y][icePos.x].floatIce
      next.grid[icePos.y][icePos.x].floatIce = null
      next.moveActionUsed = true
      next.log.push(`${state.turn} 推冰 ${DIR_CN[action.dir]}`)
      break
    }
    case 'rotate': {
      if (next.moveActionUsed) break
      const fi = next.grid[action.pos.y][action.pos.x].floatIce
      if (fi) fi.faces = rotateFaces(fi.faces, action.cw)
      next.moveActionUsed = true
      next.log.push(`${state.turn} 旋轉 (${action.pos.x},${action.pos.y}) ${action.cw?'順':'逆'}時針`)
      break
    }
  }

  trimLog(next)
  // 兩個子動作都完成 → 自動結束回合
  if (next.iceActionUsed && next.moveActionUsed) return endTurn(next)
  return next
}

function trimLog(s: GameState) {
  if (s.log.length > 30) s.log = s.log.slice(-30)
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export function applySetupClick(state: GameState, pos: Pos): GameState | null {
  const next: GameState = JSON.parse(JSON.stringify(state))

  if (state.phase === 'setup_crown') {
    const { minX, maxX, minY, maxY } = CROWN_CENTER
    if (pos.x < minX || pos.x > maxX || pos.y < minY || pos.y > maxY) return null
    next.crown = pos
    next.phase = 'setup_float'
    next.log.push(`👑 王冠放置於 (${pos.x},${pos.y})。玩家A：點空格放漂浮冰塊（最多2個），完成按「確定」。`)
    return next
  }

  if (state.phase === 'setup_float') {
    if (state.setupFloatCount >= 2) return null
    if (isOccupied(state,pos.x,pos.y) || state.grid[pos.y][pos.x].floatIce !== null) return null
    next.grid[pos.y][pos.x].floatIce = { faces: {} }
    next.availFloat--; next.setupFloatCount++
    next.log.push(`🧊 漂浮冰塊放置於 (${pos.x},${pos.y})`)
    return next
  }

  if (state.phase === 'setup_chars') {
    if (!CORNERS.some(c => posEq(c,pos))) return null
    if (next.posA && posEq(pos,next.posA)) return null
    if (next.posB && posEq(pos,next.posB)) return null
    if (!next.posA) {
      next.posA = pos
      next.log.push(`🐧 企鵝(A) → (${pos.x},${pos.y})，請放置 🐻 北極熊(B)。`)
    } else {
      next.posB = pos
      next.phase = 'playing'; next.turn = 'A'
      next.log.push(`🐻 北極熊(B) → (${pos.x},${pos.y})。遊戲開始！玩家A先手。`)
    }
    return next
  }
  return null
}

export function finishSetupFloat(state: GameState): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state))
  next.phase = 'setup_chars'; next.turn = 'B'
  next.log.push('玩家B：點角落放 🐧 企鵝(A)，再點另一角放 🐻 北極熊(B)。')
  return next
}

export function createInitialState(): GameState {
  return {
    grid: Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => emptyCell())
    ),
    posA:null, posB:null, crown:null,
    turn:'A',
    availFloat:INIT_AVAIL_FLOAT,
    availReflect:INIT_AVAIL_REFLECT,
    phase:'setup_crown',
    setupFloatCount:0,
    winner:null, turnCount:0,
    stateHistory:[], consecutiveNoMove:0,
    iceActionUsed:false, moveActionUsed:false,
    log:['遊戲設置 — 玩家A：點擊中央淺色格放置王冠 👑'],
  }
}
