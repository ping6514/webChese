# 繁體中文文本

本文檔整理專案中使用的所有繁體中文文本，方便未來進行國際化（i18n）處理。

---

## UI 文本

### 隊伍選擇
```
玩家隊伍
敵方隊伍
-- 選擇隊伍 --
開始戰鬥
```

### 行動面板
```
{單位名稱} 的回合
選擇武器攻擊，或移動/待機
點擊藍色格子移動
選擇朝向
點擊目標方向攻擊
讀條中... {時間}s
```

### 按鈕文本
```
🏃 移動
⏳ 待機
❌ 取消
關閉
```

### 面板標題
```
👥 玩家隊伍
👹 敵方隊伍
⏱️ ATB 時間軸
📜 戰鬥日誌
```

---

## 戰鬥日誌訊息

### 回合開始
```
⏰ {單位名稱} 的回合
```

### 移動
```
🏃 {單位名稱} 移動到 ({q},{r})
```

### 攻擊
```
⏳ {單位名稱} 準備使用 {武器名稱}...
⚔️ {攻擊者} 使用 {武器名稱} 攻擊 {受害者}，造成 {傷害} 傷害
```

### 待機
```
⏳ {單位名稱} 待機
```

### 擊倒
```
💀 {單位名稱} 被擊倒！
```

### 勝負
```
🎉 勝利！
💀 失敗
```

---

## 警告與提示

### 讀條警告
```
⚠️ {單位名稱} 讀條中... {剩餘時間}s
```

---

## 武器名稱

### 測試武器
```
凝膠投石索
蛛縛槍
鱗粉儀扇
```

---

## 血統名稱

### 測試血統
```
膜翼先知
狼族守衛
哨兵甲
```

---

## 屬性與數值

### 單位屬性
```
HP: {當前}/{最大}
ATB: {百分比}%
速度: {數值}
傷害: {數值}
```

### 武器屬性
```
傷害: 💥{數值}
```

---

## 座標與方向

### 座標顯示
```
({q},{r})
```

### 方向編號
```
0, 1, 2, 3, 4, 5
```

---

## 錯誤訊息（未來可能需要）

```
無法移動到該位置
攻擊範圍外
單位已死亡
回合尚未開始
```

---

## 國際化建議

### 結構
```typescript
const i18n = {
  'zh-TW': {
    ui: {
      playerTeam: '👥 玩家隊伍',
      enemyTeam: '👹 敵方隊伍',
      move: '🏃 移動',
      wait: '⏳ 待機',
      cancel: '❌ 取消',
      // ...
    },
    battle: {
      turnStart: '⏰ {name} 的回合',
      moveLog: '🏃 {name} 移動到 ({q},{r})',
      attackLog: '⚔️ {attacker} 使用 {weapon} 攻擊 {victim}，造成 {damage} 傷害',
      // ...
    }
  },
  'en-US': {
    ui: {
      playerTeam: '👥 Player Team',
      enemyTeam: '👹 Enemy Team',
      move: '🏃 Move',
      wait: '⏳ Wait',
      cancel: '❌ Cancel',
      // ...
    },
    battle: {
      turnStart: '⏰ {name}\'s Turn',
      moveLog: '🏃 {name} moved to ({q},{r})',
      attackLog: '⚔️ {attacker} attacked {victim} with {weapon}, dealing {damage} damage',
      // ...
    }
  }
}
```

### 使用範例
```typescript
function addLog(key: string, params?: Record<string, any>) {
  const template = i18n[currentLocale].battle[key]
  const message = template.replace(/{(\w+)}/g, (_, k) => params?.[k] ?? '')
  battleLog.value.unshift(message)
}

// 使用
addLog('attackLog', {
  attacker: '膜翼先知',
  weapon: '鱗粉儀扇',
  victim: '哨兵甲',
  damage: 50
})
```

---

**備註**：本文檔整理所有中文文本，方便未來進行國際化處理。
