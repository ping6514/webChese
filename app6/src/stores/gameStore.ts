import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, GameMode, Pos, Action } from '../engine/types'
import {
  createInitialState, applyAction, applySetupClick,
  finishSetupFloat, legalActions, simulateSlide, collectableCells, posEq,
  endTurn, simulatePushDest,
} from '../engine/gameEngine'
import { randomIceAction, randomMoveAction } from '../engine/ai'

export { simulateSlide, collectableCells, posEq, simulatePushDest }

const AI_DELAY_MS = 650

export const useGameStore = defineStore('game', () => {
  const state             = ref<GameState>(createInitialState())
  const mode              = ref<GameMode>('hvh')
  const isComputerThinking = ref(false)

  // ─── Mode helpers ────────────────────────────────────────────────────────────

  const isHumanTurn = computed(() => {
    const m = mode.value
    const t = state.value.turn
    if (m === 'hvh') return true
    if (m === 'hvc') return t === 'A'
    if (m === 'cvh') return t === 'B'
    return false          // cvc: never
  })

  // ─── New game ────────────────────────────────────────────────────────────────

  function newGame(m: GameMode = mode.value) {
    mode.value              = m
    state.value             = createInitialState()
    isComputerThinking.value = false
    scheduleComputerSetupIfNeeded()
  }

  // ─── Setup clicks (crown / float ice / character placement) ──────────────────

  function handleSetupClick(pos: Pos) {
    const next = applySetupClick(state.value, pos)
    if (!next) return
    state.value = next
    if (next.phase === 'playing') scheduleComputerIfNeeded()
  }

  function doneFloatSetup() {
    if (state.value.phase !== 'setup_float') return
    state.value = finishSetupFloat(state.value)
    scheduleComputerSetupIfNeeded()
  }

  // ─── Playing actions ─────────────────────────────────────────────────────────

  function handleAction(action: Action) {
    if (state.value.phase !== 'playing') return
    if (!isHumanTurn.value) return
    state.value = applyAction(state.value, action)
    scheduleComputerIfNeeded()
  }

  function handleEndTurn() {
    if (state.value.phase !== 'playing') return
    if (!isHumanTurn.value) return
    state.value = endTurn(state.value)
    scheduleComputerIfNeeded()
  }

  // ─── Computer turn scheduling ─────────────────────────────────────────────────

  function isComputerCurrentTurn(): boolean {
    const m = mode.value
    const t = state.value.turn
    return (m === 'hvc' && t === 'B') ||
           (m === 'cvh' && t === 'A') ||
           (m === 'cvc')
  }

  function scheduleComputerIfNeeded() {
    if (state.value.phase !== 'playing') return
    if (!isComputerCurrentTurn()) return

    isComputerThinking.value = true
    setTimeout(() => {
      if (state.value.phase !== 'playing') { isComputerThinking.value = false; return }

      // Phase 1: ice action (30% chance)
      if (Math.random() < 0.3) {
        const iceA = randomIceAction(state.value)
        if (iceA) state.value = applyAction(state.value, iceA)
      }

      // Phase 2: move action
      if (state.value.phase === 'playing' && !state.value.moveActionUsed) {
        const moveA = randomMoveAction(state.value)
        if (moveA) state.value = applyAction(state.value, moveA)
      }

      // End turn (if not already advanced by applyAction)
      if (state.value.phase === 'playing') state.value = endTurn(state.value)

      isComputerThinking.value = false
      if (state.value.phase === 'playing' && isComputerCurrentTurn()) scheduleComputerIfNeeded()
    }, AI_DELAY_MS)
  }

  // Computer auto-plays setup_chars phase when cvh (computer places A's pieces)
  function scheduleComputerSetupIfNeeded() {
    const s = state.value
    if (s.phase !== 'setup_chars') return
    // setup_chars is Player B's job.
    // If mode is hvh or hvc, Player B is human.
    // If mode is cvh or cvc, Player B is computer.
    const computerDoesSetup = mode.value === 'cvh' || mode.value === 'cvc'
    if (!computerDoesSetup) return

    isComputerThinking.value = true
    // Computer B picks random corners for both characters
    setTimeout(() => {
      let st = state.value
      const availCorners = [
        { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 6 }, { x: 6, y: 6 },
      ]
      // shuffle
      for (let i = availCorners.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availCorners[i], availCorners[j]] = [availCorners[j], availCorners[i]]
      }
      const next1 = applySetupClick(st, availCorners[0])
      if (next1) st = next1
      const next2 = applySetupClick(st, availCorners[1])
      if (next2) st = next2
      state.value              = st
      isComputerThinking.value = false
      if (st.phase === 'playing') scheduleComputerIfNeeded()
    }, AI_DELAY_MS)
  }

  // ─── Legal action helpers (for UI highlighting) ───────────────────────────────

  const legalActionsNow = computed(() => legalActions(state.value))

  return {
    state, mode, isComputerThinking, isHumanTurn,
    newGame, handleSetupClick, doneFloatSetup, handleAction, handleEndTurn,
    legalActionsNow,
  }
})
