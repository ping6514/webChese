# 互動系統設計文件

本文件說明 app2 中已實作的三個核心互動系統。

## 1. 投射物系統 (Projectile System)

### 功能
- 射線追蹤：計算投射物從起點到目標的路徑
- 阻擋判定：障礙物和單位可以阻擋投射物
- 攔截機制：前排單位可以攔截投射物保護後排

### 核心函數

#### `traceProjectilePath()`
```typescript
import { traceProjectilePath } from './engine/projectile'

const result = traceProjectilePath(state, attackerPos, targetUnitId, {
  maxRange: 5,
  piercing: false,  // 是否穿透第一個單位
  ignoreObstacles: false
})

// result.blocked: 是否被阻擋
// result.blockedBy: 'obstacle' | 'unit' | null
// result.finalTargetId: 最終命中的單位 ID
// result.intercepted: 是否被攔截
// result.interceptorId: 攔截者 ID
```

### 使用場景
1. **遠程攻擊**：檢查投射物是否能命中目標
2. **前排保護**：友方單位在路徑上會攔截投射物
3. **障礙物掩護**：地形可以阻擋投射物

### 事件
- `PROJECTILE_INTERCEPTED`: 投射物被攔截時觸發

---

## 2. 打斷系統 (Interrupt System)

### 功能
- 讀條中斷：攻擊讀條中的單位可以打斷其施法
- 打斷閾值：不同技能有不同的打斷難度
- 打斷懲罰：被打斷的單位損失 ATB

### 打斷閾值配置

| 施法類型 | 閾值 | 說明 |
|---------|------|------|
| `light_cast` | 1 | 輕量施法，容易打斷 |
| `projectile_cast` | 2 | 投射物施法 |
| `heavy_cast` | 3 | 重型施法 |
| `zone_cast` | 4 | 區域施法，難打斷 |
| `guard_cast` | 5 | 防禦姿態，幾乎不可打斷 |

### 核心函數

#### `attemptInterrupt()`
```typescript
import { attemptInterrupt } from './engine/interrupt'

const result = attemptInterrupt(
  state,
  attackerId,
  targetId,
  interruptValue,  // 來自攻擊者的 interrupt 屬性
  'heavy_cast'     // 目標施法類型
)

// result.interrupted: 是否成功打斷
// result.reason: 'success' | 'not_casting' | 'insufficient_interrupt'
// result.newState: 更新後的狀態（ATB 已扣除）
// result.events: [InterruptEvent]
```

### 使用場景
1. **打斷敵方大招**：在敵人讀條期間攻擊可以中斷
2. **職業專精**：某些職業對特定類型施法有打斷加成
3. **戰術決策**：選擇是否用打斷能力還是輸出傷害

### 事件
- `INTERRUPT`: 成功打斷施法時觸發

---

## 3. 保護/攔截系統 (Protection System)

### 功能
- 前排保護：前排單位可以保護後排隊友
- 投射物攔截：自動攔截飛向隊友的投射物
- 近戰阻擋：緊鄰的單位可以承受近戰攻擊

### 保護條件
1. 保護者與被保護者同陣營
2. 保護者在攻擊者與目標之間
3. 保護者距離目標 ≤ 2 格
4. 保護者未死亡且未被控制（麻痺/睡眠）

### 核心函數

#### `resolveProtection()`
```typescript
import { resolveProtection } from './engine/protect'

const result = resolveProtection(
  state,
  attackerId,
  targetId,
  'projectile'  // 攻擊類型
)

// result.protected: 是否觸發保護
// result.protectorId: 保護者 ID
// result.finalTargetId: 最終目標 ID（可能被改寫）
// result.protectType: 'intercept_projectile' | 'body_block'
```

### 使用場景
1. **前排坦克**：站在前排保護脆皮後排
2. **投射物攔截**：自動攔截飛向隊友的箭矢
3. **位置策略**：合理站位可以觸發保護

### 事件
- `PROTECT_TRIGGERED`: 保護觸發時發出

---

## 整合到戰鬥流程

### 攻擊流程整合

```typescript
// 在 reduce.ts 的 reduceAttack 中：

// 1. 檢查保護/攔截
const protectResult = resolveProtection(
  state,
  attackerId,
  targetId,
  profile.attackClass
)

// 2. 如果被保護，改寫目標
const actualTargetId = protectResult.finalTargetId

// 3. 計算傷害
const damageResult = resolveAttackDamage(attacker, target, profile)

// 4. 檢查打斷（如果目標在讀條）
if (attacker.interrupt > 0) {
  const interruptResult = attemptInterrupt(
    state,
    attackerId,
    actualTargetId,
    attacker.interrupt
  )
  // 合併事件
}

// 5. 應用傷害
const finalState = applyResolvedDamage(state, damageResult)
```

---

## 互動性設計目標

這三個系統共同實現了以下互動性：

### 1. **時機決策** ⭐⭐⭐⭐⭐
- 讀條系統：玩家可以看到敵人讀條並選擇閃避或打斷
- 打斷時機：在關鍵時刻打斷敵方大招

### 2. **空間決策** ⭐⭐⭐⭐⭐
- 站位策略：前排保護後排
- 閃避走位：移出危險區域
- 掩護利用：利用障礙物阻擋投射物

### 3. **目標選擇** ⭐⭐⭐⭐
- 投射物軌跡：考慮是否會被攔截
- 優先級判斷：先打斷還是先輸出

### 4. **資源交換** ⭐⭐⭐⭐
- 保護代價：前排承受傷害保護後排
- 打斷代價：用打斷值換取戰術優勢

### 5. **反制鏈** ⭐⭐⭐⭐⭐
- 讀條 → 閃避/打斷
- 投射物 → 掩護/攔截
- 前排保護 → 繞後攻擊

---

## 測試案例

### 投射物攔截測試
```typescript
// 場景：敵方射手攻擊後排法師，前排戰士攔截
const attacker = { pos: {q: 7, r: 3}, team: 'enemy' }
const target = { pos: {q: 1, r: 3}, team: 'player' }  // 後排
const protector = { pos: {q: 3, r: 3}, team: 'player' }  // 前排

const trace = traceProjectilePath(state, attacker.pos, target.id)
// trace.intercepted === true
// trace.interceptorId === protector.id
```

### 打斷測試
```typescript
// 場景：敵方 Boss 讀條大招，玩家打斷
const boss = { castRemaining: 1500, interrupt: 0 }
const player = { interrupt: 3 }

const result = attemptInterrupt(state, player.id, boss.id, 3, 'heavy_cast')
// result.interrupted === true
// boss.castRemaining === 0
// boss.atb 損失 30
```

---

## 未來擴展

### 可能的增強
1. **攔截機率**：根據 `interceptProjectileChance` 計算攔截成功率
2. **穿透攻擊**：某些投射物可以穿透第一個單位
3. **範圍保護**：某些技能可以保護範圍內所有隊友
4. **打斷連擊**：連續打斷有額外獎勵
5. **保護反擊**：保護觸發時可以反擊攻擊者
