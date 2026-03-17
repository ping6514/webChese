<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Monster Girl Tactical MVP</p>
        <h1>開發沙盒</h1>
        <p class="subtitle">
          職業證 / 武器匹配 / 基因 Synergy / 工具 + 六角格戰場原型
        </p>
      </div>
      <div class="tab-switcher">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          :class="['tab-btn', currentTab === tab.id && 'tab-btn--active']"
          @click="currentTab = tab.id"
        >{{ tab.label }}</button>
      </div>
    </header>

    <!-- 六角格原型 -->
    <section v-if="currentTab === 'hex'" class="panel panel--full">
      <HexBoard />
    </section>

    <section v-if="currentTab === 'attack'" class="panel panel--full">
      <AttackTestSandbox />
    </section>

    <section v-if="currentTab === 'battle'" class="panel panel--full">
      <BattlePlayground />
    </section>

    <!-- 編成沙盒（原有內容） -->
    <template v-if="currentTab === 'build'">
      <div class="hero-badge-row">
        <div class="hero-badge">
          <span>{{ resolution.certId }}</span>
          <strong>{{ selectedCert.name }}</strong>
        </div>
      </div>

    <section class="panel-grid panel-grid--top">
      <article class="panel">
        <h2>職業證</h2>
        <div class="stat-stack">
          <div class="key-value"><span>名稱</span><strong>{{ selectedCert.name }}</strong></div>
          <div class="key-value"><span>家族</span><strong>{{ selectedCert.family }}</strong></div>
          <div class="key-value"><span>定位</span><strong>{{ selectedCert.combatRole }}</strong></div>
          <div class="key-value"><span>種族標籤</span><strong>{{ selectedCert.raceTags.join(' / ') }}</strong></div>
        </div>
      </article>

      <article class="panel">
        <h2>證件基礎數值</h2>
        <div class="chip-row">
          <span class="chip">HP {{ selectedCert.baseStats.hp }}</span>
          <span class="chip">Move {{ selectedCert.baseStats.move }}</span>
          <span class="chip">STR {{ selectedCert.baseStats.str }}</span>
          <span class="chip">AGI {{ selectedCert.baseStats.agi }}</span>
          <span class="chip">INT {{ selectedCert.baseStats.int }}</span>
        </div>
      </article>
    </section>

    <section class="panel-grid panel-grid--controls">
      <article class="panel">
        <h2>編成控制</h2>
        <div class="control-grid">
          <label class="field">
            <span>職業證</span>
            <select v-model="selectedCertId">
              <option v-for="cert in demoCerts" :key="cert.id" :value="cert.id">{{ cert.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>主武器</span>
            <select v-model="selectedWeaponIdA">
              <option v-for="weapon in demoWeapons" :key="weapon.id" :value="weapon.id">{{ weapon.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>副武器</span>
            <select v-model="selectedWeaponIdB">
              <option v-for="weapon in demoWeapons" :key="weapon.id" :value="weapon.id">{{ weapon.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>基因</span>
            <select v-model="selectedGeneIds" multiple>
              <option v-for="gene in availableGenes" :key="gene.id" :value="gene.id">{{ gene.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>工具</span>
            <select v-model="selectedToolIds" multiple>
              <option v-for="tool in demoTools" :key="tool.id" :value="tool.id">{{ tool.name }}</option>
            </select>
          </label>
        </div>
      </article>

      <article class="panel">
        <h2>目前編成摘要</h2>
        <div class="stat-stack">
          <div class="key-value"><span>武器數</span><strong>{{ selectedWeapons.length }}</strong></div>
          <div class="key-value"><span>基因數</span><strong>{{ selectedGenes.length }}</strong></div>
          <div class="key-value"><span>工具數</span><strong>{{ selectedTools.length }}</strong></div>
          <div class="key-value"><span>專屬基因候選</span><strong>{{ selectedCert.exclusiveGeneOptions.join(' / ') || 'none' }}</strong></div>
        </div>
      </article>
    </section>

    <section class="panel-grid">
      <article class="panel panel--wide">
        <h2>武器匹配結果</h2>
        <div class="card-list">
          <section v-for="item in weaponCards" :key="item.id" class="build-card">
            <div class="build-card__header">
              <div>
                <h3>{{ item.name }}</h3>
                <p>{{ item.weaponType }} / {{ item.damageType }}</p>
              </div>
              <span :class="['mode-badge', item.modeClass]">{{ item.modeLabel }}</span>
            </div>

            <div class="chip-row">
              <span class="chip">Family Match: {{ item.match.matchedFamily ? 'Yes' : 'No' }}</span>
              <span class="chip">Matched Tags: {{ item.match.matchedTags.join(', ') || 'none' }}</span>
              <span class="chip">Missing: {{ item.match.missingRequiredTags.join(', ') || 'none' }}</span>
            </div>

            <div class="stat-stack stat-stack--compact">
              <div class="key-value"><span>Damage Mult</span><strong>{{ item.match.effect.damageMult ?? 1 }}</strong></div>
              <div class="key-value"><span>Protect Neighbor</span><strong>{{ item.match.effect.enableProtectNeighbor ? 'On' : 'Off' }}</strong></div>
              <div class="key-value"><span>Push</span><strong>{{ item.match.effect.enablePush ? 'On' : 'Off' }}</strong></div>
              <div class="key-value"><span>Extra Status</span><strong>{{ item.match.effect.extraStatuses?.join(', ') || 'none' }}</strong></div>
            </div>
          </section>
        </div>
      </article>

      <article class="panel">
        <h2>基因效果</h2>
        <div class="card-list">
          <section v-for="gene in resolution.resolvedGenes" :key="gene.geneId" class="build-card build-card--simple">
            <div class="build-card__header">
              <div>
                <h3>{{ geneMap[gene.geneId]?.name ?? gene.geneId }}</h3>
                <p>{{ gene.geneType }}</p>
              </div>
              <span :class="['mode-badge', gene.synergyApplied ? 'mode-badge--perfect' : 'mode-badge--base']">
                {{ gene.synergyApplied ? 'Synergy On' : 'Base Only' }}
              </span>
            </div>
            <pre>{{ stringifyEffect(gene.finalEffect) }}</pre>
          </section>
        </div>
      </article>

      <article class="panel">
        <h2>工具</h2>
        <div class="card-list">
          <section v-for="tool in resolution.resolvedTools" :key="tool.id" class="build-card build-card--simple">
            <div class="build-card__header">
              <div>
                <h3>{{ tool.name }}</h3>
                <p>{{ tool.toolType }} / {{ tool.timing }}</p>
              </div>
              <span class="mode-badge mode-badge--tool">{{ tool.charges }} charge</span>
            </div>
            <pre>{{ stringifyEffect(tool.effectSummary) }}</pre>
          </section>
        </div>
      </article>
    </section>
    </template> <!-- end build tab -->
  </main>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CertDef, GeneDef, ToolDef, WeaponDef } from './game/schema'
import {
  demoCerts,
  demoGenes,
  demoTools,
  demoWeapons,
} from './game/mockData'
import { resolveLoadout } from './game/resolveLoadout'
import HexBoard from './components/HexBoard.vue'
import AttackTestSandbox from './components/AttackTestSandbox.vue'
import BattlePlayground from './components/BattlePlayground.vue'

const TABS = [
  { id: 'hex',   label: '六角格原型' },
  { id: 'attack', label: '攻擊判定測試' },
  { id: 'battle', label: '最小戰鬥頁' },
  { id: 'build', label: '編成沙盒' },
] as const
type TabId = typeof TABS[number]['id']
const currentTab = ref<TabId>('hex')

const fallbackCert = demoCerts[0] as CertDef
const fallbackWeaponA = demoWeapons[0] as WeaponDef
const fallbackWeaponB = (demoWeapons[1] ?? demoWeapons[0]) as WeaponDef
const fallbackGeneA = demoGenes[0] as GeneDef
const fallbackGeneB = (demoGenes[1] ?? demoGenes[0]) as GeneDef
const fallbackToolA = demoTools[0] as ToolDef
const fallbackToolB = (demoTools[1] ?? demoTools[0]) as ToolDef

const selectedCertId = ref(fallbackCert.id)
const selectedWeaponIdA = ref(fallbackWeaponA.id)
const selectedWeaponIdB = ref(fallbackWeaponB.id)
const selectedGeneIds = ref<string[]>([fallbackGeneA.id, fallbackGeneB.id])
const selectedToolIds = ref<string[]>([fallbackToolA.id, fallbackToolB.id])

const selectedCert = computed<CertDef>(() =>
  demoCerts.find((cert) => cert.id === selectedCertId.value) ?? fallbackCert,
)

const availableGenes = computed<GeneDef[]>(() =>
  demoGenes.filter((gene) => !gene.ownerCertId || gene.ownerCertId === selectedCert.value.id),
)

watch(selectedCertId, () => {
  selectedGeneIds.value = selectedGeneIds.value.filter((id) =>
    availableGenes.value.some((gene) => gene.id === id),
  )

  if (selectedGeneIds.value.length === 0 && availableGenes.value[0]) {
    selectedGeneIds.value = [availableGenes.value[0].id]
  }
})

const selectedWeapons = computed<WeaponDef[]>(() => {
  return [selectedWeaponIdA.value, selectedWeaponIdB.value]
    .map((id) => demoWeapons.find((weapon) => weapon.id === id))
    .filter((weapon): weapon is WeaponDef => !!weapon)
})

const selectedGenes = computed<GeneDef[]>(() => {
  return selectedGeneIds.value
    .map((id) => demoGenes.find((gene) => gene.id === id))
    .filter((gene): gene is GeneDef => !!gene)
})

const selectedTools = computed<ToolDef[]>(() => {
  return selectedToolIds.value
    .map((id) => demoTools.find((tool) => tool.id === id))
    .filter((tool): tool is ToolDef => !!tool)
})

const resolution = computed(() => resolveLoadout(
  {
    cert: selectedCert.value,
    equippedGeneIds: selectedGeneIds.value,
    equippedToolIds: selectedToolIds.value,
  },
  selectedWeapons.value,
  selectedGenes.value,
  selectedTools.value,
))

const geneMap = demoGenes.reduce<Record<string, (typeof demoGenes)[number]>>((acc, gene) => {
  acc[gene.id] = gene
  return acc
}, {})

const weaponCards = computed(() => {
  return selectedWeapons.value.map((weapon) => {
    const resolved = resolution.value.resolvedWeapons.find((item) => item.weaponId === weapon.id)
    const match = resolved?.match

    return {
      ...weapon,
      match: match!,
      modeLabel: match?.mode === 'perfect_match_mode' ? 'Perfect Match' : 'Base Mode',
      modeClass: match?.mode === 'perfect_match_mode' ? 'mode-badge--perfect' : 'mode-badge--base',
    }
  })
})

function stringifyEffect(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2)
}
</script>
