# WebChese Checklist

## 新增氏族 — 標準 Checklist

每次加入一個新氏族，需要維護以下位置：

| # | 位置 | 說明 |
|---|------|------|
| 1 | `app/src/data/souls/<clan>.json` | 新增氏族靈魂卡 JSON（10 張） |
| 2 | `app/src/engine/cards.ts` | import 並 spread 進 `allSoulCards` |
| 3 | `app/src/engine/gameConfig.ts` | 將 clan id 加入 `DEFAULT_RULES.enabledClans` |
| 4 | `app/src/views/Home.vue` | `ALL_CLANS` 陣列加入 `{ id, label }` |
| 5 | `app/src/views/IntroPage.vue` | `CLAN_META` 加入名稱/顏色/描述 |
| 6 | `app/public/assets/cards/<clan>/` | 放入卡牌圖片（`<id>.jpg`） |
| 7 | `app/src/sim/botWeights.ts` | `BASE_WEIGHTS.buyPriority` 加入新卡初始權重 |
| 8 | `app/src/engine/damage.ts` | 若有新 ATK 加成 ability type → 在 `computeDamageCore` 加入 |
| 9 | `app/src/engine/stats.ts` | 若有新 DEF 加成 ability type → 在 `getDefValueInState` 加入 |
| 10 | `app/src/engine/effects.ts` | 若有射擊階段 ability type → 在 `getEffectHandlers` 加入 |
| 11 | `app/src/engine/reduce.ts` | 若有回合開始/結束 ability type → 在 `autoTurnStart/End` 加入 |
| 12 | `app/src/engine/shotPlan.ts` | 若有擊殺觸發 ability type → 在 `executeShotPlan` 加入 |
| 13 | `app/src/sim/balanceBot.ts` | 若有主動使用 ability → 在 bot 對應 phase 加入邏輯 |
| 14 | `npm run test` (全綠) + `npm run build` | 確認引擎測試通過、線上引擎更新 |

### 已完成氏族

| 氏族 id | 名稱 | 完成日期 |
|---------|------|----------|
| `dark_moon` | 🌙 暗月 | MVP |
| `styx` | 💧 冥河 | MVP |
| `eternal_night` | 🌑 永夜 | MVP |
| `iron_guard` | 🛡️ 鐵衛 | MVP |
| `gold_merc` | 💰 黃金傭兵 | 2026-03-08 |
| `death_oath` | 🩸死誓誓約 | 2026-03-08 |

---

## Rules/Engine Alignment
- [x] Default buy action limits: `buySoulActionsPerTurn = 1`, `buyItemActionsPerTurn = 1`
- [x] Revive cost is enforced: `REVIVE` costs **3 gold** (guards + reducer)
- [x] Enemy graveyard soul buy cost stays **3 gold**
- [ ] Default necro action limit matches rulesbook (rulesbook often states base **2** actions; engine currently uses base **1** + Blood Ritual bonus)
- [ ] Turn-start economy matches rulesbook (storage conversion + income)

## Necro: Blood Ritual
- [x] Blood Ritual (B) implemented: king -3 HP, +1 necro action once per turn (`turnFlags.bloodRitualUsed`, `turnFlags.necroBonusActions`)
- [x] Blood Ritual UI confirm modal shows king HP delta

## Item System
- [x] Item discard pile exists in engine state: `state.itemDiscard` (shared)
- [x] `DISCARD_ITEM_FROM_HAND` pushes item id into `state.itemDiscard`
- [x] `USE_ITEM_FROM_HAND` action + effect resolution for all 8 items
- [x] After `USE_ITEM_FROM_HAND`, used item pushed into `state.itemDiscard`
- [x] Item use UI: target-unit mode, target-corpse mode, no-target confirm, bone-refine 2-choice UI

## Board UX
- [x] Hover invalid move target shows red highlight and tooltip with MOVE guard reason
- [x] Unified shoot flow: click target enters preview; explicit confirm/cancel
- [x] Multi-target shooting preview is visualized on board (貫/濺/連)
- [x] Draggable shoot action overlay near target (Shoot/Cancel/Shoot Preview)
- [x] Sacrifice action uses a draggable board overlay (disabled + reason), not SidePanel
- [x] Sacrifice overlay auto-hides when a confirm modal is open
- [x] Graveyard panel uses collapsible dropdown lists to avoid overflow
- [x] Ability activation FX: engine emits `ABILITY_TRIGGERED`, UI shows float text + distinct highlight
- [ ] Show shoot feasibility/invalid reason with the same UX pattern

## UI Refactor / State Management
- [x] Shop is consolidated into `ShopModal` (TopBar button + auto-open on buy phase)
- [x] TopBar shows both King HP persistently
- [x] Introduce Pinia for UI state (start with modal open/close; expand to selection/modals)
- [x] Move UI interaction state into Pinia (selection, pending confirm, shoot preview, card detail modal)

## Docs
- [ ] Keep `docs/engine-notes.md` aligned with implemented UI/engine
- [ ] Keep `象棋桌遊規則NOW.md` aligned with web implementation notes

## Localization
- [x] Multi-target board badges + tooltips use Chinese skill hints
- [ ] Localize `ShootPreviewModal` effect text to Chinese (貫通/連鎖/波及...)

## Tests
- [x] Update item tests for new default item buy action limit (override `buyItemActionsPerTurn` in test state)
- [ ] Add tests for `REVIVE` gold cost (success + insufficient gold)

## Online Multiplayer (peerjs P2P — 當前架構)

歷史上曾用 Supabase + Vercel `api/rooms/` 架構，已封存到 `_backup_supabase/`。以下為現用 peerjs P2P 架構的 checklist。

- [x] peerjs P2P direct connection between browsers (host/guest model)
- [x] Random side assignment (red/black) + first-mover by host on room create
- [x] `MsgInit` / `MsgAck` / `MsgPush` / `MsgError` message protocol
- [x] Events array propagated alongside state in each message (no polling layer)
- [x] Disconnect + localStorage `{roomId, side}` reconnect on page reload
- [x] Clan selection UI on room create (online + local PVP/PVE)
- [x] Side splash on game start shows player colour + enabled clans
- [x] Online gear menu hides developer settings
- [ ] Surrender / resign action
- [ ] Spectator / observer mode
- [ ] Host-side timeout / kick when guest disconnects silently (see bug-audit-2026-05-14.md)
- [ ] Secret/token authentication for host → guest connection (see bug-audit-2026-05-14.md)
- [ ] Crypto-safe roomId generation (currently `Math.random()`, see bug-audit-2026-05-14.md)
- [ ] Guest version monotonic guard for `MsgAck`/`MsgPush` (see bug-audit-2026-05-14.md)
- [ ] TURN server for strict-NAT users (currently STUN-only)

## Known Constraints
- [ ] Node.js version: Vite build requires Node 20.19+ (Node 18 will fail `vite build`)
