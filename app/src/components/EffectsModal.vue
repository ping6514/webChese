<script lang="ts">
export default { name: 'EffectsModal' }
</script>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import type { GameState, Unit } from '../engine/state'
import { getSoulCard } from '../engine/cards'
import type { SoulAbility } from '../engine/cards'
import type { SoulAbilityCondition } from '../engine/abilityTypes'
import { findAbility } from '../engine/abilityTypes'
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

const DEF_KEY_LABEL: Record<string, string> = { phys: '物理', magic: '魔法' }

function palaceContains(side: 'red' | 'black', pos: { x: number; y: number }): boolean {
  if (pos.x < 3 || pos.x > 5) return false
  if (side === 'red') return pos.y >= 7 && pos.y <= 9
  return pos.y >= 0 && pos.y <= 2
}

function crossedRiver(side: 'red' | 'black', y: number): boolean {
  return side === 'red' ? y <= 4 : y >= 5
}

function alliesInPalaceCount(state: GameState, side: 'red' | 'black'): number {
  let n = 0
  for (const u of Object.values(state.units)) {
    if (u.side !== side) continue
    if (palaceContains(side, u.pos)) n++
  }
  return n
}

function isResonanceActive(state: GameState, side: 'red' | 'black', clan: string, need: number): boolean {
  if (!clan) return false
  if (!Number.isFinite(need) || need <= 0) return false
  let count = 0
  for (const u of Object.values(state.units)) {
    if (u.side !== side) continue
    const sid = u.enchant?.soulId
    if (!sid) continue
    const c = getSoulCard(sid)
    if (!c) continue
    if (c.clan !== clan) continue
    count++
  }
  return count >= need
}

function getAbWhen(ab: SoulAbility): SoulAbilityCondition | undefined {
  return (ab as { when?: SoulAbilityCondition }).when
}

function getAbPerTurn(ab: SoulAbility): number {
  return Number((ab as { perTurn?: number }).perTurn ?? 0)
}

function getAbilityLabel(ab: SoulAbility): string {
  const perT = getAbPerTurn(ab)
  const perS = perT > 0 ? `（每回合 ${perT} 次）` : ''
  switch (ab.type) {
    case 'SOLDIERS_TIERED_DAMAGE_BONUS':
      return `軍勢：卒達門檻時傷害提升（${ab.tiers.map((t) => `≥${t.count}→+${t.amount}`).join(' / ')}）`
    case 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS':
      return `軍勢氣場：全軍攻擊力提升（${ab.tiers.map((t) => `≥${t.count}→+${t.amount}`).join(' / ')}）`
    case 'SOLDIERS_TIERED_DMG_REDUCTION_AURA':
      return `軍勢氣場：全軍減傷（${ab.tiers.map((t) => `≥${t.count}→−${t.amount}`).join(' / ')}）`
    case 'IGNORE_BLOCKING': return `無視阻擋${condLabel(ab)}`
    case 'FREE_SHOOT': return `免費射擊${perS}${condLabel(ab)}`
    case 'CHAIN': return `連鎖（範圍 ${ab.radius}）${perS}${condLabel(ab)}`
    case 'MOVE_THEN_SHOOT': return `移動後射擊${perS}${condLabel(ab)}`
    case 'DAMAGE_BONUS':
    case 'DAMAGE_MODIFIER':
      return `傷害 +${ab.amount}${condLabel(ab)}`
    case 'ARMY_RALLY': return '軍援：射擊聯動相鄰卒追加攻擊'
    case 'FORMATION_COMMAND': return `整編：相鄰卒可免費移動${perS}`
    case 'LOGISTICS_REVIVE': return `後勤：免費復活卒${perS}`
    case 'PALACE_GUARD': return `宮護：帥被攻擊時減傷 ${ab.amount} 點${perS}`
    case 'DAMAGE_BONUS_PER_ADJACENT_SOLDIER': return `每相鄰卒 +${ab.amountPer} 傷（上限 +${ab.max}）`
    case 'CROSS_RIVER': return '過河後效果生效'
    case 'MINGLEI': return '冥雷：穿透魔法防禦，過河目標額外傷害'
    case 'AURA_DAMAGE_BONUS':
    case 'AURA_DAMAGE_MODIFIER':
      return `氣場：友軍攻擊傷害 +${ab.amount ?? '?'}`
    case 'TARGET_DEF_MINUS':
      return `穿透防禦（${DEF_KEY_LABEL[ab.key] ?? ab.key}）${condLabel(ab)}`
    case 'IGNORE_PATH_BLOCKING': return `無視路徑阻擋${condLabel(ab)}`
    case 'SPLASH': return `濺射（範圍 ${ab.radius}）${perS}${condLabel(ab)}`
    case 'AURA_IGNORE_BLOCKING': return `氣場：友軍射擊無視阻擋`
    case 'DAMAGE_SHARE': return `傷害轉移：帥受傷分攤給自身${condLabel(ab)}`
    case 'COUNTER_ON_KING_DAMAGED': return `反擊：帥受傷時對攻擊者反擊${condLabel(ab)}`
    case 'RESONANCE': return `共鳴：同族單位達 ${ab.need} 名時生效`
    case 'PIERCE': return `貫穿：射擊穿透目標${condLabel(ab)}`
    case 'SACRIFICE_SHOT_BUFF': {
      const buff = ab.buff
      const parts: string[] = []
      if (buff.ignoreBlockingAll) parts.push('無視全部阻擋')
      if (buff.chainRadius != null) parts.push('連鎖')
      if (buff.damageBonusPerCorpsesCap != null) parts.push(`傷害依屍骸數 +1（上限 +${buff.damageBonusPerCorpsesCap}）`)
      return `獻祭：摧毀友軍後本回合下次射擊${parts.length ? '：' + parts.join('、') : '獲得強化'}`
    }
    case 'ON_DEATH_FIXED_DAMAGE': return `冥土歸還：死亡時對周圍 ${ab.radius} 格敵方造成 ${ab.amount} 固定傷害（無視防禦）`
    case 'AURA_DEF_BONUS': return `氣場：友軍防禦 +${ab.amount}`
    case 'HEAL_KING_ON_KILL': return `擊殺後：帥回復 ${ab.amount} HP`
    case 'HEAL_SELF_AND_KING_ON_KILL': return `血回：擊殺後自身回復 ${ab.selfAmount} HP，帥回復 ${ab.kingAmount} HP`
    case 'PALACE_ONLY': return `僅在九宮格內生效`
    case 'ATK_BONUS': return `攻擊力 +${ab.amount}${condLabel(ab)}`
    case 'AURA_HP_REGEN_ON_KILL': return `氣場：友軍擊殺後回復 HP`
    case 'KILL_MANA_GAIN': return `擊殺後獲得 ${ab.amount} 魔力`
    case 'FIRST_DAMAGED_REDUCTION': return `首次受傷減傷 ${ab.amount}${perS}`
    case 'COUNTER': return `反擊：自身或帥受傷時對攻擊者造成 1d${ab.damage.dice} 傷害${perS}`
    case 'BELOW_MAX_HP_DEFENSE_BONUS': {
      const label = ab.defBonus.map((d) => `${DEF_KEY_LABEL[d.key] ?? d.key}防 +${d.value}`).join('、')
      return `末命：HP 低於上限時，${label || '雙防提升'}`
    }
    case 'ITEM_VALUE_AURA': {
      const threshold = ab.threshold
      const bonus = ab.bonus
      if (typeof bonus.atk === 'number') return `展示收藏（攻）：道具費用 ≥ ${threshold} 時，全軍 ATK +${bonus.atk}`
      if (bonus?.def) return `展示收藏（守）：道具費用 ≥ ${threshold} 時，全軍雙防 +${bonus.def.phys ?? 0}/+${bonus.def.magic ?? 0}`
      return `展示收藏：道具費用 ≥ ${threshold} 時生效`
    }
    case 'FIRST_ATTACK_IF_GOLD_LT_GAIN_GOLD':
      return `逐利：首次攻擊時若財力 < ${ab.threshold}，獲得 ${ab.amount} 財力${perS}`
    case 'FIRST_ITEM_USE_IF_GOLD_LT_GAIN_GOLD':
      return `回扣：首次使用道具後若財力 < ${ab.threshold}，獲得 ${ab.amount} 財力${perS}`
    case 'SACRIFICE_SELF_APPLY_STATUS': return `獻祭自身：使己方帥進入無敵（直到下回合開始）`
    case 'UNIT_COUNT_ADVANTAGE_AURA': {
      const defLabel = ab.defBonus.map((d) => `${DEF_KEY_LABEL[d.key] ?? d.key}防 +${d.value}`).join('、')
      return `盛勢：己方單位數比敵方多 ${ab.margin} 以上時，全軍 ${defLabel || '提升'}`
    }
    case 'UNIT_COUNT_UNDERDOG_AURA':
      return `逆勢：己方單位數比敵方少 ${ab.margin} 以上時，全軍 ATK +${ab.atkBonus}`
    // ── 死誓氏族 ──────────────────────────────────────────────────────────
    case 'FREE_SHOOT_DRAIN': return '透支：射擊不消耗魔力（下回合魔力回復 −1）'
    case 'BLOOD_TITHE_ON_KILL': return '血什一稅：擊殺附魂敵方後帥回復 HP'
    case 'BLOOD_SACRIFICE': {
      const inner = `→ ${getAbilityLabel(ab.onActivate as SoulAbility)}`
      return `血祭（帥 −${ab.hpCost} HP）${inner}`
    }
    case 'DEATH_COUNTER': return '最後一搏：死前對擊殺者反擊'
    case 'UNDERDOG_AURA': {
      const scopeLabel = ab.scope === 'global' ? '全場' : '自身'
      return `逆境（${scopeLabel}）：己方劣勢時攻擊力提升`
    }
    case 'BLOOD_RAGE_AURA': {
      const scopeLabel = ab.scope === 'global' ? '全場' : '自身'
      return `血憤（${scopeLabel}）：帥 HP 低時攻擊力提升`
    }
    // ── 金傭氏族 ──────────────────────────────────────────────────────────
    case 'KILL_GOLD_GAIN': return `血金掠奪：擊殺敵方獲得 ${ab.amount} 財力`
    case 'GOLD_FOR_DAMAGE': return `以財傷敵：可消耗 ${ab.goldCost} 財力，傷害 +${ab.damageBonus}`
    case 'ITEM_VALUE_ATK_BONUS': return `高價震懾：道具總費用 ≥ ${ab.threshold} 時攻擊力 +${ab.atkBonus}`
    case 'GOLD_THRESHOLD_ATK': {
      const scopeLabel = (ab.scope ?? 'self') === 'global' ? '全體' : '自身'
      if (ab.atkBonus != null) return `財力共鳴：持有 ≥ ${ab.threshold} 財力，${scopeLabel}攻擊力 +${ab.atkBonus}`
      if (ab.defBonus) return `財力護甲：持有 ≥ ${ab.threshold} 財力，${scopeLabel}防禦 +${ab.defBonus.phys ?? 0}/+${ab.defBonus.magic ?? 0}`
      return `財力門檻（≥ ${ab.threshold}）：效果生效`
    }
    case 'ITEM_COUNT_ATK_BONUS': return '道具備戰：攻擊力 +（手牌道具數）'
    case 'INCOME_BONUS': return `財源廣進：每回合財力收入 +${ab.amount}`
    default: return String(ab.type)
  }
}

function condLabel(ab: SoulAbility): string {
  const when = getAbWhen(ab)
  if (!when) return ''
  if (when.type === 'SOLDIERS_GTE') return `（卒 ≥ ${when.count}）`
  if (when.type === 'CORPSES_GTE') return `（屍骸 ≥ ${when.count}）`
  if (when.type === 'AFTER_CROSS_RIVER') return '（過河後）'
  if (when.type === 'MOVED_THIS_TURN') return '（本回合已移動）'
  if (when.type === 'ENEMY_KILLED_THIS_TURN_GTE') return `（本回合擊殺 ≥ ${when.count}）`
  if (when.type === 'SOURCE_IN_PALACE') return '（來源在九宮）'
  if (when.type === 'ATTACKER_IN_PALACE') return '（攻擊者在九宮）'
  if (when.type === 'ALLIES_IN_PALACE_GTE') return `（九宮友軍 ≥ ${when.count}）`
  if (when.type === 'RESONANCE_ACTIVE') return '（共鳴啟動）'
  if (when.type === 'TARGET_IN_PALACE') return '（目標在九宮）'
  if (when.type === 'TARGET_CROSS_RIVER') return '（目標已過河）'
  return ''
}

function whenStatus(state: GameState, unit: Unit, ab: SoulAbility): { active: boolean; note: string } | null {
  const when = getAbWhen(ab)
  if (!when) return null

  if (when.type === 'SOLDIERS_GTE') {
    const soldiers = countSoldiers(state, unit.side)
    const need = Number(when.count ?? 0)
    if (soldiers < need) return { active: false, note: `卒：${soldiers}/${need}` }
    return { active: true, note: `卒：${soldiers}/${need}` }
  }
  if (when.type === 'CORPSES_GTE') {
    const corpses = countCorpses(state, unit.side)
    const need = Number(when.count ?? 0)
    if (corpses < need) return { active: false, note: `屍骸：${corpses}/${need}` }
    return { active: true, note: `屍骸：${corpses}/${need}` }
  }
  if (when.type === 'AFTER_CROSS_RIVER') {
    const crossed = crossedRiver(unit.side, unit.pos.y)
    return { active: crossed, note: crossed ? '已過河' : '未過河' }
  }
  if (when.type === 'MOVED_THIS_TURN') {
    const moved = !!props.state.turnFlags.movedThisTurn?.[unit.id]
    return { active: moved, note: moved ? '已移動' : '未移動' }
  }
  if (when.type === 'ENEMY_KILLED_THIS_TURN_GTE') {
    const need = Number(when.count ?? 0)
    const cur = Number(props.state.turnFlags.enemyKilledThisTurnCount ?? 0)
    if (cur < need) return { active: false, note: `擊殺：${cur}/${need}` }
    return { active: true, note: `擊殺：${cur}/${need}` }
  }
  if (when.type === 'SOURCE_IN_PALACE') {
    const ok = palaceContains(unit.side, unit.pos)
    return { active: ok, note: ok ? '來源在九宮' : '來源不在九宮' }
  }
  if (when.type === 'ALLIES_IN_PALACE_GTE') {
    const need = Number(when.count ?? 0)
    const cur = alliesInPalaceCount(state, unit.side)
    if (cur < need) return { active: false, note: `九宮：${cur}/${need}` }
    return { active: true, note: `九宮：${cur}/${need}` }
  }
  if (when.type === 'RESONANCE_ACTIVE') {
    const myCard = getSoulCard(unit.enchant?.soulId ?? '')
    const clan = String(myCard?.clan ?? '')
    const res = findAbility(myCard?.abilities ?? [], 'RESONANCE')
    const need = res?.need ?? 0
    const resClan = String(res?.clan ?? clan)
    const ok = isResonanceActive(state, unit.side, resClan, need)
    const count = resClan
      ? Object.values(state.units).filter((u) => u.side === unit.side && u.enchant && getSoulCard(u.enchant.soulId)?.clan === resClan).length
      : 0
    return { active: ok, note: `同族 ${count}/${need || '?'}${resClan ? '' : '（缺 clan）'}` }
  }

  // Unsupported in EffectsModal context (depends on attacker/target at action time)
  if (when.type === 'ATTACKER_IN_PALACE') {
    return { active: true, note: '需攻擊者在九宮' }
  }

  return null
}

function getAbilityStatus(ab: SoulAbility, state: GameState, unit: Unit): { active: boolean; note: string } {
  const side = unit.side
  const soldiers = countSoldiers(state, side)
  const corpses = countCorpses(state, side)

  const gold = state.resources[side].gold

  // GOLD_THRESHOLD_ATK: active if gold >= threshold
  if (ab.type === 'GOLD_THRESHOLD_ATK') {
    const threshold = ab.threshold
    if (gold >= threshold) return { active: true, note: `財力 ${gold}/${threshold}` }
    return { active: false, note: `財力 ${gold}/${threshold}` }
  }

  // UNDERDOG_AURA: active if enemy has more living units
  if (ab.type === 'UNDERDOG_AURA') {
    const stages = ab.stages
    const myCount = Object.values(state.units).filter(u => u.side === side).length
    const enemyCount = Object.values(state.units).filter(u => u.side !== side).length
    const margin = enemyCount - myCount
    const hit = [...stages].sort((a, b) => (b.margin ?? 0) - (a.margin ?? 0)).find(s => margin >= (s.margin ?? 1))
    if (hit) return { active: true, note: `劣勢 ${margin} 位（ATK +${hit.atkBonus}）` }
    const minStage = [...stages].sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0))[0]
    return { active: false, note: `劣勢 ${margin}/${minStage?.margin ?? 1}` }
  }

  // BLOOD_RAGE_AURA: active if king HP <= threshold
  if (ab.type === 'BLOOD_RAGE_AURA') {
    const stages = ab.stages
    const king = Object.values(state.units).find(u => u.side === side && u.base === 'king')
    const kingHp = king?.hpCurrent ?? 999
    const hit = [...stages].sort((a, b) => a.threshold - b.threshold).find(s => kingHp <= s.threshold)
    if (hit) return { active: true, note: `帥 HP ${kingHp}（ATK +${hit.atkBonus}）` }
    const maxThreshold = [...stages].sort((a, b) => b.threshold - a.threshold)[0]
    return { active: false, note: `帥 HP ${kingHp}（觸發需 ≤${maxThreshold?.threshold ?? '?'}）` }
  }

  // RESONANCE: active if same-clan units >= need
  if (ab.type === 'RESONANCE') {
    const need = ab.need
    const myCard = getSoulCard(unit.enchant?.soulId ?? '')
    const clan = myCard?.clan
    const count = clan
      ? Object.values(state.units).filter(u => u.side === side && u.enchant && getSoulCard(u.enchant.soulId)?.clan === clan).length
      : 0
    if (count >= need) return { active: true, note: `同族 ${count}/${need}` }
    return { active: false, note: `同族 ${count}/${need}` }
  }

  // Tiered abilities: active if at least one tier met
  if (ab.type === 'SOLDIERS_TIERED_DAMAGE_BONUS' || ab.type === 'SOLDIERS_TIERED_AURA_DAMAGE_BONUS' || ab.type === 'SOLDIERS_TIERED_DMG_REDUCTION_AURA') {
    const tiers = ab.tiers
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

  // Common `when` conditions (data-driven)
  const ws = whenStatus(state, unit, ab)
  if (ws) return ws

  // Check `when` condition
  const when = getAbWhen(ab)
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
  const perTurn = getAbPerTurn(ab)
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

const mobileTab = ref<'my' | 'enemy'>('my')
const isNarrowScreen = ref(typeof window !== 'undefined' ? window.innerWidth <= 767 : false)

const modalEl = ref<HTMLElement | null>(null)

onMounted(() => {
  const onResize = () => { isNarrowScreen.value = window.innerWidth <= 767 }
  window.addEventListener('resize', onResize)
  onUnmounted(() => window.removeEventListener('resize', onResize))
})

watch(() => props.open, (open) => {
  if (!open) return
  mobileTab.value = 'my'
  modalEl.value?.scrollTo({ top: 0 })
})

watch(mobileTab, () => {
  // Ensure tab switch always visibly updates by resetting scroll position.
  modalEl.value?.scrollTo({ top: 0 })
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div ref="modalEl" class="modal">
      <div class="modalHead">
        <span class="modalTitle">⚡ 場上效果</span>
        <button type="button" class="closeBtn" @click="$emit('close')">✕ 關閉</button>
      </div>

      <!-- Mobile tab bar -->
      <div class="mobileTabs">
        <button type="button" class="mobileTabBtn" :class="{ active: mobileTab === 'my' }" @click="mobileTab = 'my'">{{ mySideLabel }}</button>
        <button type="button" class="mobileTabBtn" :class="{ active: mobileTab === 'enemy' }" @click="mobileTab = 'enemy'">{{ enemySideLabel }}</button>
      </div>

      <div class="grid">
        <!-- 己方 -->
        <div v-if="!isNarrowScreen || mobileTab === 'my'" class="col">
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

        <div v-if="!isNarrowScreen" class="divider mobileHiddenFlex" />

        <!-- 敵方 -->
        <div v-if="!isNarrowScreen || mobileTab === 'enemy'" class="col">
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
  padding-block: 24px;
  z-index: 150;
  backdrop-filter: blur(3px);
}

.modal {
  width: min(1100px, 96vw);
  max-height: min(90vh, 860px);
  overflow: auto;
  overscroll-behavior: contain;
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

.mobileTabs { display: none; }

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

@media (max-width: 767px) {
  .mobileTabs {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .mobileTabBtn {
    flex: 1;
    padding: 7px 12px;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 700;
    border: 1px solid var(--border-strong);
    background: var(--bg-surface-2);
    color: var(--text-muted);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  .mobileTabBtn.active {
    background: rgba(145, 202, 255, 0.15);
    border-color: rgba(145, 202, 255, 0.5);
    color: #91caff;
  }
  .grid { grid-template-columns: 1fr; }
  .mobileHidden { display: none; }
  .mobileHiddenFlex { display: none; }
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
