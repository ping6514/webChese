
遊戲名稱：《死靈召魂象棋》（DeadNecroChess）
核心玩法：2 人回合制象棋變體 + 靈魂附魔 + HP 射擊 + 屍骸循環 + 墳場掠奪
規則已定稿 v1.0（HackMD 文件已整理）
美術方向：極簡 CSS 原生 + 少量卡片圖片，暫不大量依賴外部素材
開發階段：一人開發 + 朋友小團體測試，尚未正式動工（幾天後開工才有環境）

技術路線（已決定）

前端：Vue 3 + Vite + Pinia + TypeScript + Tailwind CSS
後端：Node.js + Express + Socket.IO（權威伺服器模式）
部署：Render.com 免費層（後端 Web Service）
最終形式：Tauri 2.0 打包成桌面 App（.exe / .dmg）
資源處理：圖片全打包進 App（public/ 資料夾），其他全 CSS 實現
資料持久化：localStorage（房間 ID） + Tauri Store（設定） + FS API（未來存檔）

已確認的頁面結構（第一版 MVP）

首頁（Landing）→ 主題介紹 + 開始遊戲 / 瀏覽牌庫 / 教學按鈕
牌庫展示頁 → 驗證所有卡牌（你自己最常用）
教學 / 規則頁 → 完整規則說明（HackMD 內容直接用）
創建 / 加入房間頁 → 輸入房間 ID 或建立新房間
遊戲戰鬥頁 → 核心畫面（棋盤 + 手牌 + 資源 + 階段切換）
遊戲結束 / 結算頁 → 勝負顯示 + 返回大廳
（可選）遊戲內小菜單 → 投降 / 返回 / 規則 / 設定

關鍵機制已確定

狀態同步：伺服器權威 + Socket.IO 全狀態廣播
重新同步：需 API（GET /api/game/:roomId/state） + Socket.IO requestState
斷線重連：visibilitychange + localStorage roomId + 自動同步
結束條件：投降 / 帥耐久歸零 / 長時間無行動自動投降
特效方向：先純 CSS + Canvas（翻牌、粒子、傷害飛出），後期可加 PixiJS

目前最容易遺忘 / 容易卡住的點（開工前提醒）

Git repo 是否已建立（建議用 GitLab public repo）
Render 帳號是否已註冊並授權 GitLab
Node.js 版本（建議 20 LTS）
Tauri 環境是否已安裝（Rust + tauri-cli）
souls.json 是否先寫 5–10 張（至少跑通卡牌顯示）
棋盤座標系統先定義好（a1～i10 或 0,0～8,9）
第一個測試目標：兩人進房間能互相看到「移動棋子」

---

## 連線同步 / 桌面鏡像：難度評估

### 目標定義

- 連線對戰：建立 Socket 連線、建立/加入房間、同步雙方遊戲狀態。
- 桌面鏡像（更像「觀戰/同螢幕」）：一方操作、另一方只接收狀態與事件（可選：允許請求同步）。

### 建議架構（權威伺服器）

- 伺服器保存每個 room 的 `GameState`，只接受 action（MOVE/SHOOT/BUY/ENCHANT/REVIVE/NEXT_PHASE...）。
- 伺服器在收到 action 時：
  - 先跑 engine guards（canDispatch）
  - 再 reduce
  - 廣播完整 state（或 state + events）

### 難度與風險

- 難度：中（MVP 可在 1～2 週內打通）
- 風險：
  - 斷線重連／狀態回補（必做）
  - 客戶端時鐘/重放（可先不做）
  - 同時送出 action 的競態（伺服器序列化即可解）

### MVP 里程碑

1. 房間：create/join + roomId（localStorage 記住）
2. 同步：
   - client 送 action
   - server reduce
   - server broadcast 最新 state
3. 重連：GET `/api/game/:roomId/state` + Socket `requestState`
4. 桌面鏡像：同房間但設定一方為 observer（不允許送 action）

---

## Tauri 打包成 App：可行性評估

### 可行性

- 可行（Vue3/Vite + Tauri 是常見組合）。
- 對本專案最大價值：
  - 離線資源打包（卡圖/音效）
  - 桌面快捷啟動
  - 之後可用 Tauri API 做設定存檔/重連、甚至本機 LAN server。

### 前置與常見卡點

- Rust toolchain、tauri-cli 安裝
- macOS：Xcode Command Line Tools
- Windows：MSVC Build Tools
- Node 版本固定（20 LTS）

### 建議時程

- 先把「連線版 MVP」在瀏覽器跑穩（權威伺服器 + 重連）。
- 再加 Tauri（避免同時踩兩個環境坑）。

### MVP 里程碑

1. `tauri init` + dev 跑起來
2. build 出 dmg/exe
3. 設定資料：Tauri Store（房間 ID / 音量 / 顯示偏好）
4. （可選）本機 server 模式：一台當 host，另一台連 LAN