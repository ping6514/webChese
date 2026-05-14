---
description: 線上連線模式同步改善 checklist（peerjs P2P 架構）
---

# 線上同步改善 Checklist

> **架構備註**：此 checklist 原為 Supabase + 4s polling 架構撰寫，現已切換為 peerjs P2P 直連（見 [docs/象棋桌遊開發計劃.md](象棋桌遊開發計劃.md) 線上對戰段）。已標記 ❌ 的項目屬於舊架構議題，現用 P2P 不適用；其餘 UI 防呆與連線狀態相關項目仍適用。

## 第一階段：最低限度防禦（皆通用）

- [x] 分頁回前景時主動同步最新狀態
- [x] 網路恢復時主動同步最新狀態
- [x] 線上同步中禁止再次送出 action
- [x] 線上送出中禁止再次送出 action
- [x] 線上同步中顯示全畫面操作鎖
- [x] 線上同步中滑鼠游標改為 `wait`
- [x] 「下一階段」在同步中 / 發送中 disabled

## 這次需求額外防禦（皆通用）

- [x] 防止狂點 `NEXT_PHASE`
- [x] 防止同步期間舊狀態下繼續操作
- [x] 採用較暴力但穩定的 loading lock 方案

## 第二階段建議

- [ ] 顯示更細的連線狀態：`同步中` / `送出中` / `等待對手`
- [ ] 提供手動「立即重新同步」（P2P 下意義：重新向 host 請求 latest state 並 re-render）
- [ ] `offline` 時顯示離線提示
- [ ] ❌ ~~realtime 失效時自動重建訂閱並提示~~（Supabase Realtime 專用，P2P 不適用；對應的 P2P 議題是「peerjs `_conn.close` 後自動重連」，見 bug-audit-2026-05-14.md）
- [ ] 加入 presence / 對手在線狀態（P2P 下可用 peerjs `_conn.on('close')` + heartbeat 實作）

## P2P 架構新增議題（見 bug-audit-2026-05-14.md 掃描 #3）

- [ ] host 端 guest 斷線 timeout / kick（目前 host 可能無限等待）
- [ ] guest 端 `MsgAck`/`MsgPush` 版本單調遞增守門
- [ ] secret/token 認證，避免任意人知道 roomId 即可連入
- [ ] roomId 用 `crypto.getRandomValues()` 取代 `Math.random()`
- [ ] STUN-only → 加 TURN 伺服器以支援嚴格 NAT 用戶

## 設計原則（peerjs P2P 版）

- **host 為 source of truth**（取代原本「server 為 source of truth」）
- guest action 透過 PeerJS DataChannel 送給 host，host `canDispatch + reduce` 後回 `MsgAck`
- 回前景或重連後，由 client 重新與對手 peer 建立連線，host 主動重 push 最新 state
- 不要在 guest 端獨立 reduce（避免兩端 state 漂移；引擎部分含 RNG 時尤其重要）
- 先求穩定防呆，再做進階 presence 體驗
