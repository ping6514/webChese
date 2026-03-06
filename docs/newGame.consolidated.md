# 時間隨機地城消遣團（暫定名稱）— 規格收斂版（MVP1 / v0.1）

> 本文件為 `docs/newGame.md` 的收斂整理版。
> 原則：**越靠下的定義越新**；若有衝突以新定義為準。

---

## 0. 遊戲定位

- 消遣向、無限層數地城冒險
- 可單人刷、可 2–4 人連線合作（MVP1 先以單機可玩為主）
- 失敗零壓力：今天玩得很開心，下次再來，可帶部分戰利品回家
- 可隨時中斷：seed + 狀態存檔（LocalStorage/後端存檔皆可）
- 重玩性核心：
  - 隨機地圖
  - **武器插槽 Build**（武器 = 基底 + 5 綴）
  - **怪物同系統 Build**

---

## 1. MVP1 範圍（本次鎖定）

只做「**角色創建 → 村莊（極簡）→ 一層地城（5×5）**」的完整閉環。

- 地城：固定 5×5
- 玩家：1 名（後續擴到 2–4）
- 武器槽：3 槽（主攻 1、付裝 2）
- 怪物：少量（2–4 隻），AI 以追擊/守點/巡邏為主
- 掉落：seed 可重現（先做 server 決定 or 前端抽 + server 驗證皆可）

---

## 2. 時間戳系統（ATB / 共用時間軸）

- 所有單位（玩家 + 怪物）都有 `speed`（範例 8–20）
- 共用一條時間軸（從 0 開始累積）
- 每個單位有自己的「讀條進度 icon」（抽象為 atb 值）
- 當某單位 icon 先碰到下一個門檻線（基準刻度 = 100）則獲得行動權
- 行動完成後該單位 icon **重置到 0**（或扣除 100，待微調；MVP1 先用重置 0）
- 同時行動（消遣向規則）：
  - 玩家彼此同時：掷骰/硬幣決定順序（高者先，平手重擲）
  - 怪物彼此同時：隨機/掷骰
  - 玩家 vs 怪物同時：**玩家優先**

---

## 3. 單次行動流程（輪到誰就完整執行一次）

一次行動由三段構成：

1. **移動階段**
   - 移動格數依職業/裝備/詞綴修正（MVP1 可先用職業定值）
   - 可使用移動類道具（MVP1 可暫緩）

2. **行動階段（武器/技能）**
   - 選擇主攻武器或付裝
   - 多數武器有 **讀條（castTime）**
   - 讀條完成後才能施放；施放通常包含：位移 + 傷害/效果

3. **道具／互動階段（行動結尾）**
   - 使用藥水、開箱子、環境互動等
   - 使用限制（先留規格，MVP1 可只實作「每次行動內最多 1 次」）：
     - 房間限制（這層只能用 X 次）
     - 行動限制（本次行動內限 1 次）
     - 冒險限制（整場地城限 1～2 次）

---

## 4. 資源系統（MVP1）

- **HP**：生命值
- **SP**：行動點/技能點（武器消耗主要走 SP）
- **MP**：魔法值（保留欄位；MVP1 可視武器是否需要）

SP 恢復：
- 每完整行動結束，自動回復 **20% SP**
- 踩回復格可回滿（或大量回復，MVP1 先可設為回滿）

普通攻擊：0 SP（可視為無綴武器 / 0 硬直）

---

## 5. 武器系統（核心）

### 5.1 武器使用流程（實作導向）

一把武器使用後會經過：

1. 判斷條件是否符合
   - SP/MP 是否足夠
   - 武器是否在 CD
   - 角色是否處於不能出招狀態（凍結/腿軟等）
2. 消耗資源（HP/SP/MP）
3. 攻擊動作準備（castTime 讀條）
4. 打出攻擊判定（單段/持續）
5. 結算角色回復時間（recoveryTime / 硬直）與開始武器 CD
6. 回到正常狀態（等待 ATB 下次輪到）

### 5.2 武器插槽結構（固定 5 槽，防組合爆炸）

每把武器 = **基底 + 5 綴（每類限 1）**：

1. **類型綴（必填）**：傷害屬性/系統
   - 物理：劈砍 / 碎裂 / 穿刺 …
   - 魔法：水 / 火 / 木 / 光 / 暗 …

2. **攻擊模式基底（必填）**：範圍形狀/機制
   - 劈砍：前方橫 3 格
   - 旋風斬：附近 1 格，持續 DoT（例如每 50 戳傷 4 次）
   - 突刺：直線 5 格
   - 投擲：拋物線落地 AoE
   - 爆破：當前格 + 周圍爆

3. **特性綴（必填 1）**：數值調節
   - 廣範圍：範圍 +1
   - 全力：傷害 ×1.5，但回復時間 +50
   - 快速：讀條 -30%，回復時間 -20
   - 聚焦：範圍 -1（最低 1），中心傷 ×2

4. **動作綴（必填 1）**：位移/施放條件
   - 飛越：施放前前移 3 格（可跨高/牆，規則由地圖 height/enterCondition 決定）
   - 飄移：施放前任意移 2 格
   - 腿軟：下次行動禁移動，但本招 SP/讀條 -50%
   - 定點：固定位置施放（不動）

5. **附魔綴（必填 1）**：後效
   - 燒傷：機率觸發 DoT
   - 減速：速度 -20%，持續 200 戳
   - 怒吼：攻擊 -30%，持續 100 戳
   - 堅固：目標防 -20%，你防 +10%

### 5.3 武器命名（自動生成）

格式：`{動作}{特性}{模式}的{類型}{基底}(附魔)`

例：`飛躍的廣範圍旋風斬的穿刺鐵劍(戰吼)`

### 5.4 數值（MVP1 初版公式）

- 讀條：`castTime = baseCast × (1 - 敏捷加成) + 特性調整`
- 硬直：`recoveryTime = baseRecovery + 特性調整`
- 傷害：`damage = baseAtk × 屬性倍率 × 範圍係數`

### 5.5 武器槽位（攜帶）

- 玩家攜帶：3 槽
  - 槽 0：主攻武器
  - 槽 1：付裝 1（輔助偏向）
  - 槽 2：付裝 2（輔助偏向）

付裝的模式建議（輔助池）：回血波 / SP 充能 / 開鎖 / 護盾

---

## 6. 命中/抵抗（MVP1 收斂）

- MVP1 建議：**不做完整命中率/抵抗表**
- 以「環境 + 預測」作為平衡來源：
  - 怪物預測路徑存在變數（例如 30% 機率偏移/變速）→ 猜錯打空
  - 遮蔽物阻擋直線技能
  - 速度高怪物在行動時可能自移 1 格
  - AoE 邊緣減傷

（若要加入簡版命中，放到迭代：固定 10% miss 或簡易公式。）

---

## 7. 地圖與格子（MVP1）

- 地圖：固定 5×5
- 格子可擴充：回復格、遮蔽物、寶箱、階梯、傳送門、機關、危害格

### 7.1 單一格子資料結構（JSON）

```json
{
  "type": "normal",
  "passable": true,
  "blockLineOfSight": false,
  "heightLevel": 0,
  "movementCost": 1,
  "enterCondition": ["normal"],
  "effects": [
    {
      "trigger": "action_end",
      "effectType": "heal_sp",
      "value": 20,
      "element": "none",
      "duration": 0
    }
  ],
  "attackModifier": {
    "physical": 0,
    "fire": 0,
    "ice": 0,
    "lightning": 0,
    "poison": 0
  },
  "content": {
    "monsterId": null,
    "chestRarity": null,
    "mechanismId": null
  },
  "visual": "floor_normal"
}
```

### 7.2 格子類型（MVP 實用集合）

- `normal`
- `recovery`
- `obstacle`
- `chest`
- `hazard`
- `mechanism`
- `portal`
- `stairs`

---

## 8. 地城結構與路線選擇（收斂版）

### 8.1 核心規則

- 地城全域有 `dungeonSeed`
- 共有 6 層（示意；MVP1 可只做 1 層），第 6 層為 Boss 層
- 每層結束時（1~5 層）提供**兩個路線選項**：艱難的路 / 輕鬆的路
- 玩家選擇後，系統用 seed + 傾向生成下一層 config

傾向建議：
- 艱難：怪物強度↑、菁英率↑、寶箱品質↑、陷阱/環境傷害↑
- 輕鬆：怪物強度↓、補給↑、稀有掉落↓

### 8.2 路線資料結構（JSON-like）

```json
{
  "routeId": "easy-001",
  "name": "輕鬆的路",
  "difficultyTier": 1,
  "multiplier": 0.8,
  "modifiers": {
    "eliteChance": 0.1,
    "treasureChance": 0.2,
    "supplyWeight": 1.3,
    "hazardChance": 0.05
  },
  "layerTypes": [
    "combat",
    "supply",
    "combat",
    "treasure",
    "puzzle_combat",
    "boss"
  ]
}
```

---

## 9. 角色/職業證/背包資料結構（MVP1 收斂版）

### 9.1 角色創建

流程：首頁 → 開始冒險 → 輸入名稱（1–12，可中文）→ 後端生成 UUID。

```json
{
  "characterId": "uuid-...",
  "name": "玩家輸入的名稱",
  "gender": null,
  "createdAt": "...",
  "lastLogin": "..."
}
```

### 9.2 玩家持有物（inventory）

- 貨幣/資源
  - `gold`: number
  - `fragments`: number

- 職業證列表（至少一張 equipped=true 才能進地城）
  - `certId`, `name`, `equipped`
  - `baseStats`: `{ str, agi, int, vit }`
  - **職業保底基礎值**：`baseMaxHP`, `baseMaxSP`, `baseMaxMP`
  - `compatibleTags`: 允許的武器 tag（例：`["warrior","defense","burst"]`）

- 武器槽（固定 3 格，允許 null）
  - `weaponId`, `name`, `base`, `affixes`(固定5), `type`("main"|"sub")
  - 武器基本數值：`atkBase`, `spCost`, `mpCost`, `castTime`, `recoveryTime`
  - `tags`: 例如 `["warrior","mobility","aoe","burst"]`

- 道具背包（可堆疊）
  - `itemId`, `name`, `type`, `quantity`, `effect`

- 成就列表（MVP 輕量）
  - `achId`, `name`, `unlockedAt`, `rewardClaimed`

### 9.3 currentStats（基底與現在值分離）

進入地城時由「equipped 職業證 + 武器/裝備/道具加成」計算一次，戰鬥中動態變化：

- `currentHP`, `currentSP`, `currentMP`
- `maxHP`, `maxSP`, `maxMP`
- `speed`
- `moveRange`
- `activeBuffs`, `activeDebuffs`
- 戰鬥內額外狀態：
  - `recoveryRemaining`（硬直剩餘戳數）
  - `weaponCooldowns`（每把武器獨立 CD）
  - `specialStates`（腿軟禁移、凍結禁行動等）

---

## 10. 武器 tag 系統（裝備相性）

- 每把武器都有 `tags: string[]`
- 每張職業證有 `compatibleTags: string[]`
- 裝備檢查（MVP1 版規則）：
  - 武器 `tags` 需要至少匹配職業證 `compatibleTags` 的 1 個職業大類 tag
  - 其餘特性 tag 可用於 UI 推薦/加成（可先不做數值加成）

職業大類 tag（至少一個）：
- `warrior`, `ranger`, `mage`, `support`, `hybrid`

特性 tag（0–3 個）：
- `summon`, `defense`, `burst`, `sustain`, `mobility`, `control`, `pierce`, `aoe`

---

## 11. 掉落（seed 可重現 / 可驗證）

目標：同一 seed 與同一擊殺上下文，掉落結果可重現；可由 server 驗證。

概念流程：
- 以 `floorSeed + (x,y) + index + salt` 組合出怪物個人 seed
- 以 seed 初始化 pseudo-random
- 以權重池抽取掉落

MVP1 建議：
- 優先做「server 決定掉落」；若做前端預抽，server 需能重算驗證。

---

## 12. 待定/待討論（保持短清單）

- ATB 結算：重置 0 vs 扣 100 vs 溢出保留
- 移動格數公式（目前先用職業定值）
- 四維對派生數值影響（可先用職業保底 max 值）
- 詞綴稀有度/掉落率
- 地圖生成引擎（MVP1 先固定 5×5 + 少量 preset）
- 多層結構（stairs/高度/投擲）
- 命中/抵抗是否加入簡版
