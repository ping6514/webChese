# Enhanced Battle Simulator - 專案現況紀錄

**最後更新：** 2026-03-21  
**版本：** v0.1.0 Alpha  
**狀態：** 核心功能完成，進入測試階段

---

## 📋 專案概述

Enhanced Battle Simulator 是一個基於六角格的戰術戰鬥模擬器，整合了 ATB（Active Time Battle）系統、武器攻擊機制、移動系統和隊伍管理功能。

### 核心設計理念
- **移動與攻擊分離**：移動是獨立的短動作，攻擊是獨立的長動作
- **ATB 真實時間推進**：所有動作都基於 ATB tick 系統，而非獨立計時器
- **攻擊預警機制**：攻擊有讀條時間，敵人可以閃避
- **未來 Combo 系統**：預留插槽系統架構，支援移動+攻擊組合技

---

## ✅ 已完成功能

### 1. 戰鬥系統核心
- [x] ATB 時間軸系統（100ms tick 間隔）
- [x] 回合制戰鬥流程
- [x] 玩家與敵方 AI
- [x] 勝負判定

### 2. 六角格地圖
- [x] 六角格渲染（SVG）
- [x] 座標系統（axial coordinates）
- [x] 單位位置顯示
- [x] 朝向系統（0-5 方向）

### 3. 移動系統
- [x] 可移動範圍計算（3 格）
- [x] 移動路徑選擇
- [x] 朝向選擇輪盤
- [x] 移動後結束回合（獨立動作）
- [x] 短硬直時間（500ms）

### 4. 攻擊系統
- [x] 武器選擇介面
- [x] 攻擊範圍預覽（依武器類型）
  - 近戰（melee）：前方扇形 3 格
  - 投射（projectile）：直線 2 格
  - 區域（zone）：半徑 1 格
  - 奧術（arcane_cast）：十字 1 格
  - 吐息（breath）：前方扇形 3 格
- [x] 攻擊讀條機制（baseCast × 400ms）
- [x] 攻擊警告區域（紅色脈動）
- [x] 倒數計時顯示
- [x] 多個攻擊同時讀條支援
- [x] 攻擊完成後結束回合

### 5. UI/UX
- [x] 左中右三欄佈局
  - 左側：玩家隊伍狀態 + 行動面板
  - 中央：戰場 + ATB 時間軸
  - 右側：敵方隊伍狀態 + 戰鬥日誌
- [x] 單位狀態顯示（HP、ATB）
- [x] 戰鬥日誌
- [x] 視覺反饋（光環、警告格、倒數文字）

### 6. 隊伍系統
- [x] 隊伍選擇（從 localStorage 載入）
- [x] 單位初始化（血統、武器、屬性）
- [x] 多武器支援

---

## 🎮 遊戲機制詳細說明

### ATB 系統
```
- Tick 間隔：100ms
- ATB 充能速度：(speed / 100) × 10 per tick
- 達到 100 時獲得回合
- 行動後 ATB 歸零並進入硬直期
```

### 動作時間表
| 動作類型 | 施放時間 | 硬直時間 | 總時間 |
|---------|---------|---------|--------|
| 移動 | 200ms | 500ms | 0.7s |
| 待機 | 0ms | 300ms | 0.3s |
| 攻擊 | 2.0-3.2s | 1.5-2.4s | 3.5-5.6s |
| 敵方攻擊 | 即時 | 800ms | 0.8s |

### 武器讀條時間
```
實際讀條時間 = baseCast × 400ms

範例：
- 凝膠投石索（baseCast=5）：2.0s
- 蛛縛槍（baseCast=6）：2.4s
- 鱗粉儀扇（baseCast=8）：3.2s
```

### 攻擊流程
```
1. 選擇武器
2. 點擊攻擊方向
3. 開始讀條（顯示警告區域）
4. 讀條期間 ATB 繼續推進，其他單位可行動
5. 敵人可以移動閃避
6. 讀條完成，對範圍內敵人造成傷害
7. 回合結束
```

---

## 🏗️ 技術架構

### 技術棧
- **框架**：Vue 3 (Composition API)
- **語言**：TypeScript
- **渲染**：SVG
- **狀態管理**：Vue Reactive (ref, computed)
- **構建工具**：Vite

### 核心文件結構
```
app2/src/
├── components/
│   ├── EnhancedBattleSimulator.vue  # 主戰鬥模擬器
│   ├── BattleSimulator.vue          # 原始 ATB 模擬器（參考）
│   └── TeamBattleSimulator.vue      # 隊伍戰鬥模擬器
├── game/
│   ├── schema.ts                    # 遊戲類型定義
│   ├── mockData.ts                  # 測試數據（血統、武器）
│   ├── teamStorage.ts               # 隊伍儲存
│   ├── teamSystem.ts                # 隊伍系統
│   └── hex.ts                       # 六角格工具函數
└── App.vue                          # 主應用
```

### 關鍵類型定義
```typescript
type BattleUnit = {
  id: string
  name: string
  team: 'player' | 'enemy'
  bloodlineId: string
  pos: { q: number; r: number }
  facing: number
  hp: number
  maxHp: number
  speed: number
  damage: number
  isDead: boolean
  weapons: any[]
}

type PendingCast = {
  unitId: string
  weaponName: string
  targetCell: { q: number; r: number }
  readyAtTick: number
  damage: number
  attackClass: string
}

type ATBEntry = {
  unitId: string
  atb: number
  recovery: number
}
```

---

## 🔄 核心邏輯流程

### ATB Tick 循環
```typescript
function tick() {
  gameTick += 100ms
  
  // 1. 檢查讀條完成
  for (completedCast in pendingCasts) {
    resolveCast(completedCast)
  }
  
  // 2. 推進 ATB
  for (entry in timeline) {
    if (recovery > 0) {
      recovery -= 100ms
    } else {
      atb += (speed / 100) × 10
    }
  }
  
  // 3. 檢查新回合
  if (atb >= 100 && recovery === 0) {
    startNewTurn(unit)
  }
}
```

### 攻擊範圍計算
```typescript
function getAttackRangeCells(origin, facing, attackClass) {
  switch (attackClass) {
    case 'melee':      // 前方扇形 3 格
    case 'projectile': // 直線 2 格
    case 'zone':       // 半徑 1 格
    case 'arcane_cast':// 十字 1 格
    case 'breath':     // 前方扇形 3 格
  }
}
```

---

## 🐛 已知問題與限制

### 當前限制
1. **敵方 AI 簡化**：目前只會攻擊第一個玩家單位，沒有智能決策
2. **無移動動畫**：移動是瞬間完成的
3. **無攻擊動畫**：攻擊只有警告區域，沒有視覺特效
4. **固定地圖大小**：8×6 六角格
5. **無地形系統**：所有格子都可通行
6. **無狀態效果**：沒有麻痺、睡眠等狀態

### 已修復的問題
- ✅ 移動按鈕永久禁用（hasMoved 未重置）
- ✅ 敵方 AI 卡住（endCurrentTurn 函數缺失）
- ✅ 單一攻擊讀條限制（改為陣列支援多個）
- ✅ 攻擊範圍未顯示（arcane_cast、breath 類型缺失）
- ✅ 移動後強制接續動作（改為獨立動作）

---

## 🚀 未來規劃

### 短期目標（v0.2.0）
- [ ] 改進敵方 AI（目標選擇、移動決策）
- [ ] 添加移動動畫
- [ ] 添加攻擊特效
- [ ] 優化 UI 響應式設計
- [ ] 添加音效

### 中期目標（v0.3.0）
- [ ] **Combo 系統**：武器插槽組合技
  - 衝撞攻擊（移動 3 格 + 攻擊）
  - 範圍爆發（移動 + 區域傷害）
  - 連續攻擊（多段攻擊）
- [ ] 地形系統（障礙物、高度）
- [ ] 狀態效果系統
- [ ] 更多武器類型

### 長期目標（v1.0.0）
- [ ] 完整的戰役模式
- [ ] 多人對戰
- [ ] 自定義地圖編輯器
- [ ] 成就系統
- [ ] 排行榜

---

## 📊 測試數據

### 測試用血統
- 膜翼先知（速度 120，HP 100）
- 狼族守衛（速度 100，HP 120）
- 哨兵甲（速度 80，HP 150）

### 測試用武器
- 凝膠投石索（projectile，傷害 25，baseCast 5）
- 蛛縛槍（melee，傷害 30，baseCast 6）
- 鱗粉儀扇（arcane_cast，傷害 20，baseCast 8）

---

## 🔧 開發環境設置

### 安裝依賴
```bash
cd app2
npm install
```

### 啟動開發伺服器
```bash
npm run dev
```

### 構建生產版本
```bash
npm run build
```

---

## 📝 開發筆記

### 設計決策
1. **為什麼移動和攻擊分離？**
   - 符合遊戲精神：移動是快速調整位置，攻擊是主要輸出
   - 增加戰術深度：玩家可以選擇純移動或純攻擊
   - 為 Combo 系統預留空間：未來可以透過插槽組合

2. **為什麼使用 ATB tick 而非獨立計時器？**
   - 保證所有時間推進同步
   - 讀條期間其他單位可以行動
   - 更容易實現閃避機制

3. **為什麼攻擊讀條時間這麼長？**
   - 給予敵人閃避時間
   - 增加戰術深度（預判、走位）
   - 符合遊戲設計理念

### 技術挑戰
1. **六角格座標轉換**：使用 axial coordinates 系統
2. **多個讀條管理**：從單一物件改為陣列
3. **ATB 與讀條同步**：統一使用 tick 系統
4. **視覺反饋**：CSS 動畫 + SVG 渲染

---

## 👥 貢獻者

- 開發者：[Your Name]
- 設計顧問：AI Assistant (Cascade)

---

## 📄 授權

[待定]

---

**備註**：本文檔記錄專案當前狀態，隨著開發進度會持續更新。
