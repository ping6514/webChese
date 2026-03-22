# 技術架構文檔

## 專案結構

```
app2/
├── docs/                           # 文檔目錄
│   ├── enhanced-battle-simulator-status.md
│   ├── game-mechanics.md
│   └── technical-architecture.md
├── src/
│   ├── components/                 # Vue 組件
│   │   ├── EnhancedBattleSimulator.vue  # 主戰鬥模擬器 ⭐
│   │   ├── BattleSimulator.vue          # 原始 ATB 模擬器
│   │   └── TeamBattleSimulator.vue      # 隊伍戰鬥模擬器
│   ├── game/                       # 遊戲邏輯
│   │   ├── schema.ts               # 類型定義
│   │   ├── mockData.ts             # 測試數據
│   │   ├── teamStorage.ts          # 隊伍儲存
│   │   ├── teamSystem.ts           # 隊伍系統
│   │   └── hex.ts                  # 六角格工具
│   ├── App.vue                     # 主應用
│   └── main.ts                     # 入口文件
├── public/                         # 靜態資源
├── index.html                      # HTML 模板
├── package.json                    # 依賴配置
├── tsconfig.json                   # TypeScript 配置
└── vite.config.ts                  # Vite 配置
```

---

## 核心組件架構

### EnhancedBattleSimulator.vue

**職責**：整合戰鬥系統的主組件

**組成部分**：
1. **模板（Template）**
   - 左側面板：玩家隊伍狀態 + 行動面板
   - 中央區域：SVG 戰場 + ATB 時間軸
   - 右側面板：敵方隊伍狀態 + 戰鬥日誌

2. **腳本（Script）**
   - 狀態管理（ref）
   - 計算屬性（computed）
   - 核心邏輯函數
   - 生命週期鉤子

3. **樣式（Style）**
   - 佈局樣式
   - 動畫效果
   - 視覺反饋

---

## 數據流架構

```
用戶操作
    ↓
事件處理函數
    ↓
更新響應式狀態
    ↓
觸發計算屬性重新計算
    ↓
更新 DOM（Vue 自動）
    ↓
視覺反饋
```

### 範例：攻擊流程
```
點擊武器按鈕
    ↓
selectWeapon(weapon)
    ↓
selectedWeapon.value = weapon
moveStep.value = 'select_attack'
    ↓
attackRangeCells 計算屬性更新
    ↓
SVG 顯示攻擊範圍預覽
    ↓
點擊目標格子
    ↓
executeAttack(cell)
    ↓
pendingCasts.value.push(newCast)
    ↓
tick() 檢查讀條完成
    ↓
resolveCast(cast)
    ↓
更新敵人 HP
    ↓
視覺反饋（日誌、HP 條）
```

---

## 狀態管理

### 響應式狀態（ref）

#### 戰鬥狀態
```typescript
const battleStarted = ref(false)        // 戰鬥是否開始
const battleResult = ref<'player' | 'enemy' | null>(null)  // 勝負結果
const currentUnitId = ref<string | null>(null)  // 當前行動單位
const gameTick = ref(0)                 // 遊戲時鐘（ms）
```

#### 單位數據
```typescript
const playerUnits = ref<BattleUnit[]>([])  // 玩家單位
const enemyUnits = ref<BattleUnit[]>([])   // 敵方單位
const timeline = ref<ATBEntry[]>([])       // ATB 時間軸
```

#### 行動狀態
```typescript
const moveStep = ref<MoveStep>('idle')     // 當前行動步驟
const pendingMove = ref<{q,r} | null>(null)  // 待確認的移動
const selectedWeapon = ref<any>(null)      // 選中的武器
const pendingCasts = ref<PendingCast[]>([])  // 讀條中的攻擊
```

#### UI 狀態
```typescript
const hoveredCell = ref<{q,r} | null>(null)  // 滑鼠懸停的格子
const showCoords = ref(false)              // 是否顯示座標
const battleLog = ref<string[]>([])        // 戰鬥日誌
```

---

### 計算屬性（computed）

#### 單位相關
```typescript
const allUnits = computed(() => [...playerUnits.value, ...enemyUnits.value])
const currentUnit = computed(() => allUnits.value.find(u => u.id === currentUnitId.value))
const isPlayerTurn = computed(() => currentUnit.value?.team === 'player')
```

#### 武器相關
```typescript
const currentWeapons = computed(() => {
  if (!currentUnit.value) return []
  return currentUnit.value.weapons
})
```

#### 範圍計算
```typescript
const reachableCells = computed(() => {
  // 計算可移動範圍（3 格內）
})

const attackRangeCells = computed(() => {
  // 計算攻擊範圍（依武器類型）
})

const attackWarningCells = computed(() => {
  // 計算所有讀條中的攻擊警告區域
})
```

#### 時間軸
```typescript
const sortedTimeline = computed(() => {
  // 按 ATB 排序的時間軸
})
```

#### UI 提示
```typescript
const actionHint = computed(() => {
  // 根據當前狀態顯示提示文字
})
```

---

## 核心邏輯函數

### ATB 系統

#### startLoop()
啟動 ATB 循環
```typescript
function startLoop() {
  if (loopInterval) return
  loopInterval = setInterval(tick, TICK_MS)
}
```

#### stopLoop()
停止 ATB 循環
```typescript
function stopLoop() {
  if (loopInterval) {
    clearInterval(loopInterval)
    loopInterval = null
  }
}
```

#### tick()
ATB 推進核心
```typescript
function tick() {
  gameTick.value += TICK_MS
  
  // 1. 檢查讀條完成
  const completedCasts = pendingCasts.value.filter(...)
  for (const cast of completedCasts) {
    resolveCast(cast)
  }
  
  // 2. 推進 ATB
  timeline.value = timeline.value.map(e => {
    if (e.recovery > 0) {
      return { ...e, recovery: e.recovery - TICK_MS }
    }
    const gain = (unit.speed / 100) * 10
    return { ...e, atb: Math.min(100, e.atb + gain) }
  })
  
  // 3. 檢查新回合
  const ready = timeline.value.find(e => e.atb >= 100 && e.recovery === 0)
  if (ready && !currentUnitId.value) {
    startNewTurn(ready)
  }
  
  checkBattleEnd()
}
```

---

### 移動系統

#### beginMove()
開始移動流程
```typescript
function beginMove() {
  moveStep.value = 'select_move'
}
```

#### onCellClick(cell)
處理格子點擊
```typescript
function onCellClick(cell) {
  if (moveStep.value === 'select_move') {
    pendingMove.value = { q: cell.q, r: cell.r }
    moveStep.value = 'select_facing'
  }
}
```

#### selectFacing(dir)
確認朝向並完成移動
```typescript
function selectFacing(dir) {
  currentUnit.value.pos = { ...pendingMove.value }
  currentUnit.value.facing = dir
  
  // 消耗 ATB，進入硬直
  entry.atb = 0
  entry.recovery = MOVE_RECOVERY_MS
  
  // 結束回合
  currentUnitId.value = null
  startLoop()
}
```

---

### 攻擊系統

#### selectWeapon(weapon)
選擇武器
```typescript
function selectWeapon(weapon) {
  selectedWeapon.value = weapon
  moveStep.value = 'select_attack'
}
```

#### executeAttack(targetCell)
執行攻擊
```typescript
function executeAttack(targetCell) {
  // 1. 計算朝向
  const facing = getFacingToward(currentUnit.value.pos, targetCell)
  currentUnit.value.facing = facing
  
  // 2. 計算傷害
  const finalDmg = calculateDamage(...)
  
  // 3. 開始讀條
  const windupMs = selectedWeapon.value.baseCast * 400
  const newCast = {
    unitId: currentUnit.value.id,
    weaponName: selectedWeapon.value.name,
    targetCell: { q: targetCell.q, r: targetCell.r },
    readyAtTick: gameTick.value + windupMs,
    damage: finalDmg,
    attackClass: selectedWeapon.value.attackClass
  }
  pendingCasts.value.push(newCast)
  
  // 4. 消耗 ATB，進入硬直
  entry.atb = 0
  entry.recovery = selectedWeapon.value.baseRecovery * 100 + windupMs
  
  // 5. 釋放回合
  moveStep.value = 'casting'
  currentUnitId.value = null
  startLoop()
}
```

#### resolveCast(cast)
結算攻擊
```typescript
function resolveCast(cast) {
  // 1. 從陣列移除
  pendingCasts.value.splice(index, 1)
  
  // 2. 計算攻擊範圍
  const warningCells = getAttackRangeCells(...)
  
  // 3. 找出受害者
  const victims = enemyUnits.value.filter(u => {
    return warningCells.some(c => c.q === u.pos.q && c.r === u.pos.r)
  })
  
  // 4. 造成傷害
  for (const victim of victims) {
    victim.hp = Math.max(0, victim.hp - cast.damage)
    if (victim.hp === 0) {
      victim.isDead = true
    }
  }
  
  // 5. 重置狀態
  if (cast.unitId === currentUnit.value?.id) {
    currentUnitId.value = null
    moveStep.value = 'idle'
  }
}
```

---

### 範圍計算

#### getAttackRangeCells()
計算攻擊範圍
```typescript
function getAttackRangeCells(origin, facing, attackClass) {
  const cells = []
  
  switch (attackClass) {
    case 'melee':
      // 前方扇形 3 格
      const left = (facing + 5) % 6
      const right = (facing + 1) % 6
      for (const dir of [left, facing, right]) {
        const neighbor = { q: origin.q + HEX_DIRECTIONS[dir].q, ... }
        cells.push(neighbor)
      }
      break
      
    case 'projectile':
      // 直線 2 格
      for (let i = 1; i <= 2; i++) {
        const cell = { q: origin.q + HEX_DIRECTIONS[facing].q * i, ... }
        cells.push(cell)
      }
      break
      
    case 'zone':
      // 半徑 1 格
      for (let dir = 0; dir < 6; dir++) {
        const neighbor = { q: origin.q + HEX_DIRECTIONS[dir].q, ... }
        cells.push(neighbor)
      }
      cells.push(origin)
      break
      
    // ... 其他類型
  }
  
  return cells
}
```

---

### 敵方 AI

#### executeEnemyTurn(unit)
執行敵方回合
```typescript
function executeEnemyTurn(unit) {
  // 1. 選擇目標（簡化版：攻擊第一個玩家）
  const targets = playerUnits.value.filter(u => !u.isDead)
  const target = targets[0]
  
  // 2. 計算傷害
  const damage = Math.floor(unit.damage * (0.8 + Math.random() * 0.4))
  target.hp = Math.max(0, target.hp - damage)
  
  // 3. 檢查擊倒
  if (target.hp === 0) {
    target.isDead = true
  }
  
  // 4. 消耗 ATB，進入硬直
  entry.atb = 0
  entry.recovery = 800
  
  // 5. 結束回合
  currentUnitId.value = null
}
```

---

## 六角格系統

### 座標轉換

#### axialToPixel()
座標轉像素
```typescript
function axialToPixel(q: number, r: number, size: number) {
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3)/2 * r)
  const y = size * (3/2 * r)
  return { x, y }
}
```

#### offsetToAxial()
偏移座標轉軸向座標
```typescript
function offsetToAxial(col: number, row: number) {
  const q = col - Math.floor(row / 2)
  const r = row
  return { q, r }
}
```

### 六角形渲染

#### hexPoints()
生成六角形頂點
```typescript
function hexPoints(size: number) {
  const points = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i
    const x = size * Math.cos(angle)
    const y = size * Math.sin(angle)
    points.push(`${x},${y}`)
  }
  return points.join(' ')
}
```

---

## 性能優化

### 計算屬性緩存
Vue 的 computed 會自動緩存結果，只在依賴變化時重新計算。

### 條件渲染
使用 `v-if` 和 `v-show` 優化不必要的渲染。

### 事件委託
在 SVG 上使用事件委託，減少事件監聽器數量。

### 批量更新
使用 `timeline.value = timeline.value.map(...)` 而非逐個修改，減少響應式更新次數。

---

## 調試工具

### 座標顯示
```typescript
const showCoords = ref(false)  // 切換顯示格子座標
```

### 戰鬥日誌
```typescript
function addLog(msg: string) {
  battleLog.value.unshift(msg)
  if (battleLog.value.length > 50) {
    battleLog.value.pop()
  }
}
```

### Console 輸出
在關鍵函數中添加 `console.log` 用於調試。

---

## 擴展性設計

### 插槽系統預留
```typescript
// 未來可以添加
type WeaponSlot = {
  type: 'movement' | 'attack' | 'utility'
  effect: ComboEffect
}

type ComboEffect = {
  type: 'dash_attack' | 'multi_strike' | 'aoe_burst'
  params: any
}
```

### 狀態效果預留
```typescript
// 未來可以添加
type StatusEffect = {
  id: StatusId
  duration: number
  stacks: number
}

type BattleUnit = {
  // ... 現有屬性
  statusEffects: StatusEffect[]
}
```

### 地形系統預留
```typescript
// 未來可以添加
type TerrainCell = {
  q: number
  r: number
  type: 'normal' | 'obstacle' | 'high_ground'
  height: number
}
```

---

## 測試策略

### 單元測試（待實作）
- ATB 充能計算
- 攻擊範圍計算
- 傷害計算
- 座標轉換

### 整合測試（待實作）
- 完整戰鬥流程
- 多個讀條同時進行
- 閃避機制

### 手動測試
- 不同速度單位的行動順序
- 攻擊讀條期間的閃避
- 移動和攻擊的時間消耗

---

## 已知技術債務

1. **TypeScript 類型**：部分使用 `any`，需要補充完整類型定義
2. **未使用的導入**：`UnitBuild`、`hexDistance` 等未使用的導入
3. **錯誤處理**：缺少完整的錯誤處理機制
4. **測試覆蓋**：尚未編寫單元測試
5. **性能監控**：缺少性能分析工具

---

**備註**：本文檔描述專案的技術架構，隨著開發進度會持續更新。
