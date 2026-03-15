/**
 * stores/game.ts — 地城遊戲主狀態機
 *
 * 管理 GameState、setInterval 遊戲循環、玩家輸入分派。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

import type { GameState, Unit, Pos, RunState } from '@engine/state'
import type { Action } from '@engine/actions'
import type { Event } from '@engine/events'
import type { ReduceDeps } from '@engine/reduce'
import { reduce } from '@engine/reduce'
import { advanceTime } from '@engine/atb'
import { decideTurn } from '@engine/ai'
import { createGameState } from '@engine/game'
import { buildFloorFromConfig } from '@engine/campaign'
import { rollJobCert, createPlayerUnit } from '@engine/player'
import type { JobCertDef } from '@engine/player'
import { resolveWeapon } from '@engine/weapons'
import { resolveLoot } from '@engine/loot'

import {
  monsterRegistry,
  lootRegistry,
  armorAffixDefs,
  roomDefs,
  chunkDefs,
  forestConfig,
  jobCerts,
  weaponBases,
} from '@/data/index'
import { useInventoryStore } from '@/stores/inventory'

// 每個職業的初始武器 id
const JOB_STARTER_WEAPON: Record<string, string> = {
  warrior: 'iron_sword',
  ranger:  'dagger',
  mage:    'fire_staff',
}

// ── 遊戲階段 ──────────────────────────────────────────────────────────────────

export type DungeonPhase = 'setup' | 'combat' | 'loot' | 'path' | 'gameover'

// ── 選中格/高亮 ───────────────────────────────────────────────────────────────

export type HighlightKind = 'move' | 'attack' | 'select'

export type CellHighlight = {
  pos: Pos
  kind: HighlightKind
}

// ── FX 浮字 ───────────────────────────────────────────────────────────────────

export type FloatText = {
  id: string
  pos: Pos
  text: string
  kind: 'damage' | 'heal' | 'miss' | 'status'
  createdAt: number
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useGameStore = defineStore('game', () => {
  // ── 狀態 ────────────────────────────────────────────────────────────────────
  const phase = ref<DungeonPhase>('setup')
  const gameState = ref<GameState | null>(null)
  const recentEvents = ref<Event[]>([])
  const floatTexts = ref<FloatText[]>([])
  const highlights = ref<CellHighlight[]>([])
  const selectedUnitId = ref<string | null>(null)
  const hoveredPos = ref<Pos | null>(null)
  const setupJobId = ref<string>('warrior')

  const atbMode = ref<'instant' | 'timer'>('instant')

  let loopHandle: ReturnType<typeof setInterval> | null = null
  let loopRunning = false
  let floatCounter = 0

  // ── Computed ─────────────────────────────────────────────────────────────────

  const pendingUnitId = computed(() =>
    gameState.value?.timeline.pendingUnitId ?? null
  )

  const pendingUnit = computed((): Unit | null => {
    const id = pendingUnitId.value
    return id ? (gameState.value?.units[id] ?? null) : null
  })

  const isPlayerTurn = computed((): boolean =>
    pendingUnit.value?.kind === 'player'
  )

  const playerUnits = computed((): Unit[] => {
    if (!gameState.value) return []
    return Object.values(gameState.value.units).filter(u => u.kind === 'player' && !u.isDead)
  })

  const monsterUnits = computed((): Unit[] => {
    if (!gameState.value) return []
    return Object.values(gameState.value.units).filter(u => u.kind === 'monster' && !u.isDead)
  })

  // ── deps for reduce ──────────────────────────────────────────────────────────

  const reduceDeps: ReduceDeps = {
    allAffixDefs: {},    // TODO: load weapon affixes for player weapons
    dungeonQuality: 1.0,
    lootRegistry,
  }

  // ── Game init ────────────────────────────────────────────────────────────────

  function startGame(jobId: string) {
    const certDef: JobCertDef | undefined = jobCerts[jobId]
    if (!certDef || !forestConfig) {
      console.error('[game] missing jobCert or forestConfig', jobId)
      return
    }

    const certInstance = rollJobCert(certDef, `player_cert_${jobId}_1`)

    // 初始武器
    const starterWeaponId = JOB_STARTER_WEAPON[jobId]
    const starterWeaponBase = starterWeaponId ? weaponBases[starterWeaponId] : null
    const starterWeapon = starterWeaponBase
      ? resolveWeapon(starterWeaponBase, {}, [], null, 1.0)
      : null

    const inventory = useInventoryStore()

    // 武器槽：優先使用背包已裝備武器，slot 0 無裝備時使用職業初始武器
    function resolveWeaponSlot(slot: 0 | 1 | 2) {
      const frozen = inventory.equippedWeapons[slot]
      if (frozen) {
        const base = weaponBases[frozen.baseId]
        if (base) return { base, applied: frozen.affixIds.map(id => ({ id })) }
      }
      if (slot === 0 && starterWeaponBase) return { base: starterWeaponBase, applied: [] as [] }
      return null
    }

    const player = createPlayerUnit({
      id: 'player_1',
      jobCertDef: certDef,
      jobCertInstance: certInstance,
      pos: { x: 1, y: 1 },
      weaponSlots: [resolveWeaponSlot(0), resolveWeaponSlot(1), resolveWeaponSlot(2)],
      initialArmor:  inventory.equippedArmorList,
      armorAffixDefs,
    })

    const seed = `run_${Date.now()}`
    const floorResult = buildFloorFromConfig({
      dungeonConfig: forestConfig,
      floorNumber: 1,
      pathType: 'safe',
      monsterRegistry,
      roomDefs,
      chunkDefs,
      seed,
    })

    const run: RunState = {
      runSeed: seed,
      difficulty: 1,
      theme: 'forest',
      floorNumber: 1,
      maxFloors: forestConfig.totalFloors,
      pathHistory: [],
      trialFloorCount: 0,
      dungeonQuality: 1.0,
      lootQuality: 1.0,
      status: 'active',
      playerCount: 1,
      lootDistributionMode: 'free_for_all',
      captainPlayerId: null,
      lootPhase: null,
    }

    gameState.value = createGameState({ floorResult, players: [player], run })
    phase.value = 'combat'
    recentEvents.value = []
    selectedUnitId.value = null
    highlights.value = []

    startLoop()
  }

  // ── Game loop ─────────────────────────────────────────────────────────────────

  function startLoop() {
    if (loopHandle !== null) return
    loopRunning = true
    loopHandle = setInterval(tick, 50)
  }

  function stopLoop() {
    if (loopHandle !== null) {
      clearInterval(loopHandle)
      loopHandle = null
    }
    loopRunning = false
  }

  function tick() {
    if (!loopRunning || !gameState.value) return
    const gs = gameState.value

    if (gs.timeline.pendingUnitId !== null) {
      const unitId = gs.timeline.pendingUnitId
      const unit = gs.units[unitId]
      const atbEntry = gs.timeline.entries.find(e => e.unitId === unitId)

      // 已死亡的單位仍占據 pendingUnitId（e.g. 讀條期間被擊殺）→ 強制清除
      if (!unit || unit.isDead) {
        gameState.value = {
          ...gs,
          timeline: { ...gs.timeline, pendingUnitId: null },
        }
        return
      }

      // 讀條中（castRemaining > 0）→ 推進時間，等讀條結束後再結算
      if (atbEntry && atbEntry.castRemaining > 0) {
        const { newState, events } = advanceTime(gs)
        gameState.value = newState
        processEvents(events)
        const updatedEntry = newState.timeline.entries.find(e => e.unitId === unitId)
        if (updatedEntry && updatedEntry.castRemaining === 0) {
          dispatchAction({ type: 'RESOLVE_CAST', unitId })
        }
        return
      }

      // 玩家等待輸入
      if (unit?.kind === 'player') return

      // AI 單位 → 自動決策
      if (unit && !unit.isDead) {
        const action = decideTurn(gs, unit.id)
        dispatchAction(action)
      } else {
        dispatchAction({ type: 'END_TURN', unitId })
      }
      return
    }

    // 推進時間（instant = 跳至下個 ATB 事件；timer = 每次推進 50ms 遊戲時間）
    const delta = atbMode.value === 'timer' ? 50 : undefined
    const { newState, events } = advanceTime(gs, delta)
    gameState.value = newState
    processEvents(events)
    checkPhaseTransition(newState, events)
    resolveCompletedCasts()
  }

  /** 結算所有讀條剛完成（castRemaining===0 且有 pendingAction）的單位 */
  function resolveCompletedCasts() {
    if (!gameState.value) return
    for (const entry of gameState.value.timeline.entries) {
      if (entry.castRemaining !== 0) continue
      const unit = gameState.value.units[entry.unitId]
      if (!unit || unit.isDead || !unit.pendingAction) continue
      dispatchAction({ type: 'RESOLVE_CAST', unitId: entry.unitId })
      return  // 每 tick 最多結算一個，下一個 tick 繼續
    }
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────────

  function dispatchAction(action: Action) {
    if (!gameState.value) return
    const { state: nextState, events } = reduce(gameState.value, action, reduceDeps)
    gameState.value = nextState
    processEvents(events)
    checkPhaseTransition(nextState, events)

    // 即時武器（castTimeFinal === 0）→ 自動結算，不等 tick
    for (const ev of events) {
      if (ev.type === 'CAST_STARTED' && ev.castTimeMs === 0) {
        if (!gameState.value) break
        const { state: rs, events: re } = reduce(gameState.value, { type: 'RESOLVE_CAST', unitId: ev.unitId }, reduceDeps)
        gameState.value = rs
        processEvents(re)
        checkPhaseTransition(rs, re)
      }
    }
  }

  function processEvents(events: Event[]) {
    recentEvents.value = events
    for (const ev of events) {
      if (ev.type === 'DAMAGE_DEALT') {
        spawnFloat(ev.pos, `-${ev.amount}`, 'damage')
      } else if (ev.type === 'HEAL') {
        const label = ev.resource === 'mp' ? ' MP' : ev.resource === 'sp' ? ' SP' : ''
        spawnFloat(ev.pos, `+${ev.amount}${label}`, 'heal')
      } else if (ev.type === 'DOT_TICK') {
        spawnFloat(ev.pos, `-${ev.amount}`, 'damage')
      }
    }
  }

  function checkPhaseTransition(state: GameState, events: Event[]) {
    for (const ev of events) {
      if (ev.type === 'FLOOR_CLEARED') {
        if (state.run.lootPhase) {
          phase.value = 'loot'
          stopLoop()
        } else {
          // 自動生成寶相並進入打寶階段
          const playerIds = Object.values(state.units)
            .filter(u => u.kind === 'player')
            .map(u => u.id)
          const lootResult = resolveLoot(
            {
              itemTypes: ['armor'],
              slotDropChance: { head: 0.5, body: 1.0, hands: 0.4, feet: 0.4 },
              rarityTable: [
                { rarity: 'common', weight: 6 },
                { rarity: 'rare',   weight: 3 },
                { rarity: 'elite',  weight: 1 },
              ],
              affixCountTable: [
                { count: 1, weight: 4 },
                { count: 2, weight: 3 },
                { count: 3, weight: 1 },
              ],
              guaranteed: true,
              gold: 10 + state.run.floorNumber * 5,
              context: {
                floorNumber: state.run.floorNumber,
                dungeonQuality: state.run.dungeonQuality,
                theme: (state.run.theme ?? 'forest') as 'forest' | 'ruins',
                ticketSeed: `${state.run.runSeed}:floor${state.run.floorNumber}`,
              },
            },
            lootRegistry,
          )
          dispatchAction({
            type: 'START_LOOT_PHASE',
            items: lootResult.items,
            bonusGold: lootResult.gold,
            playerIds,
          })
        }
      } else if (ev.type === 'LOOT_PHASE_STARTED') {
        phase.value = 'loot'
        stopLoop()
      } else if (ev.type === 'FLOOR_FAILED') {
        phase.value = 'gameover'
        stopLoop()
      } else if (ev.type === 'PATH_SELECTED') {
        advanceToNextFloor(state, (ev as any).pathType)
      }
    }
  }

  function advanceToNextFloor(state: GameState, pathType: 'safe' | 'trial') {
    if (!forestConfig) return

    // 取出當前玩家資料（保留 HP、裝備等）
    const currentPlayers = Object.values(state.units).filter(u => u.kind === 'player')

    // 建立新樓層
    const seed = `run_${state.run.runSeed}_floor_${state.run.floorNumber}`
    const floorResult = buildFloorFromConfig({
      dungeonConfig: forestConfig,
      floorNumber: state.run.floorNumber,
      pathType,
      monsterRegistry,
      roomDefs,
      chunkDefs,
      seed,
    })

    // 組裝新的 GameState（保留 run 進度，重建地圖 + 怪物 + ATB）
    gameState.value = createGameState({
      floorResult,
      players: currentPlayers,
      run: state.run,
    })

    // 重置 UI 狀態
    recentEvents.value = []
    floatTexts.value = []
    highlights.value = []
    selectedUnitId.value = null

    phase.value = 'combat'
    startLoop()
  }

  // ── Float FX ──────────────────────────────────────────────────────────────────

  function spawnFloat(pos: Pos, text: string, kind: FloatText['kind']) {
    const id = `ft_${floatCounter++}`
    floatTexts.value.push({ id, pos, text, kind, createdAt: Date.now() })
    setTimeout(() => {
      floatTexts.value = floatTexts.value.filter(f => f.id !== id)
    }, 1200)
  }

  // ── Highlight helpers ─────────────────────────────────────────────────────────

  function setHighlights(hl: CellHighlight[]) { highlights.value = hl }
  function clearHighlights() { highlights.value = [] }

  function selectUnit(unitId: string | null) {
    selectedUnitId.value = unitId
    if (!unitId) { clearHighlights(); return }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────────

  function reset() {
    stopLoop()
    gameState.value = null
    phase.value = 'setup'
    recentEvents.value = []
    floatTexts.value = []
    highlights.value = []
    selectedUnitId.value = null
  }

  function setAtbMode(mode: 'instant' | 'timer') { atbMode.value = mode }

  return {
    phase,
    gameState,
    recentEvents,
    floatTexts,
    highlights,
    selectedUnitId,
    hoveredPos,
    setupJobId,
    atbMode,
    // computed
    pendingUnitId,
    pendingUnit,
    isPlayerTurn,
    playerUnits,
    monsterUnits,
    // actions
    startGame,
    dispatchAction,
    setHighlights,
    clearHighlights,
    selectUnit,
    setAtbMode,
    reset,
  }
})
