export type Side = 'red' | 'black'

export type Phase = 'turnStart' | 'buy' | 'necro' | 'combat' | 'turnEnd'

export type PieceBase =
  | 'king'
  | 'advisor'
  | 'elephant'
  | 'rook'
  | 'knight'
  | 'cannon'
  | 'soldier'

export type Pos = {
  x: number
  y: number
}

export const BOARD_WIDTH = 9
export const BOARD_HEIGHT = 10

export function posKey(pos: Pos): string {
  return `${pos.x},${pos.y}`
}

export function isOnBoard(pos: Pos): boolean {
  return (
    Number.isInteger(pos.x) &&
    Number.isInteger(pos.y) &&
    pos.x >= 0 &&
    pos.x < BOARD_WIDTH &&
    pos.y >= 0 &&
    pos.y < BOARD_HEIGHT
  )
}
