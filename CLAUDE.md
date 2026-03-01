# 幽冥棋 (DeadNecroChess) — Claude 工作指引

## 專案概述
2 人回合制策略遊戲：中國象棋底盤 + 靈魂附魔系統 + HP 射擊 + 屍骸資源循環。
支援**本機對戰（PVP/PVE）** 與**線上對戰**模式，已部署至 Vercel。

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
│   └── api/                # Vercel Serverless Functions（Node.js）
│       ├── rooms/
│       │   ├── create.ts          # POST /api/rooms/create
│       │   └── [roomId]/
│       │       ├── join.ts        # POST /api/rooms/:id/join
│       │       ├── action.ts      # POST /api/rooms/:id/action
│       │       └── state.ts       # GET  /api/rooms/:id/state
│       └── _engine/               # 編譯後的 CJS 引擎（由 build-engine.mjs 產生）
└── docs/                   # 規則文件（象棋桌遊規則NOW.md, 象棋桌遊開發計劃.md）
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

## 線上對戰架構（Vercel + Supabase）
- **DB**：Supabase PostgreSQL，`rooms` 資料表（id, version, state_json, status, red_secret, black_secret）
- **Serverless API**：`api/rooms/` 下的 Vercel functions
  - `create`：隨機分配 side/firstSide，支援 `enabledClans` 自訂卡池
  - `join`：joiner 加入，version +1，status → 'playing'
  - `action`：驗證 secret → canDispatch → reduce → 更新 state_json（含 `_lastEvents`）
  - `state`：version-gated（since= 參數），回傳 state + status
- **同步機制**：Realtime（Supabase WebSocket）+ 4 秒 Polling 保底（hybrid adapter）
- **前端 store**：`stores/connection.ts`（useConnection）
  - `pollEvents`：對手操作事件（polling 更新時提取 state_json._lastEvents）
  - `_suppressPollEvents`：sendAction 時防止自身事件被重複處理
- **引擎編譯**：`src/engine/` → `api/_engine/`（CJS），每次 build 自動更新

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
| 盜取（敵方墓場）| 3 財力 |
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
- 修改 engine/ 後必須跑 `npm run build` 重新編譯 `api/_engine/`，否則線上對戰使用舊引擎
- 開發分支：`temp`，由開發者手動 merge 到線上環境
