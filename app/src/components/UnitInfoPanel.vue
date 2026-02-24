<script lang="ts">
import { defineComponent } from 'vue'
import type { PieceBase } from '../engine'

type EnchantSoulLite = {
  id: string
  name: string
  image?: string
}

type UnitLite = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  pos: { x: number; y: number }
  hpCurrent: number
  atk: { key: string; value: number }
  def: { key: string; value: number }[]
  enchant?: { soulId: string }
}

export default defineComponent({
  name: 'UnitInfoPanel',
  props: {
    unit: { type: Object as () => UnitLite | null, required: true },
    enchantSoul: { type: Object as () => EnchantSoulLite | null, required: true },
  },
  emits: ['show-soul-detail'],
})
</script>

<template>
  <div>
    <h2>Unit</h2>
    <div v-if="unit" class="unitCard">
      <div class="mono">id: {{ unit.id }}</div>
      <div class="mono">side: {{ unit.side }}</div>
      <div class="mono">base: {{ unit.base }}</div>
      <div class="mono">pos: ({{ unit.pos.x }},{{ unit.pos.y }})</div>
      <div class="mono">hp: {{ unit.hpCurrent }}</div>
      <div class="mono">atk: {{ unit.atk.key }} {{ unit.atk.value }}</div>
      <div class="mono">def: {{ unit.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
      <div class="mono">soul: {{ unit.enchant?.soulId ?? '-' }}</div>

      <div v-if="enchantSoul" class="enchantRow">
        <button type="button" class="linkBtn" @click="$emit('show-soul-detail', enchantSoul.id)">
          {{ enchantSoul.name }}
        </button>
        <img v-if="enchantSoul.image" class="enchantImg" :src="enchantSoul.image" alt="" />
      </div>
    </div>
    <div v-else class="muted">Select a unit on the board.</div>
  </div>
</template>

<style scoped>
.unitCard {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.enchantRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}

.linkBtn {
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(145, 202, 255, 0.95);
  text-align: left;
  cursor: pointer;
}

.linkBtn:hover {
  text-decoration: underline;
}

.enchantImg {
  width: 42px;
  height: 58px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.muted {
  opacity: 0.75;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
