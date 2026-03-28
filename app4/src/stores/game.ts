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
  const pendingIntimidateChoice = ref<{ triggerBGId: string; intimidateBGId: string; movedPlayer: PlayerId } | null>(null)
  const detailBGId = ref<string | null>(null)
  interface PendingSkill {
    skillIndex: 0 | 1
    fromBGId: string | undefined
    handCost: number
    selected: string[]          // 棄牌選取（index:cardId）
    targetBGId: string | null   // null = 待選擇，string = 已選
    targetOptions: { id: string; name: string }[]  // 可選目標（空陣列 = 不需手動選）
  }
  const pendingSkill = ref<PendingSkill | null>(null)

  // ── UI 待確認行動 ───────────────────────────────────
  type UIPendingType = 'start_bg' | 'move' | 'attack' | 'joint' | 'clear' | 'siege'
  interface UIPending {
    type: UIPendingType
    label: string
    bgId?: string
    toZone?: ZoneId
    targetBGId?: string
    areaId?: BrickAreaId
  }
  const uiPending = ref<UIPending | null>(null)
  const uiSelectedAllyId = ref<string | null>(null)
  const effectiveAllyId = computed(() => state.value?.jointAllyId ?? uiSelectedAllyId.value ?? null)

  function setPending(p: UIPending) { uiPending.value = p }
  function clearPending() { uiPending.value = null }
  function deselectAlly() { uiSelectedAllyId.value = null }

  function confirmPending() {
    const p = uiPending.value
    if (!p) return
    uiPending.value = null
    const allyId = (state.value?.jointAllyId ?? uiSelectedAllyId.value) ?? undefined
    switch (p.type) {
      case 'start_bg':
        uiSelectedAllyId.value = null
        dispatchForCurrentPlayer({ type: 'START_BG_ACTION', bgId: p.bgId! })
        break
      case 'move':
        dispatchForCurrentPlayer({ type: 'MOVE_BG', toZone: p.toZone! })
        break
      case 'attack':
        dispatchForCurrentPlayer({ type: 'DO_ATTACK', targetBGId: p.targetBGId!, allyId })
        break
      case 'joint':
        uiSelectedAllyId.value = p.bgId!
        break
      case 'clear':
        dispatchForCurrentPlayer({ type: 'DO_CLEAR_BRICK', areaId: p.areaId! })
        break
      case 'siege':
        dispatchForCurrentPlayer({ type: 'DO_SIEGE' })
        break
    }
  }

  // ── 遊戲初始化 ─────────────────────────────────────

  function startGame(config?: GameConfig, asPlayer: PlayerId = 'p1') {
    state.value = createInitialState(config)
    localPlayer.value = asPlayer
    eventLog.value = []
    lastEvents.value = []
    error.value = null
    scheduleAutoDrawIfNeeded()
  }

  function startLocalPVP(config?: GameConfig) {
    pveMode.value = false
    startGame(config, 'p1')
  }

  function startPVE(config?: GameConfig, humanAs: PlayerId = 'p1') {
    pveMode.value = true
    startGame(config, humanAs)
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
      if (!result.ok) {
        error.value = result.error
        return false
      }
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
      error.value = null
      uiPending.value = null
      if (action.type === 'END_BG_ACTION' || action.type === 'NEXT_PHASE') {
        uiSelectedAllyId.value = null
      }
      // 檢查威嚇反應觸發
      const intimidate = result.events.find(
        e => e.type === 'reaction_triggered' && (e as { reactionId: string }).reactionId === 'intimidate'
      ) as (GameEvent & { triggerBGId: string; bgId: string }) | undefined
      if (intimidate) {
        const isBotAction = pveMode.value && player !== localPlayer.value
        if (!isBotAction) {
          pendingIntimidateChoice.value = {
            triggerBGId: intimidate.triggerBGId,
            intimidateBGId: intimidate.bgId,
            movedPlayer: player,
          }
        }
        // Bot 的威嚇交由 runBotStep 處理（下次循環時解決）
      }
      scheduleAutoDrawIfNeeded()
      scheduleAutoNextPhaseFromAction()
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
      { type: 'RESOLVE_REACTION', choice: { reactionId: 'intimidate', triggerBGId: pending.triggerBGId, intimidateBGId: pending.intimidateBGId, intimidateChoice: choice } },
      pending.movedPlayer,
    )
  }

  // ── PVE Bot 執行 ──────────────────────────────────────────

  // ── 自動抽排（draw 階段為純過渡動畫，不需玩家操作） ────────────────
  // ── 行動階段自動結束（行動耗盡或無可行動 BG） ─────────────────
  function scheduleAutoNextPhaseFromAction() {
    if (!state.value || state.value.winner) return
    if (state.value.phase !== 'action') return
    if (state.value.actingBGId !== null) return  // 有 BG 正在行動，等它結束
    const s = state.value
    const p = s.currentPlayer
    const allUsed = s.bgActionsUsed >= s.bgActionsMax
    const noneCanAct = !Object.values(s.bgs).some(bg =>
      canDispatch(s, p, { type: 'START_BG_ACTION', bgId: bg.id }).ok
    )
    if (!allUsed && !noneCanAct) return
    setTimeout(() => {
      if (!state.value || state.value.phase !== 'action' || state.value.actingBGId !== null) return
      const r = reduce(state.value, state.value.currentPlayer, { type: 'NEXT_PHASE' })
      if (!r.ok) return
      state.value = r.state
      lastEvents.value = r.events
      eventLog.value.push(...r.events)
      scheduleAutoDrawIfNeeded()
      scheduleBotTurnIfNeeded()
    }, 600)
  }

  function scheduleAutoDrawIfNeeded() {
    if (!state.value || state.value.winner) return
    if (state.value.phase !== 'draw') return
    setTimeout(() => runAutoDrawPhase(), 500)
  }

  function runAutoDrawPhase() {
    if (!state.value || state.value.phase !== 'draw') return
    const p = state.value.currentPlayer
    // 自動抽 2 張
    for (let i = 0; i < 2; i++) {
      const r = reduce(state.value, p, { type: 'DRAW_CARD' })
      if (!r.ok) break
      state.value = r.state
      eventLog.value.push(...r.events)
    }
    // 推進到主要階段
    const r = reduce(state.value, p, { type: 'NEXT_PHASE' })
    if (!r.ok) return
    state.value = r.state
    lastEvents.value = r.events
    eventLog.value.push(...r.events)
    scheduleBotTurnIfNeeded()
    scheduleAutoDrawIfNeeded()
  }

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
      if (!result.ok) return
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
      if (!result.ok) return
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
    } else {
      const result = reduce(state.value, botPlayer, action)
      if (!result.ok) return
      state.value = result.state
      lastEvents.value = result.events
      eventLog.value.push(...result.events)
    }

    if (state.value && !state.value.winner && state.value.currentPlayer !== localPlayer.value) {
      setTimeout(() => runBotStep(), 200)
    }
    scheduleAutoDrawIfNeeded()
    scheduleAutoNextPhaseFromAction()
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
    detailBGId,
    pendingSkill,
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
    uiPending,
    uiSelectedAllyId,
    effectiveAllyId,
    setPending,
    clearPending,
    deselectAlly,
    confirmPending,
  }
})
