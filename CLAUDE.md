# 幽冥棋 (DeadNecroChess) — Claude 工作指引

## 專案概述
2 人回合制策略遊戲：中國象棋底盤 + 靈魂附魔系統 + HP 射擊 + 屍骸資源循環。
支援**本機對戰（PVP/PVE）** 與**線上對戰（peerjs P2P）**模式，前端靜態檔案部署至 Vercel。

## 目錄結構
```
webChess/
├── app/                    # Vue 3 + Vite + TypeScript 主應用
│   ├── src/
│   │   ├── engine/         # 核心引擎（reducer, guards, events, cards, items）
│   │   ├── data/souls/     # 靈魂卡 JSON（dark-moon.json, styx.json, eternal-night.json, iron-guard.json）
│   │   ├── data/items/     # 道具卡 JSON
│   │   ├── sim/            # Bot 決策（balanceBot.ts）+ 訓練腳本（botWeights.ts, updateDynamicWeights.js）
│   │   ├── stores/         # Pinia（gameSetup.ts, ui.ts, connection.ts）
│   │   ├── components/     # UI 元件（BoardGrid, HandItems, TopBar, DebugMenuModal...）
│   │   └── views/          # 頁面（Game.vue, IntroPage.vue, Home.vue）
│   └── api/                # Vercel Serverless Functions（Node.js，目前僅健檢用）
│       ├── ping.ts                # Supabase 連線健檢
│       ├── test-engine.ts         # 引擎健檢
│       └── _engine/               # 編譯後的 CJS 引擎（由 build-engine.mjs 產生，build artifact，gitignored）
├── _backup_supabase/       # 舊版 Supabase + api/rooms 線上對戰架構（已封存，不再活用）
└── docs/                   # 規則文件（象棋桌遊規則NOW.md, 象棋桌遊開發計劃.md, bug-audit-*.md）
```

## 常用指令（在 `app/` 目錄執行）
```bash
npm run dev           # 開發伺服器
npm run build         # 引擎編譯 + 型別檢查 + Vite 打包（同時更新 api/_engine/）
npm run test          # Vitest 跑完整測試套件（必須全綠才能 commit）
npm run train         # Bot 自動訓練（10 輪，更新 botWeights.ts）
npm run train:3       # 輕量訓練（3 輪）
npm run sim:balance   # 單次模擬報告
```

## 引擎關鍵設計
- **Action → Guard → Reduce → Events** 的單向資料流，所有狀態變更走 `reduce(state, action)`
- `engine/guards.ts`：所有 `can*()` 函數回傳 `{ ok, reason }`
- `engine/events.ts`：引擎發出 Event 陣列，UI 讀 events 做 FX（浮字、高亮）
- `TurnFlags`：每回合暫存狀態（freeShootBonus、itemNecroBonus 等），`NEXT_PHASE` 時重置
- **NEXT_PHASE** 從 combat 一步到位：combat → turnEnd（autoTurnEnd）→ turnStart（autoTurnStart）→ buy（下一玩家）

## 線上對戰架構（peerjs P2P，目前活的版本）
- **連線層**：[stores/connection.ts](app/src/stores/connection.ts) 用 `peerjs` 做瀏覽器間 P2P 直連，無中心伺服器
  - host 用 `genId(6)` 產 room code（32 字元集）；guest 用 `Peer.connect(roomId)` 連入
  - 訊息類型：`MsgInit`（host→guest 開局）、`MsgAck`（host→guest 回覆 action）、`MsgPush`（host→guest 推送自己 action）、`MsgError`
  - 兩端都跑同一份瀏覽器 ESM 引擎；**host 是 source of truth**：guest action 送給 host → host `canDispatch + reduce` → 回傳新 state；host 自己的 action 直接 reduce 再 push
- **持久化**：`localStorage.chess_connection`（roomId + side），用於頁面重整恢復
- **STUN/TURN**：PEER_CONFIG 只有 STUN（無 TURN），嚴格 NAT 下可能連不上
- **Vercel 部署**：只部署前端靜態檔案，`api/` 下只剩 `ping.ts` 健檢用，不參與線上對戰
- **引擎編譯**：`src/engine/` → `api/_engine/`（CJS，gitignored，build 時重新編譯）— 給 `api/test-engine.ts` 健檢用，不參與線上對戰
- **已知議題**（見 [docs/bug-audit-2026-05-14.md](docs/bug-audit-2026-05-14.md)）：guest 收訊息未做 version 單調遞增驗證；host 未驗證連入者身份（任何知道 room code 者皆可送 action）— 友善 PVP 場景可接受，但若做 ranked 模式需補強

> 註：歷史上曾用 Supabase + Vercel `api/rooms/` 架構（在 `_backup_supabase/`），已棄用

## 遊戲數值（gameConfig.ts）
| 參數 | 值 |
|---|---|
| 每回合收入 | 財力 +4 / 魔力 +3 |
| 魔力儲存上限 | 5（回合結束轉 2:1 財力） |
| 財力上限 | 15 |
| 死靈術行動 | 每回合基礎 1 次 |
| 復活費用 | 3 財力 |
| 展示區購買 | 2 財力 |
| 盲抽 | 1 財力 |
| 盜取（敵方墓場）| 2 財力 |
| 靈魂手牌上限 | 5 |
| 道具手牌上限 | 3 |

## 氏族（enabledClans）
| id | 名稱 | emoji |
|---|---|---|
| `dark_moon` | 暗月 | 🌙 |
| `styx` | 冥河 | 💧 |
| `eternal_night` | 永夜 | 🌑 |
| `iron_guard` | 鐵衛 | 🛡️ |

各氏族各 10 張靈魂卡。開房時可自訂啟用的氏族（至少 1 個）。

## Bot 訓練機制
- `balanceBot.ts`：epsilon-greedy 決策，`weightsMode` 可選 base/dynamic/blend/opponent
- `botWeights.ts`：BASE_WEIGHTS（手動）/ DYNAMIC_WEIGHTS（訓練後）/ OPPONENT_WEIGHTS（上一輪動態）
- 訓練腳本自動：模擬 → 產生 report JSON → `updateDynamicWeights.js` 用 Wilson CI + momentum 更新

## 卡片資料驅動原則
- 靈魂卡效果以 `abilities[]` schema 驅動（type, when, perTurn 等），盡量不 hardcode 氏族邏輯
- 每張卡有 `text` 欄位（完整中文效果描述），UI 直接顯示不重寫
- 新增氏族：建立 JSON → `listSoulCards()` 自動包含 → Bot 訓練自動納入

## 注意事項
- 引擎測試全綠是 commit 前提，修改 engine/ 後必跑 `npm run test`
- 規則文件（docs/）是設計參考，**以引擎實作為準**，兩者不符時優先修正文件
- `api/_engine/` 是 build artifact（gitignored），只給 `api/test-engine.ts` 健檢用，**線上對戰已改 peerjs P2P 不依賴它**；但 `npm run build` 仍會重新編譯以保健檢可用
- 開發分支：`temp`，由開發者手動 merge 到線上環境

## 文檔同步原則

文檔漂移（doc drift）是 bug 來源 — agent 與開發者會基於錯誤文檔做決策。這次 audit 曝光了 Supabase → peerjs P2P 切換時文檔未同步的問題，定下以下原則：

1. **架構切換是文檔事件**：技術選型重大變更（後端、同步機制、部署模型等）時，**收尾 checklist 必含**「同步更新 CLAUDE.md / docs/開發計劃.md / docs/CHECKLIST.md / online-sync-checklist.md」。
2. **數值來源唯一**：遊戲數值（費用、上限、產出）以 `app/src/engine/gameConfig.ts` 為單一真實來源。文檔提到的數值要對齊；發現不一致時，**先確認引擎值再改文檔**（除非設計上要改引擎，需明確拍板）。
3. **能力 schema 對齊**：靈魂卡 `text` 欄位的字面描述要與 `abilities[]` schema + `effects.ts` 的實際行為一致。新增/修改卡牌時兩邊同步檢查。
4. **過時內容不要刪**：如果某段 doc 描述的功能已棄用（如 `_backup_supabase/` 內的 Supabase 線上對戰），標記「已棄用」+ 指向新位置即可，不要直接刪除（保留 design rationale 與歷史脈絡）。
5. **疑似漂移時的對策**：開發者或 agent 對文檔內容存疑時，優先 grep 引擎程式碼驗證，不要盲目相信文檔。發現漂移時直接修文檔不需 ceremony。

對應的審計紀錄見 [docs/bug-audit-2026-05-14.md](docs/bug-audit-2026-05-14.md)。
