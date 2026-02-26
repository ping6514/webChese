<script lang="ts">
import { defineComponent } from 'vue'
import type { GuardResult, PieceBase } from '../engine'
import { getItemCard, getSoulCard, type GameState } from '../engine'

export default defineComponent({
  name: 'ShopModal',
  props: {
    open: { type: Boolean, required: true },
    phase: { type: String as () => GameState['turn']['phase'], required: true },

    shopBases: { type: Array as () => PieceBase[], required: true },
    displayByBase: {
      type: Object as () => Partial<Record<PieceBase, string | null>>,
      required: true,
    },
    soulDeckByBase: {
      type: Object as () => Partial<Record<PieceBase, string[]>>,
      required: true,
    },

    buyDisplayGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
      required: true,
    },
    buyDeckGuards: {
      type: Object as () => Partial<Record<PieceBase, GuardResult>>,
      required: true,
    },

    itemDisplay: {
      type: Array as () => Array<string | null>,
      required: true,
    },
    buyItemGuards: {
      type: Array as () => GuardResult[],
      required: true,
    },

    itemDeckCount: { type: Number, required: false, default: 0 },

    enemyGraveTop: { type: String as () => string | null, required: true },
    enemyGraveyard: { type: Array as () => string[], required: false, default: () => [] },
    darkMoonScopeActive: { type: Boolean, required: false, default: false },
    buyEnemyGraveGuard: { type: Object as () => GuardResult, required: true },

    buySoulFromDeckGoldCost: { type: Number, required: true },
    buySoulFromDisplayGoldCost: { type: Number, required: true },
    buySoulFromEnemyGraveyardGoldCost: { type: Number, required: true },
  },
  emits: [
    'close',
    'buy-display',
    'buy-deck',
    'buy-item',
    'buy-enemy-graveyard',
    'show-soul-detail',
    'show-item-detail',
    'show-enemy-grave-top-detail',
  ],
  methods: {
    soulName(id: string | null | undefined): string {
      if (!id) return '-'
      return getSoulCard(id)?.name ?? id
    },
    soulImage(id: string | null | undefined): string | undefined {
      if (!id) return undefined
      const img = getSoulCard(id)?.image
      return img || undefined
    },
    itemName(id: string | null | undefined): string {
      if (!id) return '-'
      return getItemCard(id)?.name ?? id
    },
    itemImage(id: string | null | undefined): string | undefined {
      if (!id) return undefined
      const img = getItemCard(id)?.image
      return img || undefined
    },
    itemCost(id: string | null | undefined): number | null {
      if (!id) return null
      return getItemCard(id)?.costGold ?? null
    },
    baseLabel(b: string): string {
      const map: Record<string, string> = {
        king: '帥', advisor: '仕', elephant: '象', rook: '車', knight: '馬', cannon: '砲', soldier: '卒',
      }
      return map[b] ?? b
    },
  },
})
</script>

<template>
  <div v-if="open" class="modalOverlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modalHead">
        <div class="modalTitle">🛒 商店</div>
        <div v-if="phase !== 'buy'" class="phaseBanner">⚠️ 僅購買階段可購買</div>
        <button type="button" class="closeBtn" @click="$emit('close')">✕ 關閉</button>
      </div>

      <div class="grid">
        <!-- ── Souls ───────────────────────────────────────────────── -->
        <section class="panel">
          <div class="panelTitle">靈魂牌</div>
          <div class="soulList">
            <div v-for="b in shopBases" :key="b" class="soulRow">
              <div class="baseTag">{{ baseLabel(b) }}</div>

              <button
                v-if="displayByBase[b]"
                type="button"
                class="cardBtn"
                @click="$emit('show-soul-detail', displayByBase[b])"
              >
                <img v-if="soulImage(displayByBase[b])" class="thumb" :src="soulImage(displayByBase[b])" alt="" />
                <div v-else class="thumbNo">?</div>
                <div class="cardInfo">
                  <div class="cardName">展示:{{ soulName(displayByBase[b]) }}</div>
                  <div class="cardSub">牌堆剩餘: {{ soulDeckByBase[b]?.length ?? 0 }}</div>
                </div>
              </button>
              <div v-else class="cardBtn cardEmpty">
                <div class="thumbNo muted">—</div>
                <div class="cardInfo">
                  <div class="cardName muted">(空)</div>
                  <div class="cardSub">牌堆剩餘: {{ soulDeckByBase[b]?.length ?? 0 }}</div>
                </div>
              </div>

              <div class="buyBtns">
                <button
                  type="button"
                  class="buyBtn buyDisplay"
                  @click="$emit('buy-display', b)"
                  :disabled="phase !== 'buy' || !(buyDisplayGuards[b]?.ok ?? false)"
                  :title="buyDisplayGuards[b]?.ok ? '' : (buyDisplayGuards[b]?.reason ?? '')"
                >
                  📋 展示 <span class="cost">{{ buySoulFromDisplayGoldCost }}💰</span>
                </button>
                <button
                  type="button"
                  class="buyBtn buyDeck"
                  @click="$emit('buy-deck', b)"
                  :disabled="phase !== 'buy' || !(buyDeckGuards[b]?.ok ?? false)"
                  :title="buyDeckGuards[b]?.ok ? '' : (buyDeckGuards[b]?.reason ?? '')"
                >
                  🎴 牌堆頂 <span class="cost">{{ buySoulFromDeckGoldCost }}💰</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Items + Enemy Grave ─────────────────────────────────── -->
        <section class="panel">
          <div class="panelTitle">道具牌 <span class="deckCount">牌堆 {{ itemDeckCount }}</span></div>
          <div class="itemList">
            <div v-for="slot in [0, 1, 2]" :key="slot" class="itemRow">
              <div class="slotTag">{{ slot + 1 }}</div>

              <button
                v-if="itemDisplay[slot]"
                type="button"
                class="cardBtn"
                @click="$emit('show-item-detail', itemDisplay[slot])"
              >
                <img v-if="itemImage(itemDisplay[slot])" class="thumb" :src="itemImage(itemDisplay[slot])" alt="" />
                <div v-else class="thumbNo">🎁</div>
                <div class="cardInfo">
                  <div class="cardName">{{ itemName(itemDisplay[slot]) }}</div>
                  <div class="cardSub">費用 {{ itemCost(itemDisplay[slot]) ?? '-' }}💰</div>
                </div>
              </button>
              <div v-else class="cardBtn cardEmpty">
                <div class="thumbNo muted">—</div>
                <div class="cardInfo"><div class="cardName muted">(空)</div></div>
              </div>

              <div class="buyBtns">
                <button
                  type="button"
                  class="buyBtn buyItem"
                  @click="$emit('buy-item', slot)"
                  :disabled="phase !== 'buy' || !(buyItemGuards[slot]?.ok ?? false)"
                  :title="buyItemGuards[slot]?.ok ? '' : (buyItemGuards[slot]?.reason ?? '')"
                >
                  🎁 購買道具
                </button>
              </div>
            </div>
          </div>

          <!-- Enemy Graveyard -->
          <div class="panelTitle" style="margin-top: 18px">
            敵方墳場
            <span v-if="darkMoonScopeActive" class="scopeTag">🌑 暗月窺視</span>
          </div>
          <div class="enemyGrave">
            <template v-if="darkMoonScopeActive && enemyGraveyard.length > 0">
              <div class="scopeHint">選擇任意一張靈魂卡盜取</div>
              <div v-for="(sid, idx) in enemyGraveyard" :key="sid + idx" class="scopeRow">
                <button type="button" class="cardBtn" @click="$emit('show-soul-detail', sid)">
                  <img v-if="soulImage(sid)" class="thumb" :src="soulImage(sid)" alt="" />
                  <div v-else class="thumbNo">?</div>
                  <div class="cardInfo">
                    <div class="cardName">{{ soulName(sid) }}</div>
                    <div class="cardSub">{{ idx === 0 ? '頂部' : `第 ${idx + 1}` }}</div>
                  </div>
                </button>
                <button
                  type="button"
                  class="buyBtn buyGrave"
                  @click="$emit('buy-enemy-graveyard', sid)"
                  :disabled="phase !== 'buy' || !buyEnemyGraveGuard.ok"
                  :title="buyEnemyGraveGuard.ok ? '' : buyEnemyGraveGuard.reason"
                >
                  盜取 {{ buySoulFromEnemyGraveyardGoldCost }}💰
                </button>
              </div>
            </template>
            <template v-else>
              <div class="graveNormal">
                <button
                  v-if="enemyGraveTop"
                  type="button"
                  class="cardBtn"
                  @click="$emit('show-enemy-grave-top-detail')"
                >
                  <img v-if="soulImage(enemyGraveTop)" class="thumb" :src="soulImage(enemyGraveTop)" alt="" />
                  <div v-else class="thumbNo">?</div>
                  <div class="cardInfo">
                    <div class="cardName">{{ soulName(enemyGraveTop) }}</div>
                    <div class="cardSub">墳場頂部</div>
                  </div>
                </button>
                <div v-else class="emptyGrave muted">（敵方墳場為空）</div>

                <button
                  type="button"
                  class="buyBtn buyGrave"
                  @click="$emit('buy-enemy-graveyard')"
                  :disabled="phase !== 'buy' || !buyEnemyGraveGuard.ok"
                  :title="buyEnemyGraveGuard.ok ? '' : buyEnemyGraveGuard.reason"
                >
                  盜取墳場頂 {{ buySoulFromEnemyGraveyardGoldCost }}💰
                </button>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  padding: 20px;
  z-index: 60;
  backdrop-filter: blur(3px);
}

.modal {
  width: min(1100px, 96vw);
  max-height: min(92vh, 920px);
  overflow: auto;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(16, 18, 32, 0.98);
  padding: 20px;
  box-shadow: 0 8px 48px rgba(0, 0, 0, 0.6);
}

.modalHead {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.modalTitle {
  font-weight: 900;
  font-size: 22px;
  flex: 1;
}

.phaseBanner {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(250, 140, 22, 0.18);
  border: 1px solid rgba(250, 140, 22, 0.45);
  color: #ffc069;
}

.closeBtn {
  padding: 6px 16px;
  border-radius: 8px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: background 0.15s;
}
.closeBtn:hover { background: rgba(255, 255, 255, 0.15); }

.grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  align-items: start;
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
}

.panelTitle {
  font-weight: 800;
  font-size: 15px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(255, 255, 255, 0.95);
}

.deckCount {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.55;
  margin-left: auto;
}

/* ── Soul list ──────────────────────────────────────────────────────── */
.soulList {
  display: grid;
  gap: 8px;
}

.soulRow {
  display: grid;
  grid-template-columns: 38px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  transition: background 0.15s;
}
.soulRow:hover { background: rgba(255, 255, 255, 0.09); }

.baseTag {
  font-size: 22px;
  font-weight: 900;
  text-align: center;
  color: rgba(145, 202, 255, 0.9);
}

/* ── Item list ──────────────────────────────────────────────────────── */
.itemList {
  display: grid;
  gap: 8px;
}

.itemRow {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  transition: background 0.15s;
}
.itemRow:hover { background: rgba(255, 255, 255, 0.09); }

.slotTag {
  font-size: 15px;
  font-weight: 900;
  text-align: center;
  opacity: 0.65;
}

/* ── Card button ────────────────────────────────────────────────────── */
.cardBtn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.3);
  text-align: left;
  color: rgba(255, 255, 255, 0.92);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-width: 0;
  flex: 1;
}
.cardBtn:not(.cardEmpty):hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}
.cardEmpty {
  cursor: default;
  opacity: 0.45;
}

.thumb {
  width: 44px;
  height: 60px;
  object-fit: cover;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
}

.thumbNo {
  width: 44px;
  height: 60px;
  border-radius: 7px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  font-size: 20px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
}

.cardInfo {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cardName {
  font-weight: 700;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cardSub {
  font-size: 14px;
  opacity: 0.6;
}

/* ── Buy buttons ────────────────────────────────────────────────────── */
.buyBtns {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex-shrink: 0;
}

.buyBtn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, opacity 0.15s;
  border: 1px solid transparent;
}
.buyBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.buyDisplay {
  background: rgba(82, 196, 26, 0.18);
  border-color: rgba(82, 196, 26, 0.45);
  color: #95de64;
}
.buyDisplay:not(:disabled):hover { background: rgba(82, 196, 26, 0.3); }

.buyDeck {
  background: rgba(145, 202, 255, 0.14);
  border-color: rgba(145, 202, 255, 0.4);
  color: #91caff;
}
.buyDeck:not(:disabled):hover { background: rgba(145, 202, 255, 0.24); }

.buyItem {
  background: rgba(200, 160, 40, 0.18);
  border-color: rgba(200, 160, 40, 0.45);
  color: #e8d070;
}
.buyItem:not(:disabled):hover { background: rgba(200, 160, 40, 0.3); }

.buyGrave {
  background: rgba(255, 77, 79, 0.14);
  border-color: rgba(255, 77, 79, 0.4);
  color: #ff9c9e;
  width: 100%;
  justify-content: center;
  padding: 8px 14px;
  font-size: 14px;
}
.buyGrave:not(:disabled):hover { background: rgba(255, 77, 79, 0.25); }

.cost {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.85;
  background: rgba(0, 0, 0, 0.25);
  padding: 1px 5px;
  border-radius: 999px;
}

/* ── Enemy Grave ────────────────────────────────────────────────────── */
.enemyGrave { display: grid; gap: 8px; }
.graveNormal { display: grid; gap: 8px; }

.emptyGrave {
  padding: 12px;
  text-align: center;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  font-size: 13px;
}

.scopeTag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(200, 160, 40, 0.22);
  border: 1px solid rgba(200, 160, 40, 0.5);
  color: #e8d8a0;
  font-weight: 600;
}

.scopeHint {
  font-size: 12px;
  color: #e8d8a0;
  opacity: 0.85;
}

.scopeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
}

.muted { opacity: 0.55; }
</style>
