<template>
  <div class="selection-bar" v-if="game.selection">
    <span class="prompt">👆 {{ game.selection.prompt }}</span>

    <!-- BG 選擇按鈕 -->
    <div class="bg-btns" v-if="game.selection.validBGIds.length > 0">
      <button
        v-for="bgId in game.selection.validBGIds"
        :key="bgId"
        class="bg-btn"
        :class="bgOwnerClass(bgId)"
        @click="game.selectBG(bgId)"
      >{{ bgLabel(bgId) }}</button>
    </div>

    <!-- 區域按鈕 -->
    <div class="zone-btns" v-if="game.selection.validZones.length > 0">
      <button
        v-for="z in game.selection.validZones"
        :key="z"
        class="zone-btn"
        @click="game.selectZone(z)"
      >{{ zoneLabel(z) }}</button>
    </div>

    <!-- 磚堆區按鈕 -->
    <div class="area-btns" v-if="game.selection.validAreaIds.length > 0">
      <button
        v-for="a in game.selection.validAreaIds"
        :key="a"
        class="area-btn"
        @click="game.selectArea(a)"
      >{{ areaLabel(a) }}</button>
    </div>

    <button class="cancel-btn" @click="game.cancelSelection()">取消</button>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game'
import type { ZoneId, BrickAreaId } from '../engine'

const game = useGameStore()

const zoneLabels: Record<ZoneId, string> = {
  p1_base: 'P1主堡', plaza: '廣場', p2_base: 'P2主堡',
}
function zoneLabel(z: ZoneId) { return zoneLabels[z] ?? z }

function areaLabel(a: BrickAreaId) {
  const map: Record<BrickAreaId, string> = {
    p1_base: 'P1主堡磚', p1_plaza: 'P1廣場磚',
    p2_base: 'P2主堡磚', p2_plaza: 'P2廣場磚',
  }
  return map[a] ?? a
}

function bgLabel(bgId: string): string {
  const bg = game.state?.bgs[bgId]
  if (!bg) return bgId
  const zone: Record<string, string> = { p1_base: 'P1堡', plaza: '廣場', p2_base: 'P2堡' }
  return `${bg.name}（${zone[bg.zone] ?? bg.zone}）`
}

function bgOwnerClass(bgId: string): string {
  const bg = game.state?.bgs[bgId]
  return bg?.owner === 'p2' ? 'bg-btn-p2' : 'bg-btn-p1'
}
</script>

<style scoped>
.selection-bar {
  display: flex; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;
  background: #eaf4ee; border: 2px solid #007a50; border-radius: 8px;
  padding: 0.6rem 0.8rem; font-size: 0.85rem;
}
.prompt { color: #007a50; font-weight: bold; width: 100%; margin-bottom: 0.2rem; }
.bg-btns, .zone-btns, .area-btns { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.bg-btn, .zone-btn, .area-btn {
  padding: 0.3rem 0.8rem; border: 1px solid #007a50;
  color: #2a1f14; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
}
.bg-btn-p1 { background: #d8e8f8; border-color: #1a5090; }
.bg-btn-p2 { background: #f8d8e0; border-color: #901a3a; }
.bg-btn:hover { filter: brightness(0.93); }
.zone-btn, .area-btn { background: #d8f0e8; }
.zone-btn:hover, .area-btn:hover { background: #c0e4d4; }
.cancel-btn {
  padding: 0.3rem 0.8rem; background: #f0d8d8; border: 1px solid #c07070;
  color: #7a1010; border-radius: 4px; cursor: pointer; font-size: 0.8rem; margin-left: auto;
}
</style>
