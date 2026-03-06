# 棋盤/地圖渲染技術文件（HTML/CSS 版本，支援可變寬高房間，Tile=獨立 PNG）

## 0. 目標

- 以 **HTML/CSS** 渲染棋盤（房間/地圖），讓玩家能穩定地「點格子下指令」。
- 支援不同房間使用不同長寬（例如 5×5、7×5、9×9）。
- 地形採 **每格一張獨立 PNG**（方案 A）：草原/河川/高地/道路…（純貼圖，不做 3D 模型）。
- 保留未來擴充空間：
  - 視覺做假 3D 斜角（可選）
  - 地形 overlay（河川連接件、高地邊緣）
  - 多人同步（不影響渲染）

---

## 1. 核心原則

- **邏輯座標**：永遠使用「方格座標」`(x, y)`，原點 `(0,0)` 在左上。
- **渲染座標**：由 CSS Grid 決定；不在引擎內處理像素座標。
- **互動正確性優先**：
  - 點擊/hover 的判定一定要準
  - 不做需要反推座標的斜角點擊（MVP 先避免）
- **資料驅動**：UI 不直接改 state，只用 `dispatch(action)`；棋盤渲染只依 `state.grid`。

---

## 2. 資料結構（建議）

> 以 `newGame.consolidated.md` 的 tile 結構為基礎，補足 UI 渲染需要的欄位。

### 2.1 Room / Board

```ts
export type GridSize = { width: number; height: number }

export type RoomViewModel = {
  id: string
  size: GridSize
  tiles: TileViewModel[] // length = width * height
}

export type TilePos = { x: number; y: number }

export type TileType =
  | 'normal'
  | 'grass'
  | 'river'
  | 'highland'
  | 'road'
  | 'recovery'
  | 'obstacle'
  | 'chest'
  | 'hazard'
  | 'mechanism'
  | 'portal'
  | 'stairs'

export type TileViewModel = {
  pos: TilePos
  type: TileType
  passable: boolean
  blockLineOfSight: boolean
  heightLevel: number
  movementCost: number
  visualKey: string // 用來映射 PNG
  content?: {
    monsterId?: string | null
    chestRarity?: 'common' | 'rare' | 'legendary' | null
    mechanismId?: string | null
  }
}

export function tileIndex(size: GridSize, pos: TilePos) {
  return pos.y * size.width + pos.x
}
```

### 2.2 visualKey 與 PNG 映射

- 規則：`visualKey` 對應一個 PNG 檔名（不含副檔名）
- 例如：
  - `visualKey = "tile_grass_01"` → `tile_grass_01.png`
  - `visualKey = "tile_river_02"` → `tile_river_02.png`

建議：由「地圖生成器」或「渲染層」決定 `visualKey`，引擎只需要 `type`。

---

## 3. DOM 結構（可變寬高）

> 使用 CSS Grid：`grid-template-columns: repeat(width, tileSize)`。

### 3.1 建議結構（支援視覺層/點擊層分離）

```html
<div class="boardRoot" style="--w: 7; --h: 5; --tile: 56px;">
  <div class="boardVisual">
    <!-- width*height 個 tile visual -->
    <div class="tileVisual" data-x="0" data-y="0"></div>
    ...
  </div>

  <div class="boardHit">
    <!-- width*height 個 tile hit -->
    <button class="tileHit" data-x="0" data-y="0"></button>
    ...
  </div>

  <div class="boardUnits">
    <!-- 單位/特效可用 absolute 定位疊上來（可選） -->
  </div>
</div>
```

### 3.2 CSS 範例

```css
.boardRoot {
  position: relative;
  --w: 5;
  --h: 5;
  --tile: 56px;
  width: calc(var(--w) * var(--tile));
  height: calc(var(--h) * var(--tile));
}

.boardVisual,
.boardHit {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(var(--w), var(--tile));
  grid-template-rows: repeat(var(--h), var(--tile));
}

.tileVisual {
  width: var(--tile);
  height: var(--tile);
  background-size: cover;
  background-position: center;
}

.tileHit {
  width: var(--tile);
  height: var(--tile);
  background: transparent;
  border: 0;
  padding: 0;
}

.tileHit:hover {
  outline: 2px solid rgba(0, 255, 255, 0.6);
  outline-offset: -2px;
}

/* 可用狀態 class 來顯示可移動/可攻擊 */
.tileHit.is-move {
  background: rgba(0, 255, 0, 0.15);
}

.tileHit.is-attack {
  background: rgba(255, 0, 0, 0.15);
}
```

---

## 4. Tile PNG 管理（方案 A）

### 4.1 檔案建議結構

- `public/assets/tiles/`
  - `tile_grass_01.png`
  - `tile_grass_02.png`
  - `tile_river_01.png`
  - `tile_highland_01.png`
  - `tile_road_01.png`
  - `tile_obstacle_rock_01.png`

### 4.2 設定檔（可選，但推薦）

> 用一個 JSON/TS 物件集中管理 `visualKey -> url`，避免散落在 component。

```ts
export const TILE_TEXTURES: Record<string, string> = {
  tile_grass_01: '/assets/tiles/tile_grass_01.png',
  tile_river_01: '/assets/tiles/tile_river_01.png',
  tile_highland_01: '/assets/tiles/tile_highland_01.png',
}
```

### 4.3 渲染方式

- `tileVisual.style.backgroundImage = url(TILE_TEXTURES[tile.visualKey])`
- 若缺 key：fallback 到 `tile_normal_01`，並在 dev 模式 console.warn。

---

## 5. 互動（下指令）

### 5.1 Tile 點擊輸出

- `onTileClick(pos)` → UI 組合成一個 Action（例如 `MOVE` / `QUEUE_WEAPON`）
- **不要**在 UI 內直接改 unit pos 或扣資源

### 5.2 建議的 UI 模式（可做成狀態機）

- `mode = 'idle' | 'selectMoveTarget' | 'selectWeaponTarget' | 'selectItemTarget'`
- idle 時點到 unit：進入選擇模式
- 選擇模式時點 tile：dispatch 對應 action

### 5.3 可用格顯示

- UI 依引擎回傳的 `events` 或 selector 計算：哪些 tile 加 `is-move/is-attack` class
- 顯示層與點擊層分離後，不影響 hover/click。

---

## 6. 可變房間大小（不同長寬）

### 6.1 重點

- `boardRoot` 的 `--w/--h` 由 room config 決定
- tile list 長度必須永遠是 `w*h`

### 6.2 room 切換策略

- 切換房間時：
  - 更新 `--w/--h`
  - 替換 tiles array
  - 清理所有選取狀態（mode 回到 idle）

---

## 7. 假 3D 斜角（可選，且不影響點選）

若要做假 3D：**只 transform `boardVisual`，不要 transform `boardHit`**。

```css
.boardVisual {
  transform-origin: center;
  transform: skewY(-18deg) scaleY(0.9);
  filter: drop-shadow(0 18px 20px rgba(0,0,0,0.25));
}

/* boardHit 不做 transform，保持點選準確 */
```

加厚度（可選）：
- `boardVisual::before` 做一層偏移的深色底

---

## 8. 未來擴充（先留接口）

### 8.1 河川/道路連接

方案 A（每格獨立 PNG）下，河川要連接會需要：
- `visualKey` 依鄰居決定（仍可保持一格一張 PNG，但 key 會變成 `tile_river_turn_NE` 這種）
- 建議先把命名規則定好：
  - `tile_river_island`
  - `tile_river_straight_NS`
  - `tile_river_straight_EW`
  - `tile_river_turn_NE` ...

### 8.2 高地邊緣

同理：`tile_highland_edge_N` / `tile_highland_edge_NE` 等。

---

## 9. 測試清單（最小驗收）

- 5×5、7×5、9×9 三種尺寸都能正確渲染
- 每格 hover 不漂移、點擊準確
- 切換房間後不殘留上一房間的可走/可攻擊標記
- 缺貼圖時有 fallback 且在 dev 模式可看到警告

