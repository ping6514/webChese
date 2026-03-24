<template>
  <div class="hand-panel">
    <div class="hand-title">手牌（{{ currentPlayerLabel }}：{{ hand.length }} 張）</div>
    <div class="hand-cards">
      <div
        v-for="(cardId, i) in hand"
        :key="i"
        class="hand-card"
        :class="cardType(cardId)"
        :title="cardTooltip(cardId)"
        @click="onCardClick(cardId)"
      >
        <span class="card-name">{{ cardDisplayName(cardId) }}</span>
        <span class="card-type-badge">{{ cardTypeLabel(cardId) }}</span>
      </div>
    </div>
    <div class="graveyard-info">
      墓地：{{ graveyard.length }} 張 / 牌組：{{ deck.length }} 張
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { bgCardById } from '../data/bg-cards'
import { reactionById } from '../data/reactions'
import { eventById } from '../data/events'
import { buildingById } from '../data/buildings'
import type { ZoneId, BrickAreaId } from '../engine'
import { opponentOf, homeZone, areAdjacent } from '../engine'

const game = useGameStore()
const gs = computed(() => game.state!)
const cp = computed(() => gs.value.currentPlayer)
const currentPlayerLabel = computed(() => cp.value === 'p1' ? 'P1' : 'P2')

const hand = computed(() => gs.value.players[cp.value].hand)
const graveyard = computed(() => gs.value.players[cp.value].graveyard)
const deck = computed(() => gs.value.players[cp.value].deck)

function cardDisplayName(id: string): string {
  if (id === 'skill_card') return '技能牌'
  return reactionById[id]?.name
    ?? eventById[id]?.name
    ?? buildingById[id]?.name
    ?? id
}

function cardType(id: string): string {
  if (id === 'skill_card') return 'type-skill'
  if (reactionById[id]) return 'type-reaction'
  if (eventById[id]) return 'type-event'
  if (buildingById[id]) return 'type-building'
  return 'type-unknown'
}

function cardTypeLabel(id: string): string {
  if (id === 'skill_card') return '技'
  if (reactionById[id]) return '反'
  if (eventById[id]) return '事'
  if (buildingById[id]) return '建'
  return '?'
}

function cardTooltip(id: string): string {
  if (id === 'skill_card') return '技能牌：作為技能費用使用'
  return reactionById[id]?.description
    ?? eventById[id]?.description
    ?? buildingById[id]?.description
    ?? id
}

function onCardClick(cardId: string) {
  // PVE模式：Bot回合時不允許人類操作
  if (game.pveMode && cp.value !== game.localPlayer) return

  const s = gs.value
  const p = cp.value
  const enemy = opponentOf(p)

  if (s.phase === 'main') {
    // RUSH TIME — 無需選目標
    if (cardId === 'rush_time') {
      if (!s.rushTimeUsed && s.cityWalls[p] <= s.cityWalls[enemy] - 2)
        game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: {} })
      return
    }

    // 氣合 — 選我方BG
    if (cardId === 'fighting_spirit') {
      const valid = Object.values(s.bgs).filter(bg => bg.owner === p && bg.state !== 'ko').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection('選擇一位我方BG（氣合：+4堅韌1回合）', valid, bgId =>
          game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId: bgId } }))
      return
    }

    // 搖桿失靈 — 選敵BG
    if (cardId === 'joystick_fail') {
      const valid = Object.values(s.bgs).filter(bg => bg.owner === enemy && bg.state === 'normal').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection('選擇一位敵BG（搖桿失靈：1回合不能移動）', valid, bgId =>
          game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId: bgId } }))
      return
    }

    // 回家 — 選任意非KO BG
    if (cardId === 'go_home') {
      const valid = Object.values(s.bgs).filter(bg => bg.state !== 'ko').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection('選擇一位非KO的BG（回家：移到我方主堡並恢復正常）', valid, bgId =>
          game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId: bgId } }))
      return
    }

    // 看穿 — 選敵BG
    if (cardId === 'see_through') {
      const withReaction = Object.values(s.bgs).filter(bg => bg.owner === enemy && bg.reactionCard && bg.state !== 'ko').map(bg => bg.id)
      const valid = withReaction.length > 0
        ? withReaction
        : Object.values(s.bgs).filter(bg => bg.owner === enemy && bg.state !== 'ko').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection('選擇一位敵BG（看穿：移除其反應卡）', valid, bgId =>
          game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId: bgId } }))
      return
    }

    // 最佳拍檔 — 選區域
    if (cardId === 'best_partner') {
      const zones: ZoneId[] = [homeZone(p), 'plaza', homeZone(enemy)]
      const validZones = zones.filter(z =>
        Object.values(s.bgs).filter(bg => bg.owner === p && bg.zone === z && bg.state !== 'ko').length >= 2
      )
      const targetZones = validZones.length > 0 ? validZones : zones
      game.requestZoneSelection('選擇一個區域（最佳拍檔：區域內我方BG協助+3）', targetZones, zone =>
        game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetZone: zone } }))
      return
    }

    // 呼朋引伴 — 2步選擇
    if (cardId === 'call_friends') {
      const myBGs = Object.values(s.bgs).filter(bg => bg.owner === p && bg.state !== 'ko')
      if (myBGs.length >= 2) {
        game.requestBGSelection('選擇目標BG（呼朋引伴：哪個BG的區域是目的地）', myBGs.map(bg => bg.id), targetBGId => {
          const targetBG = s.bgs[targetBGId]
          const movable = myBGs.filter(bg => bg.id !== targetBGId && areAdjacent(bg.zone, targetBG.zone))
          if (movable.length > 0) {
            game.requestBGSelection('選擇要移動過來的我方BG', movable.map(bg => bg.id), moveBGId =>
              game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId, targetBGId2: moveBGId } }))
          } else {
            const other = myBGs.find(bg => bg.id !== targetBGId)
            if (other)
              game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { targetBGId, targetBGId2: other.id } })
          }
        })
      }
      return
    }

    // 反應大師 — 自動選捨棄牌（非反應卡優先）
    if (cardId === 'reaction_master') {
      const currentHand = s.players[p].hand
      if (currentHand.length >= 2) {
        const discardCardId = currentHand.find(id => id !== 'reaction_master' && !reactionById[id]) ?? currentHand.find(id => id !== 'reaction_master')
        if (discardCardId)
          game.dispatchForCurrentPlayer({ type: 'PLAY_EVENT', cardId, params: { discardCardId } })
      }
      return
    }

    // 建築卡 — 選區域
    if (buildingById[cardId]) {
      const def = buildingById[cardId]
      const validAreas: BrickAreaId[] = []
      for (const aType of def.placeable) {
        const areaId = `${p}_${aType}` as BrickAreaId
        if (game.canAct({ type: 'PLAY_BUILDING', cardId, areaId }, p))
          validAreas.push(areaId)
      }
      if (validAreas.length === 1) {
        game.dispatchForCurrentPlayer({ type: 'PLAY_BUILDING', cardId, areaId: validAreas[0] })
      } else if (validAreas.length > 1) {
        game.requestAreaSelection(`選擇放置「${def.name}」的位置`, validAreas, areaId =>
          game.dispatchForCurrentPlayer({ type: 'PLAY_BUILDING', cardId, areaId }))
      }
      return
    }

  } else if (s.phase === 'react') {
    // 反應卡 — 選我方BG安裝
    if (reactionById[cardId]) {
      const valid = Object.values(s.bgs).filter(bg => bg.owner === p && bg.state !== 'ko').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection(`選擇安裝「${reactionById[cardId].name}」的BG`, valid, bgId =>
          game.dispatchForCurrentPlayer({ type: 'INSTALL_REACTION', bgId, cardId }))
    }
  }
}
</script>

<style scoped>
.hand-panel { }
.hand-title { font-size: 0.85rem; color: #aaa; margin-bottom: 0.5rem; }
.hand-cards { display: flex; flex-wrap: wrap; gap: 0.4rem; min-height: 60px; }
.hand-card {
  padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: transform 0.15s; border: 1px solid #333; min-width: 60px;
}
.hand-card:hover { transform: translateY(-3px); border-color: #9ad4d6; }
.card-name { font-size: 0.7rem; text-align: center; }
.card-type-badge { font-size: 0.6rem; opacity: 0.7; }
.type-skill { background: #2a2a5a; }
.type-reaction { background: #1a3a1a; }
.type-event { background: #3a2800; }
.type-building { background: #2a1a3a; }
.type-unknown { background: #333; }
.graveyard-info { margin-top: 0.4rem; font-size: 0.75rem; color: #666; }
</style>
