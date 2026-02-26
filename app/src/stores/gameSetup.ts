import { defineStore } from 'pinia'
import type { Side } from '../engine'

export type GameMode = 'pvp' | 'pve'
export type SideOrRandom = Side | 'random'
export type Difficulty = 'easy' | 'hard'

export const useGameSetup = defineStore('gameSetup', {
  state: () => ({
    mode: 'pvp' as GameMode,
    playerSide: 'random' as SideOrRandom,  // PVE：玩家選哪方
    firstPlayer: 'random' as SideOrRandom,  // 先攻方
    difficulty: 'hard' as Difficulty,
    // 隨機解析後的最終值（開局時 resolve() 後設定）
    resolvedPlayerSide: 'red' as Side,
    resolvedFirstPlayer: 'red' as Side,
  }),

  actions: {
    resolve() {
      this.resolvedPlayerSide =
        this.playerSide === 'random'
          ? (Math.random() < 0.5 ? 'red' : 'black')
          : this.playerSide

      this.resolvedFirstPlayer =
        this.firstPlayer === 'random'
          ? (Math.random() < 0.5 ? 'red' : 'black')
          : this.firstPlayer
    },
  },
})
