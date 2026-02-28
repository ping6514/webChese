<script lang="ts">
export default { name: 'EffectsModal' }
</script>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState, Unit } from '../engine/state'
import { getSoulCard } from '../engine/cards'
import type { SoulAbility } from '../engine/cards'
import { countSoldiers, countCorpses } from '../engine/corpses'

const props = defineProps<{
  open: boolean
  state: GameState
}>()

defineEmits<{ (e: 'close'): void }>()

// ── Types ────────────────────────────────────────────────────────────────────

type AbilityRow = {
  label: string
  active: boolean
  note: string
}

type CardRow = {
  unitId: string
  soulName: string
  soulImage: string | null
  soulText?: string
  pos: { x: number; y: number }
  abilities: AbilityRow[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function highestTier(tiers: { count: number; amount: number }[], n: number): { count: number; amount: number } | null {
  const sorted = [...tiers].sort((a, b) => b.count - a.count)
  return sorted.find((t) => n >= t.count) ?? null
}

function getAbilityLabel(ab: SoulAbility): string {
  const perT = Number((ab as any).perTurn ?? 0)
  const perS = perT > 0 ? `（每回合 ${perT} 次）` : ''
  switch (ab.type) {
    case 'SOLDIERS_TIERED_DAMAGE_BONUS': {
      const tiers = ((ab as any).tiers ?? []) as { count: number; amount: number }[]
      return `軍勢：卒達門檻時傷害提升（${tiers.map((t) => `≥${t.count}→+${t.amount}`).join(' / ')}）`
    }
    case 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS': {
      const tiers = ((ab as any).tiers ?? []) as { count: number; amount: number }[]
      return `軍勢氣場：全軍 ATK 提升（${tiers.map((t) => `≥${t.count}→+${t.amount}`).join(' / ')}）`
    }
    case 'SOLDIERS_TIERED_DMG_REDUCTION_AURA': {
      const tiers = ((ab as any).tiers ?? []) as { count: number; amount: number }[]
      return `軍勢氣場：全軍 減傷（${tiers.map((t) => `≥${t.count}→-${t.amount}`).join(' / ')}）`
    }
    case 'IGNORE_BLOCKING': return `無視阻擋${condLabel(ab)}`
    case 'FREE_SHOOT': return `免費射擊${perS}${condLabel(ab)}`
    case 'CHAIN': return `連鎖 R=${(ab as any).radius ?? 1}${condLabel(ab)}`
    case 'MOVE_THEN_SHOOT': return `移動後射擊${perS}${condLabel(ab)}`
    case 'DAMAGE_BONUS': return `傷害 +${(ab as any).amount ?? '?'}${condLabel(ab)}`
    case 'ARMY_RALLY': return '軍援：射擊聯動相鄰卒追加攻擊'
    case 'FORMATION_COMMAND': return `整編：相鄰 ${(ab as any).radius ?? 1} 格的卒可免費移動${perS}`
    case 'LOGISTICS_REVIVE': return `後勤：免費復活卒${perS}`
    case 'PALACE_GUARD': return `宮護：帥被攻擊時減傷 ${(ab as any).amount ?? 1} 點${perS}`
    case 'DAMAGE_BONUS_PER_ADJACENT_SOLDIER': return `每相鄰卒 +${(ab as any).amountPer ?? 1} 傷（上限 +${(ab as any).max ?? '∞'}）`
    case 'CROSS_RIVER': return '過河後效果生效'
    case 'MINGLEI': return '冥雷：穿透魔法防禦，過河目標額外傷害'
    case 'AURA_DAMAGE_BONUS': return '氣場：友軍攻擊傷害提升'
    case 'TARGET_DEF_MINUS': return `穿透防禦（${(ab as any).key ?? '?'}）`
    default: return String(ab.type)
  }
}

function condLabel(ab: SoulAbility): string {
  const when = (ab as any).when
  if (!when) return ''
  if (when.type === 'SOLDIERS_GTE') return `（卒 ≥ ${when.count}）`
  if (when.type === 'CORPSES_GTE') return `（屍骸 ≥ ${when.count}）`
  return ''
}

function getAbilityStatus(ab: SoulAbility, state: GameState, unit: Unit): { active: boolean; note: string } {
  const side = unit.side
  const soldiers = countSoldiers(state, side)
  const corpses = countCorpses(state, side)

  // Tiered abilities: active if at least one tier met
  if (ab.type === 'SOLDIERS_TIERED_DAMAGE_BONUS' || ab.type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS' || ab.type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA') {
    const tiers = ((ab as any).tiers ?? []) as { count: number; amount: number }[]
    const hit = highestTier(tiers, soldiers)
    if (hit) return { active: true, note: `+${hit.amount}（卒：${soldiers}）` }
    const minTier = [...tiers].sort((a, b) => a.count - b.count)[0]
    return { active: false, note: minTier ? `卒：${soldiers}/${minTier.count}` : '' }
  }

  // CROSS_RIVER
  if (ab.type === 'CROSS_RIVER') {
    const crossed = side === 'red' ? unit.pos.y <= 4 : unit.pos.y >= 5
    return { active: crossed, note: crossed ? '已過河' : '未過河' }
  }

  // Check `when` condition
  const when = (ab as any).when
  if (when) {
    if (when.type === 'SOLDIERS_GTE') {
      const need = Number(when.count ?? 0)
      if (soldiers < need) return { active: false, note: `卒：${soldiers}/${need}` }
      return { active: true, note: `卒：${soldiers}/${need}` }
    }
    if (when.type === 'CORPSES_GTE') {
      const need = Number(when.count ?? 0)
      if (corpses < need) return { active: false, note: `屍骸：${corpses}/${need}` }
      return { active: true, note: `屍骸：${corpses}/${need}` }
    }
  }

  // perTurn usage check
  const perTurn = Number((ab as any).perTurn ?? 0)
  if (perTurn > 0) {
    const key = `${unit.id}:${ab.type}`
    const used = state.turnFlags.abilityUsed?.[key] ?? 0
    const remaining = perTurn - used
    if (used >= perTurn) return { active: false, note: `已用（${used}/${perTurn}）` }
    return { active: true, note: `剩 ${remaining} 次` }
  }

  // Passive / no condition: always active
  return { active: true, note: '' }
}

function buildRows(side: 'red' | 'black'): CardRow[] {
  const rows: CardRow[] = []
  for (const unit of Object.values(props.state.units)) {
    if (unit.side !== side) continue
    if (!unit.enchant) continue
    const card = getSoulCard(unit.enchant.soulId)
    if (!card) continue

    const abilities: AbilityRow[] = card.abilities.map((ab) => {
      const { active, note } = getAbilityStatus(ab, props.state, unit)
      return { label: getAbilityLabel(ab), active, note }
    })

    rows.push({ unitId: unit.id, soulName: card.name, soulImage: card.image, soulText: card.text, pos: unit.pos, abilities })
  }
  rows.sort((a, b) => a.unitId.localeCompare(b.unitId))
  return rows
}

const mySide = computed(() => props.state.turn.side)
const enemySide = computed(() => (props.state.turn.side === 'red' ? 'black' : 'red'))
const myRows = computed(() => buildRows(mySide.value))
const enemyRows = computed(() => buildRows(enemySide.value))
const mySideLabel = computed(() => mySide.value === 'red' ? '紅方（己方）' : '黑方（己方）')
const enemySideLabel = computed(() => enemySide.value === 'red' ? '紅方（敵方）' : '黑方（敵方）')
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <span class="modalTitle">⚡ 場上效果</span>
        <button type="button" class="closeBtn" @click="$emit('close')">✕ 關閉</button>
      </div>

      <div class="grid">
        <!-- 己方 -->
        <div class="col">
          <div class="colTitle">{{ mySideLabel }}</div>
          <div v-if="myRows.length === 0" class="empty">— 無附魔單位 —</div>
          <div v-for="row in myRows" :key="row.unitId" class="cardRow">
            <div class="cardLeft">
              <img v-if="row.soulImage" :src="row.soulImage" class="cardImg" />
              <div v-else class="cardImgPlaceholder">?</div>
              <div class="cardMeta">
                <div class="cardName">{{ row.soulName }}</div>
                <div class="cardPos">({{ row.pos.x }}, {{ row.pos.y }})</div>
              </div>
            </div>
            <div class="cardRight">
              <div
                v-for="(ab, i) in row.abilities"
                :key="i"
                class="abilityLine"
                :class="{ 'abilityLine--active': ab.active }"
              >
                <span class="abilityIcon">{{ ab.active ? '✦' : '○' }}</span>
                <span class="abilityLabel">{{ ab.label }}</span>
                <span v-if="ab.note" class="abilityNote">{{ ab.note }}</span>
              </div>
              <div v-if="row.soulText" class="cardDesc">{{ row.soulText }}</div>
            </div>
          </div>
        </div>

        <div class="divider" />

        <!-- 敵方 -->
        <div class="col">
          <div class="colTitle">{{ enemySideLabel }}</div>
          <div v-if="enemyRows.length === 0" class="empty">— 無附魔單位 —</div>
          <div v-for="row in enemyRows" :key="row.unitId" class="cardRow">
            <div class="cardLeft">
              <img v-if="row.soulImage" :src="row.soulImage" class="cardImg" />
              <div v-else class="cardImgPlaceholder">?</div>
              <div class="cardMeta">
                <div class="cardName">{{ row.soulName }}</div>
                <div class="cardPos">({{ row.pos.x }}, {{ row.pos.y }})</div>
              </div>
            </div>
            <div class="cardRight">
              <div
                v-for="(ab, i) in row.abilities"
                :key="i"
                class="abilityLine"
                :class="{ 'abilityLine--active': ab.active }"
              >
                <span class="abilityIcon">{{ ab.active ? '✦' : '○' }}</span>
                <span class="abilityLabel">{{ ab.label }}</span>
                <span v-if="ab.note" class="abilityNote">{{ ab.note }}</span>
              </div>
              <div v-if="row.soulText" class="cardDesc">{{ row.soulText }}</div>
            </div>
          </div>
        </div>
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
  backdrop-filter: blur(3px);
}

.modal {
  width: min(1100px, 96vw);
  max-height: min(90vh, 860px);
  overflow: auto;
  border-radius: 16px;
  border: 1px solid var(--border-strong);
  background: var(--bg-modal-strong);
  padding: 20px;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.45);
}

.modalHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

.modalTitle {
  font-weight: 900;
  font-size: 20px;
}

.closeBtn {
  padding: 6px 16px;
  border-radius: 8px;
  font-weight: 700;
  background: var(--bg-surface-2);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
  cursor: pointer;
  transition: background 0.15s;
}
.closeBtn:hover { background: var(--bg-surface-1); }

.grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

.divider {
  width: 1px;
  background: var(--border);
  align-self: stretch;
  margin: 0 4px;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.colTitle {
  font-size: 0.8125rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  opacity: 0.6;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}

.empty {
  font-size: 0.8125rem;
  opacity: 0.4;
  text-align: center;
  padding: 16px 0;
}

/* ── Card row ────────────────────────────────────────────────────────── */
.cardRow {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.cardLeft {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 60px;
  flex-shrink: 0;
}

.cardImg {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.18);
}

.cardImgPlaceholder {
  width: 52px;
  height: 52px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  opacity: 0.4;
}

.cardMeta {
  text-align: center;
}

.cardName {
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.2;
}

.cardPos {
  font-size: 0.625rem;
  opacity: 0.45;
  font-family: ui-monospace, monospace;
}

/* ── Ability lines ────────────────────────────────────────────────────── */
.cardRight {
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
  min-width: 0;
}

.abilityLine {
  display: flex;
  align-items: baseline;
  gap: 5px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  line-height: 1.5;
}

.abilityLine--active {
  color: #ffd666;
}

.abilityIcon {
  font-size: 0.625rem;
  flex-shrink: 0;
  width: 10px;
}

.abilityLabel {
  flex: 1;
  min-width: 0;
}

.abilityNote {
  font-size: 0.625rem;
  font-family: ui-monospace, monospace;
  opacity: 0.7;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  white-space: nowrap;
}

.abilityLine--active .abilityNote {
  background: rgba(255, 214, 102, 0.15);
}

.cardDesc {
  margin-top: 5px;
  font-size: 0.6875rem;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.38);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  padding-top: 5px;
}
</style>
