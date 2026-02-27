<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { listSoulCards, listItemCards } from '../engine'
import type { SoulCard } from '../engine/cards'
import type { ItemCard } from '../engine/items'

const router = useRouter()
const activeTab = ref<'rules' | 'cards'>('rules')
const activeCardTab = ref<'souls' | 'items'>('souls')
const selectedSoul = ref<SoulCard | null>(null)
const selectedItem = ref<ItemCard | null>(null)

const CLAN_META: Record<string, { name: string; color: string; borderColor: string; desc: string }> = {
  dark_moon:     { name: '暗月氏族', color: '#a855f7', borderColor: 'rgba(168,85,247,0.35)', desc: '以穿透射擊與越境能力見長。蘭華、影華等英雄可無視阻擋，在敵陣深處肆虐。' },
  styx:          { name: '冥河氏族', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.35)',  desc: '冥河氏族擅長以犧牲換取暴發。強大的波及與連鎖傷害讓一次攻擊波及多個目標。' },
  eternal_night: { name: '永夜氏族', color: '#f97316', borderColor: 'rgba(249,115,22,0.35)',  desc: '永夜氏族以持久戰為核心。吸血恢復與堅韌防禦讓其在殘局中佔得優勢。' },
}

const BASE_CN: Record<string, string> = {
  king: '帥/將', advisor: '仕/士', elephant: '相/象',
  rook: '車', knight: '馬', cannon: '砲/炮', soldier: '兵/卒',
}

const BASE_ORDER = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier']

const TIMING_LABEL: Record<string, string> = { buy: '💰 購買', necro: '⚗️ 死靈', combat: '⚔️ 戰鬥' }
const TIMING_CLASS: Record<string, string> = { buy: 'timingBuy', necro: 'timingNecro', combat: 'timingCombat' }

const allSouls = listSoulCards()
const allItems = listItemCards()

// Group souls by clan → then by base
const clans = computed(() => {
  return Object.keys(CLAN_META).map((clanId) => {
    const cards = allSouls.filter((c) => c.clan === clanId)
    const byBase: Record<string, SoulCard[]> = {}
    for (const b of BASE_ORDER) {
      const group = cards.filter((c) => c.base === b)
      if (group.length) byBase[b] = group
    }
    return { id: clanId, ...CLAN_META[clanId], byBase }
  })
})

function selectSoul(c: SoulCard) {
  selectedSoul.value = selectedSoul.value?.id === c.id ? null : c
  selectedItem.value = null
}
function selectItem(c: ItemCard) {
  selectedItem.value = selectedItem.value?.id === c.id ? null : c
  selectedSoul.value = null
}
</script>

<template>
  <div class="page">
    <!-- ── Header ──────────────────────────────────────── -->
    <header class="header">
      <button type="button" class="backBtn" @click="router.push({ name: 'home' })">← 返回</button>
      <h1 class="pageTitle">幽冥棋 圖鑑</h1>
      <div class="tabs">
        <button type="button" :class="['tab', activeTab === 'rules' && 'tabActive']" @click="activeTab = 'rules'">📜 規則書</button>
        <button type="button" :class="['tab', activeTab === 'cards' && 'tabActive']" @click="activeTab = 'cards'">🃏 卡牌圖鑑</button>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════
         RULES TAB
    ══════════════════════════════════════════════════ -->
    <main v-if="activeTab === 'rules'" class="rulesMain">
      <div class="rulebook">

        <section class="ruleSection">
          <h2>⚔️ 遊戲概述</h2>
          <p>幽冥棋是以中國象棋為底盤的卡牌策略遊戲。兩位玩家輪流行動，透過購買靈魂卡、召喚英靈、施展道具，最終<strong>擊殺對方帥（將）</strong>即獲勝。</p>
        </section>

        <section class="ruleSection">
          <h2>🎲 棋盤</h2>
          <ul>
            <li>棋盤為 <strong>9 × 10</strong> 格，中央有「楚河漢界」（第 5 / 6 行之間）。</li>
            <li>紅方棋子在下半場（Y = 6–9），黑方在上半場（Y = 0–3）。</li>
            <li>九宮格：紅方 X 3–5 / Y 7–9；黑方 X 3–5 / Y 0–2，帥/將與仕/士僅限九宮內移動。</li>
          </ul>
        </section>

        <section class="ruleSection">
          <h2>💰 資源</h2>
          <div class="resourceGrid">
            <div class="resourceCard">
              <div class="resTitle">💰 財力</div>
              <div class="resDesc">購買靈魂卡、道具卡、復活棋子的主要貨幣。每回合開始自動獲得收入（預設 +2）。上限 15。</div>
            </div>
            <div class="resourceCard">
              <div class="resTitle">✨ 魔力</div>
              <div class="resDesc">砲系棋子射擊時消耗 1 魔力。每回合開始 +3。未使用的魔力可在回合結束儲存（上限 5），下回合轉換為財力。</div>
            </div>
          </div>
        </section>

        <section class="ruleSection">
          <h2>🔄 回合流程</h2>
          <div class="phaseList">
            <div class="phaseItem">
              <div class="phaseTag buy">💰 購買</div>
              <div class="phaseDesc">
                <ul>
                  <li><strong>購買靈魂卡</strong>：每次花費 2~1 魔力，從對應棋子類型的展示卡中購入手牌（上限 5 張）。每回合限 1 次。</li>
                  <li><strong>購買道具卡</strong>：花費道具標示費用，加入手牌（上限 3 張）。每回合限 1 次。</li>
                  <li><strong>盜取</strong>：消耗 3 魔力，從敵方墓場頂部盜取一張靈魂卡。</li>
                  <li><strong>使用「購買」道具</strong>：使用手牌中時機為「購買」的道具卡。</li>
                </ul>
              </div>
            </div>
            <div class="phaseItem">
              <div class="phaseTag necro">⚗️ 死靈術</div>
              <div class="phaseDesc">
                <ul>
                  <li><strong>附魂（附魔）</strong>：將手牌靈魂卡附於己方棋子，棋子獲得靈魂的 HP、ATK、防禦與特殊能力。費用依靈魂卡標示。每回合限 2 次。</li>
                  <li><strong>復活</strong>：支付財力，從墓場復活己方死亡棋子至原位。費用依棋子種類。每回合限 1 次。</li>
                  <li><strong>血祭</strong>：犧牲一個己方棋子，獲得強力增益（詳見道具說明）。</li>
                  <li><strong>使用「死靈」道具</strong>：使用手牌中時機為「死靈術」的道具卡。</li>
                </ul>
              </div>
            </div>
            <div class="phaseItem">
              <div class="phaseTag combat">⚔️ 戰鬥</div>
              <div class="phaseDesc">
                <ul>
                  <li><strong>移動</strong>：每個單位每回合限移動一次，遵循象棋走法（帥原地）。</li>
                  <li><strong>射擊（砲）</strong>：砲/附魂砲可在移動後或不移動時射擊，消耗 1 魔力，需有阻擋物（炮架）。</li>
                  <li><strong>使用「戰鬥」道具</strong>：使用手牌中時機為「戰鬥」的道具卡。</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section class="ruleSection">
          <h2>👻 靈魂卡系統</h2>
          <ul>
            <li>共分 3 個氏族：<strong>暗月氏族</strong>、<strong>冥河氏族</strong>、<strong>永夜氏族</strong>。</li>
            <li>每種棋子類型有獨立的靈魂牌堆。購買時只能購入與棋子類型相符的靈魂卡（例如「車」只能買車型靈魂）。</li>
            <li>附魂後棋子的 HP、ATK、DEF 替換為靈魂卡數值，並獲得特殊能力。</li>
            <li>棋子死亡後靈魂卡進入己方墓場。可於死靈術階段復活並重新附魂。</li>
            <li>敵方墓場頂部的靈魂卡可被「盜取」。</li>
          </ul>
        </section>

        <section class="ruleSection">
          <h2>🎒 道具卡系統</h2>
          <ul>
            <li>購買後加入手牌（上限 3 張），不限氏族。</li>
            <li>每張道具有固定的使用時機：<span class="inlineTag buy">💰 購買</span>、<span class="inlineTag necro">⚗️ 死靈</span>、<span class="inlineTag combat">⚔️ 戰鬥</span>。</li>
            <li>使用後進入棄牌堆（無法回手）。</li>
            <li>購買階段也可以棄置手牌中的道具卡（退出使用）。</li>
          </ul>
        </section>

        <section class="ruleSection">
          <h2>⚙️ 特殊能力說明</h2>
          <div class="abilityGrid">
            <div class="abilityItem"><span class="abilityName">越境</span>射擊時可忽略部分或全部阻擋。</div>
            <div class="abilityItem"><span class="abilityName">鬼步</span>移動時可無視敵方阻擋（穿越）。</div>
            <div class="abilityItem"><span class="abilityName">貫通</span>砲彈繼續飛行，擊中第二個目標。</div>
            <div class="abilityItem"><span class="abilityName">波及</span>射擊命中後，波及附近格的敵方單位。</div>
            <div class="abilityItem"><span class="abilityName">連鎖</span>攻擊後可選擇連鎖攻擊第二目標。</div>
            <div class="abilityItem"><span class="abilityName">吸血</span>攻擊命中後恢復等量 HP。</div>
            <div class="abilityItem"><span class="abilityName">無敵</span>帥本回合無法被攻擊（道具觸發）。</div>
            <div class="abilityItem"><span class="abilityName">移動後射</span>移動後可額外執行一次射擊。</div>
          </div>
        </section>

        <section class="ruleSection">
          <h2>🏆 勝負判定</h2>
          <p><strong>帥（將）被擊殺，即判該方負。</strong>帥/將的 HP 耗盡即死亡——無論被直接攻擊還是砲擊均算。帥有 15 HP，且附有 2/2 物理/魔法防禦加成，需集中火力。</p>
        </section>

      </div>
    </main>

    <!-- ══════════════════════════════════════════════════
         CARDS TAB
    ══════════════════════════════════════════════════ -->
    <main v-else class="cardsMain">
      <!-- Sub-tabs -->
      <div class="cardSubTabs">
        <button type="button" :class="['subTab', activeCardTab === 'souls' && 'subTabActive']" @click="activeCardTab = 'souls'">👻 靈魂卡</button>
        <button type="button" :class="['subTab', activeCardTab === 'items' && 'subTabActive']" @click="activeCardTab = 'items'">🎒 道具卡</button>
      </div>

      <div class="cardLayout">
        <!-- ── Soul cards ────────────────────────────── -->
        <div v-if="activeCardTab === 'souls'" class="soulSection">
          <div v-for="clan in clans" :key="clan.id" class="clanBlock">
            <div class="clanHeader" :style="{ borderLeftColor: clan.color }">
              <span class="clanName" :style="{ color: clan.color }">{{ clan.name }}</span>
              <span class="clanDesc">{{ clan.desc }}</span>
            </div>
            <div v-for="(cards, base) in clan.byBase" :key="base" class="baseGroup">
              <div class="baseLabel">{{ BASE_CN[base] ?? base }}</div>
              <div class="cardGrid">
                <div
                  v-for="c in cards"
                  :key="c.id"
                  :class="['soulCard', selectedSoul?.id === c.id && 'cardSelected']"
                  :style="{ borderColor: selectedSoul?.id === c.id ? clan.color : undefined }"
                  @click="selectSoul(c)"
                >
                  <img v-if="c.image" :src="c.image" class="cardImg" :alt="c.name" />
                  <div v-else class="cardImgEmpty">👻</div>
                  <div class="cardMeta">
                    <span class="cardName">{{ c.name }}</span>
                    <span class="cardCost">{{ c.costGold }}G</span>
                  </div>
                  <div class="statRow">
                    <span class="stat hp">❤ {{ c.stats.hp }}</span>
                    <span class="stat atk">⚔ {{ c.stats.atk.value }}</span>
                    <span class="stat def">🛡 {{ c.stats.def.map(d => d.value).join('/') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Item cards ────────────────────────────── -->
        <div v-if="activeCardTab === 'items'" class="itemSection">
          <div class="cardGrid itemGrid">
            <div
              v-for="c in allItems"
              :key="c.id"
              :class="['itemCard', selectedItem?.id === c.id && 'cardSelected']"
              @click="selectItem(c)"
            >
              <div class="itemTop">
                <span :class="['timingBadge', TIMING_CLASS[c.timing ?? '']]">{{ TIMING_LABEL[c.timing ?? ''] ?? '—' }}</span>
                <span class="cardCost">{{ c.costGold }}G</span>
              </div>
              <img v-if="c.image" :src="c.image" class="cardImg" :alt="c.name" />
              <div v-else class="cardImgEmpty">🎒</div>
              <div class="cardName">{{ c.name }}</div>
            </div>
          </div>
        </div>

        <!-- ── Detail panel ──────────────────────────── -->
        <aside v-if="selectedSoul || selectedItem" class="detailPanel">
          <!-- Soul detail -->
          <template v-if="selectedSoul">
            <img v-if="selectedSoul.image" :src="selectedSoul.image" class="detailImg" :alt="selectedSoul.name" />
            <div v-else class="detailImgEmpty">👻</div>
            <div class="detailName">{{ selectedSoul.name }}</div>
            <div class="detailSub">{{ BASE_CN[selectedSoul.base] ?? selectedSoul.base }} · {{ CLAN_META[selectedSoul.clan]?.name }}</div>
            <div class="detailCost">費用 {{ selectedSoul.costGold }} 財力</div>
            <div class="detailStats">
              <div class="detailStat"><span class="statLabel">HP</span><span class="statVal hp">{{ selectedSoul.stats.hp }}</span></div>
              <div class="detailStat"><span class="statLabel">ATK</span><span class="statVal atk">{{ selectedSoul.stats.atk.value }} ({{ selectedSoul.stats.atk.key }})</span></div>
              <div v-for="d in selectedSoul.stats.def" :key="d.key" class="detailStat">
                <span class="statLabel">DEF ({{ d.key }})</span><span class="statVal def">{{ d.value }}</span>
              </div>
            </div>
            <div v-if="selectedSoul.text" class="detailText">{{ selectedSoul.text }}</div>
          </template>
          <!-- Item detail -->
          <template v-if="selectedItem">
            <img v-if="selectedItem.image" :src="selectedItem.image" class="detailImg" :alt="selectedItem.name" />
            <div v-else class="detailImgEmpty">🎒</div>
            <div class="detailName">{{ selectedItem.name }}</div>
            <div class="detailSub">
              <span :class="['timingBadge', TIMING_CLASS[selectedItem.timing ?? '']]">{{ TIMING_LABEL[selectedItem.timing ?? ''] ?? '—' }}</span>
            </div>
            <div class="detailCost">費用 {{ selectedItem.costGold }} 財力</div>
            <div v-if="selectedItem.text" class="detailText">{{ selectedItem.text }}</div>
          </template>
          <button type="button" class="closeDetail" @click="selectedSoul = null; selectedItem = null">✕ 關閉</button>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ── Page shell ──────────────────────────────────────── */
.page {
  min-height: 100vh;
  background: var(--bg-page);
  color: var(--text);
  display: flex;
  flex-direction: column;
}

/* ── Header ──────────────────────────────────────────── */
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

/* ── Rules ───────────────────────────────────────────── */
.rulesMain {
  flex: 1;
  padding: 24px max(24px, 5vw);
  max-width: 820px;
  margin: 0 auto;
  width: 100%;
}

.rulebook {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.ruleSection h2 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  color: var(--accent-gold);
}

.ruleSection p,
.ruleSection ul,
.ruleSection li {
  font-size: 0.875rem;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0;
}
.ruleSection ul { padding-left: 20px; }
.ruleSection li { margin-bottom: 4px; }
.ruleSection strong { color: var(--text); }

.resourceGrid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.resourceCard {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
}
.resTitle { font-size: 0.9375rem; font-weight: 700; margin-bottom: 6px; color: var(--text); }
.resDesc { font-size: 0.8125rem; line-height: 1.6; color: var(--text-muted); }

.phaseList { display: flex; flex-direction: column; gap: 10px; }
.phaseItem {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--bg-surface-1);
}
.phaseTag {
  padding: 6px 14px;
  font-size: 0.8125rem;
  font-weight: 700;
}
.phaseTag.buy    { background: rgba(232, 208, 112, 0.12); color: var(--accent-gold); }
.phaseTag.necro  { background: rgba(145, 202, 255, 0.10); color: var(--accent-blue); }
.phaseTag.combat { background: rgba(255, 77, 79, 0.10);   color: var(--accent-red-light); }
.phaseDesc { padding: 10px 14px; }
.phaseDesc ul { padding-left: 18px; margin: 0; }
.phaseDesc li { font-size: 0.8125rem; line-height: 1.65; color: var(--text-muted); margin-bottom: 4px; }
.phaseDesc strong { color: var(--text); }

.inlineTag {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  margin: 0 2px;
}
.inlineTag.buy    { background: rgba(232, 208, 112, 0.15); color: var(--accent-gold); }
.inlineTag.necro  { background: rgba(145, 202, 255, 0.12); color: var(--accent-blue); }
.inlineTag.combat { background: rgba(255, 77, 79, 0.12);   color: var(--accent-red-light); }

.abilityGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.abilityItem {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  font-size: 0.8125rem;
  color: var(--text-muted);
  line-height: 1.5;
}
.abilityName {
  display: inline-block;
  font-weight: 700;
  color: var(--accent-blue);
  margin-right: 6px;
}

/* ── Cards main layout ───────────────────────────────── */
.cardsMain {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  gap: 16px;
}

.cardSubTabs {
  display: flex;
  gap: 8px;
}
.subTab {
  padding: 6px 18px;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.subTab:hover { color: var(--text); }
.subTabActive {
  background: rgba(145, 202, 255, 0.12);
  border-color: rgba(145, 202, 255, 0.4);
  color: var(--accent-blue);
}

.cardLayout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex: 1;
}

/* ── Soul cards ──────────────────────────────────────── */
.soulSection {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.clanBlock {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.clanHeader {
  padding: 8px 14px;
  border-left: 3px solid;
  background: var(--bg-surface-1);
  border-radius: 0 8px 8px 0;
}
.clanName {
  font-size: 0.9375rem;
  font-weight: 700;
  display: block;
  margin-bottom: 3px;
}
.clanDesc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.baseGroup { display: flex; flex-direction: column; gap: 8px; }
.baseLabel {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cardGrid {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.soulCard {
  width: 110px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
  padding: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.soulCard:hover { border-color: var(--border-strong); background: var(--bg-surface-2); }
.cardSelected { box-shadow: 0 0 0 2px currentColor; }

.cardImg {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.cardImgEmpty {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 6px;
  border: 1px dashed var(--border);
  display: grid;
  place-items: center;
  font-size: 1.5rem;
  background: var(--bg-surface-3);
}

.cardMeta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.cardName {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cardCost {
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--accent-gold);
  white-space: nowrap;
}

.statRow {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.stat {
  font-size: 0.625rem;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 700;
}
.stat.hp  { background: rgba(255, 77, 79, 0.12);   color: var(--accent-red-light); }
.stat.atk { background: rgba(232, 208, 112, 0.12); color: var(--accent-gold); }
.stat.def { background: rgba(145, 202, 255, 0.10); color: var(--accent-blue); }

/* ── Item cards ──────────────────────────────────────── */
.itemSection { flex: 1; min-width: 0; }
.itemGrid { flex-wrap: wrap; }

.itemCard {
  width: 130px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.itemCard:hover { border-color: var(--border-strong); }

.itemTop {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.timingBadge {
  font-size: 0.625rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 6px;
}
.timingBuy    { background: rgba(232, 208, 112, 0.15); color: var(--accent-gold); }
.timingNecro  { background: rgba(145, 202, 255, 0.12); color: var(--accent-blue); }
.timingCombat { background: rgba(255, 120, 100, 0.12); color: var(--accent-red-light); }

/* ── Detail panel ────────────────────────────────────── */
.detailPanel {
  position: sticky;
  top: 70px;
  width: 200px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detailImg {
  width: 100%;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--border);
}
.detailImgEmpty {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  border: 1px dashed var(--border);
  display: grid;
  place-items: center;
  font-size: 2.5rem;
  background: var(--bg-surface-3);
}
.detailName {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}
.detailSub {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.detailCost {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--accent-gold);
}
.detailStats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detailStat {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--bg-surface-2);
}
.statLabel { color: var(--text-muted); }
.statVal { font-weight: 700; }
.statVal.hp  { color: var(--accent-red-light); }
.statVal.atk { color: var(--accent-gold); }
.statVal.def { color: var(--accent-blue); }

.detailText {
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.closeDetail {
  margin-top: 4px;
  padding: 5px;
  font-size: 0.75rem;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.closeDetail:hover { color: var(--text); border-color: var(--border-strong); }
</style>
