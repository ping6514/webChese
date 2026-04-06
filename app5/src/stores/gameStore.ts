import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, SquadInstance, AIConfig } from '../engine/types'
import { captainDefs, followerDefs, captainCards, DEFAULT_AI_CONFIG } from '../data/testSquads'
import { createTestMap } from '../engine/mapData'
import { stepGame } from '../engine/squadEngine'

export const useGameStore = defineStore('game', () => {
  // ─── 備戰：玩家選的隊長卡清單 ──────────────────────────────────────────────
  const selectedCardIds = ref<string[]>([
    'card_captain_infantry',
    'card_captain_cavalry',
    'card_captain_heavy',
  ])

  // ─── 戰場狀態 ──────────────────────────────────────────────────────────────
  const gameState = ref<GameState | null>(null)
  const tickInterval = ref<number | null>(null)
  const speedMultiplier = ref(1)

  // ─── 建立小隊實例 ─────────────────────────────────────────────────────────
  function buildSquadInstance(
    squadId: string,
    captainDefId: string,
    aiConfig: AIConfig,
    team: 'player' | 'enemy',
    startPos: { q: number; r: number },
    deployAtTick: number | null = null
  ): SquadInstance {
    const capDef = captainDefs.find(c => c.id === captainDefId)!
    return {
      squadId,
      team,
      captainCardId: `card_${captainDefId}`,
      captainDefId,
      hp:             capDef.stats.hp,
      maxHp:          capDef.stats.hp,
      atb:            0,
      sp:             0,
      statusEffects:  [],
      spBuffActive:   false,
      spBuffType:     null,
      shieldLayers:   [],
      maxShieldSlots: capDef.baseFollowerSlots,
      unlockedNodes:  [],
      passiveUnlocked: false,
      pos:            { ...startPos },
      spawnPos:       { ...startPos },
      state:          'idle',
      aiConfig,
      reviveAtTick:   null,
      deployAtTick,
    }
  }

  // ─── 開始戰鬥 ─────────────────────────────────────────────────────────────
  function startBattle() {
    const cells = createTestMap()
    const squads: Record<string, SquadInstance> = {}

    // 玩家小隊（依選的卡片）
    selectedCardIds.value.forEach((cardId, i) => {
      const card = captainCards.find(c => c.id === cardId)
      if (!card) return
      const squadId = `player_squad_${i}`
      const startPos = { q: 1, r: 1 + i }
      const ai: AIConfig = {
        ...DEFAULT_AI_CONFIG,
        route: i === 0 ? 'top' : i === 1 ? 'mid' : 'bottom',
      }
      squads[squadId] = buildSquadInstance(
        squadId, card.captainDefId, ai, 'player', startPos,
        i === 0 ? null : i * 120  // 第 1 支立即，後面每 120 tick 入場
      )
    })

    // 固定敵方配置
    const enemyConfigs = [
      { captainId: 'captain_infantry', pos: { q: 8, r: 1 }, route: 'top'    },
      { captainId: 'captain_heavy',    pos: { q: 8, r: 3 }, route: 'mid'    },
      { captainId: 'captain_infantry', pos: { q: 8, r: 4 }, route: 'bottom' },
    ] as const

    enemyConfigs.forEach((cfg, i) => {
      const squadId = `enemy_squad_${i}`
      const ai: AIConfig = {
        behavior:       'aggressive',
        targetPriority: 'nearest',
        spMode:         'auto',
        route:          cfg.route,
        alertRange:     2,
      }
      squads[squadId] = buildSquadInstance(
        squadId, cfg.captainId, ai, 'enemy', cfg.pos
      )
    })

    gameState.value = {
      phase:    'running',
      tick:     0,
      squads,
      cells,
      resources: { mana: 20, experience: 0, destinyPoints: 0 },
      production: {
        current:  null,
        inventory: [],
        maxInventory: 3,
        rerollCooldownEndsAtTick: null,
      },
      tacticHand: {
        cards:            [],
        maxSize:          3,
        conveyorProgress: 0,
        conveyorMax:      100,
      },
      ddzList: [],
      log:     ['戰鬥開始'],
    }

    startTicking()
  }

  // ─── ATB ticking ──────────────────────────────────────────────────────────
  function startTicking() {
    if (tickInterval.value) clearInterval(tickInterval.value)
    tickInterval.value = setInterval(() => {
      if (!gameState.value || gameState.value.phase !== 'running') {
        stopTicking()
        return
      }
      gameState.value = stepGame(gameState.value)
    }, 120 / speedMultiplier.value) as unknown as number
  }

  function stopTicking() {
    if (tickInterval.value) clearInterval(tickInterval.value)
    tickInterval.value = null
  }

  function setSpeed(mult: number) {
    speedMultiplier.value = mult
    if (tickInterval.value) { stopTicking(); startTicking() }
  }

  // ─── Getters ──────────────────────────────────────────────────────────────
  const playerSquads = computed(() =>
    gameState.value
      ? Object.values(gameState.value.squads).filter(s => s.team === 'player')
      : []
  )
  const enemySquads = computed(() =>
    gameState.value
      ? Object.values(gameState.value.squads).filter(s => s.team === 'enemy')
      : []
  )

  return {
    selectedCardIds,
    gameState,
    speedMultiplier,
    startBattle, stopTicking, setSpeed,
    playerSquads, enemySquads,
    captainDefs, followerDefs, captainCards,
  }
})
