<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, PieceBase, ShotPreviewEffect, DamageFormulaItem } from '../engine'

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

type DamageFormula = {
  items: DamageFormulaItem[]
  resultMin: number
  resultMax: number
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
    damageFormula: {
      type: Object as () => DamageFormula | null,
      required: false,
      default: null,
    },
  },
  emits: ['confirm', 'cancel'],
  methods: {
    baseLabel(base: string): string { return BASE_LABEL[base] ?? base },
    amountDisplay(amount: number | [number, number]): string {
      if (Array.isArray(amount)) return `${amount[0]} ~ ${amount[1]}`
      return amount > 0 ? `+${amount}` : String(amount)
    },
    extraEffectText(e: ShotPreviewEffect): string | null {
      if (e.kind === 'DAMAGE_SHARE') return `傷害分攤：${e.amount}（由 ${e.byUnitId} 承擔）`
      if (e.kind === 'SPLASH') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds.join(', ') : ''
        return `波及 (半徑${(e as any).radius})：[${ids}] 各 ${(e as any).fixedDamage} 傷`
      }
      if (e.kind === 'CHAIN') return `連鎖：追加 ${(e as any).targetUnitId} ${(e as any).fixedDamage} 傷`
      if (e.kind === 'PIERCE') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds : []
        const mode = (e as any).mode === 'CANNON_SCREEN_AND_TARGET' ? '隔子' : '直線'
        return `貫通(${mode})：[${ids.join(', ')}] 各 ${(e as any).fixedDamage} 傷`
      }
      return null
    },
    extraEffects(): ShotPreviewEffect[] {
      return this.effects.filter((e) => {
        const k = e.kind
        return k === 'DAMAGE_SHARE' || k === 'SPLASH' || k === 'CHAIN' || k === 'PIERCE'
      })
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

      <!-- 攻擊方 / 目標 -->
      <div class="grid">
        <div class="col">
          <div class="colTitle">攻擊方</div>
          <div v-if="attacker" class="unitCard">
            <div class="row">
              <img v-if="attacker.image" class="img" :src="attacker.image" alt="" />
              <div v-else class="noImg">{{ baseLabel(attacker.base) }}</div>
              <div class="meta">
                <div class="name">{{ attacker.name }}</div>
                <div class="mono small">HP {{ attacker.hpCurrent }}</div>
                <div class="mono small">ATK {{ attacker.atk.key }} {{ attacker.atk.value }}</div>
                <div class="mono small">({{ attacker.pos.x }},{{ attacker.pos.y }})</div>
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
                <div class="mono small">HP {{ target.hpCurrent }}</div>
                <div class="mono small">DEF {{ target.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
                <div class="mono small">({{ target.pos.x }},{{ target.pos.y }})</div>
              </div>
            </div>
          </div>
          <div v-else class="muted">(none)</div>
        </div>
      </div>

      <!-- 傷害公式 -->
      <div v-if="damageFormula" class="formulaBox">
        <div class="formulaTitle">傷害預測</div>
        <div
          v-for="(item, idx) in damageFormula.items"
          :key="idx"
          :class="['formulaRow', item.isBonus ? 'bonus' : 'penalty']"
        >
          <span class="fAmount">{{ amountDisplay(item.amount) }}</span>
          <span class="fLabel">{{ item.label }}</span>
        </div>
        <div class="formulaDivider"></div>
        <div class="formulaResult">
          預期傷害：
          <span v-if="damageFormula.resultMin === damageFormula.resultMax">
            {{ damageFormula.resultMin }}
          </span>
          <span v-else>{{ damageFormula.resultMin }} ~ {{ damageFormula.resultMax }}</span>
        </div>
      </div>

      <!-- 額外目標（波及/連鎖/貫通/分攤） -->
      <div v-if="extraEffects().length > 0" class="extraBox">
        <div class="colTitle">額外效果</div>
        <div v-for="(e, idx) in extraEffects()" :key="idx" class="mono small extraLine">
          {{ extraEffectText(e) }}
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
  width: min(520px, 96vw);
  border-radius: 12px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modalHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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
  gap: 10px;
}

.colTitle {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 5px;
}

.unitCard {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-surface-2);
  padding: 10px;
}

.row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  align-items: start;
}

.img {
  width: 72px;
  height: 100px;
  object-fit: cover;
  border-radius: 7px;
  border: 1px solid var(--border-strong);
}

.noImg {
  width: 72px;
  height: 100px;
  border-radius: 7px;
  border: 1px dashed var(--border-strong);
  display: grid;
  place-items: center;
  font-size: 1.75rem;
  font-weight: 900;
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.04);
}

.name {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 3px;
}

.small {
  font-size: 11px;
  opacity: 0.85;
  line-height: 1.5;
}

/* ── 傷害公式 ───────────────── */
.formulaBox {
  background: var(--bg-surface-2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px 14px;
}

.formulaTitle {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.formulaRow {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 2px 0;
}

.fAmount {
  font-family: ui-monospace, monospace;
  font-size: 13px;
  font-weight: 700;
  min-width: 60px;
  text-align: right;
}

.fLabel {
  font-size: 12px;
  opacity: 0.85;
}

.formulaRow.bonus .fAmount {
  color: #e8c83c;
}

.formulaRow.penalty .fAmount {
  color: var(--text-muted, rgba(255,255,255,0.45));
}

.formulaDivider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}

.formulaResult {
  font-size: 14px;
  font-weight: 700;
  color: #e8c83c;
  text-align: right;
}

/* ── 額外效果 ───────────────── */
.extraBox {
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.extraLine {
  opacity: 0.8;
  padding: 1px 0;
}

.btnRow {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.muted {
  opacity: 0.55;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
