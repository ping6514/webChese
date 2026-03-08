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

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

const ATK_LABEL: Record<string, string> = {
  magic: '魔', phys: '物理', true: '穿透',
}

export default defineComponent({
  name: 'UnitInfoPanel',
  props: {
    unit: { type: Object as () => UnitLite | null, default: null },
    enchantSoul: { type: Object as () => EnchantSoulLite | null, default: null },
    baseImage: { type: String as () => string | undefined, required: false, default: undefined },
  },
  emits: ['show-soul-detail'],
  methods: {
    baseLabel(b: string) { return BASE_LABEL[b] ?? b },
    atkLabel(k: string) { return ATK_LABEL[k] ?? k },
  },
})
</script>

<template>
  <div class="unitPanel">
    <div class="sectionTitle">⚔️ 選中單位</div>

    <div v-if="unit" class="unitCard">
      <div class="cardLeft">
        <img
          v-if="enchantSoul?.image"
          class="soulImg"
          :src="enchantSoul.image"
          alt=""
          @click="$emit('show-soul-detail', enchantSoul!.id)"
        />
        <img
          v-else-if="baseImage"
          class="soulImg baseImg"
          :src="baseImage"
          alt=""
        />
        <div v-else class="soulImgEmpty">
          <span class="baseChar">{{ baseLabel(unit.base) }}</span>
        </div>
        <div v-if="enchantSoul" class="soulName linkBtn" @click="$emit('show-soul-detail', enchantSoul.id)">
          {{ enchantSoul.name }}
        </div>
        <div v-else class="soulName muted">無靈魂</div>
      </div>

      <div class="cardRight">
        <div class="hpRow">
          <span class="hpIcon">❤️</span>
          <span class="hpNum" :class="unit.side === 'red' ? 'red' : 'green'">{{ unit.hpCurrent }}</span>
          <span class="hpLabel">HP</span>
        </div>
        <div class="statRow">
          <span class="statLabel">陣營</span>
          <span class="statVal" :class="unit.side === 'red' ? 'red' : 'green'">
            {{ unit.side === 'red' ? '🔴 紅方' : '🟢 黑方' }}
          </span>
        </div>
        <div class="statRow">
          <span class="statLabel">基底</span>
          <span class="statVal">{{ baseLabel(unit.base) }}</span>
        </div>
        <div class="statRow">
          <span class="statLabel">⚔️ 攻</span>
          <span class="statVal">{{ atkLabel(unit.atk.key) }} {{ unit.atk.value }}</span>
        </div>
        <div class="statRow">
          <span class="statLabel">🛡️ 防</span>
          <span class="statVal">{{ unit.def.map(d => `${atkLabel(d.key)} ${d.value}`).join(' / ') }}</span>
        </div>
        <div class="statRow">
          <span class="statLabel">📍 位置</span>
          <span class="statVal mono">({{ unit.pos.x }}, {{ unit.pos.y }})</span>
        </div>
      </div>
    </div>

    <div v-else class="empty">點擊棋盤上的單位</div>
  </div>
</template>

<style scoped>
.unitPanel { display: grid; gap: 8px; }

.sectionTitle {
  font-size: 0.75rem;
  font-weight: 800;
  opacity: 0.65;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.unitCard {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--bg-surface-1);
}

.cardLeft {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.soulImg {
  width: 72px;
  height: 96px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--border-strong);
}

.baseImg {
  cursor: default;
  opacity: 0.7;
  cursor: pointer;
  transition: border-color 0.2s;
}
.soulImg:hover { border-color: rgba(145, 202, 255, 0.7); }

.soulImgEmpty {
  width: 72px;
  height: 96px;
  border-radius: 10px;
  border: 1px dashed var(--border-strong);
  display: grid;
  place-items: center;
  background: var(--bg-surface-2);
}
.baseChar { font-size: 2rem; font-weight: 900; opacity: 0.55; }

.soulName {
  font-size: 0.6875rem;
  font-weight: 700;
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
}
.linkBtn {
  color: var(--accent-blue);
  cursor: pointer;
}
.linkBtn:hover { text-decoration: underline; }
.muted { color: var(--text-dim); }

.cardRight {
  display: flex;
  flex-direction: column;
  gap: 7px;
  justify-content: center;
}

.hpRow {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-bottom: 2px;
}
.hpIcon { font-size: 0.9375rem; }
.hpNum {
  font-size: 1.875rem;
  font-weight: 900;
  line-height: 1;
}
.hpNum.red { color: #ff9c9e; }
.hpNum.green { color: #95de64; }
.hpLabel { font-size: 0.8125rem; opacity: 0.65; font-weight: 600; }

.statRow {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.statLabel {
  font-size: 0.75rem;
  opacity: 0.55;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 3.25rem;
}
.statVal {
  font-size: 0.8125rem;
  font-weight: 700;
}
.statVal.red { color: #ff9c9e; }
.statVal.green { color: #95de64; }

.empty { font-size: 0.8125rem; opacity: 0.45; padding: 8px 0; }

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
