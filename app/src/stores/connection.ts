import { defineStore } from 'pinia'
import Peer, { type DataConnection } from 'peerjs'
import type { GameState } from '../engine'
import { createInitialState, canDispatch, reduce } from '../engine'

export type ConnStatus = 'idle' | 'connecting' | 'waiting' | 'playing' | 'error'

// ── Message protocol ───────────────────────────────────────────────────────

type MsgInit   = { type: 'init';  side: 'red' | 'black'; state: GameState; version: number }
type MsgAck    = { type: 'ack';   state: GameState; events: unknown[]; version: number }
type MsgPush   = { type: 'push';  state: GameState; events: unknown[]; version: number }
type MsgError  = { type: 'error'; reason: string; code?: string }
type MsgAction = { type: 'action'; action: unknown }

type HostMsg = MsgInit | MsgAck | MsgPush | MsgError
type GuestMsg = MsgAction

// ── Constants ──────────────────────────────────────────────────────────────

const ALL_CLANS = ['dark_moon', 'styx', 'eternal_night', 'iron_guard', 'gold_merc', 'death_oath']

const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
    ],
  },
}

// ── Module-level state (not reactive) ─────────────────────────────────────
// Kept outside Pinia to avoid Vue reactive wrapping overhead

let _peer: Peer | null = null
let _conn: DataConnection | null = null
let _isHost = false
let _pendingActionResolve: ((r: { ok: boolean; error?: string; code?: string }) => void) | null = null

// ── Helpers ────────────────────────────────────────────────────────────────

function genId(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useConnection = defineStore('connection', {
  state: () => ({
    status:          'idle' as ConnStatus,
    roomId:          null as string | null,
    side:            null as 'red' | 'black' | null,
    gameState:       null as GameState | null,
    lastEvents:      [] as unknown[],
    pollEvents:      [] as unknown[],
    isSendingAction: false,
    isSyncing:       false,
    errorMsg:        null as string | null,
    localVersion:    -1,
    isOffline:       typeof navigator !== 'undefined' ? !navigator.onLine : false,
  }),

  actions: {
    // ── Create room (Host) ──────────────────────────────────────────────────
    async createRoom(enabledClans: string[] = ALL_CLANS): Promise<string | null> {
      this._cleanup()
      this.status   = 'connecting'
      this.errorMsg = null
      _isHost = true

      const mySide: 'red' | 'black' = Math.random() < 0.5 ? 'red' : 'black'
      const firstSide: 'red' | 'black' = Math.random() < 0.5 ? 'red' : 'black'
      this.side = mySide

      const safeClans = enabledClans.filter(c => ALL_CLANS.includes(c))
      const initial = createInitialState({
        rules: { firstSide, enabledClans: safeClans.length ? safeClans : ALL_CLANS } as any,
      })
      this.gameState    = initial
      this.localVersion = 0

      const tryCreate = (id: string): Promise<string | null> =>
        new Promise((resolve) => {
          const p = new Peer(id, PEER_CONFIG)
          _peer = p

          p.on('open', () => {
            this.roomId = id
            this.status = 'waiting'
            this._persist()
            resolve(id)
          })

          p.on('error', (err: any) => {
            if (err.type === 'unavailable-id') {
              p.destroy()
              tryCreate(genId(6)).then(resolve)
            } else {
              this.errorMsg = `建立失敗: ${err.message}`
              this.status   = 'error'
              resolve(null)
            }
          })

          // Guest connects
          p.on('connection', (c) => {
            _conn = c
            c.on('open', () => {
              const guestSide = mySide === 'red' ? 'black' : 'red'
              c.send({ type: 'init', side: guestSide, state: this.gameState!, version: this.localVersion } as MsgInit)
              this.status = 'playing'
            })
            c.on('data',  (data) => this._onGuestData(data as GuestMsg))
            c.on('close', () => { this.errorMsg = '對手已斷線' })
            c.on('error', (err: any) => { this.errorMsg = `連線錯誤: ${err.message}` })
          })
        })

      return tryCreate(genId(6))
    },

    // ── Join room (Guest) ───────────────────────────────────────────────────
    async joinRoom(roomId: string): Promise<boolean> {
      this._cleanup()
      this.status   = 'connecting'
      this.errorMsg = null
      _isHost = false

      return new Promise((resolve) => {
        const p = new Peer(PEER_CONFIG as any)
        _peer = p

        let resolved = false

        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            this.errorMsg = '連線逾時，請確認房間碼是否正確'
            this.status   = 'error'
            resolve(false)
          }
        }, 15000)

        p.on('open', () => {
          const c = p.connect(roomId, { reliable: true })
          _conn = c

          c.on('data', (data) => {
            const msg = data as HostMsg
            if (!resolved && msg.type === 'init') {
              resolved = true
              clearTimeout(timeout)
              this.side         = msg.side
              this.gameState    = msg.state
              this.localVersion = msg.version
              this.roomId       = roomId
              this.status       = 'playing'
              this._persist()
              resolve(true)
            } else {
              this._onHostData(msg)
            }
          })

          c.on('close', () => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              this.errorMsg = '房間不存在或已關閉'
              this.status   = 'error'
              resolve(false)
            } else {
              this.errorMsg = '對手已斷線'
            }
          })

          c.on('error', (err: any) => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              this.errorMsg = `連線錯誤: ${err.message}`
              this.status   = 'error'
              resolve(false)
            }
          })
        })

        p.on('error', (err: any) => {
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            this.errorMsg = `連線錯誤: ${err.message}`
            this.status   = 'error'
            resolve(false)
          }
        })
      })
    },

    // ── Send action ─────────────────────────────────────────────────────────
    async sendAction(action: unknown): Promise<{ ok: boolean; error?: string; code?: string }> {
      if (!this.side || !this.gameState) return { ok: false, error: 'Not connected' }
      if (this.isSendingAction)          return { ok: false, error: '同步中，請稍候' }

      if (_isHost) {
        return this._hostProcess(action, false)
      }

      // Guest: send to Host, await ack or error
      if (!_conn?.open) return { ok: false, error: '連線已斷開' }
      this.isSendingAction = true

      return new Promise((resolve) => {
        _pendingActionResolve = resolve
        _conn!.send({ type: 'action', action } as GuestMsg)

        setTimeout(() => {
          if (_pendingActionResolve === resolve) {
            _pendingActionResolve    = null
            this.isSendingAction     = false
            resolve({ ok: false, error: '等待回應逾時' })
          }
        }, 10000)
      })
    },

    // ── Host: validate + reduce, then broadcast ─────────────────────────────
    _hostProcess(action: unknown, fromGuest: boolean): { ok: boolean; error?: string; code?: string } {
      const guard = canDispatch(this.gameState!, action as any)
      if (!guard.ok) {
        if (fromGuest && _conn?.open)
          _conn.send({ type: 'error', reason: guard.reason } as MsgError)
        return { ok: false, error: guard.reason }
      }

      const result = reduce(this.gameState!, action as any)
      if (!result.ok) {
        if (fromGuest && _conn?.open)
          _conn.send({ type: 'error', reason: result.error } as MsgError)
        return { ok: false, error: result.error }
      }

      this.gameState    = result.state
      this.localVersion++

      if (fromGuest) {
        // Opponent acted → Host's pollEvents
        this.pollEvents  = result.events
        this.lastEvents  = []
        _conn?.open && _conn.send({
          type: 'ack', state: result.state, events: result.events, version: this.localVersion,
        } as MsgAck)
      } else {
        // Host's own action
        this.lastEvents  = result.events
        this.pollEvents  = []
        _conn?.open && _conn.send({
          type: 'push', state: result.state, events: result.events, version: this.localVersion,
        } as MsgPush)
      }

      return { ok: true }
    },

    // ── Guest receives data from Host ───────────────────────────────────────
    _onHostData(msg: HostMsg) {
      if (msg.type === 'ack') {
        this.gameState       = msg.state
        this.lastEvents      = msg.events   // my action's events
        this.pollEvents      = []
        this.localVersion    = msg.version
        const resolve        = _pendingActionResolve
        _pendingActionResolve = null
        this.isSendingAction = false
        resolve?.({ ok: true })
      } else if (msg.type === 'push') {
        // Host's own action → Guest's pollEvents
        this.gameState    = msg.state
        this.pollEvents   = msg.events
        this.lastEvents   = []
        this.localVersion = msg.version
      } else if (msg.type === 'error') {
        const resolve        = _pendingActionResolve
        _pendingActionResolve = null
        this.isSendingAction = false
        resolve?.({ ok: false, error: msg.reason, code: msg.code })
      }
    },

    // ── Host receives data from Guest ───────────────────────────────────────
    _onGuestData(msg: GuestMsg) {
      if (msg.type === 'action') {
        this._hostProcess(msg.action, true)
      }
    },

    // ── Disconnect ──────────────────────────────────────────────────────────
    disconnect() {
      this._cleanup()
      this.$reset()
      localStorage.removeItem('chess_connection')
    },

    // ── Reconnect (P2P 不支援跨頁面重連) ────────────────────────────────────
    async reconnect(): Promise<boolean> {
      return false
    },

    // ── Lifecycle stubs（P2P 不需要 visibility 重連） ────────────────────────
    attachLifecycleHandlers() {},
    detachLifecycleHandlers() {},

    // ── resyncNow stub（P2P 不需要主動拉取，兼容舊 UI 呼叫） ────────────────
    async resyncNow(_restartAdapter?: boolean) {},

    // ── Internal ────────────────────────────────────────────────────────────
    _cleanup() {
      if (_pendingActionResolve) {
        _pendingActionResolve({ ok: false, error: '連線已重置' })
        _pendingActionResolve = null
      }
      _conn?.close()
      _peer?.destroy()
      _conn = null
      _peer = null
    },

    _persist() {
      if (this.roomId && this.side) {
        localStorage.setItem(
          'chess_connection',
          JSON.stringify({ roomId: this.roomId, side: this.side }),
        )
      }
    },
  },
})
