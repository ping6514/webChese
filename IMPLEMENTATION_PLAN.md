# PixiJS 缺失功能實現計劃

## ✅ 已完成
1. **靈魂卡閃爍優化** - 調整透明度範圍 (0.9 ↔ 0.75)，避免看穿到棋子文字
2. **附魔特效** - 完整的光束、爆炸、粒子、震動效果
3. **復活特效** - 擴散波紋效果
4. **基礎渲染** - 棋盤、棋子、高亮、攻擊/射擊特效

## 🚧 進行中：屍體顯示系統

### 已創建文件
- `CorpseSprite.ts` - 屍體精靈類 ✅
- 已在 `PixiBoardRenderer.ts` 添加：
  - `corpsesContainer` 容器
  - `corpseSprites` Map
  - 圖層順序：board → highlight → **corpses** → units → effects

### 待實現功能
1. **渲染屍體方法** (`syncCorpsesFromState`)
   - 遍歷 `state.corpsesByPos`
   - 為每個位置創建/更新 `CorpseSprite`
   - 顯示 X 標記和數量

2. **屍體高亮** (`updateCorpseHighlights`)
   - 骸骨煉化選擇時高亮屍體格子
   - 參考 `highlightCorpsePosKeys` prop

3. **集成到 PixiBoard.vue**
   - 傳遞 `corpsesByPos` 數據
   - 傳遞 `highlightCorpsePosKeys`
   - 在 `watch` 中調用渲染方法

---

## 📋 待實現：狀態圖示系統

### 優先級：高
**封印狀態** (DISABLE_UNIT_ACTIONS)
- 在 `UnitSprite.ts` 添加狀態圖示容器
- 顯示 🔒 或 "封" 字樣
- 半透明紅色背景

### 優先級：中
**其他狀態**
- Buff/Debuff 圖示
- 臨時效果標記

---

## 📋 待確認：道具使用特效

需要為以下道具添加視覺反饋：
1. **亡者歸途** - 移除附魔的視覺效果
2. **骸骨煉化** - 移除屍體的視覺效果
3. **冥鎖封印** - 封印動畫
4. **牢籠掠奪** - 奪取靈魂動畫
5. **殺戮狂歡** - 魔力回復效果

---

## 📋 待實現：能力觸發特效

1. **獻祭** - 摧毀友軍的視覺效果
2. **連鎖射擊** - 連鎖目標的視覺連接
3. **濺射** - 濺射範圍顯示
4. **光環** - 光環效果提示

---

## 實施順序

### 第一階段（本次）
1. ✅ 修復靈魂卡閃爍
2. 🚧 完成屍體顯示系統
   - 實現 `syncCorpsesFromState` 方法
   - 實現屍體高亮
   - 集成到 PixiBoard.vue

### 第二階段
3. 實現封印狀態圖示
4. 測試所有功能

### 第三階段
5. 添加道具使用特效
6. 添加能力觸發特效
7. 全面測試並優化

---

## 技術細節

### 屍體渲染邏輯
```typescript
syncCorpsesFromState(state: GameState) {
  // 清理不存在的屍體
  this.corpseSprites.forEach((sprite, posKey) => {
    if (!state.corpsesByPos[posKey] || state.corpsesByPos[posKey].length === 0) {
      this.corpsesContainer.removeChild(sprite)
      sprite.destroy()
      this.corpseSprites.delete(posKey)
    }
  })
  
  // 更新/創建屍體精靈
  Object.entries(state.corpsesByPos).forEach(([posKey, corpses]) => {
    if (corpses.length === 0) return
    
    const [x, y] = posKey.split(',').map(Number)
    const pos = this.getCellPosition(x, y)
    
    const corpseData = corpses.map(c => ({
      base: c.base,
      ownerSide: c.ownerSide
    }))
    
    if (this.corpseSprites.has(posKey)) {
      this.corpseSprites.get(posKey)!.updateCorpses(corpseData)
    } else {
      const sprite = new CorpseSprite(corpseData)
      sprite.x = pos.x
      sprite.y = pos.y
      this.corpseSprites.set(posKey, sprite)
      this.corpsesContainer.addChild(sprite)
    }
  })
}
```

### 屍體高亮邏輯
```typescript
updateCorpseHighlights(highlightPosKeys: string[]) {
  // 清理舊高亮
  this.corpseSprites.forEach((sprite, posKey) => {
    if (highlightPosKeys.includes(posKey)) {
      // 添加高亮效果（發光或邊框）
      gsap.to(sprite, { alpha: 1, duration: 0.2 })
    } else {
      gsap.to(sprite, { alpha: 0.7, duration: 0.2 })
    }
  })
}
```
