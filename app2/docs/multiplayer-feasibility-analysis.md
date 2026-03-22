# 多人連線功能可行性分析

**分析日期**：2026-03-21  
**目標**：評估在現有 app 專案基礎上實作 BG 卡片遊戲的多人連線功能

---

## 📋 專案現況

### app 專案技術棧
```json
{
  "框架": "Vue 3 + TypeScript + Vite",
  "狀態管理": "Pinia",
  "路由": "Vue Router",
  "後端服務": "Supabase",
  "桌面應用": "Electron (可選)",
  "部署": "Vercel"
}
```

### 現有架構優勢
1. ✅ **已整合 Supabase**：提供後端服務基礎
2. ✅ **Vue 3 + Pinia**：現代化響應式架構
3. ✅ **TypeScript**：類型安全，易於維護
4. ✅ **模組化設計**：engine、data、components 分離

### app2 專案成果
- ✅ 完整的 ATB 戰鬥系統
- ✅ 六角格地圖渲染（SVG）
- ✅ 武器攻擊與讀條機制
- ✅ 隊伍管理系統

---

## 🎮 BG 卡片遊戲需求分析

### 從 BoardTechDesign.md 提取的核心需求

#### 1. 棋盤系統
- **可變尺寸**：5×5、7×5、9×9 等
- **方格座標系統**：(x, y)，原點左上
- **地形類型**：草原、河川、高地、道路、障礙物等
- **Tile 渲染**：每格獨立 PNG
- **互動**：點擊格子下指令

#### 2. 遊戲機制（推測）
- 回合制戰鬥
- 單位移動與攻擊
- 地形影響（移動成本、視線阻擋）
- 資源管理（從 PDF 內容推測）

#### 3. 多人需求（推測）
- 玩家對戰
- 即時同步
- 回合制或同時行動
- 房間系統

---

## 🔌 連線功能技術方案

### 方案 1：Supabase Realtime ⭐ 推薦

**優勢**：
- ✅ 已整合 Supabase，無需額外後端
- ✅ 內建即時訂閱功能
- ✅ 支援 PostgreSQL 觸發器
- ✅ 自動處理連線管理
- ✅ 免費額度足夠開發測試

**架構**：
```typescript
// 1. 建立遊戲房間表
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY,
  room_code TEXT UNIQUE,
  status TEXT, -- 'waiting' | 'playing' | 'finished'
  max_players INT,
  current_players INT,
  game_state JSONB,
  created_at TIMESTAMP
);

// 2. 建立玩家表
CREATE TABLE room_players (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id),
  user_id UUID,
  player_name TEXT,
  team INT,
  ready BOOLEAN,
  joined_at TIMESTAMP
);

// 3. 建立遊戲動作表（事件溯源）
CREATE TABLE game_actions (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES game_rooms(id),
  player_id UUID,
  action_type TEXT,
  action_data JSONB,
  timestamp TIMESTAMP
);
```

**客戶端實作**：
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 訂閱房間狀態
const channel = supabase
  .channel(`room:${roomId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'game_actions',
    filter: `room_id=eq.${roomId}`
  }, (payload) => {
    // 處理遊戲動作
    handleGameAction(payload.new)
  })
  .subscribe()

// 發送動作
async function sendAction(action: GameAction) {
  await supabase.from('game_actions').insert({
    room_id: roomId,
    player_id: playerId,
    action_type: action.type,
    action_data: action.data,
    timestamp: new Date().toISOString()
  })
}
```

**適用場景**：
- ✅ 回合制遊戲
- ✅ 中小型玩家數（2-8 人）
- ✅ 不需要極低延遲（<100ms 可接受）

---

### 方案 2：Socket.io + Node.js 後端

**優勢**：
- ✅ 更低延遲（<50ms）
- ✅ 更靈活的事件處理
- ✅ 支援房間廣播
- ✅ 自動重連機制

**劣勢**：
- ❌ 需要獨立後端伺服器
- ❌ 需要處理部署和維護
- ❌ 成本較高

**架構**：
```typescript
// 後端（Node.js + Socket.io）
import { Server } from 'socket.io'

const io = new Server(3000, {
  cors: { origin: '*' }
})

io.on('connection', (socket) => {
  socket.on('join-room', (roomCode) => {
    socket.join(roomCode)
    io.to(roomCode).emit('player-joined', {
      playerId: socket.id
    })
  })
  
  socket.on('game-action', (data) => {
    // 驗證動作
    if (validateAction(data)) {
      // 廣播給房間內所有玩家
      io.to(data.roomCode).emit('action-broadcast', data)
    }
  })
})

// 前端（Vue 3）
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000')

socket.on('connect', () => {
  socket.emit('join-room', roomCode)
})

socket.on('action-broadcast', (action) => {
  store.dispatch('applyAction', action)
})

function sendAction(action: GameAction) {
  socket.emit('game-action', {
    roomCode,
    playerId,
    action
  })
}
```

**適用場景**：
- ✅ 即時動作遊戲
- ✅ 需要極低延遲
- ✅ 複雜的房間邏輯

---

### 方案 3：WebRTC P2P

**優勢**：
- ✅ 最低延遲（直連）
- ✅ 無需中央伺服器處理遊戲邏輯
- ✅ 節省伺服器成本

**劣勢**：
- ❌ 實作複雜度高
- ❌ NAT 穿透問題
- ❌ 需要信令伺服器
- ❌ 作弊風險高（無權威伺服器）

**不推薦**：除非是 1v1 對戰且對延遲要求極高

---

## 🏗️ 推薦架構設計

### 整體架構（基於 Supabase Realtime）

```
┌─────────────────────────────────────────┐
│           Vue 3 前端應用                 │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  UI Layer   │  │  Game Engine    │  │
│  │  (Components)│  │  (Pure Logic)   │  │
│  └──────┬──────┘  └────────┬────────┘  │
│         │                  │            │
│  ┌──────▼──────────────────▼────────┐  │
│  │      Pinia Store (State)         │  │
│  │  ┌──────────┐  ┌──────────────┐ │  │
│  │  │ Room     │  │ Game State   │ │  │
│  │  │ Store    │  │ Store        │ │  │
│  │  └──────────┘  └──────────────┘ │  │
│  └──────┬───────────────────────────┘  │
│         │                               │
│  ┌──────▼───────────────────────────┐  │
│  │   Supabase Client (Realtime)     │  │
│  └──────┬───────────────────────────┘  │
└─────────┼───────────────────────────────┘
          │
          │ WebSocket
          │
┌─────────▼───────────────────────────────┐
│         Supabase 後端服務                │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │  PostgreSQL Database            │   │
│  │  ┌───────────┐  ┌────────────┐ │   │
│  │  │ Rooms     │  │ Actions    │ │   │
│  │  │ Players   │  │ Game State │ │   │
│  │  └───────────┘  └────────────┘ │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Realtime (WebSocket Server)    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Edge Functions (遊戲邏輯驗證)   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## 💾 資料同步策略

### 事件溯源模式（Event Sourcing）⭐ 推薦

**原理**：
- 不直接同步完整遊戲狀態
- 只同步玩家動作（events）
- 每個客戶端獨立計算狀態

**優勢**：
- ✅ 網路流量小
- ✅ 易於實作回放功能
- ✅ 易於除錯（完整動作歷史）
- ✅ 支援斷線重連（重放所有動作）

**實作**：
```typescript
// 遊戲動作類型
type GameAction = 
  | { type: 'MOVE_UNIT', unitId: string, to: {x: number, y: number} }
  | { type: 'ATTACK', attackerId: string, targetId: string }
  | { type: 'USE_ITEM', unitId: string, itemId: string }
  | { type: 'END_TURN', playerId: string }

// Store
const gameStore = defineStore('game', () => {
  const actions = ref<GameAction[]>([])
  const gameState = computed(() => {
    // 從初始狀態 + 所有動作計算當前狀態
    return actions.value.reduce(
      (state, action) => applyAction(state, action),
      initialState
    )
  })
  
  // 接收遠端動作
  function receiveAction(action: GameAction) {
    actions.value.push(action)
  }
  
  // 發送本地動作
  async function sendAction(action: GameAction) {
    // 樂觀更新
    actions.value.push(action)
    
    // 發送到伺服器
    await supabase.from('game_actions').insert({
      room_id: roomId,
      action_type: action.type,
      action_data: action
    })
  }
  
  return { gameState, receiveAction, sendAction }
})
```

---

## 🎯 實作路線圖

### Phase 1：本地多人模式（1-2 週）
**目標**：在單機環境實作完整遊戲邏輯

- [ ] 整合 BoardTechDesign.md 的棋盤系統
- [ ] 實作回合制邏輯
- [ ] 實作玩家切換
- [ ] 測試遊戲流程完整性

**成果**：可以在同一台電腦上進行 2 人對戰

---

### Phase 2：房間系統（1 週）
**目標**：建立多人房間基礎設施

- [ ] 設計資料庫 schema
- [ ] 實作房間建立/加入/離開
- [ ] 實作玩家列表
- [ ] 實作準備/開始機制

**成果**：玩家可以建立房間並邀請其他人

---

### Phase 3：即時同步（1-2 週）
**目標**：實作遊戲狀態同步

- [ ] 整合 Supabase Realtime
- [ ] 實作動作廣播
- [ ] 實作狀態同步
- [ ] 處理斷線重連
- [ ] 處理衝突解決

**成果**：多個玩家可以即時對戰

---

### Phase 4：優化與測試（1 週）
**目標**：提升穩定性和用戶體驗

- [ ] 延遲優化
- [ ] 樂觀更新
- [ ] 錯誤處理
- [ ] 壓力測試
- [ ] UI/UX 優化

**成果**：穩定的多人遊戲體驗

---

## 📊 技術可行性評估

### 整體可行性：⭐⭐⭐⭐⭐ 非常可行

| 項目 | 評分 | 說明 |
|------|------|------|
| **技術棧匹配** | ⭐⭐⭐⭐⭐ | Vue 3 + Supabase 完美契合 |
| **現有基礎** | ⭐⭐⭐⭐ | app 專案已有良好架構 |
| **開發難度** | ⭐⭐⭐ | 中等，主要是狀態同步 |
| **維護成本** | ⭐⭐⭐⭐ | Supabase 降低維護負擔 |
| **擴展性** | ⭐⭐⭐⭐ | 易於添加新功能 |

---

## 💰 成本估算

### Supabase 免費額度
- **資料庫**：500MB（足夠）
- **Realtime**：200 個並發連線
- **API 請求**：無限制
- **頻寬**：5GB/月

### 預估使用量（100 個活躍玩家）
- **資料庫**：< 100MB
- **並發連線**：< 50
- **頻寬**：< 2GB/月

**結論**：免費額度完全足夠開發和小規模運營

---

## ⚠️ 潛在挑戰與解決方案

### 1. 狀態同步衝突
**問題**：兩個玩家同時操作

**解決方案**：
- 回合制：只有當前玩家可操作
- 時間戳排序：伺服器端驗證動作順序
- 樂觀鎖：版本號機制

### 2. 網路延遲
**問題**：動作延遲影響體驗

**解決方案**：
- 樂觀更新：本地立即顯示
- 預測性動畫：平滑過渡
- 延遲補償：時間戳校正

### 3. 斷線重連
**問題**：玩家斷線後狀態丟失

**解決方案**：
- 事件溯源：重放所有動作
- 狀態快照：定期保存完整狀態
- 自動重連：Supabase 內建

### 4. 作弊防護
**問題**：客戶端可能被修改

**解決方案**：
- 伺服器驗證：所有動作必須通過驗證
- Edge Functions：關鍵邏輯在後端執行
- 動作日誌：可追溯異常行為

---

## 🚀 快速啟動指南

### 1. 設置 Supabase 專案
```bash
# 1. 前往 https://supabase.com 建立專案
# 2. 複製 API URL 和 anon key
# 3. 更新 .env.local
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. 建立資料庫表
```sql
-- 在 Supabase SQL Editor 執行
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'waiting',
  max_players INT DEFAULT 2,
  game_state JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES game_rooms(id),
  player_id TEXT,
  action_type TEXT,
  action_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 啟用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_actions;
```

### 3. 安裝依賴（已完成）
```bash
# app 專案已安裝 @supabase/supabase-js
```

### 4. 建立 Supabase 客戶端
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 5. 建立房間 Store
```typescript
// src/stores/room.ts
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useRoomStore = defineStore('room', () => {
  const roomId = ref<string | null>(null)
  const players = ref<Player[]>([])
  
  async function createRoom() {
    const code = generateRoomCode()
    const { data } = await supabase
      .from('game_rooms')
      .insert({ room_code: code })
      .select()
      .single()
    
    roomId.value = data.id
    subscribeToRoom(data.id)
  }
  
  function subscribeToRoom(id: string) {
    supabase
      .channel(`room:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_actions',
        filter: `room_id=eq.${id}`
      }, handleAction)
      .subscribe()
  }
  
  return { roomId, players, createRoom }
})
```

---

## 📝 結論與建議

### ✅ 強烈推薦實作

**理由**：
1. **技術棧完美匹配**：Vue 3 + Supabase 是理想組合
2. **現有基礎扎實**：app 專案架構良好
3. **成本可控**：免費額度足夠
4. **開發週期合理**：4-6 週可完成 MVP
5. **擴展性強**：易於添加新功能

### 🎯 建議採用方案

**Supabase Realtime + 事件溯源模式**

**優勢總結**：
- ✅ 無需額外後端開發
- ✅ 自動處理連線管理
- ✅ 內建權限控制
- ✅ 易於除錯和測試
- ✅ 成本低廉

### 📅 建議時程

- **Week 1-2**：整合棋盤系統，實作本地多人
- **Week 3**：建立房間系統
- **Week 4-5**：實作即時同步
- **Week 6**：優化與測試

**預計 6 週完成可玩的多人版本**

---

## 🔗 相關資源

### 官方文檔
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- [Vue 3 文檔](https://vuejs.org/)
- [Pinia 文檔](https://pinia.vuejs.org/)

### 範例專案
- [Supabase Realtime 範例](https://github.com/supabase/supabase/tree/master/examples/realtime)
- [Vue 3 多人遊戲範例](https://github.com/topics/multiplayer-game?l=vue)

---

**最後更新**：2026-03-21  
**分析者**：AI Assistant (Cascade)
