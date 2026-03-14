<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import IntroRulesTab from './IntroRulesTab.vue'
import IntroCardsTab from './IntroCardsTab.vue'

const router = useRouter()
const activeTab = ref<'rules' | 'cards'>('rules')
</script>

<template>
  <div class="page">
    <header class="header">
      <button type="button" class="backBtn" @click="router.push({ name: 'home' })">← 返回</button>
      <h1 class="pageTitle">幽冥棋 圖鑑</h1>
      <div class="tabs">
        <button type="button" :class="['tab', activeTab === 'rules' && 'tabActive']" @click="activeTab = 'rules'">📜 規則書</button>
        <button type="button" :class="['tab', activeTab === 'cards' && 'tabActive']" @click="activeTab = 'cards'">🃏 卡牌圖鑑</button>
      </div>
    </header>

    <IntroRulesTab v-if="activeTab === 'rules'" />
    <IntroCardsTab v-else />
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text);
  display: flex;
  flex-direction: column;
}

.header {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bg-topbar);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.backBtn {
  padding: 5px 14px;
  font-size: 0.8125rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.backBtn:hover { color: var(--text); border-color: var(--border-strong); }

.pageTitle {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
  color: var(--accent-gold);
  letter-spacing: 0.08em;
}

.tabs {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.tab {
  padding: 6px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.tab:hover { color: var(--text); }
.tabActive {
  background: rgba(232, 208, 112, 0.14);
  border-color: rgba(232, 208, 112, 0.4);
  color: var(--accent-gold);
}

@media (max-width: 420px) {
  .header { padding: 8px 12px; gap: 10px; }
  .pageTitle { font-size: 1rem; }
  .tab { padding: 5px 10px; font-size: 0.75rem; }
}
</style>
