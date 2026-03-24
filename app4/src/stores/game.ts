// BG Card Game — 遊戲狀態 Store

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  createInitialState, reduce, canDispatch,
  getBGsInZone, getEnemyBGsInZone, getAllyBGsInZone,
  effectiveHP,
} from '../engine'
import type { GameState, GameConfig, BGInstance } from '../engine'
import type { Action } from '../engine'
import type { GameEvent } from '../engine'
import type { PlayerId, ZoneId, BrickAreaId } from '../engine'
import { opponentOf } from '../engine'
import { botDecide } from '../sim/bot'
import { DYNAMIC_WEIGHTS } from '../sim/botWeights'

export interface SelectionState {
  prompt: string
  validBGIds: string[]
  validZones: ZoneId[]
  validAreaIds: BrickAreaId[]
  onSelectBG?: (bgId: string) => void
  onSelectZone?: (zone: ZoneId) => void
  onSelectArea?: (areaId: BrickAreaId) => void
}

export const useGameStore = defineStore('game', () => {
  const state = ref<GameState | null>(null)
  const localPlayer = ref<PlayerId>('p1')
  const eventLog = ref<GameEvent[]>([])
  const lastEvents = ref<GameEvent[]>([])
  const error = ref<string | null>(null)
  const selection = ref<SelectionState | null>(null)
  const pveMode = ref(false)
  const pendingIntimidateChoice = ref<{ triggerBGId: string; movedPlayer: PlayerId } | null>(null)

  // ── 遊戲初始化 ─────────────────────────────────────

  function startGame(config?: GameConfig, asPlayer: PlayerId = 'p1') {
    state.value = createInitialState(config)
    localPlayer.value = asPlayer
    eventLog.value = []
    lastEvents.value = []
    error.value = null
  }

  function startLocalPVP(config?: GameConfig) {
    pveMode.value = false
    startGame(config, 'p1')
  }

  function startPVE(config?: GameConfig, humanAs: PlayerId = 'p1') {
    pveMode.value = true
    startGame(config, humanAs)
    scheduleBotTurnIfNeeded()
  }

  // ── 行動分發 ────────────────────────────────────────

  function dispatch(action: Action, asPlayer?: PlayerId): boolean {
    if (!state.value) return false
    const player = asPlayer ?? localPlayer.value
    const guard = canDispatch(state.value, player, action)
    if (!guard.ok) {
      error.value = guard.reason
      return false
    }
    try {
      const result = reduce(state.value, player, action)
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
      error.value = null
      // 檢查威嚇反應觸發
      const intimidate = result.events.find(
        e => e.type === 'reaction_triggered' && (e as { reactionId: string }).reactionId === 'intimidate'
      ) as (GameEvent & { triggerBGId: string }) | undefined
      if (intimidate) {
        const isBotAction = pveMode.value && player !== localPlayer.value
        if (!isBotAction) {
          pendingIntimidateChoice.value = { triggerBGId: intimidate.triggerBGId, movedPlayer: player }
        }
        // Bot 的威嚇交由 runBotStep 處理（下次循環時解決）
      }
      scheduleBotTurnIfNeeded()
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return false
    }
  }

  // ── 威嚇反應解決 ────────────────────────────────────────

  function resolveIntimidateChoice(choice: 'take_damage' | 'move_back') {
    const pending = pendingIntimidateChoice.value
    if (!pending || !state.value) return
    pendingIntimidateChoice.value = null
    dispatch(
      { type: 'RESOLVE_REACTION', choice: { reactionId: 'intimidate', triggerBGId: pending.triggerBGId, intimidateChoice: choice } },
      pending.movedPlayer,
    )
  }

  // ── PVE Bot 執行 ──────────────────────────────────────────

  function scheduleBotTurnIfNeeded() {
    if (!pveMode.value || !state.value) return
    if (state.value.winner) return
    if (state.value.currentPlayer === localPlayer.value) return
    if (pendingIntimidateChoice.value) return  // 等人類解決威嚇
    setTimeout(() => runBotStep(), 400)
  }

  function runBotStep() {
    if (!pveMode.value || !state.value) return
    if (state.value.winner) return
    if (state.value.currentPlayer === localPlayer.value) return

    const botPlayer = state.value.currentPlayer

    // Bot 自動解決威嚇反應：存活優先選退回，否則承受傷害
    const intimidate = lastEvents.value.find(
      e => e.type === 'reaction_triggered' && (e as { reactionId: string }).reactionId === 'intimidate'
    ) as (GameEvent & { triggerBGId: string }) | undefined
    if (intimidate) {
      const bg = state.value.bgs[intimidate.triggerBGId]
      const choice = bg && effectiveHP(bg) > 4 ? 'move_back' : 'take_damage'
      const result = reduce(state.value, botPlayer, {
        type: 'RESOLVE_REACTION',
        choice: { reactionId: 'intimidate', triggerBGId: intimidate.triggerBGId, intimidateChoice: choice },
      })
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
      if (state.value && !state.value.winner && state.value.currentPlayer !== localPlayer.value)
        setTimeout(() => runBotStep(), 200)
      return
    }

    const action = botDecide(state.value, botPlayer, DYNAMIC_WEIGHTS)
    const guard = canDispatch(state.value, botPlayer, action)
    if (!guard.ok) {
      const result = reduce(state.value, botPlayer, { type: 'NEXT_PHASE' })
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
    } else {
      const result = reduce(state.value, botPlayer, action)
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
    }

    if (state.value && !state.value.winner && state.value.currentPlayer !== localPlayer.value) {
      setTimeout(() => runBotStep(), 200)
    }
  }

  /** PVP 模式：任意玩家都可操作 */
  function dispatchForCurrentPlayer(action: Action): boolean {
    if (!state.value) return false
    return dispatch(action, state.value.currentPlayer)
  }

  // ── 選擇模式 ────────────────────────────────────────

  function requestBGSelection(prompt: string, validBGIds: string[], onSelectBG: (bgId: string) => void) {
    selection.value = { prompt, validBGIds, validZones: [], validAreaIds: [], onSelectBG }
  }

  function requestZoneSelection(prompt: string, validZones: ZoneId[], onSelectZone: (zone: ZoneId) => void) {
    selection.value = { prompt, validBGIds: [], validZones, validAreaIds: [], onSelectZone }
  }

  function requestAreaSelection(prompt: string, validAreaIds: BrickAreaId[], onSelectArea: (areaId: BrickAreaId) => void) {
    selection.value = { prompt, validBGIds: [], validZones: [], validAreaIds, onSelectArea }
  }

  function cancelSelection() {
    selection.value = null
  }

  function selectBG(bgId: string) {
    const sel = selection.value
    if (!sel?.onSelectBG || !sel.validBGIds.includes(bgId)) return
    selection.value = null
    sel.onSelectBG(bgId)
  }

  function selectZone(zone: ZoneId) {
    const sel = selection.value
    if (!sel?.onSelectZone || !sel.validZones.includes(zone)) return
    selection.value = null
    sel.onSelectZone(zone)
  }

  function selectArea(areaId: BrickAreaId) {
    const sel = selection.value
    if (!sel?.onSelectArea || !sel.validAreaIds.includes(areaId)) return
    selection.value = null
    sel.onSelectArea(areaId)
  }

  // ── 查詢輔助 ────────────────────────────────────────

  const currentPlayer = computed(() => state.value?.currentPlayer ?? 'p1')
  const phase = computed(() => state.value?.phase ?? 'draw')
  const winner = computed(() => state.value?.winner ?? null)
  const isMyTurn = computed(() => state.value?.currentPlayer === localPlayer.value)

  function bgsInZone(zone: ZoneId): BGInstance[] {
    if (!state.value) return []
    return getBGsInZone(state.value, zone)
  }

  function myBGs(): BGInstance[] {
    if (!state.value) return []
    return Object.values(state.value.bgs).filter(bg => bg.owner === localPlayer.value)
  }

  function canAct(action: Action, asPlayer?: PlayerId): boolean {
    if (!state.value) return false
    const player = asPlayer ?? localPlayer.value
    return canDispatch(state.value, player, action).ok
  }

  return {
    state,
    localPlayer,
    pveMode,
    pendingIntimidateChoice,
    eventLog,
    lastEvents,
    error,
    selection,
    currentPlayer,
    phase,
    winner,
    isMyTurn,
    startGame,
    startLocalPVP,
    startPVE,
    dispatch,
    dispatchForCurrentPlayer,
    bgsInZone,
    myBGs,
    canAct,
    requestBGSelection,
    requestZoneSelection,
    requestAreaSelection,
    cancelSelection,
    selectBG,
    selectZone,
    selectArea,
    resolveIntimidateChoice,
  }
})
