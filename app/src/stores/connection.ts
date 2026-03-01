import { defineStore } from 'pinia'
import { supabase } from '../lib/supabaseClient'
import type { GameState } from '../engine'

// ─── SyncAdapter interface ─────────────────────────────────────────────────

type SyncAdapter = {
  start(onTick: () => void): void
  stop(): void
}

// Strategy 1: Realtime version ping (tiny payload, low Realtime message cost)
function makeRealtimeAdapter(roomId: string, getLocalVersion: () => number): SyncAdapter {
  let channel: ReturnType<typeof supabase.channel> | null = null
  return {
    start(onTick) {
      channel = supabase
        .channel(`room-${roomId}`)
        .on(
          'postgres_changes' as any,
          { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
          (payload: any) => {
            if ((payload.new?.version ?? 0) > getLocalVersion()) onTick()
          },
        )
        .subscribe()
    },
    stop() {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    },
  }
}

// Strategy 4: Polling fallback (no Realtime, just intervals)
function makePollingAdapter(intervalMs = 3000): SyncAdapter {
  let timer: ReturnType<typeof setInterval> | null = null
  return {
    start(onTick) {
      timer = setInterval(onTick, intervalMs)
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}

// Realtime + polling hybrid: Realtime fires instantly when available,
// polling fires every 4s as a safety net when Realtime is unreliable
function makeHybridAdapter(roomId: string, getLocalVersion: () => number): SyncAdapter {
  const rt = makeRealtimeAdapter(roomId, getLocalVersion)
  const poll = makePollingAdapter(4000)
  return {
    start(onTick) {
      rt.start(onTick)
      poll.start(onTick)
    },
    stop() {
      rt.stop()
      poll.stop()
    },
  }
}

// ─── Connection store ──────────────────────────────────────────────────────

export type SyncMode = 'realtime' | 'polling'
export type ConnStatus = 'idle' | 'connecting' | 'waiting' | 'playing' | 'error'

export const useConnection = defineStore('connection', {
  state: () => ({
    status: 'idle' as ConnStatus,
    roomId: null as string | null,
    side: null as 'red' | 'black' | null,
    secret: null as string | null,
    syncMode: 'realtime' as SyncMode,
    localVersion: -1,
    gameState: null as GameState | null,
    lastEvents: [] as unknown[],
    pollEvents: [] as unknown[],   // events from opponent (via polling)
    _suppressPollEvents: false,
    errorMsg: null as string | null,
    _adapter: null as SyncAdapter | null,
  }),

  actions: {
    // ── Create a new room ────────────────────────────────────────────────
    async createRoom(enabledClans: string[] = ['dark_moon', 'styx', 'eternal_night', 'iron_guard']) {
      this.status = 'connecting'
      this.errorMsg = null
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledClans }),
      })
      if (!res.ok) {
        this.errorMsg = 'Failed to create room'
        this.status = 'error'
        return null
      }
      const data = await res.json()
      this.roomId = data.roomId
      this.side = data.side
      this.secret = data.secret
      this._persist()
      await this._fetchState()
      this._startAdapter()
      this.status = 'waiting'
      return data.roomId as string
    },

    // ── Join an existing room (become black) ────────────────────────────
    async joinRoom(roomId: string) {
      this.status = 'connecting'
      this.errorMsg = null
      const res = await fetch(`/api/rooms/${roomId}/join`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        this.errorMsg = err.error ?? 'Failed to join room'
        this.status = 'error'
        return false
      }
      const data = await res.json()
      this.roomId = data.roomId
      this.side = data.side
      this.secret = data.secret
      this._persist()
      await this._fetchState()
      this._startAdapter()
      this.status = 'playing'
      return true
    },

    // ── Reconnect from localStorage ─────────────────────────────────────
    async reconnect() {
      const saved = localStorage.getItem('chess_connection')
      if (!saved) return false
      const { roomId, side, secret } = JSON.parse(saved) as {
        roomId: string
        side: 'red' | 'black'
        secret: string
      }
      this.roomId = roomId
      this.side = side
      this.secret = secret
      await this._fetchState()
      this._startAdapter()
      return true
    },

    // ── Send an action to the server ────────────────────────────────────
    async sendAction(action: unknown) {
      if (!this.roomId || !this.secret || !this.side) return { ok: false, error: 'Not connected' }
      const res = await fetch(`/api/rooms/${this.roomId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, secret: this.secret, side: this.side }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      // Optimistic: update local state immediately with returned events
      this.lastEvents = data.events ?? []
      this.localVersion = data.version
      // Suppress pollEvents during _fetchState so we don't re-emit our own events
      this._suppressPollEvents = true
      await this._fetchState()
      this._suppressPollEvents = false
      return { ok: true }
    },

    // ── Switch sync mode on the fly ─────────────────────────────────────
    setSyncMode(mode: SyncMode) {
      this.syncMode = mode
      if (this.roomId) {
        this._stopAdapter()
        this._startAdapter()
      }
    },

    // ── Disconnect ───────────────────────────────────────────────────────
    disconnect() {
      this._stopAdapter()
      this.status = 'idle'
      this.roomId = null
      this.side = null
      this.secret = null
      this.gameState = null
      this.localVersion = -1
      localStorage.removeItem('chess_connection')
    },

    // ── Internal ─────────────────────────────────────────────────────────
    async _fetchState() {
      if (!this.roomId) return
      const url = `/api/rooms/${this.roomId}/state?since=${this.localVersion}`
      const res = await fetch(url)
      if (res.status === 304) return // already latest
      if (!res.ok) return
      const data = await res.json()
      // Strip internal _lastEvents from game state; expose via pollEvents instead
      const rawEvents: unknown[] = (data.state as any)?._lastEvents ?? []
      const cleanState = { ...data.state }
      delete (cleanState as any)._lastEvents
      this.gameState = cleanState
      this.pollEvents = this._suppressPollEvents ? [] : rawEvents
      this.localVersion = data.version
      if (data.status === 'playing') this.status = 'playing'
      if (data.status === 'finished') this.status = 'idle'
    },

    _startAdapter() {
      this._stopAdapter()
      if (!this.roomId) return
      const adapter: SyncAdapter =
        this.syncMode === 'realtime'
          ? makeHybridAdapter(this.roomId, () => this.localVersion)
          : makePollingAdapter(3000)
      adapter.start(() => this._fetchState())
      this._adapter = adapter
    },

    _stopAdapter() {
      this._adapter?.stop()
      this._adapter = null
    },

    _persist() {
      if (this.roomId && this.side && this.secret) {
        localStorage.setItem(
          'chess_connection',
          JSON.stringify({ roomId: this.roomId, side: this.side, secret: this.secret }),
        )
      }
    },
  },
})
