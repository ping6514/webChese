<template>
  <div class="sim-overlay" @click.self="$emit('close')">
    <div class="sim-panel panel">
      <div class="sim-header">
        <span class="sim-title">🎲 寶相模擬器</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>

      <div class="sim-body">
        <!-- 模式切換 -->
        <div class="mode-tabs">
          <button class="mode-tab" :class="{ active: mode === 'armor' }" @click="mode = 'armor'">🛡️ 防具</button>
          <button class="mode-tab" :class="{ active: mode === 'weapon' }" @click="mode = 'weapon'">⚔️ 武器</button>
        </div>

        <!-- 參數 -->
        <div class="param-grid">
          <label class="param-label">樓層
            <input type="range" v-model.number="floorNum" min="1" max="10" step="1" class="param-slider" />
            <span class="param-val">{{ floorNum }}</span>
          </label>
          <label class="param-label">品質
            <input type="range" v-model.number="quality" min="0.5" max="2.0" step="0.1" class="param-slider" />
            <span class="param-val">{{ quality.toFixed(1) }}</span>
          </label>
          <label class="param-label">職業偏好
            <select v-model="jobId" class="param-select">
              <option value="">任意</option>
              <option v-for="j in jobs" :key="j.id" :value="j.id">{{ j.name }}</option>
            </select>
          </label>
          <!-- 武器模式：選特定武器基底 -->
          <label v-if="mode === 'weapon'" class="param-label">武器種類
            <select v-model="weaponBaseId" class="param-select">
              <option value="">隨機</option>
              <option v-for="wb in weaponBaseList" :key="wb.id" :value="wb.id">{{ wb.name }}</option>
            </select>
          </label>
        </div>

        <!-- 生成按鈕 -->
        <div class="sim-actions">
          <button class="btn btn--primary" @click="simulate">⚡ 生成一批</button>
          <button v-if="mode === 'armor' && armorResults.length > 0" class="btn btn--secondary" @click="addAllArmors">
            📦 全部加入背包（{{ armorResults.length }} 件）
          </button>
          <button v-if="mode === 'weapon' && weaponResults.length > 0" class="btn btn--secondary" @click="addAllWeapons">
            📦 全部加入背包（{{ weaponResults.length }} 件）
          </button>
        </div>

        <!-- 防具結果 -->
        <div v-if="mode === 'armor' && armorResults.length > 0" class="result-list">
          <div v-for="item in armorResults" :key="item.instanceId" class="result-item"
               :class="{ 'result-item--added': armorAddedIds.has(item.instanceId) }">
            <div class="result-header">
              <span class="result-name">{{ item.name }}</span>
              <span class="result-slot">{{ SLOT_LABEL[item.slot] }}</span>
              <span class="result-level">Lv{{ item.itemLevel }}</span>
              <span class="result-rarity" :class="`rarity-${computeArmorRarity(item)}`">{{ computeArmorRarity(item) }}</span>
            </div>
            <div class="result-affixes">
              <span v-for="id in item.affixIds" :key="id" class="result-affix-tag">
                {{ affixName(id) }}
              </span>
            </div>
            <div class="result-stats">{{ armorStatSummary(item) }}</div>
            <button
              class="btn-add"
              :disabled="armorAddedIds.has(item.instanceId)"
              @click="addOneArmor(item)"
            >{{ armorAddedIds.has(item.instanceId) ? '✓ 已加入' : '加入背包' }}</button>
          </div>
        </div>

        <!-- 武器結果 -->
        <div v-if="mode === 'weapon' && weaponResults.length > 0" class="result-list">
          <div v-for="item in weaponResults" :key="item.instanceId" class="result-item"
               :class="{ 'result-item--added': weaponAddedIds.has(item.instanceId) }">
            <div class="result-header">
              <span class="result-name">{{ item.name }}</span>
              <span class="result-level">Lv{{ item.itemLevel }}</span>
              <span class="result-slot">{{ weaponStatSummary(item)?.statScaling }}</span>
            </div>
            <div class="result-affixes">
              <span v-for="id in item.affixIds" :key="id" class="result-affix-tag">{{ id }}</span>
              <span v-if="item.affixIds.length === 0" class="result-affix-tag">基礎</span>
            </div>
            <template v-if="weaponStatSummary(item) as ResolvedWeapon | null">
              <div class="result-stats">
                ATK×{{ weaponStatSummary(item)!.atkFinal.toFixed(2) }}
                · {{ weaponStatSummary(item)!.element }}
                · {{ weaponStatSummary(item)!.attackMode }}
                <span v-if="weaponStatSummary(item)!.enchant"> · {{ weaponStatSummary(item)!.enchant }}</span>
                · 讀條{{ weaponStatSummary(item)!.castTimeFinal }}ms
                · 硬直{{ weaponStatSummary(item)!.recoveryTimeFinal }}ms
                <span v-if="weaponStatSummary(item)!.spCostFinal"> · SP{{ weaponStatSummary(item)!.spCostFinal }}</span>
                <span v-if="weaponStatSummary(item)!.mpCostFinal"> · MP{{ weaponStatSummary(item)!.mpCostFinal }}</span>
              </div>
            </template>
            <button
              class="btn-add"
              :disabled="weaponAddedIds.has(item.instanceId)"
              @click="addOneWeapon(item)"
            >{{ weaponAddedIds.has(item.instanceId) ? '✓ 已加入' : '加入背包' }}</button>
          </div>
        </div>

        <div v-else-if="hasRun && ((mode === 'armor' && armorResults.length === 0) || (mode === 'weapon' && weaponResults.length === 0))" class="no-results">
          本次未產出任何物品（機率未命中）
        </div>

        <!-- 統計 -->
        <div v-if="runCount > 0" class="sim-stats">
          已模擬 <b>{{ runCount }}</b> 次，產出 <b>{{ totalItems }}</b> 件
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { resolveLoot } from '@engine/loot'
import { resolveArmorStats } from '@engine/armor'
import { resolveWeapon } from '@engine/weapons'
import type { FrozenArmor, FrozenWeapon } from '@engine/item'
import type { ResolvedWeapon } from '@engine/state'
import { lootRegistry, armorAffixDefs, jobCerts, weaponBases } from '@/data/index'
import { useInventoryStore, SLOT_LABEL, type ArmorSlot } from '@/stores/inventory'

defineEmits<{ (e: 'close'): void }>()

const inventory = useInventoryStore()

const mode = ref<'armor' | 'weapon'>('armor')
const floorNum = ref(1)
const quality  = ref(1.0)
const jobId    = ref('')
const weaponBaseId = ref('')
const jobs     = computed(() => Object.values(jobCerts))
const weaponBaseList = computed(() => Object.values(weaponBases))

const armorResults   = ref<FrozenArmor[]>([])
const armorAddedIds  = ref<Set<string>>(new Set())
const weaponResults  = ref<FrozenWeapon[]>([])
const weaponAddedIds = ref<Set<string>>(new Set())
const hasRun    = ref(false)
const runCount  = ref(0)
const totalItems = ref(0)

function simulate() {
  hasRun.value = true
  runCount.value++

  if (mode.value === 'armor') {
    const job = jobId.value ? jobCerts[jobId.value] : null
    const playerJobTags = job ? job.tags : undefined

    const lootResult = resolveLoot(
      {
        itemTypes: ['armor'],
        slotDropChance: { head: 0.5, body: 0.9, hands: 0.4, feet: 0.4, chest: 0.9, gloves: 0.4, legs: 0.4, boots: 0.4 },
        rarityTable: [
          { rarity: 'common', weight: Math.max(1, 8 - floorNum.value) },
          { rarity: 'rare',   weight: 2 + Math.floor(floorNum.value / 2) },
          { rarity: 'elite',  weight: Math.floor(floorNum.value / 3) },
        ],
        affixCountTable: [
          { count: 1, weight: 4 },
          { count: 2, weight: 3 },
          { count: 3, weight: 1 },
        ],
        guaranteed: true,
        gold: 10 + floorNum.value * 5,
        context: {
          floorNumber: floorNum.value,
          dungeonQuality: quality.value,
          theme: 'forest',
          ticketSeed: `sim_${Date.now()}`,
        },
      },
      lootRegistry,
      { playerJobTags },
    )

    armorResults.value = lootResult.items.filter((i): i is FrozenArmor => i.kind === 'armor')
    armorAddedIds.value = new Set()
    totalItems.value += armorResults.value.length
  } else {
    // 武器生成：選取 weaponBases 中的基底，生成 FrozenWeapon
    const allBases = Object.values(weaponBases)
    let candidates = allBases
    if (weaponBaseId.value) {
      candidates = allBases.filter(b => b.id === weaponBaseId.value)
    } else if (jobId.value) {
      const job = jobCerts[jobId.value]
      if (job) {
        const jobTags = new Set(job.tags)
        candidates = allBases.filter(b => b.requiredTags.some(t => jobTags.has(t)))
        if (candidates.length === 0) candidates = allBases
      }
    }

    const results: FrozenWeapon[] = []
    // 生成 1-3 把武器
    const count = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const base = candidates[Math.floor(Math.random() * candidates.length)]
      if (!base) continue

      // 隨機選取詞條 slots（slot3/4 一定選，slot5 依品質機率）
      const affixIds: string[] = []
      // slot1 (element): 從 pool 隨機或用 default（存入 index 0）
      const s1 = base.slot1Default ?? (base.slot1Pool ? base.slot1Pool[Math.floor(Math.random() * base.slot1Pool.length)] : null)
      if (s1) affixIds[0] = s1
      // slot2 (attack mode): 預設值（存入 index 1）
      const s2 = base.slot2Default ?? (base.slot2Pool ? base.slot2Pool[Math.floor(Math.random() * base.slot2Pool.length)] : null)
      if (s2) affixIds[1] = s2
      // slot3 (trait): 依樓層機率
      if (base.slot3Pool && floorNum.value >= 2) {
        affixIds[2] = base.slot3Pool[Math.floor(Math.random() * base.slot3Pool.length)]
      }
      // slot4 (motion): 高品質才有
      if (base.slot4Pool && quality.value >= 1.2) {
        affixIds[3] = base.slot4Pool[Math.floor(Math.random() * base.slot4Pool.length)]
      }
      // slot5 (enchant): 高樓層 + 高品質
      if (base.slot5Pool && floorNum.value >= 4 && quality.value >= 1.5) {
        affixIds[4] = base.slot5Pool[Math.floor(Math.random() * base.slot5Pool.length)]
      }

      const weapon: FrozenWeapon = {
        kind: 'weapon',
        instanceId: `wsim_${Date.now()}_${i}`,
        baseId: base.id,
        name: base.name,
        itemLevel: floorNum.value,
        dungeonQuality: quality.value,
        affixIds: affixIds.filter(Boolean),
      }
      results.push(weapon)
    }
    weaponResults.value = results
    weaponAddedIds.value = new Set()
    totalItems.value += results.length
  }
}

// Armor actions
function addOneArmor(item: FrozenArmor) {
  inventory.addArmorToStash([item])
  armorAddedIds.value = new Set([...armorAddedIds.value, item.instanceId])
}

function addAllArmors() {
  inventory.addArmorToStash(armorResults.value)
  armorAddedIds.value = new Set(armorResults.value.map(i => i.instanceId))
}

// Weapon actions
function addOneWeapon(item: FrozenWeapon) {
  inventory.addWeaponsToStash([item])
  weaponAddedIds.value = new Set([...weaponAddedIds.value, item.instanceId])
}

function addAllWeapons() {
  inventory.addWeaponsToStash(weaponResults.value)
  weaponAddedIds.value = new Set(weaponResults.value.map(i => i.instanceId))
}

function weaponStatSummary(item: FrozenWeapon): ResolvedWeapon | null {
  const base = weaponBases[item.baseId]
  if (!base) return null
  const applied = item.affixIds.map(id => ({ id }))
  return resolveWeapon(base, {}, applied, item.instanceId, item.dungeonQuality)
}

function affixName(id: string): string {
  return lootRegistry.armorAffixes.find(a => a.id === id)?.id ?? id
}

const RARITY_LEVEL: Record<string, number> = { common: 0, rare: 1, elite: 2 }
function computeArmorRarity(item: FrozenArmor): 'common' | 'rare' | 'elite' {
  let max = 0
  for (const id of item.affixIds) {
    const a = lootRegistry.armorAffixes.find(x => x.id === id)
    if (a) max = Math.max(max, RARITY_LEVEL[a.rarity] ?? 0)
  }
  return max >= 2 ? 'elite' : max >= 1 ? 'rare' : 'common'
}

function armorStatSummary(item: FrozenArmor): string {
  const delta = resolveArmorStats(item.affixIds, armorAffixDefs, item.dungeonQuality)
  const parts: string[] = []
  if (delta.str)      parts.push(`STR+${delta.str}`)
  if (delta.agi)      parts.push(`AGI+${delta.agi}`)
  if (delta.int)      parts.push(`INT+${delta.int}`)
  if (delta.lck)      parts.push(`LCK+${delta.lck}`)
  if (delta.maxHP)    parts.push(`HP+${delta.maxHP}`)
  if (delta.maxSP)    parts.push(`SP+${delta.maxSP}`)
  if (delta.maxMP)    parts.push(`MP+${delta.maxMP}`)
  if (delta.moveRange) parts.push(`移動+${delta.moveRange}`)
  for (const [el, v] of Object.entries(delta.resistances)) {
    parts.push(`${el}抗${Math.round(v * 100)}%`)
  }
  for (const [el, v] of Object.entries(delta.defenses)) {
    parts.push(`${el}防+${v}`)
  }
  if (delta.passiveKeys.length > 0) parts.push(`[${delta.passiveKeys.join(',')}]`)
  return parts.join('  ') || '（無直接數值）'
}
</script>

<style scoped>
.sim-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: var(--bg-overlay);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.sim-panel {
  width: 100%; max-width: 520px; max-height: 85vh;
  overflow-y: auto; background: var(--bg-card);
  display: flex; flex-direction: column;
}
.sim-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--border-light); flex-shrink: 0;
}
.sim-title { font-weight: 700; font-size: 14px; color: var(--accent); }
.close-btn {
  background: transparent; border: none; color: var(--text-dim);
  cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 4px;
}
.close-btn:hover { background: var(--accent-bg); color: var(--text); }

.sim-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

/* ── 模式切換 ── */
.mode-tabs { display: flex; gap: 6px; }
.mode-tab {
  flex: 1; padding: 5px 0; border-radius: 4px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border-light); background: var(--bg); color: var(--text-dim);
  cursor: pointer; transition: all .12s;
}
.mode-tab.active { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); }

/* ── 參數 ── */
.param-grid { display: flex; flex-direction: column; gap: 6px; }
.param-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-dim);
}
.param-slider { flex: 1; cursor: pointer; accent-color: var(--accent); }
.param-select {
  flex: 1; background: var(--bg); border: 1px solid var(--border-light);
  color: var(--text); border-radius: 4px; padding: 2px 4px; font-size: 11px;
}
.param-val { min-width: 28px; text-align: right; font-weight: 600; color: var(--accent); font-size: 12px; }

/* ── 按鈕 ── */
.sim-actions { display: flex; gap: 8px; }
.btn--secondary {
  background: var(--bg-card); border: 1px solid var(--border-light);
  color: var(--text); padding: 6px 12px; border-radius: 4px;
  cursor: pointer; font-size: 12px;
}
.btn--secondary:hover { border-color: var(--accent-light); }

/* ── 結果卡 ── */
.result-list { display: flex; flex-direction: column; gap: 8px; }
.result-item {
  border: 1px solid var(--border-light); border-radius: 6px;
  padding: 8px 10px; background: var(--bg);
  display: flex; flex-direction: column; gap: 4px;
}
.result-item--added { opacity: .55; }
.result-header { display: flex; align-items: center; gap: 6px; }
.result-name { flex: 1; font-weight: 700; font-size: 13px; color: var(--text); }
.result-slot { font-size: 10px; color: var(--text-dim); }
.result-level { font-size: 10px; color: var(--text-dim); }
.result-rarity {
  font-size: 9px; padding: 1px 5px; border-radius: 2px; font-weight: 700;
}
.rarity-common { background: #e0e0e0; color: #555; }
.rarity-rare   { background: #d0e8ff; color: #1a5fa0; }
.rarity-elite  { background: #e8d0ff; color: #7b2ca0; }

.result-affixes { display: flex; flex-wrap: wrap; gap: 4px; }
.result-affix-tag {
  font-size: 9px; padding: 1px 5px; border-radius: 3px;
  background: var(--accent-bg); border: 1px solid var(--border-light); color: var(--text-dim);
}
.result-stats { font-size: 10px; color: var(--accent); line-height: 1.5; }
.btn-add {
  align-self: flex-end; font-size: 10px; padding: 3px 10px;
  border-radius: 4px; border: 1px solid var(--accent-light);
  background: transparent; color: var(--accent); cursor: pointer;
}
.btn-add:disabled { opacity: .5; cursor: default; }
.btn-add:not(:disabled):hover { background: var(--accent-bg); }

.no-results { font-size: 12px; color: var(--text-dim); text-align: center; padding: 8px; }

.sim-stats {
  font-size: 11px; color: var(--text-dim); text-align: center;
  border-top: 1px solid var(--border-light); padding-top: 8px;
}
.sim-stats b { color: var(--accent); }
</style>
