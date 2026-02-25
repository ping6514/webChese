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
    effectText(e: ShotPreviewEffect): string {
      if (e.kind === 'DAMAGE_SHARE') return `DAMAGE_SHARE: ${e.amount} (by ${e.byUnitId})`
      if (e.kind === 'DAMAGE_BONUS') return `DAMAGE_BONUS: + ${e.amount} (by ${e.byUnitId})`
      if (e.kind === 'AURA_IGNORE_BLOCKING_ALL') return `AURA_IGNORE_BLOCKING: all (by ${e.byUnitId})`
      if (e.kind === 'AURA_IGNORE_BLOCKING_COUNT') return `AURA_IGNORE_BLOCKING: ${(e as any).count} (by ${e.byUnitId})`
      if (e.kind === 'IGNORE_BLOCKING_ALL') return `IGNORE_BLOCKING: all (by ${e.byUnitId})`
      if (e.kind === 'IGNORE_BLOCKING_COUNT') return `IGNORE_BLOCKING: ${(e as any).count} (by ${e.byUnitId})`
      if (e.kind === 'SPLASH') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds.join(',') : ''
        return `SPLASH r${(e as any).radius}: [${ids}] dmg=${(e as any).fixedDamage} (by ${e.byUnitId})`
      }
      if (e.kind === 'CHAIN') {
        return `CHAIN -> ${(e as any).targetUnitId} dmg=${(e as any).fixedDamage} (by ${e.byUnitId})`
      }
      if (e.kind === 'PIERCE') {
        const ids = Array.isArray((e as any).targetUnitIds) ? (e as any).targetUnitIds : []
        const main = ids[0] ? `main=${ids[0]}` : 'main=?'
        const collateral = ids.slice(1)
        const colText = collateral.length > 0 ? ` collateral=[${collateral.join(',')}]` : ''
        return `PIERCE ${String((e as any).mode ?? '')}: ${main}${colText} dmg=${(e as any).fixedDamage} (by ${e.byUnitId})`
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
        <div class="modalTitle">Confirm Shoot</div>
        <button type="button" class="closeBtn" @click="$emit('cancel')">Close</button>
      </div>

      <div class="effects">
        <div class="colTitle">Effects</div>
        <div v-if="rawDamage != null" class="mono small">raw damage: {{ rawDamage }}</div>
        <div v-if="damageToTarget != null" class="mono small">to target: {{ damageToTarget }}</div>
        <div v-if="shared" class="mono small">shared: {{ shared.amount }} -> {{ shared.toUnitId }}</div>
        <div v-if="effects.length === 0" class="muted">(none)</div>
        <div v-for="(e, idx) in effects" :key="idx" class="mono small">
          <span>{{ effectText(e) }}</span>
        </div>
      </div>

      <div class="grid">
        <div class="col">
          <div class="colTitle">Attacker</div>
          <div v-if="attacker" class="unitCard">
            <div class="row">
              <img v-if="attacker.image" class="img" :src="attacker.image" alt="" />
              <div v-else class="noImg mono">no img</div>
              <div class="meta">
                <div class="name">{{ attacker.name }}</div>
                <div class="mono small">{{ attacker.side }} | {{ attacker.base }} | hp {{ attacker.hpCurrent }}</div>
                <div class="mono small">atk {{ attacker.atk.key }} {{ attacker.atk.value }}</div>
                <div class="mono small">def {{ attacker.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
                <div class="mono small">pos ({{ attacker.pos.x }},{{ attacker.pos.y }})</div>
                <div class="mono small">id {{ attacker.id }}</div>
              </div>
            </div>
          </div>
          <div v-else class="muted">(none)</div>
        </div>

        <div class="col">
          <div class="colTitle">Target</div>
          <div v-if="target" class="unitCard">
            <div class="row">
              <img v-if="target.image" class="img" :src="target.image" alt="" />
              <div v-else class="noImg mono">no img</div>
              <div class="meta">
                <div class="name">{{ target.name }}</div>
                <div class="mono small">{{ target.side }} | {{ target.base }} | hp {{ target.hpCurrent }}</div>
                <div class="mono small">atk {{ target.atk.key }} {{ target.atk.value }}</div>
                <div class="mono small">def {{ target.def.map((d) => `${d.key} ${d.value}`).join(' / ') }}</div>
                <div class="mono small">pos ({{ target.pos.x }},{{ target.pos.y }})</div>
                <div class="mono small">id {{ target.id }}</div>
              </div>
            </div>
          </div>
          <div v-else class="muted">(none)</div>
        </div>
      </div>

      <div class="btnRow">
        <button type="button" @click="$emit('confirm')" :disabled="!guard.ok" :title="guard.ok ? '' : guard.reason">
          Confirm Shoot
        </button>
        <button type="button" @click="$emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
}

.modal {
  width: min(860px, 96vw);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(0, 0, 0, 0.92);
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
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
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
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.noImg {
  width: 90px;
  height: 124px;
  border-radius: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  display: grid;
  place-items: center;
  font-size: 11px;
  opacity: 0.8;
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
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.muted {
  opacity: 0.75;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}
</style>
