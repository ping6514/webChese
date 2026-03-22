# BG 卡片遊戲 - 技術難點分析

**分析日期**：2026-03-21  
**對比**：BG 卡片 vs 象棋實作難度

---

## 📊 技術難點總覽

### 難點排序（由難到易）

| 排名 | 技術難點 | 難度 | 說明 |
|------|---------|------|------|
| 1 | **反應卡觸發系統** | ⭐⭐⭐⭐⭐ | 最複雜 |
| 2 | **隱藏資訊處理** | ⭐⭐⭐⭐⭐ | 防作弊關鍵 |
| 3 | **效果連鎖與結算順序** | ⭐⭐⭐⭐ | 邏輯複雜 |
| 4 | **多人同步與衝突解決** | ⭐⭐⭐⭐ | 網路問題 |
| 5 | **狀態管理複雜度** | ⭐⭐⭐⭐ | 變數多 |
| 6 | **卡牌效果實作** | ⭐⭐⭐ | 數量多但單純 |
| 7 | **UI/UX 設計** | ⭐⭐⭐ | 資訊呈現 |
| 8 | **技能冷卻系統** | ⭐⭐ | 簡單 |

---

## 🔥 難點 1：反應卡觸發系統（最難）

### 為什麼是最難的？

**問題**：反應卡需要在特定時機「中斷」遊戲流程

#### 範例場景
```
1. 玩家 A 的小白對玩家 B 的小黑進行對敵
2. 小黑裝備了「閃避」反應卡
3. 系統需要：
   a. 暫停對敵流程
   b. 詢問玩家 B 是否發動「閃避」
   c. 等待玩家 B 回應
   d. 如果發動，修改對敵傷害為 0
   e. 繼續原本的流程
```

### 技術挑戰

#### 挑戰 1：事件驅動系統
```typescript
// 需要設計完整的事件系統
type GameEvent = 
  | { type: 'BEFORE_DAMAGE', source: BGId, target: BGId, amount: number }
  | { type: 'AFTER_DAMAGE', target: BGId, finalAmount: number }
  | { type: 'BEFORE_MOVE', bg: BGId, from: Zone, to: Zone }
  | { type: 'AFTER_MOVE', bg: BGId, from: Zone, to: Zone }
  | { type: 'ON_CLEAR_BRICK', bg: BGId, zone: Zone }
  | { type: 'ON_KO', bg: BGId }
  | { type: 'ON_STUNNED', bg: BGId }

// 每個動作都需要觸發對應事件
async function executeAttack(attacker: BG, target: BG) {
  // 1. 觸發 BEFORE_DAMAGE 事件
  const beforeEvent = { type: 'BEFORE_DAMAGE', source: attacker.id, target: target.id, amount: damage }
  await processEvent(beforeEvent)  // ← 可能被反應卡修改
  
  // 2. 執行傷害
  applyDamage(target, finalDamage)
  
  // 3. 觸發 AFTER_DAMAGE 事件
  const afterEvent = { type: 'AFTER_DAMAGE', target: target.id, finalAmount: finalDamage }
  await processEvent(afterEvent)
}
```

#### 挑戰 2：非同步流程控制
```typescript
// 需要等待玩家回應
async function processEvent(event: GameEvent) {
  // 1. 找出可以觸發的反應卡
  const reactions = findTriggeredReactions(event)
  
  // 2. 依序詢問玩家
  for (const reaction of reactions) {
    // ⚠️ 這裡需要暫停遊戲，等待玩家決定
    const shouldActivate = await askPlayer(reaction.owner, {
      message: `是否發動反應卡「${reaction.name}」？`,
      timeout: 30000  // 30 秒超時
    })
    
    if (shouldActivate) {
      // 3. 執行反應卡效果
      await executeReaction(reaction, event)
      
      // 4. 標記已觸發（每回合限 1 次）
      reaction.triggeredThisTurn = true
    }
  }
}
```

#### 挑戰 3：效果修改與取消
```typescript
// 反應卡可能修改或取消原本的效果
type EventModifier = {
  eventId: string
  modifications: {
    damage?: number  // 修改傷害
    cancelled?: boolean  // 取消效果
    additionalEffects?: Effect[]  // 額外效果
  }
}

// 範例：閃避卡
function reactionDodge(event: BeforeDamageEvent): EventModifier {
  return {
    eventId: event.id,
    modifications: {
      damage: 0,  // 傷害改為 0
      additionalEffects: [
        { type: 'DRAW_CARD', player: event.target.owner, count: 1 }
      ]
    }
  }
}
```

### 與象棋對比

**象棋**：
```typescript
// 象棋沒有「中斷」機制
function movePiece(from: Position, to: Position) {
  // 1. 驗證移動合法性
  if (!isValidMove(from, to)) return false
  
  // 2. 執行移動
  board[to] = board[from]
  board[from] = null
  
  // 3. 完成！
  return true
}
```

**BG 卡片**：
```typescript
// 需要處理多層中斷
async function moveBG(bg: BG, to: Zone) {
  // 1. 觸發 BEFORE_MOVE 事件
  await processEvent({ type: 'BEFORE_MOVE', bg, to })
  // ↑ 可能被「威嚇」反應卡中斷
  
  // 2. 執行移動
  bg.zone = to
  
  // 3. 觸發 AFTER_MOVE 事件
  await processEvent({ type: 'AFTER_MOVE', bg, to })
  // ↑ 可能觸發其他效果
}
```

**結論**：BG 卡片的反應系統比象棋複雜 **10 倍以上**

---

## 🔒 難點 2：隱藏資訊處理

### 問題描述

**需要隱藏的資訊**：
1. 手牌（對手不可見）
2. 牌組（對手不可見）
3. 磚堆（蓋牌，雙方都不可見）

### 技術挑戰

#### 挑戰 1：防止作弊
```typescript
// ❌ 錯誤做法：客戶端儲存完整狀態
type ClientGameState = {
  myHand: Card[]
  opponentHand: Card[]  // ← 作弊者可以看到！
}

// ✅ 正確做法：伺服器端驗證
// 客戶端
type ClientGameState = {
  myHand: Card[]  // 完整資訊
  opponentHandCount: number  // 只知道數量
}

// 伺服器端
type ServerGameState = {
  player1Hand: Card[]  // 完整資訊
  player2Hand: Card[]  // 完整資訊
}
```

#### 挑戰 2：動作驗證
```typescript
// 客戶端發送動作
function useSkill(bgId: string, skillNum: 1 | 2, discardedCards: CardId[]) {
  // 客戶端只能說「我要用這些卡」
  // 但不能證明自己真的有這些卡
  
  await supabase.from('game_actions').insert({
    type: 'USE_SKILL',
    bgId,
    skillNum,
    discardedCards  // ← 可能是假的！
  })
}

// 伺服器端驗證（Edge Function）
async function validateUseSkill(action: UseSkillAction, gameState: ServerGameState) {
  const player = gameState.players[action.playerId]
  
  // 1. 檢查玩家是否真的有這些卡
  for (const cardId of action.discardedCards) {
    if (!player.hand.includes(cardId)) {
      return { valid: false, reason: '手牌中沒有這張卡' }
    }
  }
  
  // 2. 檢查消耗是否正確
  const skill = getSkill(action.bgId, action.skillNum)
  if (!matchesCost(action.discardedCards, skill.cost)) {
    return { valid: false, reason: '消耗不符合' }
  }
  
  // 3. 檢查冷卻
  const bg = findBG(gameState, action.bgId)
  if (bg.skillCooldowns[skillNum] > 0) {
    return { valid: false, reason: '技能冷卻中' }
  }
  
  return { valid: true }
}
```

#### 挑戰 3：狀態同步
```typescript
// 伺服器執行動作後，需要分別發送給兩位玩家
async function broadcastGameState(gameState: ServerGameState) {
  // 玩家 1 視角
  const player1View = {
    myHand: gameState.player1Hand,
    myDeck: gameState.player1Deck.length,
    opponentHand: gameState.player2Hand.length,
    opponentDeck: gameState.player2Deck.length,
    // ... 公開資訊
  }
  
  // 玩家 2 視角
  const player2View = {
    myHand: gameState.player2Hand,
    myDeck: gameState.player2Deck.length,
    opponentHand: gameState.player1Hand.length,
    opponentDeck: gameState.player1Deck.length,
    // ... 公開資訊
  }
  
  await supabase.channel(`game:${gameId}`)
    .send({ type: 'STATE_UPDATE', view: player1View }, { to: player1Id })
    .send({ type: 'STATE_UPDATE', view: player2View }, { to: player2Id })
}
```

### 與象棋對比

**象棋**：
```typescript
// 完全公開資訊，不需要隱藏
type ChessState = {
  board: Piece[8][8]  // 雙方都能看到完整棋盤
}
```

**BG 卡片**：
```typescript
// 需要複雜的資訊過濾
type BGCardState = {
  // 公開資訊
  zones: Zone[]
  bgs: BGInstance[]
  
  // 隱藏資訊（需要分別處理）
  player1: {
    hand: Card[]  // 只有玩家 1 可見
    deck: Card[]  // 只有伺服器知道
  }
  player2: {
    hand: Card[]  // 只有玩家 2 可見
    deck: Card[]  // 只有伺服器知道
  }
}
```

**結論**：BG 卡片需要完整的伺服器端驗證，象棋不需要

---

## 🔗 難點 3：效果連鎖與結算順序

### 問題描述

多個效果同時觸發時，需要正確的結算順序

#### 範例場景
```
1. 小白使用技能「超級究極炸彈」
   - 效果 A：區域內清磚 2
   - 效果 B：攻城 1
   - 效果 C：區域內所有敵 BG 對敵 4
   - 效果 D：此 BG 暈眩

2. 敵方小黑裝備「閃避」反應卡
   - 觸發：受到對敵時

3. 敵方建築「城門」在場
   - 效果：區域內我方所有 BG 受到對敵-1

問題：這些效果的結算順序是什麼？
```

### 技術挑戰

#### 挑戰 1：效果堆疊
```typescript
// 需要設計效果堆疊系統
type EffectStack = Effect[]

async function resolveEffects(effects: Effect[]) {
  const stack: EffectStack = [...effects]
  
  while (stack.length > 0) {
    const effect = stack.pop()!
    
    // 1. 執行效果
    const events = await executeEffect(effect)
    
    // 2. 檢查是否觸發新效果（反應卡、建築效果等）
    const triggeredEffects = await checkTriggers(events)
    
    // 3. 新效果加入堆疊
    stack.push(...triggeredEffects)
  }
}
```

#### 挑戰 2：效果修改
```typescript
// 效果可能被其他效果修改
type Effect = {
  id: string
  type: string
  params: any
  modifiers: EffectModifier[]  // 修改器
}

// 範例：城門減傷
function applyCityGateModifier(effect: DamageEffect): DamageEffect {
  if (effect.type === 'DAMAGE' && effect.target.zone === 'my_castle') {
    return {
      ...effect,
      params: {
        ...effect.params,
        amount: effect.params.amount - 1  // 減少 1 點傷害
      }
    }
  }
  return effect
}
```

#### 挑戰 3：結算順序規則
```typescript
// 需要定義明確的結算順序
const RESOLUTION_ORDER = [
  'BEFORE_EFFECT',      // 1. 效果發動前
  'MODIFY_EFFECT',      // 2. 修改效果
  'EXECUTE_EFFECT',     // 3. 執行效果
  'AFTER_EFFECT',       // 4. 效果發動後
  'CHECK_STATE',        // 5. 檢查狀態變化
  'TRIGGER_REACTIONS'   // 6. 觸發反應
]

async function processSkill(skill: Skill) {
  for (const phase of RESOLUTION_ORDER) {
    await processPhase(phase, skill)
  }
}
```

### 與象棋對比

**象棋**：
```typescript
// 沒有效果連鎖
function movePiece(from, to) {
  // 1. 移動
  board[to] = board[from]
  board[from] = null
  
  // 2. 完成！沒有後續效果
}
```

**BG 卡片**：
```typescript
// 複雜的效果連鎖
async function useSkill(skill: Skill) {
  // 1. 執行技能效果
  const effects = skill.effects
  
  // 2. 每個效果可能觸發反應卡
  for (const effect of effects) {
    await executeEffect(effect)
    // ↑ 可能觸發 3-5 個反應卡
    // ↑ 每個反應卡又可能觸發新效果
    // ↑ 形成複雜的連鎖
  }
}
```

**結論**：BG 卡片需要完整的效果堆疊系統

---

## 🌐 難點 4：多人同步與衝突解決

### 問題描述

兩位玩家同時操作時的衝突處理

#### 範例場景
```
情況 1：同時發送動作
- 玩家 A：使用技能攻擊
- 玩家 B：使用反應卡閃避
- 問題：哪個先執行？

情況 2：網路延遲
- 玩家 A 看到的狀態：敵人 HP 10
- 玩家 B 看到的狀態：敵人 HP 8（因為延遲）
- 問題：以哪個為準？
```

### 技術挑戰

#### 挑戰 1：動作序列化
```typescript
// 需要為每個動作分配序列號
type GameAction = {
  id: string
  playerId: string
  type: string
  data: any
  sequenceNumber: number  // 序列號
  timestamp: number
}

// 伺服器端按序列號處理
async function processActions() {
  const actions = await getUnprocessedActions()
  
  // 按序列號排序
  actions.sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  
  for (const action of actions) {
    await processAction(action)
  }
}
```

#### 挑戰 2：樂觀更新與回滾
```typescript
// 客戶端樂觀更新
function sendAction(action: GameAction) {
  // 1. 立即更新本地狀態（樂觀）
  const newState = applyActionLocally(action)
  updateUI(newState)
  
  // 2. 發送到伺服器
  const result = await supabase.from('game_actions').insert(action)
  
  // 3. 如果伺服器拒絕，回滾
  if (result.error) {
    rollbackAction(action)
    showError('動作無效')
  }
}
```

#### 挑戰 3：斷線重連
```typescript
// 玩家斷線後重連，需要同步狀態
async function reconnect(playerId: string, roomId: string) {
  // 1. 獲取當前遊戲狀態
  const currentState = await getGameState(roomId)
  
  // 2. 獲取玩家上次已知的序列號
  const lastKnownSeq = await getLastSeq(playerId)
  
  // 3. 重放中間的所有動作
  const missedActions = await getActionsSince(roomId, lastKnownSeq)
  
  let state = currentState
  for (const action of missedActions) {
    state = applyAction(state, action)
  }
  
  // 4. 發送完整狀態給玩家
  return state
}
```

### 與象棋對比

**象棋**：
```typescript
// 回合制，不會同時操作
// 玩家 A 走完 → 玩家 B 走
// 不需要處理衝突
```

**BG 卡片**：
```typescript
// 雖然是回合制，但反應卡可以在對手回合觸發
// 需要處理非同步操作
```

**結論**：BG 卡片需要完整的同步機制

---

## 📦 難點 5：狀態管理複雜度

### 狀態變數對比

#### 象棋狀態
```typescript
type ChessState = {
  board: Piece[8][8]        // 64 格
  currentPlayer: Player     // 1 個變數
  moveHistory: Move[]       // 歷史記錄
}
// 總計：約 10 個核心變數
```

#### BG 卡片狀態
```typescript
type BGCardState = {
  // 場地（5 個區域）
  zones: {
    player1_castle: Zone
    player1_plaza_brick: Zone
    plaza: Zone
    player2_plaza_brick: Zone
    player2_castle: Zone
  }
  
  // 玩家狀態（2 位玩家 × 10+ 變數）
  players: {
    player1: {
      hand: Card[]
      deck: Card[]
      graveyard: Card[]
      castleHP: number
      supplyActions: number
      bgActions: number
      // ...
    }
    player2: { /* 同上 */ }
  }
  
  // BG 實例（8 位角色 × 10+ 變數）
  bgs: BGInstance[]  // 每個 BG 有：
  // - id, cardId, zone, state, toughness
  // - skill1CD, skill2CD, reactionCard
  // - modifiers[], hasActed, ...
  
  // 建築卡
  buildings: Building[]
  
  // 遊戲流程
  turn: number
  phase: Phase
  currentPlayer: Player
  
  // 效果堆疊
  effectStack: Effect[]
  pendingEvents: Event[]
  
  // 歷史記錄
  actionHistory: Action[]
}
// 總計：約 50-60 個核心變數
```

### 技術挑戰

#### 挑戰 1：狀態更新
```typescript
// 每個動作可能影響多個狀態
function useSkill(bgId: string, skillNum: number) {
  // 1. 更新 BG 狀態
  bg.skillCooldowns[skillNum] = getCooldown(skillNum)
  
  // 2. 更新手牌
  player.hand = player.hand.filter(...)
  
  // 3. 更新墓地
  player.graveyard.push(...discardedCards)
  
  // 4. 更新目標 BG
  target.toughness -= damage
  if (target.toughness <= 0) {
    target.state = 'stunned'
  }
  
  // 5. 更新磚堆
  zone.bricks -= 1
  
  // 6. 更新城牆
  if (isSiege) {
    opponent.castleHP -= 1
  }
  
  // 7. 觸發事件
  eventQueue.push(...)
  
  // 8. 檢查勝負
  checkWinCondition()
}
```

#### 挑戰 2：狀態驗證
```typescript
// 需要驗證狀態一致性
function validateState(state: GameState): boolean {
  // 1. 手牌數量 ≤ 6
  if (state.player1.hand.length > 6) return false
  
  // 2. 磚堆 ≤ 2
  if (state.zones.player1_castle.bricks > 2) return false
  
  // 3. BG 位置合法
  for (const bg of state.bgs) {
    if (!isValidZone(bg.zone)) return false
  }
  
  // 4. 冷卻 ≥ 0
  for (const bg of state.bgs) {
    if (bg.skill1CD < 0 || bg.skill2CD < 0) return false
  }
  
  // ... 更多驗證
  
  return true
}
```

**結論**：BG 卡片的狀態管理複雜度是象棋的 **5-6 倍**

---

## 🎨 難點 6：卡牌效果實作

### 為什麼不是最難的？

雖然有 52 種卡牌效果，但每種效果都是**獨立**的，可以逐一實作。

```typescript
// 效果實作模式化
const SKILL_EFFECTS = {
  // 小白技能 1
  xiaobai_skill1: {
    cost: { any: 1 },
    cooldown: 1,
    condition: (state, bg) => bg.zone !== 'my_castle',
    effects: [
      { type: 'CLEAR_BRICK', zone: 'enemy_castle', count: 1 },
      { type: 'CLEAR_BRICK', zone: 'enemy_plaza', count: 1 }
    ]
  },
  
  // 小黑技能 1
  xiaohei_skill1: {
    cost: { any: 1 },
    cooldown: 1,
    effects: [
      { type: 'ADD_MODIFIER', target: 'self', modifier: {
        type: 'REDUCE_DAMAGE',
        amount: 2,
        duration: 2
      }}
    ]
  },
  
  // ... 依此類推
}
```

### 實作工作量
- 每種效果：0.5-1 天
- 52 種效果：約 26-52 小時 = **3-7 天**

**結論**：卡牌效果實作雖然數量多，但難度不高

---

## 🎯 技術難點總結

### 難度排名（重新整理）

| 排名 | 難點 | 象棋有嗎？ | 複雜度倍數 |
|------|------|-----------|----------|
| 1 | **反應卡觸發系統** | ❌ 無 | 10x |
| 2 | **隱藏資訊處理** | ❌ 無 | ∞（象棋不需要） |
| 3 | **效果連鎖與結算** | ❌ 無 | 8x |
| 4 | **多人同步** | ✅ 有（簡單） | 3x |
| 5 | **狀態管理** | ✅ 有（簡單） | 5-6x |
| 6 | **卡牌效果** | ✅ 有（7 種棋子） | 7.4x |
| 7 | **UI/UX** | ✅ 有（簡單） | 3x |
| 8 | **技能冷卻** | ❌ 無 | 1.1x（很簡單） |

---

## 💭 你的觀點分析

### 你說：「象棋的技能設計複雜比較多」

讓我們分析一下：

#### 象棋的「技能」（移動規則）

```typescript
// 車：直線移動
function getRookMoves(pos: Position): Position[] {
  // 上下左右直線，直到遇到棋子
  // 邏輯：簡單的迴圈
}

// 馬：日字移動
function getKnightMoves(pos: Position): Position[] {
  // 8 個固定方向
  // 需要檢查「蹩馬腳」
  // 邏輯：中等複雜
}

// 炮：隔子打
function getCannonMoves(pos: Position): Position[] {
  // 需要計算中間是否有棋子
  // 邏輯：稍複雜
}
```

**象棋移動規則複雜度**：
- 7 種棋子 × 每種 50-100 行代碼
- 總計：約 **350-700 行代碼**

#### BG 卡片的「技能」

```typescript
// 小白技能 1：穿刺炸彈
function xiaobai_skill1(state: GameState, bg: BG) {
  // 1. 檢查條件
  if (bg.zone === 'my_castle') return false
  
  // 2. 執行效果
  clearBrick(state, 'enemy_castle', 1)
  clearBrick(state, 'enemy_plaza', 1)
  
  // 邏輯：簡單
}

// 小白技能 2：超級究極炸彈
function xiaobai_skill2(state: GameState, bg: BG) {
  // 1. 清磚
  clearBrick(state, bg.zone, 2)
  
  // 2. 攻城
  siege(state, 1)
  
  // 3. 對敵
  const enemies = getEnemiesInZone(state, bg.zone)
  for (const enemy of enemies) {
    dealDamage(enemy, 4)
  }
  
  // 4. 自己暈眩
  bg.state = 'stunned'
  
  // 邏輯：中等複雜
}
```

**BG 卡片技能複雜度**：
- 32 種技能 × 每種 20-50 行代碼
- 總計：約 **640-1600 行代碼**

### 結論

**單個技能的複雜度**：
- 象棋：⭐⭐⭐（馬、炮的移動規則較複雜）
- BG 卡片：⭐⭐（大部分技能邏輯簡單）

**但是！**

**整體系統複雜度**：
- 象棋：⭐⭐（只需要移動規則）
- BG 卡片：⭐⭐⭐⭐⭐（需要反應卡、效果連鎖、隱藏資訊等）

**你說得對一半**：
- ✅ 象棋的**單個移動規則**確實比較複雜（如馬的蹩腳、炮的隔子）
- ❌ 但 BG 卡片的**整體系統**複雜度遠高於象棋

---

## 📊 最終結論

### 開發難度總評

| 項目 | 象棋 | BG 卡片 | 倍數 |
|------|------|---------|------|
| **單個規則複雜度** | ⭐⭐⭐ | ⭐⭐ | 0.7x |
| **規則數量** | 7 種 | 52 種 | 7.4x |
| **系統複雜度** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 10x |
| **總開發時間** | 1 週 | 4-6 週 | **5-6x** |

### 最難的 3 個技術點

1. **反應卡觸發系統**（⭐⭐⭐⭐⭐）
   - 需要事件驅動架構
   - 需要非同步流程控制
   - 需要效果修改機制

2. **隱藏資訊處理**（⭐⭐⭐⭐⭐）
   - 需要伺服器端驗證
   - 需要防作弊機制
   - 需要狀態過濾

3. **效果連鎖與結算**（⭐⭐⭐⭐）
   - 需要效果堆疊系統
   - 需要明確的結算順序
   - 需要處理複雜的連鎖反應

### 相對簡單的部分

1. **技能冷卻系統**（⭐⭐）
   - 只需要 2 個變數
   - 邏輯簡單明確

2. **卡牌效果實作**（⭐⭐⭐）
   - 雖然數量多，但可以模式化
   - 每種效果獨立，不會互相干擾

---

**總結**：BG 卡片遊戲的開發難度主要來自**系統複雜度**（反應卡、隱藏資訊、效果連鎖），而非單個技能的複雜度。象棋的移動規則確實精巧，但整體系統相對簡單。

---

**最後更新**：2026-03-21  
**分析者**：AI Assistant (Cascade)
