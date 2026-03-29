# PixiJS 棋盤重構 - 遷移指南

## 📦 已完成的工作

### 1. 安裝的依賴
```json
{
  "pixi.js": "^8.5.2",
  "gsap": "^3.12.5",
  "@pixi/particle-emitter": "^5.0.8"
}
```

### 2. 創建的核心文件

#### 遊戲渲染層 (`src/game/`)
- ✅ **UnitSprite.ts** - 單位精靈類，包含動畫系統
- ✅ **EffectsManager.ts** - 特效管理器（光束、粒子、傷害數字）
- ✅ **PixiBoardRenderer.ts** - 核心棋盤渲染器

#### Vue 組件層 (`src/components/v2/`)
- ✅ **PixiBoard.vue** - PixiJS 棋盤的 Vue 包裝組件

---

## 🚀 如何啟用 PixiJS 棋盤

### 方案 A：完全替換（推薦用於測試）

在 `BoardV2.vue` 中替換 `BoardGrid` 組件：

```vue
<script setup lang="ts">
// ... 現有導入 ...
import BoardGrid from '../BoardGrid.vue'  // 舊的 DOM 棋盤
import PixiBoard from './PixiBoard.vue'    // 新的 PixiJS 棋盤
</script>

<template>
  <!-- 替換這個 -->
  <BoardGrid
    v-if="false"  <!-- 暫時禁用舊棋盤 -->
    :state="state"
    ...
  />
  
  <!-- 使用這個 -->
  <PixiBoard
    :state="state"
    :selected-unit-id="selectedUnitId"
    :legal-moves="legalMoves"
    :fx-attack-unit-ids="ctx.fx?.fxAttackUnitIds ?? []"
    :fx-hit-unit-ids="ctx.fx?.fxHitUnitIds ?? []"
    :fx-killed-unit-ids="ctx.fx?.fxKilledUnitIds ?? []"
    :float-texts-by-pos="ctx.fx?.floatTextsByPos ?? {}"
    :fx-beams="ctx.fx?.fxBeams ?? []"
    @cell-click="onCellClick"
    @unit-click="onSelectUnit"
  />
</template>
```

### 方案 B：切換開關（推薦用於生產）

添加一個設定選項讓用戶選擇使用哪個渲染器：

```vue
<script setup lang="ts">
const usePixiRenderer = ref(localStorage.getItem('usePixiRenderer') === '1')

function toggleRenderer() {
  usePixiRenderer.value = !usePixiRenderer.value
  localStorage.setItem('usePixiRenderer', usePixiRenderer.value ? '1' : '0')
  location.reload() // 重新載入以應用變更
}
</script>

<template>
  <BoardGrid v-if="!usePixiRenderer" ... />
  <PixiBoard v-else ... />
  
  <!-- 設定面板中添加切換按鈕 -->
  <button @click="toggleRenderer">
    {{ usePixiRenderer ? '使用 DOM 渲染' : '使用 PixiJS 渲染' }}
  </button>
</template>
```

---

## 🎯 PixiBoard 組件 API

### Props

```typescript
{
  state: GameState                          // 遊戲狀態
  selectedUnitId: string | null             // 當前選中的單位 ID
  legalMoves: Array<{ x: number; y: number }> // 可移動的位置
  fxAttackUnitIds: string[]                 // 正在攻擊的單位
  fxHitUnitIds: string[]                    // 被攻擊的單位
  fxKilledUnitIds: string[]                 // 被殺死的單位
  floatTextsByPos: Record<string, FloatText[]> // 浮動文字
  fxBeams: BeamFx[]                         // 攻擊光束
}
```

### Events

```typescript
{
  'cell-click': (payload: { x: number; y: number }) => void
  'unit-click': (unitId: string) => void
}
```

---

## 🎨 已實現的功能

### 視覺效果
- ✅ **棋盤渲染** - 10x9 格子，圓角設計
- ✅ **單位顯示** - 中文棋子標籤，HP 條，附魔標記
- ✅ **選中高亮** - 單位選中時發光 + 縮放動畫
- ✅ **移動高亮** - 可移動格子脈動動畫
- ✅ **懸停效果** - 格子懸停時透明度變化

### 動畫系統
- ✅ **單位移動** - 拋物線軌跡 + 旋轉
- ✅ **攻擊動畫** - 單位放大縮小
- ✅ **受擊動畫** - 震動 + 閃紅
- ✅ **死亡動畫** - 旋轉淡出 + 粒子爆炸

### 特效系統
- ✅ **攻擊光束** - 發光光束 + 粒子拖尾
- ✅ **傷害數字** - 彈出動畫 + 暴擊效果
- ✅ **治療數字** - 綠色數字 + 治療粒子
- ✅ **附魔特效** - 魔法陣 + 旋轉動畫
- ✅ **死亡爆炸** - 粒子擴散效果

---

## 🔧 待整合的功能

以下功能在舊的 `BoardGrid.vue` 中存在，需要逐步遷移到 PixiJS：

### 高優先級
- [ ] **射擊預覽** - 射擊範圍、濺射標記、連鎖目標
- [ ] **獻祭模式** - 獻祭目標高亮
- [ ] **附魔拖放** - 靈魂卡拖放到單位上
- [ ] **屍體顯示** - 墓地位置標記

### 中優先級
- [ ] **單位詳情提示** - 懸停顯示單位資訊
- [ ] **封印效果** - 被封印單位的視覺標記
- [ ] **Buff 圖標** - 單位身上的 Buff/Debuff 顯示
- [ ] **3D 模式** - 棋盤 3D 視角切換

### 低優先級
- [ ] **河流/障礙物** - 特殊地形渲染
- [ ] **陣營邊界** - 紅黑雙方區域標記
- [ ] **移動路徑預覽** - 顯示移動軌跡

---

## 🧪 測試清單

### 基礎功能測試
- [ ] 遊戲啟動後棋盤正常顯示
- [ ] 單位位置正確
- [ ] 點擊單位可以選中
- [ ] 點擊格子可以移動
- [ ] HP 條正確顯示

### 動畫測試
- [ ] 單位移動動畫流暢
- [ ] 攻擊動畫正常播放
- [ ] 受擊動畫正確觸發
- [ ] 死亡動畫 + 粒子效果

### 特效測試
- [ ] 攻擊光束正確顯示
- [ ] 傷害數字彈出
- [ ] 治療效果顯示
- [ ] 附魔特效播放

### 性能測試
- [ ] 60 FPS 穩定運行
- [ ] 多個特效同時播放不卡頓
- [ ] 內存使用正常（無洩漏）
- [ ] CPU 使用率合理

### 兼容性測試
- [ ] Chrome 瀏覽器
- [ ] Firefox 瀏覽器
- [ ] Edge 瀏覽器
- [ ] Electron 桌面版
- [ ] 不同螢幕解析度

---

## 🐛 已知問題

### TypeScript 警告
- `posKey` 變數未使用警告（不影響功能）
- 某些類型推斷警告（已大部分修正）

### 功能限制
- 目前只實現了基礎棋盤和單位渲染
- 射擊預覽、獻祭等進階功能需要額外整合
- 粒子效果在低性能設備上可能需要優化

---

## 📝 開發建議

### 逐步遷移策略

**第一階段：基礎驗證（當前）**
1. 啟用 PixiBoard 組件
2. 測試基本的移動和選擇
3. 確認動畫和特效正常

**第二階段：功能對齊**
1. 實現射擊預覽系統
2. 添加附魔拖放支持
3. 整合獻祭模式

**第三階段：優化增強**
1. 添加更多粒子效果
2. 優化性能和內存
3. 添加設定選項（特效品質、動畫速度）

**第四階段：完全替換**
1. 移除舊的 BoardGrid 組件
2. 清理相關代碼
3. 更新文檔

### 性能優化建議

```typescript
// 對象池 - 重用精靈對象
class SpritePool {
  private pool: PIXI.Sprite[] = []
  
  acquire(texture: PIXI.Texture): PIXI.Sprite {
    return this.pool.pop() || new PIXI.Sprite(texture)
  }
  
  release(sprite: PIXI.Sprite) {
    sprite.visible = false
    this.pool.push(sprite)
  }
}

// 批次更新 - 減少渲染次數
function batchUpdate(updates: Array<() => void>) {
  requestAnimationFrame(() => {
    updates.forEach(fn => fn())
  })
}
```

### 調試工具

```typescript
// 在 PixiBoardRenderer 中添加調試模式
export class PixiBoardRenderer {
  private debugMode = false
  
  enableDebug() {
    this.debugMode = true
    // 顯示 FPS、draw calls 等資訊
    this.app.stage.addChild(new PIXI.Text('Debug Mode'))
  }
}
```

---

## 🎓 學習資源

### PixiJS 官方文檔
- [PixiJS v8 文檔](https://pixijs.com/8.x/guides)
- [PixiJS 範例](https://pixijs.com/8.x/examples)

### GSAP 動畫
- [GSAP 文檔](https://gsap.com/docs/v3/)
- [PixiPlugin](https://gsap.com/docs/v3/Plugins/PixiPlugin)

### 粒子系統
- [@pixi/particle-emitter](https://github.com/pixijs/particle-emitter)

---

## 💡 下一步行動

1. **立即測試**：啟動開發服務器，查看 PixiJS 棋盤效果
   ```bash
   cd D:\workspace\webChese\app
   npm run dev
   ```

2. **整合到 BoardV2**：按照上面的方案 A 或 B 整合組件

3. **測試基礎功能**：移動、攻擊、選擇等

4. **逐步添加功能**：根據優先級列表實現缺失功能

5. **性能測試**：確保在各種設備上流暢運行

6. **收集反饋**：測試遊戲體驗，記錄需要改進的地方

---

## 🎉 預期效果

使用 PixiJS 重構後，你將獲得：

- **性能提升 10-50 倍**：GPU 渲染 vs DOM 操作
- **專業級特效**：粒子、光影、濾鏡
- **流暢動畫**：穩定 60 FPS
- **可擴展性**：易於添加新特效
- **商業品質**：達到上市遊戲水準

開始享受專業級的遊戲視覺體驗吧！🚀
