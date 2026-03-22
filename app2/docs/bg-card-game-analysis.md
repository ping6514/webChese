# BG 卡片遊戲 - 完整分析與實作建議

**分析日期**：2026-03-21  
**基於**：BG卡片.md 遊戲規則文檔

---

## 📋 遊戲概述

### 遊戲類型
**回合制卡牌對戰遊戲**，結合區域控制、資源管理和角色戰鬥機制。

### 核心特色
- **3 區域戰場**：我方主堡區 ↔ 廣場區 ↔ 敵主堡區
- **4 位 BG 角色**：每位有獨特技能和屬性
- **5 種卡牌類型**：BG卡、反應卡、建築卡、事件卡、技能卡
- **磚堆防禦系統**：保護城牆的關鍵機制
- **城牆攻防**：摧毀敵方 4 個城牆指示物即可勝利

---

## 🎮 遊戲機制詳解

### 勝利條件
```
在敵人城牆區為 0 的情況下
讓 BG 進行攻城動作成功
→ 我方勝利
```

### 場地結構

```
我方視角：
┌─────────────┬─────────────┬─────────────┐
│ 我方主堡區   │   廣場區     │  敵主堡區    │
│             │             │             │
│ [BG] [BG]   │  [BG] [BG]  │  [敵] [敵]  │
│ [BG] [BG]   │             │  [敵] [敵]  │
│             │             │             │
│ 磚堆: ██    │  磚堆: ██   │  磚堆: ██   │
│ 城牆: ●●●● │             │  城牆: ●●●● │
└─────────────┴─────────────┴─────────────┘
```

**區域功能**：
- **我方主堡區**：起始位置，有城牆保護
- **廣場區**：中立戰場，雙方爭奪
- **敵主堡區**：攻城目標

**磚堆系統**：
- 每個區域最多 2 層磚堆（蓋牌）
- 主堡磚堆：保護城牆，阻止攻城
- 廣場磚堆：阻止敵人進入主堡區

---

### 回合流程

#### Step 1：補充階段
可進行以下行為 **2 次**：
1. 抽 1 張牌
2. 放 1 張牌到磚堆（1 回合只能 1 次）

#### Step 2：主要階段
- 打出 1 張建築卡
- 打出任意數量事件卡

#### Step 3：行動階段
選擇未行動的 BG 進行行動（1 回合最多 4 次）

**行動流程**：
1. 移動角色（可停留原地）
2. 執行通常動作（清磚/對敵/攻城）
3. 可在任意時機使用 1 次技能

#### Step 4：反應階段
為 BG 安裝反應卡（每位 BG 最多 1 張）

#### Step 5：結束階段
- 手牌超過 6 張則棄牌至 6 張
- 回合交給對手

---

### BG 角色系統

#### 屬性
```typescript
type BGCard = {
  name: string
  class: 'BOM' | 'ATK' | 'SHT' | 'BLC'  // 職業
  toughness: number  // 堅韌度（HP）
  support: number    // 協助力
  attack: number     // 對敵力
  skill1: Skill
  skill2: Skill
}
```

#### 職業類型
- **BOM（爆破）**：擅長清磚和範圍攻擊
- **ATK（攻擊）**：高機動性和單體傷害
- **SHT（射擊）**：遠程攻擊和控制
- **BLC（阻擋）**：高堅韌度和防禦

#### 狀態系統
1. **普通狀態**（正放）：可正常行動
2. **暈眩狀態**（橫放）：無法主動行動，再受傷→KO
3. **KO 狀態**（倒放）：退回主堡區，2 回合後恢復

#### 通常動作
1. **清磚**：移除敵方磚堆，敵人抽 1 張牌
2. **對敵**：攻擊敵方 BG
   - 對敵力 + 協助力 vs 堅韌度
   - 超過 → 暈眩
   - 超過 2 倍或暈眩再受傷 → KO
3. **攻城**：敵主堡區無磚堆時可發動
   - 移除 1 個城牆指示物
   - 敵人抽 1 張牌
   - 城牆為 0 → 勝利

---

### 卡牌系統

#### 1. BG 卡（16 張範例）
**職業分佈**：
- BOM：小白、小黑、白金、小灰、大可（5 張）
- ATK：小橘、其阿莫、賽菲亞、鐵火、淺蔥（5 張）
- SHT：普拉斯、艾美拉、津輕、小紫、奧莉薇（5 張）
- BLC：派因、阿庫雅、希洛、普倫、蜜瓜（5 張）

**技能消耗**：
- 任*N：任意手牌 N 張
- 技*N：技能牌 N 張

#### 2. 反應卡（8 種）
- **閃避**（ALL）：對敵改為 0，抽 1 張
- **冷靜思考**（ALL）：KO 時抽 3 張
- **阻擋**（ALL）：無效清磚，抽 1 張
- **玉石俱焚**（ALL）：暈眩時對敵 5
- **誤導**（ALL）：對敵改為 0，清磚 1
- **靈動**（ATK）：堅韌+4，移動 1
- **威嚇**（SHT）：敵人移動進入時選擇受傷或退回

#### 3. 建築卡（4 種）
- **中繼點**（∞堅韌）：KO 時可從廣場區復活
- **城門**（3堅韌）：區域內我方受到對敵-1
- **雜魚群體**（1堅韌）：每回合對敵區域內敵人 2
- **主堡**（5堅韌）：城牆指示物

#### 4. 事件卡（8 種）
- **搖桿失靈**：敵人 1 回合不能移動
- **最佳拍檔**：區域內 2+ 我方 BG，協助+3
- **呼朋引伴**：移動相鄰區我方 BG
- **氣合**：堅韌+4
- **回家**：移動到主堡區並恢復
- **看穿**：移除敵人反應卡
- **RUSH TIME**：抽 5 張，多 2 次行動（限 1 次）
- **反應大師**：檢索反應卡

#### 5. 技能牌
用於支付 BG 技能 2 的消耗

---

### 牌組規則
- **牌組數量**：40-60 張
- **同名卡限制**：最多 3 張
- **手牌上限**：6 張
- **起始手牌**：先攻 5 張，後攻 7 張
- **調度**：可進行 1 次（全部洗回重抽）

---

## 🔌 多人連線需求分析

### 遊戲特性

#### 優勢（適合連線）
1. ✅ **回合制**：不需要即時同步
2. ✅ **完整資訊**：雙方可見場面狀態
3. ✅ **離散動作**：每個動作獨立
4. ✅ **狀態明確**：易於驗證和同步

#### 挑戰
1. ⚠️ **複雜狀態**：多個區域、多位 BG、多種狀態
2. ⚠️ **卡牌隱藏資訊**：手牌、牌組、磚堆
3. ⚠️ **觸發時機**：反應卡、技能效果
4. ⚠️ **規則驗證**：需要完整的遊戲引擎

---

## 🏗️ 技術實作建議

### 整體架構

```
┌─────────────────────────────────────────┐
│         Vue 3 前端應用                   │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌─────────────────┐ │
│  │ UI Layer     │  │ Game Engine     │ │
│  │ - 場地渲染   │  │ - 規則驗證      │ │
│  │ - 卡牌顯示   │  │ - 狀態計算      │ │
│  │ - 動作輸入   │  │ - 效果處理      │ │
│  └──────┬───────┘  └────────┬────────┘ │
│         │                   │          │
│  ┌──────▼───────────────────▼────────┐ │
│  │      Pinia Store (State)          │ │
│  │  ┌──────────┐  ┌──────────────┐  │ │
│  │  │ Game     │  │ Player       │  │ │
│  │  │ State    │  │ State        │  │ │
│  │  └──────────┘  └──────────────┘  │ │
│  └──────┬────────────────────────────┘ │
│         │                              │
│  ┌──────▼──────────────────────────┐  │
│  │   Supabase Realtime             │  │
│  └──────┬──────────────────────────┘  │
└─────────┼──────────────────────────────┘
          │
┌─────────▼──────────────────────────────┐
│      Supabase 後端                      │
│  ┌─────────────────────────────────┐  │
│  │  PostgreSQL                     │  │
│  │  - game_rooms                   │  │
│  │  - game_actions                 │  │
│  │  - player_hands (加密)          │  │
│  └─────────────────────────────────┘  │
│  ┌─────────────────────────────────┐  │
│  │  Edge Functions                 │  │
│  │  - validateAction()             │  │
│  │  - processEffect()              │  │
│  └─────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

### 資料結構設計

#### 遊戲狀態
```typescript
type GameState = {
  roomId: string
  turn: number
  phase: 'supply' | 'main' | 'action' | 'reaction' | 'end'
  currentPlayer: 'player1' | 'player2'
  
  // 場地
  zones: {
    player1_castle: Zone
    player1_plaza: Zone
    plaza: Zone
    player2_plaza: Zone
    player2_castle: Zone
  }
  
  // 玩家狀態
  players: {
    player1: PlayerState
    player2: PlayerState
  }
}

type Zone = {
  bgs: BGInstance[]
  bricks: number  // 磚堆層數
  buildings: BuildingCard[]
}

type PlayerState = {
  hand: Card[]  // 手牌（隱藏）
  deck: Card[]  // 牌組（隱藏）
  graveyard: Card[]  // 墓地（公開）
  castleHP: number  // 城牆指示物
  supplyActions: number  // 剩餘補充次數
  bgActions: number  // 剩餘 BG 行動次數
}

type BGInstance = {
  cardId: string
  zone: ZoneId
  state: 'normal' | 'stunned' | 'ko'
  toughness: number  // 當前堅韌度
  modifiers: Modifier[]  // 臨時效果
  reactionCard: ReactionCard | null
  hasActed: boolean  // 本回合是否已行動
}
```

---

### 動作系統設計

#### 動作類型
```typescript
type GameAction = 
  | { type: 'SUPPLY_DRAW' }
  | { type: 'SUPPLY_BRICK', zone: ZoneId }
  | { type: 'PLAY_BUILDING', cardId: string, zone: ZoneId }
  | { type: 'PLAY_EVENT', cardId: string, targets: Target[] }
  | { type: 'BG_MOVE', bgId: string, toZone: ZoneId }
  | { type: 'BG_CLEAR_BRICK', bgId: string, targetZone: ZoneId }
  | { type: 'BG_ATTACK', bgId: string, targetBgId: string }
  | { type: 'BG_SIEGE', bgId: string }
  | { type: 'USE_SKILL', bgId: string, skillNum: 1 | 2, costs: Card[], targets: Target[] }
  | { type: 'INSTALL_REACTION', bgId: string, cardId: string }
  | { type: 'END_PHASE' }
```

#### 動作驗證
```typescript
function validateAction(state: GameState, action: GameAction): boolean {
  switch (action.type) {
    case 'SUPPLY_DRAW':
      return state.phase === 'supply' 
        && state.players[state.currentPlayer].supplyActions > 0
    
    case 'BG_MOVE':
      const bg = findBG(state, action.bgId)
      return state.phase === 'action'
        && !bg.hasActed
        && isValidMove(bg.zone, action.toZone, state)
    
    // ... 其他驗證
  }
}
```

---

### 隱藏資訊處理

#### 問題
- 手牌、牌組、蓋牌（磚堆）對對手不可見
- 但伺服器需要驗證動作合法性

#### 解決方案：伺服器端狀態 + 客戶端視圖

```typescript
// 伺服器端（完整狀態）
type ServerGameState = {
  // ... 所有資訊
  player1: {
    hand: Card[]  // 完整手牌
    deck: Card[]  // 完整牌組
  }
  player2: {
    hand: Card[]
    deck: Card[]
  }
}

// 客戶端視圖（玩家 1）
type ClientGameState = {
  // ... 公開資訊
  myHand: Card[]  // 我的手牌（完整）
  myDeck: number  // 我的牌組數量
  opponentHand: number  // 對手手牌數量
  opponentDeck: number  // 對手牌組數量
}

// Supabase Edge Function
async function getGameView(gameId: string, playerId: string) {
  const fullState = await getFullState(gameId)
  return filterStateForPlayer(fullState, playerId)
}
```

---

### 同步策略

#### 事件溯源模式（推薦）

**優勢**：
- 完整動作歷史
- 易於回放和除錯
- 支援斷線重連
- 隱藏資訊安全

**實作**：
```typescript
// 動作表
CREATE TABLE game_actions (
  id UUID PRIMARY KEY,
  room_id UUID,
  player_id UUID,
  action_type TEXT,
  action_data JSONB,
  timestamp TIMESTAMP,
  sequence_number INT
);

// 客戶端
const gameStore = defineStore('game', () => {
  const actions = ref<GameAction[]>([])
  
  // 從動作重建狀態
  const gameState = computed(() => {
    return actions.value.reduce(
      (state, action) => applyAction(state, action),
      initialState
    )
  })
  
  // 發送動作
  async function sendAction(action: GameAction) {
    // 樂觀更新
    actions.value.push(action)
    
    // 發送到伺服器驗證
    const { data, error } = await supabase
      .from('game_actions')
      .insert({
        room_id: roomId,
        player_id: playerId,
        action_type: action.type,
        action_data: action
      })
    
    if (error) {
      // 回滾樂觀更新
      actions.value.pop()
      showError('動作無效')
    }
  }
})
```

---

## 📅 開發路線圖

### Phase 1：核心遊戲引擎（3-4 週）

#### Week 1-2：基礎系統
- [ ] 資料結構定義
- [ ] 場地渲染（3 區域）
- [ ] BG 卡片顯示
- [ ] 基本移動邏輯

#### Week 3：戰鬥系統
- [ ] 對敵判定
- [ ] 狀態系統（普通/暈眩/KO）
- [ ] 清磚機制
- [ ] 攻城機制

#### Week 4：卡牌系統
- [ ] 手牌管理
- [ ] 牌組抽牌
- [ ] 事件卡效果
- [ ] 建築卡效果

---

### Phase 2：技能與反應（2-3 週）

#### Week 5：技能系統
- [ ] 技能消耗驗證
- [ ] 16 張 BG 技能實作
- [ ] 技能目標選擇
- [ ] 效果結算

#### Week 6-7：反應系統
- [ ] 反應卡安裝
- [ ] 觸發時機檢測
- [ ] 8 種反應卡實作
- [ ] 連鎖效果處理

---

### Phase 3：多人連線（2-3 週）

#### Week 8：房間系統
- [ ] Supabase 資料庫設計
- [ ] 房間建立/加入
- [ ] 牌組選擇
- [ ] 遊戲初始化

#### Week 9：即時同步
- [ ] Supabase Realtime 整合
- [ ] 動作廣播
- [ ] 狀態同步
- [ ] 隱藏資訊處理

#### Week 10：優化與測試
- [ ] 動作驗證
- [ ] 錯誤處理
- [ ] 斷線重連
- [ ] UI/UX 優化

---

### Phase 4：完善與平衡（2 週）

#### Week 11：完整測試
- [ ] 所有卡牌效果測試
- [ ] 邊界情況處理
- [ ] 規則一致性驗證
- [ ] 性能優化

#### Week 12：上線準備
- [ ] 教學模式
- [ ] AI 對手（可選）
- [ ] 牌組構築器
- [ ] 部署與發布

---

## 💰 成本與資源評估

### 開發成本
- **時間**：10-12 週（全職開發）
- **人力**：1-2 名開發者
- **技術棧**：Vue 3 + Supabase（已有基礎）

### 運營成本
- **Supabase 免費額度**：足夠 100+ 並發玩家
- **升級成本**：$25/月（Pro 方案，500+ 並發）

### 技術難度
| 項目 | 難度 | 說明 |
|------|------|------|
| **遊戲引擎** | ⭐⭐⭐⭐ | 複雜規則，需要完整實作 |
| **UI 渲染** | ⭐⭐⭐ | 3 區域 + 卡牌顯示 |
| **多人同步** | ⭐⭐⭐ | Supabase 簡化難度 |
| **隱藏資訊** | ⭐⭐⭐⭐ | 需要伺服器端驗證 |
| **技能效果** | ⭐⭐⭐⭐⭐ | 32 種技能 + 8 種反應 |

---

## ⚠️ 關鍵挑戰與解決方案

### 1. 複雜的技能效果

**挑戰**：32 種 BG 技能 + 8 種反應卡，每種效果不同

**解決方案**：
```typescript
// 效果系統設計
type Effect = {
  type: 'damage' | 'move' | 'clear_brick' | 'modify_stat' | ...
  params: any
}

type SkillDefinition = {
  id: string
  cost: Cost
  effects: Effect[]
  condition?: (state: GameState) => boolean
}

// 範例：小白技能 1
const skill_xiaobai_1: SkillDefinition = {
  id: 'xiaobai_skill1',
  cost: { any: 1 },
  effects: [
    { type: 'clear_brick', zone: 'enemy_castle', count: 1 },
    { type: 'clear_brick', zone: 'enemy_plaza', count: 1 }
  ],
  condition: (state) => state.currentBG.zone !== 'my_castle'
}
```

---

### 2. 反應卡觸發時機

**挑戰**：反應卡在特定時機觸發，需要中斷流程

**解決方案**：
```typescript
// 事件系統
type GameEvent = 
  | { type: 'BEFORE_DAMAGE', target: BGId, amount: number }
  | { type: 'AFTER_MOVE', bg: BGId, from: Zone, to: Zone }
  | { type: 'ON_KO', bg: BGId }

async function processAction(action: GameAction) {
  // 1. 執行動作
  const events = executeAction(action)
  
  // 2. 檢查反應卡觸發
  for (const event of events) {
    const reactions = findTriggeredReactions(event)
    for (const reaction of reactions) {
      // 詢問玩家是否發動
      const shouldActivate = await askPlayer(reaction.owner, reaction)
      if (shouldActivate) {
        await processReaction(reaction, event)
      }
    }
  }
  
  // 3. 結算最終效果
  applyFinalEffects()
}
```

---

### 3. 隱藏資訊安全

**挑戰**：防止玩家作弊（查看對手手牌）

**解決方案**：
```typescript
// 伺服器端驗證（Edge Function）
export async function validateAndExecute(req: Request) {
  const { roomId, playerId, action } = await req.json()
  
  // 1. 獲取完整狀態（包含隱藏資訊）
  const fullState = await getFullState(roomId)
  
  // 2. 驗證動作合法性
  if (!validateAction(fullState, playerId, action)) {
    return new Response('Invalid action', { status: 400 })
  }
  
  // 3. 執行動作
  const newState = applyAction(fullState, action)
  
  // 4. 儲存新狀態
  await saveState(roomId, newState)
  
  // 5. 廣播公開資訊
  await broadcastPublicState(roomId, newState)
  
  return new Response('OK')
}
```

---

## 🎯 可行性總結

### 整體評估：⭐⭐⭐⭐ 可行但具挑戰性

| 面向 | 評分 | 說明 |
|------|------|------|
| **技術可行性** | ⭐⭐⭐⭐⭐ | Vue 3 + Supabase 完全支援 |
| **開發難度** | ⭐⭐⭐⭐ | 規則複雜，需要完整引擎 |
| **時間成本** | ⭐⭐⭐ | 10-12 週全職開發 |
| **維護成本** | ⭐⭐⭐⭐ | Supabase 降低維護負擔 |
| **擴展性** | ⭐⭐⭐⭐⭐ | 易於添加新卡牌和功能 |

---

### 推薦實作順序

1. **先做單機版**（4-6 週）
   - 完整遊戲引擎
   - 所有卡牌效果
   - 本地 2 人對戰

2. **再加連線**（2-3 週）
   - Supabase 整合
   - 房間系統
   - 即時同步

3. **最後優化**（2 週）
   - UI/UX 改進
   - 性能優化
   - 教學模式

---

## 📚 參考資源

### 類似遊戲
- **爐石戰記**：卡牌對戰機制
- **符文大地傳說**：回合制卡牌
- **萬智牌 Arena**：複雜規則引擎

### 技術參考
- [Supabase Realtime 文檔](https://supabase.com/docs/guides/realtime)
- [Vue 3 遊戲開發](https://vuejs.org/)
- [卡牌遊戲引擎設計](https://github.com/topics/card-game-engine)

---

## 🚀 下一步建議

### 立即行動
1. **建立專案結構**
   ```bash
   cd app
   mkdir src/game/bg-card
   ```

2. **定義資料結構**
   - 建立 `types.ts`
   - 定義所有卡牌資料

3. **實作核心引擎**
   - 場地系統
   - 移動邏輯
   - 戰鬥判定

### 中期目標
- 完成單機版遊戲
- 實作所有卡牌效果
- 本地測試完整流程

### 長期目標
- 整合 Supabase 連線
- 上線公開測試
- 收集玩家反饋並平衡

---

**結論**：BG 卡片遊戲在 app 專案基礎上實作**完全可行**，但需要投入 10-12 週的開發時間。建議先完成單機版，驗證遊戲性後再加入多人連線功能。使用 Supabase Realtime 可以大幅簡化連線開發，是理想的技術選擇。

---

**最後更新**：2026-03-21  
**分析者**：AI Assistant (Cascade)
