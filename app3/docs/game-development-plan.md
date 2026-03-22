# 魔物娘戰棋遊戲開發計畫

## 📋 專案目標

開發一個完整的魔物娘戰棋遊戲，包含：
- 牌組編輯系統
- 預設牌組系統
- 完整對戰系統
- 鏡像桌面視角
- AI對戰功能

---

## 🎯 核心功能需求

### **1. 牌組系統**
- ✅ 牌組編輯器
- ✅ 預設牌組庫
- ✅ 牌組儲存/載入
- ✅ 牌組驗證（合法性檢查）

### **2. 對戰系統**
- ✅ 遊戲引擎（回合、行動、戰鬥）
- ✅ 手牌管理
- ✅ 場地管理（四區域）
- ✅ 狀態管理（生命、磚堆、冷卻）

### **3. UI系統**
- ✅ 手牌UI（可拖曳、可點擊）
- ✅ 卡牌詳情UI（懸停/點擊顯示）
- ✅ 場地UI（四區域、首領位置）
- ✅ 玩家狀態UI（手牌數、牌組數、基地生命）
- ✅ 鏡像桌面（雙方視角）

### **4. AI系統**
- ✅ Bot決策邏輯
- ✅ 難度等級
- ✅ 預設牌組套用

---

## 🏗️ 技術架構評估

### **方案A：基於App3擴展（推薦）**

#### **優勢：**
- ✅ 已有完整的卡牌資料和規則
- ✅ 已有卡牌圖鑑和規則展示
- ✅ Vue 3 + TypeScript 基礎良好
- ✅ 可以直接使用現有資料結構

#### **需要添加：**
- 遊戲引擎（狀態管理）
- 對戰UI組件
- 牌組編輯器
- 儲存系統（LocalStorage/IndexedDB）

#### **架構：**
```
app3/
├── src/
│   ├── views/
│   │   ├── Home.vue              # 首頁
│   │   ├── CardsGallery.vue      # 卡牌圖鑑
│   │   ├── GameRules.vue         # 規則頁面
│   │   ├── DeckBuilder.vue       # 🆕 牌組編輯器
│   │   ├── DeckLibrary.vue       # 🆕 牌組庫
│   │   └── BattleGame.vue        # 🆕 對戰頁面
│   │
│   ├── components/
│   │   ├── game/
│   │   │   ├── HandCards.vue     # 🆕 手牌區
│   │   │   ├── Battlefield.vue   # 🆕 場地區
│   │   │   ├── PlayerStatus.vue  # 🆕 玩家狀態
│   │   │   ├── CardDetail.vue    # 🆕 卡牌詳情
│   │   │   └── ActionPanel.vue   # 🆕 行動面板
│   │   │
│   │   └── deck/
│   │       ├── DeckEditor.vue    # 🆕 牌組編輯
│   │       ├── CardSelector.vue  # 🆕 卡牌選擇器
│   │       └── DeckStats.vue     # 🆕 牌組統計
│   │
│   ├── game/                      # 🆕 遊戲引擎
│   │   ├── GameEngine.ts         # 核心引擎
│   │   ├── GameState.ts          # 遊戲狀態
│   │   ├── TurnManager.ts        # 回合管理
│   │   ├── ActionHandler.ts      # 行動處理
│   │   ├── CombatResolver.ts     # 戰鬥解算
│   │   └── AIPlayer.ts           # AI玩家
│   │
│   ├── stores/                    # 🆕 狀態管理
│   │   ├── gameStore.ts          # 遊戲狀態
│   │   ├── deckStore.ts          # 牌組狀態
│   │   └── uiStore.ts            # UI狀態
│   │
│   └── utils/
│       ├── deckValidator.ts      # 🆕 牌組驗證
│       ├── deckStorage.ts        # 🆕 牌組儲存
│       └── presetDecks.ts        # 🆕 預設牌組
```

### **方案B：基於App2擴展**

#### **優勢：**
- 已有部分遊戲引擎基礎
- 已有戰鬥模擬器

#### **劣勢：**
- 卡牌資料可能不完整
- 需要重新整理架構

---

## 📊 資料結構設計

### **1. 牌組資料結構**

```typescript
// 牌組定義
interface Deck {
  id: string
  name: string
  description?: string
  author?: string
  createdAt: Date
  updatedAt: Date
  
  // 卡牌組成
  leaders: string[]        // 3張首領卡ID
  cards: DeckCard[]        // 30-40張卡牌
  
  // 統計資訊
  stats: {
    totalCards: number
    leaderCount: number
    legionCount: number
    eventCount: number
    reactionCount: number
    buildingCount: number
    
    // 職業分布
    classDistribution: {
      destroyer: number
      conqueror: number
      commander: number
      guardian: number
      neutral: number
    }
    
    // 成本曲線
    costCurve: number[]
  }
}

interface DeckCard {
  cardId: string
  count: number           // 數量（1-3張）
}

// 預設牌組
interface PresetDeck extends Deck {
  preset: true
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  strategy: string        // 策略說明
  recommended: boolean    // 是否推薦
}
```

### **2. 遊戲狀態資料結構**

```typescript
// 遊戲狀態
interface GameState {
  gameId: string
  mode: 'pvp' | 'pve'
  status: 'setup' | 'playing' | 'ended'
  
  // 玩家狀態
  players: {
    player1: PlayerState
    player2: PlayerState
  }
  
  // 回合資訊
  turn: {
    currentPlayer: 'player1' | 'player2'
    turnNumber: number
    phase: 'start' | 'draw' | 'main' | 'end'
  }
  
  // 場地狀態
  battlefield: BattlefieldState
  
  // 歷史記錄
  history: GameAction[]
}

// 玩家狀態
interface PlayerState {
  playerId: string
  playerName: string
  isAI: boolean
  
  // 基地狀態
  fortress: {
    hp: number
    maxHp: number
  }
  
  // 牌組狀態
  deck: string[]          // 牌組（卡牌ID）
  hand: string[]          // 手牌
  graveyard: string[]     // 墓地
  
  // 首領狀態
  leaders: LeaderState[]
  
  // 資源
  resources: {
    handLimit: number
  }
}

// 首領狀態
interface LeaderState {
  cardId: string
  instanceId: string      // 實例ID
  
  // 位置
  zone: 'my_base' | 'my_field' | 'enemy_field' | 'enemy_base'
  
  // 屬性
  currentToughness: number
  maxToughness: number
  attack: number
  defensiveSupport: number
  offensiveSupport: number
  recovery: number
  
  // 狀態
  status: 'normal' | 'stunned' | 'ko'
  hasActed: boolean
  
  // 裝備
  equippedLegion?: string
  installedReactions: string[]
  
  // 技能冷卻
  skillCooldown: number
}

// 場地狀態
interface BattlefieldState {
  zones: {
    player1_base: ZoneState
    player1_field: ZoneState
    player2_field: ZoneState
    player2_base: ZoneState
  }
}

interface ZoneState {
  bricks: number          // 磚堆數量
  building?: string       // 建築卡ID
  leaders: string[]       // 首領實例ID列表
}
```

---

## 🎨 UI設計規劃

### **1. 鏡像桌面佈局**

```
玩家視角（Player 1）：
┌─────────────────────────────────────────────┐
│  敵方狀態 (P2)                               │
│  手牌: 5張 | 牌組: 25張 | 基地: 3/5          │
├─────────────────────────────────────────────┤
│                                             │
│  [敵方基地] ← [敵方戰場] ← [我方戰場] → [我方基地] │
│     🏰          ⚔️          🛡️          🏠    │
│   磚堆:3      磚堆:2      磚堆:4      磚堆:5   │
│   👹👹        👹          🧙          🧙🧙    │
│                                             │
├─────────────────────────────────────────────┤
│  我方手牌                                    │
│  [🎴] [🎴] [🎴] [🎴] [🎴] [🎴] [🎴]         │
├─────────────────────────────────────────────┤
│  我方狀態 (P1)                               │
│  手牌: 7張 | 牌組: 30張 | 基地: 5/5          │
└─────────────────────────────────────────────┘

玩家視角（Player 2）- 鏡像翻轉：
┌─────────────────────────────────────────────┐
│  敵方狀態 (P1)                               │
│  手牌: 7張 | 牌組: 30張 | 基地: 5/5          │
├─────────────────────────────────────────────┤
│                                             │
│  [敵方基地] ← [敵方戰場] ← [我方戰場] → [我方基地] │
│     🏠          🛡️          ⚔️          🏰    │
│   磚堆:5      磚堆:4      磚堆:2      磚堆:3   │
│   🧙🧙        🧙          👹          👹👹    │
│                                             │
├─────────────────────────────────────────────┤
│  我方手牌                                    │
│  [🎴] [🎴] [🎴] [🎴] [🎴]                   │
├─────────────────────────────────────────────┤
│  我方狀態 (P2)                               │
│  手牌: 5張 | 牌組: 25張 | 基地: 3/5          │
└─────────────────────────────────────────────┘
```

### **2. UI組件設計**

#### **HandCards.vue - 手牌區**
```vue
功能：
- 顯示手牌（扇形排列）
- 可拖曳卡牌
- 懸停顯示詳情
- 高亮可用卡牌
- 顯示成本
```

#### **Battlefield.vue - 場地區**
```vue
功能：
- 四區域顯示
- 首領卡片顯示
- 磚堆數量顯示
- 建築卡顯示
- 可點擊選擇目標
- 高亮可行動區域
```

#### **PlayerStatus.vue - 玩家狀態**
```vue
功能：
- 基地生命力
- 手牌數量
- 牌組剩餘數量
- 墓地數量
- 玩家名稱
```

#### **CardDetail.vue - 卡牌詳情**
```vue
功能：
- 卡牌大圖
- 完整屬性
- 技能描述
- 成本資訊
- 關閉按鈕
```

#### **ActionPanel.vue - 行動面板**
```vue
功能：
- 可用行動列表
- 移動、攻擊、清磚、攻城等
- 使用技能
- 結束回合按鈕
```

---

## 🎮 遊戲引擎設計

### **1. GameEngine.ts - 核心引擎**

```typescript
class GameEngine {
  private state: GameState
  private turnManager: TurnManager
  private actionHandler: ActionHandler
  private combatResolver: CombatResolver
  
  // 初始化遊戲
  initGame(player1Deck: Deck, player2Deck: Deck, mode: 'pvp' | 'pve'): void
  
  // 回合控制
  startTurn(): void
  endTurn(): void
  
  // 行動處理
  executeAction(action: GameAction): ActionResult
  
  // 狀態查詢
  getGameState(): GameState
  getAvailableActions(playerId: string): Action[]
  
  // 遊戲結束
  checkWinCondition(): 'player1' | 'player2' | null
}
```

### **2. TurnManager.ts - 回合管理**

```typescript
class TurnManager {
  // 回合階段
  startPhase(): void      // 回合開始
  drawPhase(): void       // 抽牌階段
  mainPhase(): void       // 主要階段
  endPhase(): void        // 回合結束
  
  // 回合切換
  switchPlayer(): void
  
  // 階段檢查
  canPerformAction(action: Action): boolean
}
```

### **3. ActionHandler.ts - 行動處理**

```typescript
class ActionHandler {
  // 卡牌行動
  playCard(cardId: string, target?: Target): ActionResult
  equipLegion(leaderId: string, legionId: string): ActionResult
  installReaction(leaderId: string, reactionId: string): ActionResult
  placeBuilding(zoneId: string, buildingId: string): ActionResult
  
  // 首領行動
  moveLeader(leaderId: string, targetZone: string): ActionResult
  attackLeader(attackerId: string, targetId: string): ActionResult
  clearBricks(leaderId: string, targetZone: string): ActionResult
  siegeFortress(leaderId: string): ActionResult
  buildBricks(leaderId: string): ActionResult
  repairFortress(leaderId: string): ActionResult
  useSkill(leaderId: string, skillId: string, target?: Target): ActionResult
}
```

### **4. CombatResolver.ts - 戰鬥解算**

```typescript
class CombatResolver {
  // 傷害計算
  calculateDamage(attacker: LeaderState, defender: LeaderState): number
  
  // 協助計算
  calculateSupport(leaderId: string, zone: string): SupportValue
  
  // 狀態更新
  applyDamage(leaderId: string, damage: number): void
  checkStunned(leaderId: string): void
  checkKO(leaderId: string): void
  
  // 攻城計算
  calculateSiegeDamage(attackerId: string, bricks: number): number
}
```

### **5. AIPlayer.ts - AI玩家**

```typescript
class AIPlayer {
  private difficulty: 'easy' | 'medium' | 'hard'
  
  // 決策
  makeDecision(gameState: GameState): GameAction
  
  // 策略
  evaluateBoard(gameState: GameState): number
  selectBestAction(actions: Action[]): Action
  
  // 優先級
  prioritizeTargets(targets: Target[]): Target[]
}
```

---

## 📦 牌組系統設計

### **1. 牌組編輯器功能**

```typescript
// DeckBuilder.vue
功能：
- 選擇3張首領卡
- 添加卡牌（拖曳或點擊）
- 移除卡牌
- 調整數量（1-3張）
- 即時驗證
- 顯示統計（職業分布、成本曲線）
- 儲存/載入牌組
- 導出/導入牌組

驗證規則：
✅ 必須有3張首領卡
✅ 總卡牌數30-40張
✅ 單卡最多3張
✅ 職業專屬卡需要對應職業首領
```

### **2. 預設牌組庫**

```typescript
// presetDecks.ts
預設牌組類型：

1. 新手牌組（4套）
   - 破壞者速攻
   - 征服者機動
   - 指揮官控制
   - 守護者防守

2. 進階牌組（4套）
   - 混合職業
   - 特殊戰術
   - 資源流
   - 攻城流

3. 競技牌組（4套）
   - 錦標賽級別
   - 高級策略
   - 複雜組合

每套牌組包含：
- 完整卡表
- 策略說明
- 難度標記
- 推薦等級
```

### **3. 牌組儲存系統**

```typescript
// deckStorage.ts
功能：
- LocalStorage儲存
- IndexedDB備份
- 導出JSON
- 導入JSON
- 雲端同步（可選）

資料格式：
{
  "decks": [
    {
      "id": "deck_001",
      "name": "我的牌組",
      "leaders": [...],
      "cards": [...],
      "stats": {...}
    }
  ],
  "version": "1.0.0"
}
```

---

## 🗓️ 開發階段規劃

### **階段1：基礎架構（1-2週）**

#### **Week 1: 資料結構與狀態管理**
- [ ] 定義完整的TypeScript介面
- [ ] 設置Pinia狀態管理
- [ ] 實現牌組資料結構
- [ ] 實現遊戲狀態結構
- [ ] 建立路由結構

#### **Week 2: 牌組系統**
- [ ] 開發牌組編輯器UI
- [ ] 實現卡牌選擇器
- [ ] 實現牌組驗證
- [ ] 實現牌組儲存/載入
- [ ] 創建12套預設牌組

---

### **階段2：遊戲引擎（2-3週）**

#### **Week 3: 核心引擎**
- [ ] 實現GameEngine核心
- [ ] 實現TurnManager
- [ ] 實現遊戲初始化
- [ ] 實現抽牌邏輯
- [ ] 實現回合切換

#### **Week 4: 行動系統**
- [ ] 實現ActionHandler
- [ ] 實現卡牌打出邏輯
- [ ] 實現首領移動
- [ ] 實現攻擊邏輯
- [ ] 實現清磚/攻城/築城/修城

#### **Week 5: 戰鬥系統**
- [ ] 實現CombatResolver
- [ ] 實現傷害計算
- [ ] 實現協助計算
- [ ] 實現暈眩/擊敗邏輯
- [ ] 實現勝利條件檢查

---

### **階段3：UI開發（2-3週）**

#### **Week 6: 基礎UI**
- [ ] 開發Battlefield組件
- [ ] 開發PlayerStatus組件
- [ ] 開發HandCards組件
- [ ] 開發CardDetail組件
- [ ] 實現鏡像視角切換

#### **Week 7: 互動UI**
- [ ] 實現卡牌拖曳
- [ ] 實現目標選擇
- [ ] 實現行動高亮
- [ ] 實現動畫效果
- [ ] 實現音效（可選）

#### **Week 8: 行動面板**
- [ ] 開發ActionPanel組件
- [ ] 實現行動按鈕
- [ ] 實現技能面板
- [ ] 實現回合控制
- [ ] 實現遊戲日誌

---

### **階段4：AI與整合（1-2週）**

#### **Week 9: AI系統**
- [ ] 實現基礎AI決策
- [ ] 實現難度等級
- [ ] 實現AI策略
- [ ] 測試AI平衡性

#### **Week 10: 整合測試**
- [ ] 整合所有模組
- [ ] 完整流程測試
- [ ] Bug修復
- [ ] 性能優化
- [ ] 文檔完善

---

## 🎯 開發優先級

### **P0 - 核心功能（必須）**
1. ✅ 遊戲引擎核心
2. ✅ 基礎UI（場地、手牌、狀態）
3. ✅ 牌組編輯器
4. ✅ 預設牌組系統
5. ✅ 基礎AI

### **P1 - 重要功能（應該有）**
1. ✅ 鏡像桌面
2. ✅ 卡牌詳情UI
3. ✅ 行動面板
4. ✅ 牌組儲存
5. ✅ 遊戲日誌

### **P2 - 增強功能（可以有）**
1. ⭕ 動畫效果
2. ⭕ 音效
3. ⭕ 教學模式
4. ⭕ 回放系統
5. ⭕ 雲端同步

---

## 🛠️ 技術選型

### **前端框架**
- Vue 3 + TypeScript
- Vite
- Pinia（狀態管理）
- Vue Router

### **UI框架**
- 自定義CSS（遊戲風格）
- Vue Draggable（拖曳）
- GSAP（動畫，可選）

### **儲存方案**
- LocalStorage（牌組）
- IndexedDB（遊戲記錄）
- JSON導出/導入

### **測試工具**
- Vitest（單元測試）
- Playwright（E2E測試，可選）

---

## 📊 里程碑

### **Milestone 1: 牌組系統（Week 2）**
- ✅ 可以編輯牌組
- ✅ 可以儲存/載入牌組
- ✅ 有12套預設牌組

### **Milestone 2: 遊戲引擎（Week 5）**
- ✅ 可以初始化遊戲
- ✅ 可以執行回合
- ✅ 可以執行基本行動
- ✅ 可以判定勝負

### **Milestone 3: 基礎對戰（Week 8）**
- ✅ 可以進行完整對戰
- ✅ UI完整可用
- ✅ 鏡像視角正常

### **Milestone 4: AI對戰（Week 10）**
- ✅ 可以與AI對戰
- ✅ 所有功能整合完成
- ✅ 可以發布測試版

---

## 🚀 啟動建議

### **立即開始（建議順序）**

1. **設置專案結構**
   ```bash
   # 在app3中添加新資料夾
   mkdir -p src/game src/stores src/components/game src/components/deck
   ```

2. **定義資料結構**
   - 創建所有TypeScript介面
   - 設置Pinia stores

3. **開發牌組編輯器**
   - 先做UI
   - 再做邏輯
   - 最後做儲存

4. **開發遊戲引擎**
   - 先做核心邏輯
   - 再做行動系統
   - 最後做戰鬥系統

5. **開發對戰UI**
   - 先做靜態UI
   - 再做互動
   - 最後做動畫

6. **整合測試**
   - 完整流程測試
   - Bug修復
   - 優化

---

## 📝 注意事項

### **開發原則**
1. **先功能後優化** - 先實現核心功能，再優化性能
2. **模組化設計** - 每個模組獨立，便於測試和維護
3. **類型安全** - 充分利用TypeScript，減少運行時錯誤
4. **測試驅動** - 核心邏輯要有單元測試
5. **文檔完善** - 複雜邏輯要有註釋和文檔

### **風險控制**
1. **複雜度管理** - 分階段開發，避免一次做太多
2. **性能考慮** - 遊戲狀態更新要高效
3. **UI響應** - 確保UI流暢，避免卡頓
4. **AI平衡** - AI不能太強或太弱
5. **Bug追蹤** - 建立Bug追蹤系統

---

## 🎉 預期成果

### **最終交付物**
- ✅ 完整的牌組編輯系統
- ✅ 12套預設牌組
- ✅ 完整的對戰系統
- ✅ 鏡像桌面視角
- ✅ AI對戰功能
- ✅ 牌組儲存/載入
- ✅ 完整的遊戲文檔

### **可玩性**
- 玩家可以自由編輯牌組
- 玩家可以與AI對戰
- 玩家可以儲存多套牌組
- 遊戲規則完整實現
- UI友好易用

---

**預計總開發時間：8-10週**

**建議開發模式：**
- 每週完成一個里程碑
- 每天提交代碼
- 每週進行測試
- 保持文檔更新

**準備好開始了嗎？** 🚀
