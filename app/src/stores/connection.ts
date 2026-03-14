import { defineStore } from 'pinia'
import { supabase } from '../lib/supabaseClient'
import type { GameState } from '../engine'

let detachLifecycleHandlers: (() => void) | null = null
let activeAdapter: SyncAdapter | null = null  // kept outside Pinia to avoid reactive wrapping

// ─── SyncAdapter interface ─────────────────────────────────────────────────

type SyncAdapter = {
  start(onTick: () => void): void
  stop(): void
  nudge?(): void   // hint to re-evaluate interval immediately
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

// Strategy 4: Adaptive polling — fast when waiting for opponent, slow on own turn
// getIsWaitingForOpponent: () => boolean drives the interval switching
function makeAdaptivePollingAdapter(
  getIsWaitingForOpponent: () => boolean,
  fastMs = 10000,
  slowMs = 30000,
): SyncAdapter {
  let timer: ReturnType<typeof setInterval> | null = null
  let currentFast = false
  let onTickFn: (() => void) | null = null

  function reschedule() {
    const shouldBeFast = getIsWaitingForOpponent()
    if (shouldBeFast === currentFast && timer !== null) return
    if (timer) clearInterval(timer)
    currentFast = shouldBeFast
    timer = setInterval(() => {
      onTickFn?.()
      reschedule() // re-evaluate interval after each tick
    }, shouldBeFast ? fastMs : slowMs)
  }

  return {
    start(onTick) {
      onTickFn = onTick
      reschedule()
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null }
      onTickFn = null
    },
    nudge() { reschedule() },
  }
}

// Realtime + adaptive-polling hybrid
function makeHybridAdapter(
  roomId: string,
  getLocalVersion: () => number,
  getIsWaitingForOpponent: () => boolean,
): SyncAdapter {
  const rt = makeRealtimeAdapter(roomId, getLocalVersion)
  const poll = makeAdaptivePollingAdapter(getIsWaitingForOpponent)
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
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    roomId: null as string | null,
    side: null as 'red' | 'black' | null,
    secret: null as string | null,
    syncMode: 'realtime' as SyncMode,
    localVersion: -1,
    gameState: null as GameState | null,
    lastEvents: [] as unknown[],
    pollEvents: [] as unknown[],   // events from opponent (via polling)
    _suppressPollEvents: false,
    _fetchInFlight: false,
    isSyncing: false,
    isSendingAction: false,
    errorMsg: null as string | null,
  }),

  actions: {
    // ── Create a new room ────────────────────────────────────────────────
    async createRoom(enabledClans: string[] = ['dark_moon', 'styx', 'eternal_night', 'iron_guard', 'gold_merc', 'death_oath']) {
      this.status = 'connecting'
      this.errorMsg = null
      const MAX_RETRIES = 3
      let lastErr = '建立房間失敗'
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 1200 * attempt))
        let res: Response
        try {
          res = await fetch('/api/rooms/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabledClans }),
          })
        } catch (e) {
          lastErr = e instanceof Error ? e.message : '網路錯誤，請檢查連線'
          continue
        }
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          lastErr = errBody.error ?? `伺服器錯誤 (${res.status})`
          continue
        }
        const data = await res.json()
        this.roomId = data.roomId
        this.side = data.side
        this.secret = data.secret
        this._persist()
        await this._fetchState()
        this._startAdapter()
        this.attachLifecycleHandlers()
        this.status = 'waiting'
        return data.roomId as string
      }
      this.errorMsg = lastErr
      this.status = 'error'
      return null
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
      this.attachLifecycleHandlers()
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
      this.attachLifecycleHandlers()
      return true
    },

    // ── Send an action to the server ────────────────────────────────────
    async sendAction(action: unknown) {
      if (!this.roomId || !this.secret || !this.side) return { ok: false, error: 'Not connected' }
      if (this.isSendingAction || this.isSyncing) return { ok: false, error: '同步中，請稍候' }
      // Suppress pollEvents for the entire request window so Realtime can't fire
      // during the fetch and double-process our own events
      this._suppressPollEvents = true
      this.isSendingAction = true
      try {
        const res = await fetch(`/api/rooms/${this.roomId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, secret: this.secret, side: this.side }),
        })
        const data = await res.json()
        if (!res.ok) {
          // Await resync before returning so _suppressPollEvents is still true
          // during the fetch — prevents stale pollEvents from being double-processed
          await this._fetchState()
          return {
            ok: false,
            error: data.error,
            code: data.code,
            currentVersion: data.currentVersion,
          }
        }
        this.lastEvents = data.events ?? []
        this.localVersion = data.version
        await this._fetchState()
        return { ok: true }
      } finally {
        this.isSendingAction = false
        this._suppressPollEvents = false
      }
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
      this.detachLifecycleHandlers()
      this.status = 'idle'
      this.isOffline = false
      this.roomId = null
      this.side = null
      this.secret = null
      this.gameState = null
      this.localVersion = -1
      this.isSyncing = false
      this.isSendingAction = false
      localStorage.removeItem('chess_connection')
    },

    // ── Internal ─────────────────────────────────────────────────────────
    async _fetchState() {
      if (!this.roomId) return
      if (this._fetchInFlight) return  // prevent concurrent duplicate fetches
      this._fetchInFlight = true
      this.isSyncing = true
      try {
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
        // Let adaptive polling re-evaluate fast/slow interval immediately
        activeAdapter?.nudge?.()
      } finally {
        this._fetchInFlight = false
        this.isSyncing = false
      }
    },

    async resyncNow(restartAdapter = false) {
      if (!this.roomId) return
      if (restartAdapter) this._startAdapter()
      await this._fetchState()
    },

    attachLifecycleHandlers() {
      if (typeof window === 'undefined' || typeof document === 'undefined') return
      this.detachLifecycleHandlers()

      const onVisibility = () => {
        if (document.hidden) return
        this.resyncNow(true)
      }
      const onFocus = () => { this.resyncNow(false) }
      const onPageShow = () => { this.resyncNow(true) }
      const onOnline = () => {
        this.isOffline = false
        if (this.errorMsg === '目前已離線，等待網路恢復後自動同步') this.errorMsg = null
        this.resyncNow(true)
      }
      const onOffline = () => {
        this.isOffline = true
        this.errorMsg = '目前已離線，等待網路恢復後自動同步'
      }

      document.addEventListener('visibilitychange', onVisibility)
      window.addEventListener('focus', onFocus)
      window.addEventListener('pageshow', onPageShow)
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)

      detachLifecycleHandlers = () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('focus', onFocus)
        window.removeEventListener('pageshow', onPageShow)
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
    },

    detachLifecycleHandlers() {
      if (detachLifecycleHandlers) {
        detachLifecycleHandlers()
        detachLifecycleHandlers = null
      }
    },

    _startAdapter() {
      this._stopAdapter()
      if (!this.roomId) return
      const isWaiting = () =>
        !!this.gameState && this.side !== null && this.gameState.turn.side !== this.side
      const adapter: SyncAdapter =
        this.syncMode === 'realtime'
          ? makeHybridAdapter(this.roomId, () => this.localVersion, isWaiting)
          : makeAdaptivePollingAdapter(isWaiting)
      adapter.start(() => this._fetchState())
      activeAdapter = adapter
    },

    _stopAdapter() {
      activeAdapter?.stop()
      activeAdapter = null
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
