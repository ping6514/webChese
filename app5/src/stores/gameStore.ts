import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, SquadInstance, AIConfig } from '../engine/types'
import { captainDefs, followerDefs, DEFAULT_AI_CONFIG } from '../data/testSquads'
import { createTestMap } from '../engine/mapData'
import { stepGame, isSquadAlive } from '../engine/squadEngine'

export const useGameStore = defineStore('game', () => {
  // ─── 備戰編隊狀態 ──────────────────────────────────────────────────────────
  const playerSquadConfigs = ref<{
    captainId: string
    followerIds: string[]
    skills: string[]
    aiConfig: AIConfig
  }[]>([
    // 預設測試隊伍
    {
      captainId: 'captain_infantry_a',
      followerIds: ['follower_infantry_a', 'follower_infantry_white'],
      skills: [],
      aiConfig: { moveSequence: ['front_mid', 'center', 'enemy_base'], loopSequence: false, alertRange: 2, targetPriority: ['nearest', 'lowest_hp', 'most_members'], actionPriority: ['attack', 'capture', 'move'], autoSP: false },
    },
    {
      captainId: 'captain_cavalry_a',
      followerIds: ['follower_cavalry_a'],
      skills: [],
      aiConfig: { moveSequence: ['front_mid', 'center', 'enemy_base'], loopSequence: false, alertRange: 2, targetPriority: ['nearest', 'lowest_hp', 'most_members'], actionPriority: ['attack', 'move', 'capture'], autoSP: false },
    },
    {
      captainId: 'captain_infantry_b',
      followerIds: ['follower_heavy_a', 'follower_infantry_white'],
      skills: [],
      aiConfig: { moveSequence: ['front_mid', 'center'], loopSequence: true, alertRange: 1, targetPriority: ['nearest', 'most_members', 'lowest_hp'], actionPriority: ['capture', 'attack', 'move'], autoSP: false },
    },
  ])

  // ─── 戰場狀態 ──────────────────────────────────────────────────────────────
  const gameState = ref<GameState | null>(null)
  const tickInterval = ref<number | null>(null)
  const speedMultiplier = ref(1)

  // ─── 備戰操作 ──────────────────────────────────────────────────────────────
  function addSquad(captainId: string) {
    if (playerSquadConfigs.value.length >= 3) return
    playerSquadConfigs.value.push({
      captainId,
      followerIds: [],
      skills: [],
      aiConfig: { ...DEFAULT_AI_CONFIG },
    })
  }

  function removeSquad(index: number) {
    playerSquadConfigs.value.splice(index, 1)
  }

  function addFollower(squadIndex: number, followerId: string) {
    const squad = playerSquadConfigs.value[squadIndex]
    const captain = captainDefs.find(c => c.id === squad.captainId)
    if (!captain) return
    if (squad.followerIds.length >= captain.maxFollowerSlots) return
    squad.followerIds.push(followerId)
  }

  function removeFollower(squadIndex: number, followerIndex: number) {
    playerSquadConfigs.value[squadIndex].followerIds.splice(followerIndex, 1)
  }

  function updateAIConfig(squadIndex: number, config: Partial<AIConfig>) {
    Object.assign(playerSquadConfigs.value[squadIndex].aiConfig, config)
  }

  // ─── 建立小隊實例 ────────────────────────────────────────────────────────
  function buildSquadInstance(
    squadId: string,
    captainId: string,
    followerIds: string[],
    skills: string[],
    aiConfig: AIConfig,
    team: 'player' | 'enemy',
    startPos: { q: number; r: number }
  ): SquadInstance {
    const captainDef = captainDefs.find(c => c.id === captainId)!
    const captainMember: MemberInstance = {
      instanceId: `${squadId}_captain`,
      defId: captainId,
      isCaptain: true,
      hp: captainDef.stats.hp,
      maxHp: captainDef.stats.hp,
      atb: 0,
      statusEffects: [],
      buildupAccum: { poison: 0, armorBreak: 0, slow: 0 },
      isDead: false,
      blockPriority: captainDef.stats.blockPriority,
    }

    const followerMembers: MemberInstance[] = followerIds.map((fid, i) => {
      const fDef = followerDefs.find(f => f.id === fid)!
      return {
        instanceId: `${squadId}_follower_${i}`,
        defId: fid,
        isCaptain: false,
        hp: fDef.stats.hp,
        maxHp: fDef.stats.hp,
        atb: 0,
        statusEffects: [],
        buildupAccum: { poison: 0, armorBreak: 0, slow: 0 },
        isDead: false,
        blockPriority: fDef.stats.blockPriority,
      }
    })

    return {
      squadId,
      team,
      captainDefId: captainId,
      followerDefIds: followerIds,
      members: [captainMember, ...followerMembers],
      pos: startPos,
      state: 'idle',
      sp: 0,
      aiConfig,
      installedSkills: skills.map(s => ({ skillId: s, level: 1 })),
      spBuffActive: false,
      spBuffType: null,
      commandCooldownRemaining: 0,
      reviveAtTick: null,
      manualTargetPos: null,
      spawnPos: startPos,
    }
  }

  // ─── 戰鬥中指定移動目標 ──────────────────────────────────────────────────
  function setManualTarget(squadId: string, pos: { q: number; r: number } | null) {
    if (!gameState.value) return
    const squad = gameState.value.squads[squadId]
    if (squad) squad.manualTargetPos = pos
  }

  // ─── 開始戰鬥 ────────────────────────────────────────────────────────────
  function startBattle() {
    const cells = createTestMap()

    const squads: Record<string, SquadInstance> = {}

    // 玩家小隊
    playerSquadConfigs.value.forEach((config, i) => {
      const squadId = `player_squad_${i}`
      const startPos = { q: 1, r: 1 + i }
      squads[squadId] = buildSquadInstance(
        squadId, config.captainId, config.followerIds,
        config.skills, config.aiConfig, 'player', startPos
      )
    })

    // 固定敵方配置（3 支步兵小隊，被動警戒）
    const enemyConfigs = [
      { captainId: 'captain_infantry_b', followerIds: ['follower_infantry_white', 'follower_infantry_white'], pos: { q: 7, r: 1 } },
      { captainId: 'captain_infantry_a', followerIds: ['follower_infantry_a'], pos: { q: 6, r: 3 } },
      { captainId: 'captain_infantry_b', followerIds: ['follower_heavy_a'], pos: { q: 7, r: 4 } },
    ]

    enemyConfigs.forEach((cfg, i) => {
      const squadId = `enemy_squad_${i}`
      const enemyAI: AIConfig = {
        moveSequence: [],          // 空移動序列 = 不主動移動
        loopSequence: false,
        alertRange: 2,
        targetPriority: ['nearest'],
        actionPriority: ['attack', 'capture', 'move'],
        autoSP: false,
      }
      squads[squadId] = buildSquadInstance(
        squadId, cfg.captainId, cfg.followerIds,
        [], enemyAI, 'enemy', cfg.pos
      )
    })

    gameState.value = {
      phase: 'running',
      tick: 0,
      squads,
      cells,
      ddzList: [],
      playerBase: { hp: 500, maxHp: 500 },
      enemyBase: { hp: 500, maxHp: 500 },
      log: ['戰鬥開始'],
    }

    startTicking()
  }

  // ─── ATB ticking ────────────────────────────────────────────────────────
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
    if (tickInterval.value) {
      stopTicking()
      startTicking()
    }
  }

  // ─── Getters ─────────────────────────────────────────────────────────────
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
    playerSquadConfigs,
    gameState,
    speedMultiplier,
    addSquad, removeSquad, addFollower, removeFollower, updateAIConfig,
    startBattle, stopTicking, setSpeed, setManualTarget,
    playerSquads, enemySquads,
    captainDefs, followerDefs,
  }
})
