import { defineStore } from 'pinia'
import type { Side } from '../engine'

export type GameMode = 'pvp' | 'pve' | 'online'
export type SideOrRandom = Side | 'random'
export type Difficulty = 'easy' | 'hard'

const SESSION_KEY = 'gameSetup_v1'

function loadSession(): { enabledClans?: string[]; resolvedPlayerSide?: Side; resolvedFirstPlayer?: Side } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const useGameSetup = defineStore('gameSetup', {
  state: () => {
    const saved = loadSession()
    return {
      mode: 'pvp' as GameMode,
      playerSide: 'random' as SideOrRandom,
      firstPlayer: 'random' as SideOrRandom,
      difficulty: 'hard' as Difficulty,
      enabledClans: (saved.enabledClans ?? ['dark_moon', 'styx', 'eternal_night', 'iron_guard']) as string[],
      resolvedPlayerSide: (saved.resolvedPlayerSide ?? 'red') as Side,
      resolvedFirstPlayer: (saved.resolvedFirstPlayer ?? 'red') as Side,
    }
  },

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

      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          enabledClans: this.enabledClans,
          resolvedPlayerSide: this.resolvedPlayerSide,
          resolvedFirstPlayer: this.resolvedFirstPlayer,
        }))
      } catch { /* ignore */ }
    },
  },
})
