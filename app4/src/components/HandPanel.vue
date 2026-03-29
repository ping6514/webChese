<template>
  <div class="hand-panel">
    <div v-if="game.pendingReactionMaster?.discardCardId === ''" class="rm-hint">
      ⬇ 點選要捨棄的手牌（反應大師）
    </div>
    <div class="hand-title">手牌（{{ currentPlayerLabel }}：{{ hand.length }} 張）</div>
    <div class="hand-cards">
      <div
        v-for="(cardId, i) in hand"
        :key="i"
        class="hand-card"
        :class="[cardType(cardId), {
          'discard-selected': isDiscardSelected(cardId, i),
          'discard-mode': !!game.pendingSkill || isReactionMasterDiscardMode(cardId),
          'rm-discard-target': isReactionMasterDiscardMode(cardId),
        }]"
        :title="cardTooltip(cardId)"
        @click="onCardClick(cardId, i)"
      >
        <div class="hand-card-art">
          <img
            :src="cardImageSrc(cardId)"
            :alt="cardDisplayName(cardId)"
            class="hand-card-img"
            @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
          />
        </div>
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
// pendingSkill from store is needed for discard mode
import { useGameStore } from '../stores/game'
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
  return reactionById[id]?.name
    ?? eventById[id]?.name
    ?? buildingById[id]?.name
    ?? id
}

function cardType(id: string): string {
  if (reactionById[id]) return 'type-reaction'
  if (eventById[id]) return 'type-event'
  if (buildingById[id]) return 'type-building'
  return 'type-unknown'
}

function cardTypeLabel(id: string): string {
  if (reactionById[id]) return '反'
  if (eventById[id]) return '事'
  if (buildingById[id]) return '建'
  return '?'
}

function cardImageSrc(id: string): string {
  if (reactionById[id]) return `/assets/cards/reaction/${id}.png`
  if (eventById[id]) return `/assets/cards/event/${id}.png`
  if (buildingById[id]) return `/assets/cards/building/${id}.png`
  return ''
}

function cardTooltip(id: string): string {
  return reactionById[id]?.description
    ?? eventById[id]?.description
    ?? buildingById[id]?.description
    ?? id
}

function isDiscardSelected(cardId: string, index: number): boolean {
  const ps = game.pendingSkill
  if (!ps) return false
  return ps.selected.includes(`${index}:${cardId}`)
}

function isReactionMasterDiscardMode(cardId: string): boolean {
  return !!game.pendingReactionMaster &&
    game.pendingReactionMaster.discardCardId === '' &&
    cardId !== 'reaction_master'
}

function onCardClick(cardId: string, index: number = 0) {
  // 反應大師：選要捨棄的手牌
  if (game.pendingReactionMaster && game.pendingReactionMaster.discardCardId === '') {
    if (cardId !== 'reaction_master') {
      game.pendingReactionMaster.discardCardId = cardId
    }
    return
  }

  // 棄牌選擇模式
  if (game.pendingSkill) {
    const ps = game.pendingSkill
    const key = `${index}:${cardId}`
    const idx = ps.selected.indexOf(key)
    if (idx >= 0) {
      ps.selected.splice(idx, 1)
    } else if (ps.selected.length < ps.handCost) {
      ps.selected.push(key)
    }
    return
  }

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

    // 回家 — 只能選我方非KO BG
    if (cardId === 'go_home') {
      const valid = Object.values(s.bgs).filter(bg => bg.owner === p && bg.state !== 'ko').map(bg => bg.id)
      if (valid.length > 0)
        game.requestBGSelection('選擇一位我方非KO的BG（回家：移到我方主堡並恢復正常）', valid, bgId =>
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

    // 反應大師 — 開啟選擇 modal
    if (cardId === 'reaction_master') {
      const ps = s.players[p]
      const otherHand = ps.hand.filter(id => id !== 'reaction_master')
      if (otherHand.length === 0) return
      // 收集牌組+墓地中的反應卡（同 id 只顯示一次）
      const available: { id: string; name: string; source: 'deck' | 'graveyard' }[] = []
      const seen = new Set<string>()
      for (const id of ps.deck) {
        if (reactionById[id] && !seen.has(id)) {
          seen.add(id); available.push({ id, name: reactionById[id].name, source: 'deck' })
        }
      }
      for (const id of ps.graveyard) {
        if (reactionById[id] && !seen.has(id)) {
          seen.add(id); available.push({ id, name: reactionById[id].name, source: 'graveyard' })
        }
      }
      if (available.length === 0) return
      // 只有1張可捨棄時自動選定，直接進第2步；否則先讓玩家選
      const autoDiscard = otherHand.length === 1 ? otherHand[0] : ''
      game.pendingReactionMaster = { discardCardId: autoDiscard, availableCards: available }
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
.rm-hint {
  background: #fff3e0; border: 1px solid #e07000; border-radius: 6px;
  padding: 0.3rem 0.7rem; font-size: 0.82rem; color: #5a3000;
  margin-bottom: 0.4rem; font-weight: bold;
}
.hand-card.rm-discard-target { border-color: #e07000; outline: 2px dashed #e07000; }
.hand-card.rm-discard-target:hover { border-color: #c04000; background: #fff0d8; }
.hand-title { font-size: 0.85rem; color: #7a6a58; margin-bottom: 0.5rem; }
.hand-cards { display: flex; flex-wrap: wrap; gap: 0.4rem; min-height: 60px; }
.hand-card {
  padding: 0.3rem 0.4rem; border-radius: 6px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  transition: transform 0.15s; border: 1px solid #c0b5a5; min-width: 60px; color: #2a1f14;
}
.hand-card:hover { transform: translateY(-3px); border-color: #1a8090; }
.hand-card.discard-mode { cursor: crosshair; }
.hand-card.discard-mode:hover { border-color: #c04000; }
.hand-card.discard-selected { border: 2px solid #c04000; background: #f8d8c8; transform: translateY(-4px); box-shadow: 0 0 8px rgba(192,64,0,0.5); }
.hand-card-art {
  width: 56px; height: 56px; overflow: hidden; border-radius: 4px;
  background: #c8bfb0; display: flex; align-items: center; justify-content: center;
}
.hand-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.card-name { font-size: 0.7rem; text-align: center; }
.card-type-badge { font-size: 0.6rem; opacity: 0.7; }
.type-reaction { background: #d8e8d8; }
.type-event { background: #e8e0c8; }
.type-building { background: #e0d8e8; }
.type-unknown { background: #ddd5c8; }
.graveyard-info { margin-top: 0.4rem; font-size: 0.75rem; color: #9a8a78; }
</style>
