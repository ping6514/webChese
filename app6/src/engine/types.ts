export type IceOrientation = 'slash' | 'backslash'   // '╱' or '╲'
export type Direction = 'up' | 'down' | 'left' | 'right'
export type Player = 'A' | 'B'
export type FaceKey = 'up' | 'down' | 'left' | 'right'

export type Phase =
  | 'setup_crown'   // 玩家A在中央放王冠
  | 'setup_float'   // 玩家A放最多2個漂浮冰塊
  | 'setup_chars'   // 玩家B選角落放角色
  | 'playing'
  | 'ended'

export type GameMode = 'hvh' | 'hvc' | 'cvh' | 'cvc'

export interface Pos {
  x: number  // 欄 0–6（左→右）
  y: number  // 列 0–6（上→下）
}

/** 漂浮冰塊的四個面可各自裝上反射冰（最多形成十字） */
export type FaceSet = Partial<Record<FaceKey, IceOrientation>>

export interface FloatIce {
  faces: FaceSet
}

export interface Cell {
  floatIce: FloatIce | null  // null = 空格
}

/** 計算 FaceSet 中已裝上的反射面數量 */
export function faceCount(faces: FaceSet): number {
  return (Object.keys(faces) as FaceKey[]).filter(k => faces[k] !== undefined).length
}

export type Action =
  | { kind: 'placeMountain'; pos: Pos; faces: FaceSet }  // 放置冰塊（可帶0-4面反射冰）
  | { kind: 'collect';       pos: Pos }                   // 回收最遠漂浮冰塊
  | { kind: 'move';          dir: Direction }             // 角色滑動
  | { kind: 'push';          dir: Direction }             // 推動鄰近漂浮冰塊
  | { kind: 'rotate';        pos: Pos; cw: boolean }      // 旋轉冰塊（需緊鄰）

export interface GameState {
  grid: Cell[][]          // grid[y][x]
  posA: Pos | null        // 企鵝（玩家A）
  posB: Pos | null        // 北極熊（玩家B）
  crown: Pos | null
  turn: Player
  availFloat: number      // 剩餘漂浮冰塊
  availReflect: number    // 剩餘反射冰片
  phase: Phase
  setupFloatCount: number
  winner: Player | 'draw' | null
  turnCount: number
  stateHistory: string[]
  consecutiveNoMove: number
  iceActionUsed: boolean  // 本回合是否已用過冰塊動作（放置/回收）
  moveActionUsed: boolean // 本回合是否已用過移動動作（移動/推/轉）
  log: string[]
}

export const GRID_SIZE = 7
export const MAX_TURNS = 200
export const REPEAT_DRAW_COUNT = 3
export const MAX_CONSECUTIVE_NO_MOVE = 10
export const INIT_AVAIL_FLOAT = 6
export const INIT_AVAIL_REFLECT = 12
export const CROWN_CENTER = { minX: 2, maxX: 4, minY: 2, maxY: 4 }
export const CORNERS: Pos[] = [
  { x: 0, y: 0 }, { x: 6, y: 0 },
  { x: 0, y: 6 }, { x: 6, y: 6 },
]
