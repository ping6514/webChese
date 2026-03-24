<template>
  <div class="selection-bar" v-if="game.selection">
    <span class="prompt">👆 {{ game.selection.prompt }}</span>
    <div class="zone-btns" v-if="game.selection.validZones.length > 0">
      <button
        v-for="z in game.selection.validZones"
        :key="z"
        class="zone-btn"
        @click="game.selectZone(z)"
      >{{ zoneLabel(z) }}</button>
    </div>
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
</script>

<style scoped>
.selection-bar {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  background: #0d3b2e; border: 1px solid #00ff99; border-radius: 8px;
  padding: 0.5rem 0.8rem; font-size: 0.85rem;
}
.prompt { color: #00ff99; font-weight: bold; flex: 1; }
.zone-btn, .area-btn {
  padding: 0.3rem 0.8rem; background: #1a5c45; border: 1px solid #00ff99;
  color: #eee; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
}
.zone-btn:hover, .area-btn:hover { background: #267a5e; }
.cancel-btn {
  padding: 0.3rem 0.8rem; background: #4a1010; border: 1px solid #8b0000;
  color: #eee; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
}
</style>
