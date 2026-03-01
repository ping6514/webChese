<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, PieceBase, ShotPreviewEffect } from '../engine'

type UnitPreview = {
  id: string
  side: 'red' | 'black'
  base: PieceBase
  pos: { x: number; y: number }
  hpCurrent: number
  atk: { key: string; value: number }
  def: { key: string; value: number }[]
  name: string
  image: string | null
}

const BASE_LABEL: Record<string, string> = {
  king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
}

export default defineComponent({
  name: 'ShootPreviewModal',
  props: {
    open: { type: Boolean, required: true },
    attacker: { type: Object as () => UnitPreview | null, required: true },
    target: { type: Object as () => UnitPreview | null, required: true },
    guard: { type: Object as () => GuardResult, required: true },
    rawDamage: { type: Number as () => number | null, required: false, default: null },
    damageToTarget: { type: Number as () => number | null, required: false, default: null },
    shared: {
      type: Object as () => { toUnitId: string; amount: number } | null,
      required: false,
      default: null,
    },
    effects: {
      type: Array as () => ShotPreviewEffect[],
      required: false,
      default: () => [],
    },
  },
  emits: ['confirm', 'cancel'],
  methods: {
    baseLabel(base: string): string { return BASE_LABEL[base] ?? base },
    effectText(e: ShotPreviewEffect): string {
      if (e.kind === 'DAMAGE_SHARE') return `傷害分攤：${e.amount}（由 ${e.byUnitId} 承擔）`
      if (e.kind === 'DAMAGE_BONUS') return `傷害加成：+${e.amount}（來源 ${e.byUnitId}）`
      if (e.kind === 'AURA_IGNORE_BLOCKING_ALL') return `光環：無視阻擋（全部）（來源 ${e.byUnitId}）`
      if (e.kind === 'AURA_IGNORE_BLOCKING_COUNT') return `光環：無視阻擋（${(e as any).count} 個）（來源 ${e.byUnitId}）`
      if (e.kind === 'IGNORE_BLOCKING_ALL') return `無視阻擋（全部）（來源 ${e.byUnitId}）`
      if (e.kind === 'IGNORE_BLOCKING_COUNT') return `無視阻擋（${(e as any).count} 個）（來源 ${e.byUnitId}）`
      if (e.kind === 'TARGET_DEF_MINUS') {
        const key = String((e as any).key ?? '')
        const keyText = key === 'magic' ? '魔防' : key === 'phys' ? '物防' : key
        return `目標${keyText}降低：-${(e as any).amount}（來源 ${e.byUnitId}）`
      }
      if (e.kind === 'SPLASH') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds.join(',') : ''
        return `波及（半徑 ${(e as any).radius}）：[${ids}] 固定傷害=${(e as any).fixedDamage}（來源 ${e.byUnitId}）`
      }
      if (e.kind === 'CHAIN') {
        return `連鎖：追加目標 ${(e as any).targetUnitId} 固定傷害=${(e as any).fixedDamage}（來源 ${e.byUnitId}）`
      }
      if (e.kind === 'PIERCE') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds : []
        const main = ids[0] ? `主目標=${ids[0]}` : '主目標=?'
        const collateral = ids.slice(1)
        const colText = collateral.length > 0 ? ` 連帶=[${collateral.join(',')}]` : ''
        const mode = String((e as any).mode ?? '')
        const modeText = mode === 'CANNON_SCREEN_AND_TARGET' ? '隔子（砲架與目標）' : mode === 'LINE_ENEMIES' ? '直線前 N 名敵方' : mode
        return `貫通（${modeText}）：${main}${colText} 固定傷害=${(e as any).fixedDamage}（來源 ${e.byUnitId}）`
      }
      return 'UNKNOWN'
    },
  },
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">射擊預覽</div>
        <button type="button" class="closeBtn" @click="$emit('cancel')">關閉</button>
      </div>

      <div class="effects">
        <div class="colTitle">效果</div>
        <div v-if="rawDamage != null" class="mono small">原始傷害：{{ rawDamage }}</div>
        <div v-if="damageToTarget != null" class="mono small">對主目標：{{ damageToTarget }}</div>
        <div v-if="shared" class="mono small">分攤：{{ shared.amount }} -> {{ shared.toUnitId }}</div>
        <div v-if="effects.length === 0" class="muted">(none)</div>
        <div v-for="(e, idx) in effects" :key="idx" class="mono small">
          <span>{{ effectText(e) }}</span>
        </div>
      </div>

      <div class="grid">
        <div class="col">
          <div class="colTitle">攻擊方</div>
          <div v-if="attacker" class="unitCard">
            <div class="row">
              <img v-if="attacker.image" class="img" :src="attacker.image" alt="" />
              <div v-else class="noImg">{{ baseLabel(attacker.base) }}</div>
              <div class="meta">
                <div class="name">{{ attacker.name }}</div>
                <div class="mono small">{{ attacker.side }} | {{ attacker.base }} | HP {{ attacker.hpCurrent }}</div>
                <div class="mono small">ATK {{ attacker.atk.key }} {{ attacker.atk.value }}</div>
                <div class="mono small">DEF {{ attacker.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
                <div class="mono small">座標 ({{ attacker.pos.x }},{{ attacker.pos.y }})</div>
                <div class="mono small">ID {{ attacker.id }}</div>
              </div>
            </div>
          </div>
          <div v-else class="muted">(none)</div>
        </div>

        <div class="col">
          <div class="colTitle">目標</div>
          <div v-if="target" class="unitCard">
            <div class="row">
              <img v-if="target.image" class="img" :src="target.image" alt="" />
              <div v-else class="noImg">{{ baseLabel(target.base) }}</div>
              <div class="meta">
                <div class="name">{{ target.name }}</div>
                <div class="mono small">{{ target.side }} | {{ target.base }} | HP {{ target.hpCurrent }}</div>
                <div class="mono small">ATK {{ target.atk.key }} {{ target.atk.value }}</div>
                <div class="mono small">DEF {{ target.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
                <div class="mono small">座標 ({{ target.pos.x }},{{ target.pos.y }})</div>
                <div class="mono small">ID {{ target.id }}</div>
              </div>
            </div>
          </div>
          <div v-else class="muted">(none)</div>
        </div>
      </div>

      <div class="btnRow">
        <button type="button" @click="$emit('confirm')" :disabled="!guard.ok" :title="guard.ok ? '' : guard.reason">
          確認射擊
        </button>
        <button type="button" @click="$emit('cancel')">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: var(--bg-modal-overlay);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
}

.modal {
  width: min(860px, 96vw);
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal);
  padding: 16px;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.modalTitle {
  font-weight: 700;
  font-size: 16px;
}

.closeBtn {
  padding: 6px 10px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.colTitle {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}

.unitCard {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface-2);
  padding: 10px;
}

.row {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  align-items: start;
}

.img {
  width: 90px;
  height: 124px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
}

.noImg {
  width: 90px;
  height: 124px;
  border-radius: 8px;
  border: 1px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 900;
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.04);
}

.name {
  font-weight: 700;
}

.small {
  font-size: 12px;
  opacity: 0.9;
}

.btnRow {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 14px;
}

.effects {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.muted {
  opacity: 0.75;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
