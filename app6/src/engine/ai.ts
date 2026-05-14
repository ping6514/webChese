import { legalActions } from './gameEngine'
import type { GameState, Action, FaceSet, FaceKey } from './types'

function randomFaces(): FaceSet {
  const keys: FaceKey[] = ['up','down','left','right']
  const faces: FaceSet = {}
  for (const k of keys) {
    const v = Math.random() < 0.5 ? (Math.random() < 0.5 ? 'slash' : 'backslash') : undefined
    if (v !== undefined) faces[k] = v
  }
  return faces
}

/** 隨機選一個冰塊動作（放置/回收）*/
export function randomIceAction(state: GameState): Action | null {
  const actions = legalActions(state)
    .filter(a => a.kind === 'placeMountain' || a.kind === 'collect')
  if (actions.length === 0) return null
  const chosen = actions[Math.floor(Math.random() * actions.length)]
  if (chosen.kind === 'placeMountain') return { ...chosen, faces: randomFaces() }
  return chosen
}

/** 隨機選一個移動動作（滑動/推冰/旋轉）*/
export function randomMoveAction(state: GameState): Action | null {
  const actions = legalActions(state)
    .filter(a => a.kind === 'move' || a.kind === 'push' || a.kind === 'rotate')
  if (actions.length === 0) return null
  return actions[Math.floor(Math.random() * actions.length)]
}

/** 相容舊介面：隨機選任意合法動作（含放置時隨機面） */
export function randomAction(state: GameState): Action | null {
  const actions = legalActions(state)
  if (actions.length === 0) return null
  const chosen = actions[Math.floor(Math.random() * actions.length)]
  if (chosen.kind === 'placeMountain') return { ...chosen, faces: randomFaces() }
  return chosen
}
