# Electron / Windows 打包問題紀錄

## 現象
- 打包後（Windows / Electron）開啟時畫面可能變成白底、樣式像是沒套用。
- 常見伴隨：圖片（卡牌 / icon）載入失敗。

## 主要原因（高機率）
### 1) Vite build 的 asset path 在 Electron `file://` 下失效
- Vite 預設 `base` 是 `/`。
- build 後 `index.html` 會引用類似：
  - `/assets/index-xxxx.js`
  - `/assets/index-xxxx.css`
- 但在 Electron packaged（`file://.../index.html`）環境下：
  - `/assets/...` 會被解析成 `file:///assets/...`
  - 導致 JS/CSS 404 → 看起來像 `style.css` 沒套用。

## 最小修正清單（之後要做）
### 1) `vite.config.ts` 加上 `base: './'`
- 目標：讓 build 後資源引用變成相對路徑 `./assets/...`，可在 `file://` 下正確讀到。

## 已確認項目
### 1) Electron main process 載入 `dist/index.html` 的路徑
- 現在 `electron/main.cjs` 使用 `loadFile(path.join(__dirname, '..', 'dist', 'index.html'))`（packaged mode）。
- 方向合理，通常不會是 `index.html` 找不到的原因。

### 2) 不是「瀏覽器內建黑夜模式」造成
- 專案的 `src/style.css` 有 `color-scheme: light dark;`。
- 這只會影響瀏覽器/UA 對表單、捲軸等原生元件的配色選擇。
- 若打包後畫面白底或無樣式，優先懷疑是 **CSS/JS 沒載到**（asset path）。

## 建議驗證方式（Windows packaged app）
- 開 DevTools（如果可開）。
- 觀察 Console/Network：
  - `index-xxxx.css` / `index-xxxx.js` 是否 404
  - 是否出現大量 `/assets/...` 404

## 備註
- 卡牌/道具圖片路徑：目前程式碼內有用 `import.meta.env.BASE_URL` 做 runtime 正規化。
- 因此建議優先解決 Vite `base`，避免去大改 JSON 內所有圖片 path。
