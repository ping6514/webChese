# WebChese 遊戲 UI 強化建議

## 已實作功能：卡片使用動畫 ✅

### 新增的卡片使用提示動畫
- **位置**：`src/components/CardUsageToast.vue`
- **功能**：當使用道具卡或安裝靈魂卡時，會在畫面中央上方顯示卡片圖片和行為描述
- **特色**：
  - 顯示完整卡片圖片（如果有的話）
  - 顯示卡片名稱和類型標籤
  - 顯示當前行為描述（例如：「對 暗月砲兵 使用」、「附魔於 帥」）
  - 平滑的進出場動畫（縮放 + 淡入淡出）
  - 自動在 2.8 秒後消失
  - 支援多個卡片使用提示同時顯示（堆疊排列）

---

## UI 互動感強化建議

### 1. 🎯 **棋盤互動動畫**

#### 1.1 單位移動軌跡動畫
**現況**：單位移動時直接跳到目標位置
**建議**：
- 添加平滑的移動過渡動畫（CSS transition 或 GSAP）
- 移動路徑上顯示淡淡的軌跡線條
- 移動時單位稍微放大（scale: 1.1）並添加陰影
- 到達目標位置時有輕微的「落地」彈跳效果

**實作位置**：`src/components/BoardCell.vue`、`src/components/BoardGrid.vue`

```css
/* 建議樣式 */
.unit {
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1),
              left 0.4s ease-out,
              top 0.4s ease-out;
}

.unit.moving {
  transform: scale(1.1);
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
  z-index: 100;
}
```

#### 1.2 可移動格子高亮動畫
**現況**：可移動格子有靜態高亮
**建議**：
- 添加脈動動畫（pulse）讓可移動格子更明顯
- 滑鼠懸停時格子稍微放大並增強發光效果
- 選中格子時有漣漪擴散動畫

```css
@keyframes cellPulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.05); }
}

.legalMove {
  animation: cellPulse 1.5s ease-in-out infinite;
}
```

#### 1.3 攻擊範圍指示器
**現況**：射擊目標有靜態標記
**建議**：
- 添加旋轉的瞄準圈動畫
- 攻擊範圍邊緣有流動的光效
- 鎖定目標時有十字準星收縮動畫

---

### 2. ⚔️ **戰鬥特效增強**

#### 2.1 攻擊光束效果升級
**現況**：已有基礎光束效果（`fxBeams`）
**建議**：
- 光束添加粒子拖尾效果
- 根據傷害類型使用不同顏色（物理攻擊：橙紅色，魔法攻擊：藍紫色）
- 光束擊中時產生爆炸粒子效果
- 暴擊時光束更粗、更亮，並有閃電效果

**實作位置**：`src/components/BoardGrid.vue` 的光束渲染部分

#### 2.2 傷害數字彈出動畫
**現況**：已有浮動文字（`floatTextsByPos`）
**建議增強**：
- 傷害數字從單位位置彈出並向上飄移
- 根據傷害大小調整字體大小和顏色強度
- 暴擊傷害使用特殊字體效果（描邊、發光、震動）
- 治療數字使用綠色並有十字符號

```css
@keyframes damageFloat {
  0% {
    transform: translateY(0) scale(1.2);
    opacity: 1;
  }
  70% {
    transform: translateY(-40px) scale(1);
    opacity: 0.8;
  }
  100% {
    transform: translateY(-60px) scale(0.8);
    opacity: 0;
  }
}

.floatText.critical {
  font-size: 2rem;
  font-weight: 900;
  color: #ff4444;
  text-shadow: 0 0 20px #ff0000,
               0 0 40px #ff0000;
  animation: damageFloat 1s ease-out, shake 0.3s;
}
```

#### 2.3 單位死亡動畫
**現況**：已有死亡標記（`fxKilledPosKeys`）
**建議**：
- 單位淡出前先閃爍紅光
- 添加碎裂效果或粒子消散動畫
- 屍骸出現時有煙霧效果
- 重要單位（如帥）死亡時全屏震動效果

---

### 3. 🃏 **卡片系統動畫**

#### 3.1 手牌卡片互動
**現況**：卡片有基本的 hover 效果
**建議**：
- 滑鼠懸停時卡片向上浮起（translateY: -8px）
- 添加 3D 傾斜效果（perspective + rotateX/Y）
- 卡片選中時有發光邊框動畫
- 拖曳卡片時留下殘影效果

**實作位置**：`src/components/HandItems.vue`、`src/components/HandSouls.vue`

```css
.itemCard {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  transform-style: preserve-3d;
}

.itemCard:hover {
  transform: translateY(-8px) rotateX(5deg);
  box-shadow: 0 12px 32px rgba(145, 202, 255, 0.4);
}

.itemCard.dragging {
  opacity: 0.7;
  transform: scale(1.1) rotate(5deg);
}
```

#### 3.2 購買/抽卡動畫
**建議**：
- 購買卡片時從商店位置飛向手牌區
- 新卡片進入手牌時有翻轉動畫（flip）
- 卡片堆疊時有扇形展開動畫

#### 3.3 附魔特效
**現況**：已有附魔位置標記（`fxEnchantedPosKeys`）
**建議增強**：
- 附魔時單位周圍出現魔法陣
- 靈魂卡圖案短暫顯示在單位上方
- 附魔成功後單位有持續的微光環繞效果
- 不同氏族的靈魂卡使用不同顏色的特效

---

### 4. 💰 **資源變化反饋**

#### 4.1 金幣/魔力變化動畫
**現況**：資源數字直接更新
**建議**：
- 資源增加時數字跳動並放大
- 資源減少時數字縮小並閃紅
- 添加金幣/魔力圖標飛向資源欄的動畫
- 資源不足時資源欄震動並閃紅

**實作位置**：`src/components/v2/StatusBarV2.vue`

```javascript
// 數字滾動動畫範例
function animateValue(start, end, duration) {
  const range = end - start
  const increment = range / (duration / 16)
  let current = start
  
  const timer = setInterval(() => {
    current += increment
    if ((increment > 0 && current >= end) || 
        (increment < 0 && current <= end)) {
      current = end
      clearInterval(timer)
    }
    displayValue.value = Math.floor(current)
  }, 16)
}
```

#### 4.2 收入報告動畫
**現況**：已有收入提示（`incomeToasts`）
**建議增強**：
- 收入項目逐個彈出顯示（stagger animation）
- 每個收入項目有對應的圖標動畫
- 總收入數字有累加動畫效果

---

### 5. 🎨 **階段轉換動畫**

#### 5.1 階段提示優化
**現況**：已有階段提示（`phaseToast`）
**建議增強**：
- 階段圖標旋轉進場
- 背景添加對應階段的粒子效果
- 階段名稱逐字顯示（typewriter effect）
- 階段轉換時全屏漸變過渡

#### 5.2 回合切換動畫
**建議**：
- 回合切換時棋盤翻轉 180 度（如果是對戰模式）
- 背景顏色平滑過渡（紅方 ↔ 黑方）
- 添加「回合開始」橫幅動畫

---

### 6. ✨ **微互動細節**

#### 6.1 按鈕反饋
**建議**：
- 所有按鈕添加點擊漣漪效果（ripple）
- 按鈕 hover 時有輕微放大
- 禁用按鈕有灰階濾鏡並搖頭動畫（表示不可用）

```css
.button {
  position: relative;
  overflow: hidden;
}

.button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  transform: scale(0);
  transition: transform 0.5s;
}

.button:active::after {
  transform: scale(2);
}
```

#### 6.2 模態框動畫
**建議**：
- 模態框從中心縮放進場（scale from center）
- 背景遮罩淡入並添加模糊效果
- 模態框內容逐個淡入（stagger）
- 關閉時縮小並旋轉消失

#### 6.3 Tooltip 提示
**建議**：
- 添加延遲顯示的 tooltip（hover 0.5s 後顯示）
- Tooltip 有箭頭指向目標元素
- Tooltip 內容淡入並稍微向上移動

---

### 7. 🌟 **特殊事件動畫**

#### 7.1 技能觸發特效
**現況**：已有技能觸發標記（`fxAbilityUnitIds`）
**建議增強**：
- 不同技能類型使用不同特效（治療：綠色十字、增益：金色光環、debuff：紫色煙霧）
- 技能範圍顯示擴散圓圈動畫
- 技能圖標在單位上方短暫顯示

#### 7.2 連鎖攻擊動畫
**建議**：
- 連鎖目標之間用閃電連接
- 連鎖順序用數字標記並依序觸發
- 每次連鎖傷害遞減時視覺效果也遞減

#### 7.3 復活動畫
**現況**：已有復活標記（`fxRevivedPosKeys`）
**建議增強**：
- 復活位置出現光柱從天而降
- 單位從光柱中淡入並旋轉出現
- 復活後單位有短暫的無敵金光效果

---

## 實作優先級建議

### 高優先級（立即可實作，效果顯著）
1. ✅ **卡片使用動畫**（已完成）
2. 🎯 **單位移動軌跡動畫**
3. ⚔️ **傷害數字彈出增強**
4. 💰 **資源變化數字滾動**
5. 🃏 **手牌卡片 3D hover 效果**

### 中優先級（提升整體體驗）
6. 🎨 **階段轉換動畫優化**
7. ⚔️ **攻擊光束粒子效果**
8. 🃏 **購買卡片飛行動畫**
9. ✨ **按鈕漣漪反饋**
10. 🎯 **可移動格子脈動動畫**

### 低優先級（錦上添花）
11. 🌟 **技能特效差異化**
12. ⚔️ **單位死亡碎裂效果**
13. 🎨 **回合切換棋盤翻轉**
14. ✨ **模態框進出場動畫**
15. 🌟 **連鎖攻擊閃電效果**

---

## 技術實作建議

### 推薦使用的動畫庫
1. **CSS Animations & Transitions**：適合簡單的狀態轉換
2. **GSAP (GreenSock)**：複雜的時間軸動畫和物理效果
3. **Anime.js**：輕量級的 JavaScript 動畫庫
4. **Particles.js** 或 **tsParticles**：粒子效果系統

### 性能優化建議
- 使用 `transform` 和 `opacity` 而非 `left/top/width/height`
- 啟用 GPU 加速：`will-change: transform`
- 動畫結束後移除 `will-change` 屬性
- 使用 `requestAnimationFrame` 進行 JavaScript 動畫
- 限制同時播放的動畫數量
- 提供「降低動畫」選項給低性能設備

### 可訪問性考慮
- 尊重用戶的 `prefers-reduced-motion` 設定
- 提供關閉動畫的選項
- 確保動畫不影響遊戲可玩性
- 避免過於閃爍的效果（癲癇警告）

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 總結

這個專案已經有很好的基礎架構（事件系統、FX 系統、組件化設計），非常適合添加更多的視覺反饋和動畫效果。建議從高優先級項目開始逐步實作，每次添加一個新動畫後測試性能和用戶體驗，確保不會影響遊戲流暢度。

重點是讓每個玩家操作都有清晰的視覺反饋，讓遊戲感覺更「活」、更有互動感！
