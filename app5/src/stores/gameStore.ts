import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  GameState, SquadInstance, AIConfig, RouteAssign, AIBehavior,
  TraitType,
} from '../engine/types'
import {
  captainDefs, followerDefs, captainCards, summonerCards,
  DEFAULT_AI_CONFIG, captainAlertRange, traitDefs,
} from '../data/testSquads'
import { createTestMap, createInitialZones, createDefaultLanes } from '../engine/mapData'
import { stepGame } from '../engine/squadEngine'

export const useGameStore = defineStore('game', () => {
  // ─── 備戰：玩家選的隊長卡清單 ──────────────────────────────────────────────
  const selectedCardIds = ref<string[]>([
    'card_captain_infantry',
    'card_captain_cavalry',
    'card_captain_heavy',
  ])

  // ─── 備戰：玩家選的召喚師裝備卡（最多 2 張）────────────────────────────────
  const selectedSummonerCardIds = ref<string[]>([])

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

    const playerSpawns = [
      { r: 2,  route: 'top'    as RouteAssign },
      { r: 7,  route: 'mid'    as RouteAssign },
      { r: 12, route: 'bottom' as RouteAssign },
      { r: 4,  route: 'top'    as RouteAssign },
      { r: 10, route: 'bottom' as RouteAssign },
    ]

    selectedCardIds.value.forEach((cardId, i) => {
      const card = captainCards.find(c => c.id === cardId)
      if (!card) return
      const squadId  = `player_squad_${i}`
      const spawn    = playerSpawns[i] ?? { r: 5, route: 'mid' as RouteAssign }
      const startPos = { q: 1, r: spawn.r }
      const capDef   = captainDefs.find(c => c.id === card.captainDefId)!
      const ai: AIConfig = {
        ...DEFAULT_AI_CONFIG,
        route:      spawn.route,
        alertRange: captainAlertRange(capDef.type),
      }
      squads[squadId] = buildSquadInstance(
        squadId, card.captainDefId, ai, 'player', startPos,
        i === 0 ? null : i * 100
      )
    })

    const enemyConfigs = [
      { captainId: 'captain_infantry', pos: { q: 14, r: 2  }, route: 'top'    },
      { captainId: 'captain_heavy',    pos: { q: 14, r: 7  }, route: 'mid'    },
      { captainId: 'captain_ranged',   pos: { q: 14, r: 12 }, route: 'bottom' },
    ] as const

    enemyConfigs.forEach((cfg, i) => {
      const squadId = `enemy_squad_${i}`
      const capDef2 = captainDefs.find(c => c.id === cfg.captainId)!
      const ai: AIConfig = {
        behavior:       'aggressive',
        targetPriority: 'nearest',
        spMode:         'auto',
        route:          cfg.route,
        alertRange:     captainAlertRange(capDef2.type),
      }
      squads[squadId] = buildSquadInstance(
        squadId, cfg.captainId, ai, 'enemy', cfg.pos
      )
    })

    // 從者帶預覽初始化
    const followerPool = ['follower_infantry', 'follower_cavalry', 'follower_heavy', 'follower_ranged', 'follower_siege']
    const fUpcoming = Array.from({ length: 3 }, (_, i) => ({
      instanceId:    `fc_init_${i}`,
      followerDefId: followerPool[Math.floor(Math.random() * followerPool.length)],
    }))

    // Trait 帶預覽初始化
    const traitPool: TraitType[] = ['Charge', 'Splash', 'Block', 'Pierce', 'LifeSteal', 'Taunt']
    const tUpcoming = Array.from({ length: 3 }, (_, i) => ({
      instanceId: `tc_init_${i}`,
      traitId: traitPool[Math.floor(Math.random() * traitPool.length)],
    }))

    gameState.value = {
      phase:         'running',
      tick:          0,
      maxTicks:      5400,    // ~10.8 分鐘（5400 × 120ms）
      playerBaseHp:  1000,
      enemyBaseHp:   1000,
      squads,
      cells,
      zones:    createInitialZones(),
      lanes:    createDefaultLanes(),
      resources: { mana: 20, experience: 0, destinyPoints: 0 },
      followerBelt: {
        hand:          [],
        maxHand:       4,
        cooldownTicks: 80,
        intervalTicks: 200,
        pool:          followerPool,
        upcoming:      fUpcoming,
        upcomingSize:  3,
      },
      traitBelt: {
        hand:          [],
        maxHand:       4,
        cooldownTicks: 160,
        intervalTicks: 280,
        pool:          traitPool,
        upcoming:      tUpcoming,
        upcomingSize:  3,
      },
      stagingArea: { slots: [], maxSlots: 2 },
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
      events:  [],
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

  // ─── 玩家指令：修改小隊路線 ──────────────────────────────────────────────
  function setSquadRoute(squadId: string, route: RouteAssign) {
    if (!gameState.value) return
    const squad = gameState.value.squads[squadId]
    if (!squad || squad.team !== 'player') return
    squad.aiConfig.route = route
  }

  // ─── 玩家指令：修改小隊行為 ──────────────────────────────────────────────
  function setSquadBehavior(squadId: string, behavior: AIBehavior) {
    if (!gameState.value) return
    const squad = gameState.value.squads[squadId]
    if (!squad || squad.team !== 'player') return
    squad.aiConfig.behavior = behavior
  }

  // ─── 從者帶：移入暫存區 ──────────────────────────────────────────────────
  function stageFollower(cardInstanceId: string): boolean {
    if (!gameState.value) return false
    const belt  = gameState.value.followerBelt
    const staging = gameState.value.stagingArea
    const idx = belt.hand.findIndex(c => c.instanceId === cardInstanceId)
    if (idx === -1) return false
    if (staging.slots.length >= staging.maxSlots) return false   // 暫存區已滿

    const card = belt.hand.splice(idx, 1)[0]
    staging.slots.push({
      instanceId:   `staged_${gameState.value.tick}_${Math.random().toString(36).slice(2, 6)}`,
      followerCard: card,
      traits:       [],
      maxTraits:    2,
    })
    return true
  }

  // ─── Trait 帶：疊加到暫存從者 ────────────────────────────────────────────
  function applyTraitToStaged(traitCardId: string, stagedInstanceId: string): boolean {
    if (!gameState.value) return false
    const belt    = gameState.value.traitBelt
    const staging = gameState.value.stagingArea
    const traitIdx = belt.hand.findIndex(c => c.instanceId === traitCardId)
    if (traitIdx === -1) return false
    const staged = staging.slots.find(s => s.instanceId === stagedInstanceId)
    if (!staged || staged.traits.length >= staged.maxTraits) return false

    const traitCard = belt.hand.splice(traitIdx, 1)[0]
    staged.traits.push(traitCard.traitId)
    return true
  }

  // ─── 暫存區：召喚到小隊 ──────────────────────────────────────────────────
  function summonStagedFollower(stagedInstanceId: string, squadId: string): boolean {
    if (!gameState.value) return false
    const staging = gameState.value.stagingArea
    const idx = staging.slots.findIndex(s => s.instanceId === stagedInstanceId)
    if (idx === -1) return false
    const staged = staging.slots[idx]

    const fDef = followerDefs.find(f => f.id === staged.followerCard.followerDefId)
    if (!fDef) return false

    const squad = gameState.value.squads[squadId]
    if (!squad || squad.team !== 'player') return false

    if (gameState.value.resources.mana < fDef.productionCost) return false
    const alive = squad.shieldLayers.filter(s => !s.isDead)
    if (alive.length >= squad.maxShieldSlots) return false

    gameState.value.resources.mana -= fDef.productionCost
    squad.shieldLayers.push({
      instanceId:    `shield_${gameState.value.tick}_${Math.random().toString(36).slice(2, 6)}`,
      followerDefId: staged.followerCard.followerDefId,
      hp:            fDef.shieldHp,
      maxHp:         fDef.shieldHp,
      atb:           0,
      isDead:        false,
      statusEffects: [],
      traits:        [...staged.traits],
      chargeReady:   false,
    })
    staging.slots.splice(idx, 1)
    return true
  }

  // ─── 從者帶：丟棄手牌 ────────────────────────────────────────────────────
  function discardFollower(cardInstanceId: string) {
    if (!gameState.value) return
    const belt = gameState.value.followerBelt
    const idx  = belt.hand.findIndex(c => c.instanceId === cardInstanceId)
    if (idx !== -1) belt.hand.splice(idx, 1)
  }

  // ─── Trait 帶：丟棄手牌 ──────────────────────────────────────────────────
  function discardTrait(cardInstanceId: string) {
    if (!gameState.value) return
    const belt = gameState.value.traitBelt
    const idx  = belt.hand.findIndex(c => c.instanceId === cardInstanceId)
    if (idx !== -1) belt.hand.splice(idx, 1)
  }

  // ─── 暫存區：移除暫存從者 ────────────────────────────────────────────────
  function discardStaged(stagedInstanceId: string) {
    if (!gameState.value) return
    const staging = gameState.value.stagingArea
    const idx = staging.slots.findIndex(s => s.instanceId === stagedInstanceId)
    if (idx !== -1) staging.slots.splice(idx, 1)
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
    selectedSummonerCardIds,
    gameState,
    speedMultiplier,
    startBattle, stopTicking, setSpeed,
    setSquadRoute, setSquadBehavior,
    stageFollower, applyTraitToStaged, summonStagedFollower,
    discardFollower, discardTrait, discardStaged,
    playerSquads, enemySquads,
    captainDefs, followerDefs, captainCards, summonerCards, traitDefs,
  }
})
