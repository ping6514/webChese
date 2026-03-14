<script setup lang="ts">
import { ref, computed } from 'vue'
import { listSoulCards, listItemCards } from '../engine'
import type { SoulCard } from '../engine/cards'
import type { ItemCard } from '../engine/items'
import { BASE_STATS } from '../engine/state'
import type { PieceBase } from '../engine/types'

const CLAN_META: Record<string, { name: string; color: string; borderColor: string; desc: string }> = {
  dark_moon:     { name: '暗月氏族', color: '#a855f7', borderColor: 'rgba(168,85,247,0.35)', desc: '以穿透射擊與越境能力見長。蘭華、影華等英雄可無視阻擋，在敵陣深處肆虐。' },
  styx:          { name: '冥河氏族', color: '#38bdf8', borderColor: 'rgba(56,189,248,0.35)',  desc: '冥河氏族擅長以犧牲換取暴發。強大的波及與連鎖傷害讓一次攻擊波及多個目標。' },
  eternal_night: { name: '永夜氏族', color: '#4ade80', borderColor: 'rgba(74,222,128,0.35)',  desc: '永夜氏族以持久戰為核心。吸血恢復與堅韌防禦讓其在殘局中佔得優勢。' },
  iron_guard:    { name: '鐵衛氏族', color: '#f97316', borderColor: 'rgba(249,115,22,0.35)', desc: '鐵衛氏族以卒的數量為核心。卒越多，全軍傷害與防禦越強。整編、後勤讓卒永不停歇。' },
  gold_merc:     { name: '黃金傭兵', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.35)',  desc: '黃金傭兵以財力驅動戰力。金幣越多防禦越強，擊殺可掠奪財富，甚至以黃金換取額外傷害。' },
  death_oath:    { name: '亡命誓約', color: '#f43f5e', borderColor: 'rgba(244,63,94,0.35)',   desc: '亡命誓約以逆境激發潛能。帥血量越低或兵力劣勢越大，全軍攻擊越猛，誓死不退。' },
}

const activeClanId = ref<string>('dark_moon')
const activeCardTab = ref<'souls' | 'items' | 'bases'>('souls')
const selectedSoul = ref<SoulCard | null>(null)
const selectedItem = ref<ItemCard | null>(null)
const selectedBase = ref<string | null>(null)

const BASE_CN: Record<string, string> = {
  king: '帥/將', advisor: '仕/士', elephant: '相/象',
  rook: '車', knight: '馬', cannon: '砲/炮', soldier: '兵/卒',
}
const BASE_ORDER = ['king', 'advisor', 'elephant', 'rook', 'knight', 'cannon', 'soldier']

const BASE_MOVE: Record<string, string> = {
  king:     '每次移動一格，限在己方九宮格內。無法復活。',
  advisor:  '斜走一格，限在己方九宮格內。',
  elephant: '斜走兩格（田字），不可過河，可被馬腿阻塞。',
  rook:     '橫直任意格數移動，無阻擋限制。',
  knight:   '日字移動，出發格旁有棋子時無法朝該方向移動（馬腿）。',
  cannon:   '橫直移動；射擊需要砲架（中間隔一棋子）。',
  soldier:  '未過河前只能前進，過河後可橫向移動。',
}

const ATK_KEY_LABEL: Record<string, string> = { phys: '物理', magic: '魔法' }

const BASE_PIECE_LIST = BASE_ORDER.map((b) => ({
  base: b as PieceBase,
  name: BASE_CN[b] ?? b,
  img: `/assets/cards/base/${b}.jpg`,
  stats: BASE_STATS[b as PieceBase],
  move: BASE_MOVE[b] ?? '',
}))

const TIMING_LABEL: Record<string, string> = { buy: '💰 購買', necro: '⚗️ 死靈', combat: '⚔️ 戰鬥' }
const TIMING_CLASS: Record<string, string> = { buy: 'timingBuy', necro: 'timingNecro', combat: 'timingCombat' }

const allSouls = listSoulCards()
const allItems = listItemCards()
const clanIds = Object.keys(CLAN_META)

const activeClan = computed(() => {
  const clanId = activeClanId.value
  const meta = CLAN_META[clanId]!
  const cards = allSouls.filter((c) => c.clan === clanId)
  const byBase: Record<string, SoulCard[]> = {}
  for (const b of BASE_ORDER) {
    const group = cards.filter((c) => c.base === b)
    if (group.length) byBase[b] = group
  }
  return { id: clanId, ...meta, byBase }
})

const hasDetail = computed(() => !!(selectedSoul.value || selectedItem.value || selectedBase.value))

const selectedBaseData = computed(() =>
  selectedBase.value ? BASE_PIECE_LIST.find((p) => p.base === selectedBase.value) ?? null : null
)

function selectSoul(c: SoulCard) {
  selectedSoul.value = selectedSoul.value?.id === c.id ? null : c
  selectedItem.value = null
  selectedBase.value = null
}
function selectItem(c: ItemCard) {
  selectedItem.value = selectedItem.value?.id === c.id ? null : c
  selectedSoul.value = null
  selectedBase.value = null
}
function selectBase(base: string) {
  selectedBase.value = selectedBase.value === base ? null : base
  selectedSoul.value = null
  selectedItem.value = null
}
function closeDetail() {
  selectedSoul.value = null
  selectedItem.value = null
  selectedBase.value = null
}
</script>

<template>
  <main class="cardsMain">
    <!-- Sub-tabs -->
    <div class="cardSubTabs">
      <button type="button" :class="['subTab', activeCardTab === 'souls' && 'subTabActive']" @click="activeCardTab = 'souls'; selectedBase = null">👻 靈魂卡</button>
      <button type="button" :class="['subTab', activeCardTab === 'items' && 'subTabActive']" @click="activeCardTab = 'items'; selectedBase = null">🎒 道具卡</button>
      <button type="button" :class="['subTab', activeCardTab === 'bases' && 'subTabActive']" @click="activeCardTab = 'bases'; closeDetail()">⚔️ 基礎兵種</button>
    </div>

    <div class="cardLayout">
      <!-- ── Soul cards ────────────────────────────── -->
      <div v-if="activeCardTab === 'souls'" class="soulSection">
        <div class="clanTabs">
          <button
            v-for="cid in clanIds"
            :key="cid"
            type="button"
            :class="['clanTab', activeClanId === cid && 'clanTabActive']"
            :style="activeClanId === cid ? { borderColor: CLAN_META[cid]!.borderColor, color: CLAN_META[cid]!.color, background: `${CLAN_META[cid]!.borderColor}` } : {}"
            @click="activeClanId = cid; selectedSoul = null"
          >{{ CLAN_META[cid]!.name }}</button>
        </div>
        <div class="clanHeader" :style="{ borderLeftColor: activeClan.color }">
          <span class="clanName" :style="{ color: activeClan.color }">{{ activeClan.name }}</span>
          <span class="clanDesc">{{ activeClan.desc }}</span>
        </div>
        <div class="baseGroups">
          <div v-for="(cards, base) in activeClan.byBase" :key="base" class="baseGroup">
            <div class="baseLabel">{{ BASE_CN[base] ?? base }}</div>
            <div class="cardGrid">
              <div
                v-for="c in cards"
                :key="c.id"
                :class="['soulCard', selectedSoul?.id === c.id && 'cardSelected']"
                :style="{ borderColor: selectedSoul?.id === c.id ? activeClan.color : undefined }"
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
                  <span class="stat def">🛡 {{ c.stats.def.map((d: any) => d.value).join('/') }}</span>
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
            <div class="itemCopies">×{{ c.copies ?? 1 }} 張</div>
          </div>
        </div>
      </div>

      <!-- ── Base pieces ───────────────────────────── -->
      <div v-if="activeCardTab === 'bases'" class="baseSection">
        <div class="basePieceGrid">
          <div
            v-for="piece in BASE_PIECE_LIST"
            :key="piece.base"
            :class="['basePieceCard', selectedBase === piece.base && 'cardSelected']"
            @click="selectBase(piece.base)"
          >
            <img :src="piece.img" class="cardImg" :alt="piece.name" />
            <div class="cardName">{{ piece.name }}</div>
            <div class="statRow">
              <span class="stat hp">❤ {{ piece.stats.hp }}</span>
              <span class="stat atk">⚔ {{ piece.stats.atk }}</span>
              <span class="stat def">🛡 {{ piece.stats.def.map((d) => d.value).join('/') }}</span>
            </div>
            <div class="baseCost">
              {{ piece.stats.reviveCost >= 999 ? '不可復活' : `復活 ${piece.stats.reviveCost}G` }}
            </div>
          </div>
        </div>
      </div>

      <!-- ── Detail panel (desktop sidebar) ───────── -->
      <aside v-if="hasDetail" class="detailPanel detailDesktop">
        <template v-if="selectedSoul">
          <div class="detailPanelImg">
            <img v-if="selectedSoul.image" :src="selectedSoul.image" class="detailImg" :alt="selectedSoul.name" />
            <div v-else class="detailImgEmpty">👻</div>
          </div>
          <div class="detailPanelInfo">
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
            <button type="button" class="closeDetail" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>
        <template v-if="selectedItem">
          <div class="detailPanelImg">
            <img v-if="selectedItem.image" :src="selectedItem.image" class="detailImg" :alt="selectedItem.name" />
            <div v-else class="detailImgEmpty">🎒</div>
          </div>
          <div class="detailPanelInfo">
            <div class="detailName">{{ selectedItem.name }}</div>
            <div class="detailSub">
              <span :class="['timingBadge', TIMING_CLASS[selectedItem.timing ?? '']]">{{ TIMING_LABEL[selectedItem.timing ?? ''] ?? '—' }}</span>
            </div>
            <div class="detailCost">費用 {{ selectedItem.costGold }} 財力</div>
            <div class="detailStats">
              <div class="detailStat">
                <span class="statLabel">牌組配率</span>
                <span class="statVal" style="color: var(--text)">×{{ selectedItem.copies ?? 1 }} 張</span>
              </div>
            </div>
            <div v-if="selectedItem.text" class="detailText">{{ selectedItem.text }}</div>
            <button type="button" class="closeDetail" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>
        <template v-if="selectedBaseData">
          <div class="detailPanelImg">
            <img :src="selectedBaseData.img" class="detailImg" :alt="selectedBaseData.name" />
          </div>
          <div class="detailPanelInfo">
            <div class="detailName">{{ selectedBaseData.name }}</div>
            <div class="detailSub">基礎兵種</div>
            <div class="detailStats">
              <div class="detailStat"><span class="statLabel">HP</span><span class="statVal hp">{{ selectedBaseData.stats.hp }}</span></div>
              <div class="detailStat"><span class="statLabel">ATK</span><span class="statVal atk">{{ selectedBaseData.stats.atk }} ({{ ATK_KEY_LABEL[selectedBaseData.stats.atkKey] ?? selectedBaseData.stats.atkKey }})</span></div>
              <div v-for="d in selectedBaseData.stats.def" :key="d.key" class="detailStat">
                <span class="statLabel">DEF ({{ ATK_KEY_LABEL[d.key] ?? d.key }})</span><span class="statVal def">{{ d.value }}</span>
              </div>
              <div class="detailStat">
                <span class="statLabel">復活費用</span>
                <span class="statVal" :style="{ color: selectedBaseData.stats.reviveCost >= 999 ? 'var(--text-muted)' : 'var(--accent-gold)' }">
                  {{ selectedBaseData.stats.reviveCost >= 999 ? '不可復活' : `${selectedBaseData.stats.reviveCost} 財力` }}
                </span>
              </div>
            </div>
            <div class="detailText">{{ selectedBaseData.move }}</div>
            <button type="button" class="closeDetail" @click="closeDetail">✕ 關閉</button>
          </div>
        </template>
      </aside>
    </div>

    <!-- ── Detail panel (mobile bottom drawer) ────── -->
    <Transition name="drawer">
      <div v-if="hasDetail" class="detailDrawer">
        <div class="drawerBackdrop" @click="closeDetail" />
        <div class="drawerSheet">
          <div class="drawerHandle" />
          <div class="drawerContent">
            <template v-if="selectedSoul">
              <img v-if="selectedSoul.image" :src="selectedSoul.image" class="drawerImgFull" :alt="selectedSoul.name" />
              <div v-else class="drawerImgEmptyFull">👻</div>
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
            <template v-if="selectedItem">
              <img v-if="selectedItem.image" :src="selectedItem.image" class="drawerImgFull" :alt="selectedItem.name" />
              <div v-else class="drawerImgEmptyFull">🎒</div>
              <div class="detailName">{{ selectedItem.name }}</div>
              <div class="detailSub">
                <span :class="['timingBadge', TIMING_CLASS[selectedItem.timing ?? '']]">{{ TIMING_LABEL[selectedItem.timing ?? ''] ?? '—' }}</span>
              </div>
              <div class="detailCost">費用 {{ selectedItem.costGold }} 財力</div>
              <div class="detailStats">
                <div class="detailStat">
                  <span class="statLabel">牌組配率</span>
                  <span class="statVal" style="color: var(--text)">×{{ selectedItem.copies ?? 1 }} 張</span>
                </div>
              </div>
              <div v-if="selectedItem.text" class="detailText">{{ selectedItem.text }}</div>
            </template>
            <template v-if="selectedBaseData">
              <img :src="selectedBaseData.img" class="drawerImgFull" :alt="selectedBaseData.name" />
              <div class="detailName">{{ selectedBaseData.name }}</div>
              <div class="detailSub">基礎兵種</div>
              <div class="detailStats">
                <div class="detailStat"><span class="statLabel">HP</span><span class="statVal hp">{{ selectedBaseData.stats.hp }}</span></div>
                <div class="detailStat"><span class="statLabel">ATK</span><span class="statVal atk">{{ selectedBaseData.stats.atk }} ({{ ATK_KEY_LABEL[selectedBaseData.stats.atkKey] ?? selectedBaseData.stats.atkKey }})</span></div>
                <div v-for="d in selectedBaseData.stats.def" :key="d.key" class="detailStat">
                  <span class="statLabel">DEF ({{ ATK_KEY_LABEL[d.key] ?? d.key }})</span><span class="statVal def">{{ d.value }}</span>
                </div>
                <div class="detailStat">
                  <span class="statLabel">復活費用</span>
                  <span class="statVal" :style="{ color: selectedBaseData.stats.reviveCost >= 999 ? 'var(--text-muted)' : 'var(--accent-gold)' }">
                    {{ selectedBaseData.stats.reviveCost >= 999 ? '不可復活' : `${selectedBaseData.stats.reviveCost} 財力` }}
                  </span>
                </div>
              </div>
              <div class="detailText">{{ selectedBaseData.move }}</div>
            </template>
          </div>
          <div class="drawerFooter">
            <button type="button" class="closeDetail drawerClose" @click="closeDetail">✕ 關閉</button>
          </div>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
/* ── Cards main layout ───────────────────────────────── */
.cardsMain {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px;
  gap: 16px;
  max-width: 1200px;
  width: 100%;
  align-self: center;
  box-sizing: border-box;
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

.baseGroups {
  display: flex;
  flex-wrap: wrap;
  gap: 20px 28px;
  align-items: flex-start;
}
.baseGroup {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;
}
.baseLabel {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.08em;
}

/* ── Clan tabs ───────────────────────────────────────── */
.clanTabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.clanTab {
  padding: 5px 16px;
  font-size: 0.8125rem;
  font-weight: 700;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface-2);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.clanTab:hover { color: var(--text); border-color: var(--border-strong); }
.clanTabActive { font-weight: 800; }

/* ── Card grid ───────────────────────────────────────── */
.cardGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.soulCard {
  width: 120px;
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
  gap: 3px;
  flex-wrap: wrap;
}
.stat {
  font-size: 0.5625rem;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 700;
}
.stat.hp  { background: rgba(255, 77, 79, 0.12);   color: var(--accent-red-light); }
.stat.atk { background: rgba(232, 208, 112, 0.12); color: var(--accent-gold); }
.stat.def { background: rgba(145, 202, 255, 0.10); color: var(--accent-blue); }

/* ── Base pieces ─────────────────────────────────────── */
.baseSection { flex: 1; min-width: 0; }

.basePieceGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.basePieceCard {
  width: 120px;
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
.basePieceCard:hover { border-color: var(--border-strong); background: var(--bg-surface-2); }

.baseCost {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-align: center;
}

/* ── Item cards ──────────────────────────────────────── */
.itemSection { flex: 1; min-width: 0; }

.itemCard {
  width: 140px;
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

.itemCopies {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-align: center;
}

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

/* ── Detail panel (desktop sidebar) ─────────────────── */
.detailDesktop { display: flex; }
.detailPanel {
  position: sticky;
  top: 70px;
  width: 35vw;
  min-width: 380px;
  max-width: 450px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-surface-1);
  padding: 14px;
  display: flex;
  flex-direction: row;
  gap: 14px;
  align-items: flex-start;
  align-self: flex-start;
}

.detailPanelImg { width: 130px; flex-shrink: 0; }
.detailPanelInfo {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detailImg {
  width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid var(--border);
  display: block;
}
.detailImgEmpty {
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  border: 1px dashed var(--border);
  display: grid;
  place-items: center;
  font-size: 2rem;
  background: var(--bg-surface-3);
}
.detailName { font-size: 1rem; font-weight: 700; color: var(--text); }
.detailSub {
  font-size: 0.75rem;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.detailCost { font-size: 0.8125rem; font-weight: 700; color: var(--accent-gold); }
.detailStats { display: flex; flex-direction: column; gap: 4px; }
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
  align-self: flex-start;
}
.closeDetail:hover { color: var(--text); border-color: var(--border-strong); }

/* ── Mobile bottom drawer ────────────────────────────── */
.detailDrawer { display: none; }

.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.22s ease;
}
.drawer-enter-active .drawerSheet,
.drawer-leave-active .drawerSheet {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}
.drawer-enter-from,
.drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawerSheet,
.drawer-leave-to .drawerSheet { transform: translateY(100%); }

/* ── Responsive ──────────────────────────────────────── */
@media (max-width: 700px) {
  .cardsMain { padding: 12px 0; }
  .cardSubTabs { padding: 0 12px; }

  .clanTabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    padding: 0 12px 2px;
    width: 100%;
    box-sizing: border-box;
  }
  .clanTabs::-webkit-scrollbar { display: none; }

  .clanHeader, .baseGroups { padding-left: 12px; padding-right: 12px; }
  .baseGroups { flex-direction: column; gap: 16px; }
  .baseGroup { width: 100%; }

  .cardGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    gap: 8px;
  }
  .soulCard, .itemCard { width: auto; }

  .basePieceGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
    gap: 8px;
    padding: 0 12px;
  }
  .basePieceCard { width: auto; }

  .detailDesktop { display: none !important; }
  .detailDrawer { display: block; }

  .drawerBackdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    z-index: 60;
  }
  .drawerSheet {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 61;
    background: #1a1a2e;
    border-radius: 16px 16px 0 0;
    border-top: 1px solid var(--border);
    height: 95vh;
    display: flex;
    flex-direction: column;
  }
  .drawerHandle {
    width: 36px;
    height: 4px;
    background: var(--border-strong);
    border-radius: 2px;
    margin: 10px auto 4px;
  }
  .drawerContent {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 10px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .drawerFooter {
    flex-shrink: 0;
    padding: 10px 16px 20px;
    border-top: 1px solid var(--border);
    background: #1a1a2e;
  }
  .drawerImgFull {
    width: 80%;
    height: auto;
    display: block;
    border-radius: 10px;
    margin: auto;
    border: 1px solid var(--border);
  }
  .drawerImgEmptyFull {
    width: 100%;
    height: 120px;
    border-radius: 10px;
    border: 1px dashed var(--border);
    display: grid;
    place-items: center;
    font-size: 2.5rem;
    background: var(--bg-surface-3);
  }
  .drawerClose {
    width: 100%;
    padding: 10px;
    font-size: 0.875rem;
    text-align: center;
  }
}

@media (max-width: 420px) {
  .soulCard, .itemCard { width: auto; }
  .cardGrid { grid-template-columns: repeat(auto-fit, minmax(76px, 1fr)); }
}
</style>
