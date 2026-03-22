# Beast Conquest v3.0 - 卡牌圖鑑

Beast Conquest（獸族征戰）是一款策略卡牌對戰遊戲，採用 Tags 系統為主、種族為輔的設計理念，支持跨種族混合組牌。

## 🎴 卡牌總覽

本專案包含完整的核心卡池設計：

- **首領卡**：24 張（6 種族 × 4 職業）
- **軍團卡**：30 張（每種族 5 張：2 普通 + 2 精英 + 1 傳說）
- **事件卡**：12 張（戰鬥、召喚、控制、防禦等類別）
- **戰術卡**：10 張（防禦、反擊、移動、築城）
- **建築卡**：12 張（防禦、經濟、進攻、輔助、特殊）

**總計：88 張核心卡牌**

## 🚀 快速開始

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

啟動後訪問 `http://localhost:5173` 即可查看卡牌圖鑑。

### 建置專案

```bash
npm run build
```

### 預覽建置結果

```bash
npm run preview
```

## 📁 專案結構

```
app3/
├── docs/                           # 設計文檔
│   ├── beast-conquest-game-design-v3.md
│   ├── card-design-guidelines.md
│   └── effect-keywords-dictionary.md
├── src/
│   ├── data/                       # 卡牌數據
│   │   ├── leaders/               # 首領卡（24 張）
│   │   ├── legions/               # 軍團卡（30 張）
│   │   ├── events/                # 事件卡（12 張）
│   │   ├── tactical/              # 戰術卡（10 張）
│   │   └── buildings/             # 建築卡（12 張）
│   ├── types/                      # TypeScript 類型定義
│   ├── views/                      # 頁面組件
│   │   ├── Home.vue               # 首頁
│   │   └── CardsGallery.vue       # 卡牌圖鑑
│   ├── router/                     # 路由配置
│   └── App.vue
└── package.json
```

## 🎮 功能特色

### 卡牌圖鑑

- **分類瀏覽**：按卡牌類型（首領、軍團、事件、戰術、建築）分類查看
- **篩選功能**：支持按種族、職業篩選
- **詳情展示**：點擊卡牌查看詳細資訊
- **圖片佔位符**：預留圖片欄位，待後續補充

### Tags 系統

所有卡牌效果基於 Tags 觸發，支持：
- 種族 Tags：dragon、harpy、lamia、slime、centaur、aquatic
- 職業 Tags：destroyer、conqueror、commander、guardian
- 屬性 Tags：flying、elemental、fire、ice、lightning、poison 等

### 設計原則

1. **Tags 優先**：卡牌效果主要基於 Tags 觸發，而非限制於種族
2. **混合組牌**：支持跨種族組建卡組，只要 Tags 匹配即可協同
3. **效果關鍵詞**：60+ 種效果關鍵詞，涵蓋攻擊、防禦、移動、控制等

## 📝 開發說明

### 技術棧

- **Vue 3**：使用 Composition API 和 `<script setup>`
- **TypeScript**：完整的類型定義
- **Vue Router**：頁面路由管理
- **Vite**：快速的開發構建工具

### 添加新卡牌

1. 在對應的 `src/data/` 目錄下添加卡牌數據
2. 確保符合 TypeScript 類型定義
3. 卡牌會自動顯示在圖鑑中

### 添加卡牌圖片

圖片佔位符已預留，後續可以：
1. 將圖片放置在 `public/assets/cards/` 目錄
2. 在卡牌數據中添加 `image` 屬性，指向圖片路徑
3. 圖片會自動替換佔位符顯示

## 📚 相關文檔

- [遊戲設計文檔](./docs/beast-conquest-game-design-v3.md)
- [卡牌設計指南](./docs/card-design-guidelines.md)
- [效果關鍵詞字典](./docs/effect-keywords-dictionary.md)

## 🎯 下一步計劃

- [ ] 補充卡牌圖片
- [ ] 實作遊戲邏輯
- [ ] 開發對戰系統
- [ ] UI/UX 優化

## 📄 授權

本專案為個人學習專案。
