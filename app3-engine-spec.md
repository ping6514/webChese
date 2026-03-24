# 獸族征戰 (Beast Conquest) — 引擎規格說明書

> 本文件完全以 `app3/src/engine/` 及 `app3/src/data/` 原始碼為依據，
> 描述遊戲的實際運作邏輯。資料層描述與此文件衝突時，以此為準。
>
> 最後更新：2026-03-23

---

## 目錄

1. [遊戲概要](#1-遊戲概要)
2. [戰場結構](#2-戰場結構)
3. [遊戲初始化](#3-遊戲初始化)
4. [回合流程](#4-回合流程)
5. [主要階段（Main Phase）](#5-主要階段-main-phase)
6. [戰鬥階段（Battle Phase）](#6-戰鬥階段-battle-phase)
7. [反應階段（React Phase）](#7-反應階段-react-phase)
8. [戰鬥計算細節](#8-戰鬥計算細節)
9. [首領狀態系統](#9-首領狀態系統)
10. [勝利條件](#10-勝利條件)
11. [卡牌系統](#11-卡牌系統)
12. [首領一覽](#12-首領一覽)
13. [軍團卡一覽](#13-軍團卡一覽)
14. [事件卡一覽](#14-事件卡一覽)
15. [戰術卡一覽](#15-戰術卡一覽)
16. [被動能力總表](#16-被動能力總表)
17. [已知限制與設計備注](#17-已知限制與設計備注)

---

## 1. 遊戲概要

- **玩家數**：2 人
- **勝利目標**：將敵方城牆（City Walls）打到 0
- **核心機制**：首領（Leader）在三個區域移動、戰鬥、清除防禦工事；透過軍團卡強化首領、事件卡打出即時效果、戰術卡設置觸發陷阱
- **沒有 HP**：首領採用**閾值判定制**——傷害是否達到堅韌（Toughness）的 1× 或 2× 才是關鍵，不追蹤累積傷害
- **回合上限**：100 回合（超過後以場面優勢判定勝負）

---

## 2. 戰場結構

```
[ p1_base ] ←→ [ plaza ] ←→ [ p2_base ]
```

| 區域 | 說明 |
|------|------|
| `p1_base` | 玩家 1 的基地，初始 fortLevel=3，cityWalls=3 |
| `plaza` | 中立廣場，fortLevel 永遠為 0，cityWalls=0 |
| `p2_base` | 玩家 2 的基地，初始 fortLevel=4，cityWalls=4（後攻補償） |

### 區域屬性

- **fortLevel（築城等級）**：0–3。敵方想**進入**你的基地，需要 fortLevel=0；或擁有 `ignore_fortification` 被動。
  基地最大值 = 3（技能 `鐵壁` 可堆至 3；`on_receive_damage` 的鋼鐵之軀最多 2）。
- **cityWalls（城牆HP）**：0–4。只有 `p1_base` 和 `p2_base` 有城牆。城牆歸零即失敗。

### 相鄰規則

```
p1_base ↔ plaza ↔ p2_base
```

- `p1_base` 與 `p2_base` 不相鄰，首領無法直接跨越。

---

## 3. 遊戲初始化

### 首領配置

- 每位玩家從每個職業（`destroyer`/`conqueror`/`commander`）各隨機選出 1 名首領，共 **3 名首領**（不包含 guardian）
- 所有首領初始在己方基地（`lairZone`）
- 首領有 2 個軍團槽（`legionSlots = 2`）

### 卡組（Deck）

預設牌組組成（共約 40 張）：
- 每種軍團卡 × **2 張**（10 種 × 2 = 20 張）
- 每種戰術卡 × **1 張**（10 種 = 10 張）
- 每種事件卡 × **1 張**（10 種 = 10 張）
- 洗牌後置於牌組頂部

### 先後手與起手牌

| | P1（先攻） | P2（後攻） |
|---|---|---|
| 起手牌數 | **2 張** | **3 張**（後攻補償） |
| 何時抽牌 | 每回合準備階段抽 2 張 | 每回合準備階段抽 2 張 |

### 初始城牆不對稱

P2 基地初始 cityWalls=4（P1 為 3），屬於設計上的後攻補償。

---

## 4. 回合流程

每位玩家的完整回合 = **自動準備** → **主要階段** → **戰鬥階段** → **反應階段**

```
react（前一玩家）結束
     ↓
切換 currentPlayer
     ↓
【自動準備階段】（不是獨立階段，react→main 時自動執行）
 1. 回合旗標重置（battle_cry、divine_blessing）
 2. 復活中 → 普通（HP 恢復至基地）
 3. KO 倒計時 +1（到達 reviveTime → 轉 reviving）
 4. 技能冷卻倒計時 -1
 5. 抽牌 2 張 + 重置一般召喚次數
 6. 解除禁錮（immobilized → false）
     ↓
【主要階段（main）】
     ↓
【戰鬥階段（battle）】
     ↓
【反應階段（react）】
     ↓
下一位玩家的回合...
```

> **暈眩（stunned）的首領**：在對手的戰鬥階段結束（battle → react 時），被我方打暈的敵方首領自動恢復。
> 更精確地說：`battle→react` 轉換時，`currentPlayer` 的**我方**被暈首領自動恢復正常。

---

## 5. 主要階段（Main Phase）

每回合可執行：

### 5.1 一般召喚（SUMMON_LEGION）

- **每回合限 1 次**（`normalSummonUsed`）
- 將手牌中 1 張**軍團卡**附加到 1 名己方首領（狀態非 ko/reviving）
- 首領軍團槽需有空間（最多 2 個）
- 立即加算 `bonusToughness`、`bonusAttack`、`bonusSupport`

### 5.2 打出事件卡（PLAY_EVENT）

- 從手牌打出事件卡，**棄置指定數量的其他手牌**作為費用
- 事件卡本身也移入墓地
- 每回合可打出**多張**（無次數限制，只要費用夠）
- 詳見「[事件卡一覽](#14-事件卡一覽)」

### 5.3 結束主要階段（NEXT_PHASE）

→ 進入戰鬥階段。

---

## 6. 戰鬥階段（Battle Phase）

### 行動規則總覽

進入戰鬥階段時，所有我方首領的 `moveCount` 重置為 0，`actedLeaders` 清空。

每位首領每個戰鬥階段可選擇**以下其中一條路線**（不可兼行）：

| 選項 | 移動 | 戰鬥行動 |
|------|------|----------|
| A：純移動 | 移動 1 次 | ✗ 不可（moveCount > 0 後無法 act） |
| B：純行動 | ✗ 不動 | ✓ 攻擊 / 清磚 / 攻城 / 技能 |
| C：不動不打 | 可選擇不行動 | 可選擇不行動 |

> **特例**：擁有 `double_move` 被動（半人馬娘）的首領可移動 **2 次**，但仍然無法在移動後攻擊。

---

### 6.1 移動（MOVE）

- 首領移動到相鄰區域（僅相鄰，不可跨越）
- 條件：`state == 'normal'`、未被 `immobilized`、`moveCount < maxMoves`
- **進入敵方基地**：需 `fortLevel == 0`，或擁有 `ignore_fortification` 被動
- 移動後 `moveCount++`（1 次移動後不再能 act）
- 移動**觸發**目標區域中敵方首領的 `on_enemy_enter_zone` 戰術卡

### 6.2 攻擊（ATTACK）

- 攻擊**同區域**的敵方首領（`state == 'normal'` 或 `'stunned'`）
- 條件：`moveCount == 0`、不在 `actedLeaders` 中
- 傷害計算見「[第 8 節](#8-戰鬥計算細節)」
- 攻擊後加入 `actedLeaders`（本回合不可再 act）

### 6.3 清磚（CLEAR_FORT）

- 首領在 **`plaza`** 時，消耗行動將敵方基地的 `fortLevel - 1`
- 條件：`moveCount == 0`、`fortLevel > 0`、不在 `actedLeaders`
- 可被敵方「阻擋（block）」戰術卡攔截（攔截後清磚無效，但行動仍消耗）
- 事件卡 `battle_cry` 啟用時，清磚額外 +1（**注意：引擎實現中此效果目前未反映在 CLEAR_FORT 動作中，僅記錄旗標**）

### 6.4 攻城（SIEGE）

- 首領在**敵方基地**（`fortLevel == 0`）時，使敵方城牆 `cityWalls - 1`
- 條件：`moveCount == 0`、`fortLevel == 0`、`cityWalls > 0`、不在 `actedLeaders`
- 城牆降至 0 → 攻城方立即勝利

### 6.5 使用技能（SKILL）

- 條件：`moveCount == 0`、`skillCooldown == 0`、不在 `actedLeaders`
- 技能使用後 `skillCooldown = 3`（3 回合冷卻）
- 技能效果依**職業**決定（非個人技能），見下表

| 職業 | 技能名 | 引擎實際效果 |
|------|--------|------------|
| 破壞者（destroyer） | 戰吼 | 對同區域所有敵首領造成 `⌈totalAttack / 2⌉` 直接傷害 |
| 征服者（conqueror） | 衝鋒 | 無視 fortLevel 強行移動至更靠近敵方基地的相鄰區域，並觸發 on_enemy_enter_zone |
| 指揮官（commander） | 號令 | 抽 2 張牌 |
| 守護者（guardian） | 鐵壁 | 己方所在區域 `fortLevel + 1`（上限 3）；若在 plaza 則加強己方基地 |

> ⚠️ 注意：`data/leaders.ts` 中的個人技能描述（如炎龍娘「火龍吐息」）目前**未被引擎實作**。引擎使用上表統一職業技能。

---

## 7. 反應階段（React Phase）

- 玩家可將手牌中的**戰術卡**安裝到己方首領身上（`INSTALL_TACTICAL`）
- 每位首領只能持有 **1 張**戰術卡（`tacticalCard` 欄位）
- 安裝後從手牌移除，等待觸發條件
- 可安裝**多張**（分配給不同首領），無次數限制
- 觸發後自動使用並移入墓地

---

## 8. 戰鬥計算細節

### 8.1 傷害計算（攻擊方）

```
傷害 = max(0, effectiveAttack - enemyAttackDebuff) + supportDamage
```

其中：

| 項目 | 說明 |
|------|------|
| `effectiveAttack` | `baseTk + bonusAtk` + `attack_bonus_after_move`（若 moveCount > 0，但實際不可達，見備注） + 軍團被動加成 |
| `enemyAttackDebuff` | 目標區域內敵方首領/軍團的 `enemy_attack_debuff` 光環加總 |
| `supportDamage` | 同區域的**其他**友軍（state=normal）的協助力（effectiveSupport）加總 |
| `battle_cry` 旗標 | 本回合 `turnFlags[player].battle_cry == true` → 傷害 +2 |

**協助力（effectiveSupport）**：
```
effectiveSupport = totalSupport(l) + zoneAllySupportAura + 軍團 support_bonus 加成
```

### 8.2 傷害減免（防守方）

按順序套用：

1. **戰術卡觸發**（`on_receive_damage`）：可將傷害改為 0 或降低（見戰術卡表）
2. **damage_reduction 被動**（首領）：傷害 -N，最少 1
3. **ally_damage_reduction 光環**（同區域友軍）：傷害 -N，最少 1
4. **divine_blessing 旗標**：受到傷害 -1，最少 1

### 8.3 傷害結果判定

最終傷害與防守方**總堅韌（totalToughness）**比較：

| 條件 | 結果 |
|------|------|
| damage ≥ 2 × totalToughness | **KO**（擊敗） |
| damage ≥ totalToughness | **stunned**（暈眩） |
| damage < totalToughness | **no_effect**（無效） |

> 這是**一次性判定**，不累積傷害。每次攻擊獨立計算。

### 8.4 直接傷害（applyDirectDamage）

某些能力（被動反擊、戰術卡、事件卡）造成「直接傷害」：
- 不觸發 `on_receive_damage` 戰術卡
- 不觸發 `on_stunned` 戰術卡（防止遞迴）
- 但仍會觸發 `on_ko`

---

## 9. 首領狀態系統

| 狀態 | 說明 |
|------|------|
| `normal` | 正常，可移動、行動 |
| `stunned` | 暈眩，**不可移動、不可行動**；在對手 battle→react 轉換時自動恢復 |
| `ko` | 擊敗，移回己方基地，所有軍團卡/戰術卡丟入墓地；開始倒計時 |
| `reviving` | 復活中（koTurnCount 達到 reviveTime）；下回合準備階段恢復為 normal |

### KO 倒計時

```
ko → (每回合 koTurnCount++) → koTurnCount >= reviveTime → reviving → 下一準備階段 → normal
```

復活時間依職業：

| 職業 | reviveTime（需等待的回合數） |
|------|------------------------------|
| 守護者（guardian） | **1** 回合 |
| 征服者（conqueror） / 指揮官（commander） | **2** 回合 |
| 破壞者（destroyer） | **3** 回合 |

### 禁錮（immobilized）

- 事件卡「冰凍」、某些技能可設置
- 首領無法移動（canMove 回傳 err）
- 在己方下一回合**準備階段自動解除**

---

## 10. 勝利條件

| 觸發 | 說明 |
|------|------|
| `cityWalls <= 0`（任一基地）| 攻入基地攻城方勝利 |
| 投降（SURRENDER） | 對手勝利 |
| 超過 100 回合 | 以場面分數判定：城牆 ×10 + 在場首領 ×3 + fortLevel ×1 |

---

## 11. 卡牌系統

### 牌組機制

- 每回合準備階段抽 **2 張牌**
- 牌組耗盡時，墓地洗牌（seeded shuffle）成為新牌組
- 手牌沒有上限（引擎層）

### 三種手牌卡類型

| 類型 | 打出時機 | 使用後 |
|------|----------|--------|
| 軍團卡（Legion） | 主要階段（SUMMON_LEGION） | 附加在首領身上 → KO 時移入墓地 |
| 事件卡（Event） | 主要階段（PLAY_EVENT） | 本身 + 棄牌費 → 墓地 |
| 戰術卡（Tactical） | 反應階段（INSTALL_TACTICAL） | 安裝在首領身上，觸發後 → 墓地 |

> 注意：`data/buildings.ts` 中的建築卡在引擎中**尚未實作**，不進入牌組。

---

## 12. 首領一覽

每位玩家隨機從以下 12 名首領中，各職業選 1 人（共 3 人）。
引擎使用的屬性為 `baseToughness`、`baseAttack`、`baseSupport`（= `baseOffensiveSupport`）。

> `reviveTime` 由職業決定（guardian=1, destroyer=3, 其餘=2）。

### 破壞者（Destroyer）— reviveTime=3

| ID | 名稱 | 韌性 | 攻擊 | 協助 | 引擎被動 |
|----|------|------|------|------|---------|
| `fire_dragon_girl` | 炎龍娘 | 8 | 4 | 2 | 無（passive.effect 未定義） |
| `golem_girl` | 哥雷姆娘 | 10 | 3 | 1 | 無（passive.effect 未定義） |
| `minotaur_girl` | 牛頭人娘 | 9 | 4 | 2 | `attack_bonus_after_move: +2`（※見備注） |

### 征服者（Conqueror）— reviveTime=2

| ID | 名稱 | 韌性 | 攻擊 | 協助 | 引擎被動 |
|----|------|------|------|------|---------|
| `harpy_girl` | 哈比娘 | 6 | 3 | 3 | `ignore_fortification`（移動無視築城） |
| `centaur_girl` | 半人馬娘 | 7 | 3 | 2 | `double_move`（可連移 2 次） |
| `werewolf_girl` | 狼人娘 | 7 | 4 | 2 | `on_ko_or_stun_draw: 1`（暈/KO 敵人時抽 1 張） |

### 指揮官（Commander）— reviveTime=2

| ID | 名稱 | 韌性 | 攻擊 | 協助 | 引擎被動 |
|----|------|------|------|------|---------|
| `lamia_girl` | 拉米亞娘 | 6 | 2 | 3 | 無（passive.effect 未定義） |
| `succubus_girl` | 魅魔蝙蝠娘 | 5 | 2 | 3 | 無（passive.effect 未定義） |
| `kitsune_girl` | 妖狐娘 | 6 | 2 | 3 | `on_ko_or_stun_draw: 1`（暈/KO 敵人時抽 1 張） |

### 守護者（Guardian）— reviveTime=1

> 目前隨機選隊不包含 guardian（`randomLeaderSelection` 僅選 destroyer/conqueror/commander）。建築卡整合後預計加入。

| ID | 名稱 | 韌性 | 攻擊 | 協助 | 引擎被動 |
|----|------|------|------|------|---------|
| `mermaid_girl` | 人魚娘 | 7 | 1 | 1 | 無（passive.effect 未定義） |
| `slime_girl` | 史萊姆娘 | 8 | 1 | 1 | 無（passive.effect 未定義） |
| `dryad_girl` | 樹精娘 | 7 | 1 | 1 | 無（passive.effect 未定義） |

---

## 13. 軍團卡一覽

軍團卡附加在首領身上提供屬性加成，每位首領最多 **2 張**。
引擎只使用 `bonusToughness`、`bonusAttack`、`bonusSupport`（= offensiveSupport）。

| ID | 名稱 | +韌性 | +攻擊 | +協助 | 引擎被動 |
|----|------|-------|-------|-------|---------|
| `dragon_whelp` | 幼龍 | +2 | +2 | +1 | `enemy_attack_debuff: 1`（裝備者同區域敵人攻擊 -1） |
| `goblin_squad` | 哥布林小隊 | +1 | +1 | +1 | 無 |
| `orc_warrior` | 獸人戰士 | +2 | +2 | +1 | 無 |
| `skeleton_archer` | 骷髏弓手 | +1 | +1 | +2 | 無 |
| `dark_elf_assassin` | 暗精靈刺客 | +1 | +2 | +2 | 無（data 中有 passive 但 mapLegionPassive 未識別） |
| `fairy_mage` | 妖精法師 | +1 | +1 | +2 | 無 |
| `witch_apprentice` | 見習魔女 | +1 | +1 | +2 | `enemy_attack_debuff: 1`（裝備者同區域敵人攻擊 -1） |
| `dwarf_guard` | 矮人守衛 | +2 | +0 | +0 | 無 |
| `treant_sapling` | 樹人幼苗 | +2 | +0 | +0 | 無 |
| `angel_healer` | 天使治療師 | +1 | +0 | +1 | 無 |

---

## 14. 事件卡一覽

主要階段打出，消耗事件卡本身 + 棄牌費。

| ID | 名稱 | 棄牌費 | 引擎實際效果 |
|----|------|--------|------------|
| `forced_march` | 強行軍 | 0 | 選 1 名己方首領，移動至任意非當前區域 |
| `draw_cards` | 戰術規劃 | 0 | 抽 2 張牌 |
| `rush_time` | RUSH TIME | 0 | 抽 5 張牌 + 清除所有己方首領暈眩 + 所有技能冷卻重置為 0 |
| `tactical_retreat` | 戰術撤退 | 1 | 選 1 名己方首領移回己方基地，觸發 applyRecover(2) |
| `battle_cry` | 戰吼 | 1 | 本回合設置 `battle_cry` 旗標（攻擊 +2） |
| `divine_blessing` | 神聖祝福 | 1 | 設置 `divine_blessing` 旗標（受傷 -1）+ 對所有己方首領 applyRecover(2) |
| `freeze` | 冰凍 | 1 | 選 1 名敵方首領設置 `immobilized`（下回合準備解除） |
| `ambush` | 埋伏 | 1 | 對 1 名敵方首領造成直接傷害 4 + 擊退 1 格（朝其己方基地方向） |
| `emergency_repair` | 緊急修復 | 1 | 己方基地 `fortLevel +1`（上限 2） + 己方基地內首領 applyRecover(1) |
| `mass_stun` | 群體暈眩 | 2 | 選 1 個區域，該區域所有敵方首領（state=normal）→ stunned |

> **applyRecover 說明**：
> - 目標是 `stunned` → 解除暈眩
> - 目標是 `ko` → `koTurnCount -= amount`（加速復活）
> - 目標是 `normal` → 只記錄事件（此系統無 HP 概念）

---

## 15. 戰術卡一覽

反應階段安裝在首領身上，條件觸發後自動使用並丟棄。每位首領最多持有 1 張。

### 觸發時機：on_receive_damage（受到攻擊時）

| ID | 名稱 | 效果（引擎實作） | 適用職業 |
|----|------|----------------|---------|
| `dodge` | 閃避 | 將傷害改為 **0** + 抽 1 張牌 | 全部 |
| `counter_strike` | 反擊打擊 | 對第一位攻擊者造成直接傷害 **3**（傷害不減少） | 破壞者 |
| `agile` | 靈動 | `bonusToughness +4` + `moveCount = 0`（可再移動） | 征服者 |
| `tactical_retreat_reaction` | 戰術撤退 | 傷害 **-2** + 同區域友軍 `bonusToughness +2` | 指揮官 |
| `iron_body` | 鋼鐵之軀 | 傷害 **-4** + 所在區域（非 plaza）`fortLevel +1`（上限 2） | 守護者 |
| `guardian_shield` | 守護之盾 | 傷害 **-2** + 同區域友軍 `bonusToughness +2` | 守護者 |

### 觸發時機：on_stunned（進入暈眩時）

| ID | 名稱 | 效果（引擎實作） | 適用職業 |
|----|------|----------------|---------|
| `mutual_destruction` | 玉石俱焚 | 對第一位攻擊者造成直接傷害 **5** | 全部 |

### 觸發時機：on_ko（被 KO 時）

| ID | 名稱 | 效果（引擎實作） | 適用職業 |
|----|------|----------------|---------|
| `calm_thinking` | 冷靜思考 | 抽 **3** 張牌 | 全部 |

### 觸發時機：on_enemy_enter_zone（敵人進入同區域時）

| ID | 名稱 | 效果（引擎實作） | 適用職業 |
|----|------|----------------|---------|
| `intimidate` | 威嚇 | 對進入者造成直接傷害 **4** | 征服者 |

### 觸發時機：on_enemy_clear_brick（敵人清磚時）

| ID | 名稱 | 效果（引擎實作） | 適用職業 |
|----|------|----------------|---------|
| `block` | 阻擋 | **無效化**此次清磚 + 抽 1 張牌 | 全部 |

> **注意**：每次觸發只消耗 1 張戰術卡（第一個符合條件的首領觸發）。
> `data/reactions.ts` 中的 `suitableClass` 僅為 UI 分類，引擎並不強制職業限制。

---

## 16. 被動能力總表

### 首領被動（LeaderPassive）

| 類型 | 說明 | 持有者 |
|------|------|--------|
| `counter_damage` | 被攻擊（非 KO 時）後反擊攻擊者 N 直接傷害 | （預留，目前無首領定義） |
| `damage_reduction` | 受到傷害 -N（最少 1） | （預留，目前無首領定義） |
| `ignore_fortification` | 移動時無視敵方 fortLevel | 哈比娘 |
| `double_move` | battle phase 可移動 2 次 | 半人馬娘 |
| `attack_bonus_after_move` | 移動後攻擊 +N（※但移動後不可攻擊，實際不生效） | 牛頭人娘 |
| `ally_support_buff` | 同區域友軍協助力 +N（光環） | （預留，目前無首領定義） |
| `ally_damage_reduction` | 同區域友軍受傷 -N（光環） | （預留，目前無首領定義） |
| `enemy_attack_debuff` | 同區域敵首領攻擊 -N | （預留，目前無首領定義） |
| `splash_damage` | 攻擊時對目標同區域其他敵首領造成 N 直接傷害 | （預留，目前無首領定義） |
| `on_ko_or_stun_draw` | 擊暈或 KO 敵首領時抽 N 張牌 | 狼人娘、妖狐娘 |

### 軍團被動（LegionPassive）

| 類型 | 說明 | 持有者 |
|------|------|--------|
| `enemy_attack_debuff` | 裝備者所在區域的敵首領攻擊 -N | 幼龍、見習魔女（各 -1） |
| `attack_bonus_if_leader_tag` | 首領擁有特定 tag 時攻擊 +N | （預留） |
| `support_bonus_if_leader_tag` | 首領擁有特定 tag 時協助 +N | （預留） |
| `damage_reduction_if_leader_tag` | 首領擁有特定 tag 時減傷 +N | （預留） |
| `siege_damage_bonus` | 攻城傷害 +N | （預留） |
| `all_stats_if_leader_elemental` | 首領有元素 tag 時全屬性 +N | （預留） |

---

## 17. 已知限制與設計備注

1. **`attack_bonus_after_move` 被動永遠不生效**
   引擎要求 `moveCount == 0` 才能攻擊，但此被動需要 `moveCount > 0`。兩條件互斥，牛頭人娘的被動目前是死規則。

2. **個人技能未實作**
   `data/leaders.ts` 中每位首領有個性化的 `skill` 描述，但引擎統一以職業技能（Warcry/Charge/Rally/Fortify）實作。

3. **守護者不加入隊伍**
   `randomLeaderSelection` 只從 destroyer/conqueror/commander 各選 1 人（共 3 名），守護者目前不會被選入。

4. **建築卡未實作**
   `data/buildings.ts` 有 6 張建築卡，但 `makeDefaultDeck` 不包含它們，引擎也無對應 action。

5. **`battle_cry` 清磚加成未實作**
   旗標說明為「攻擊+2、清磚+1」，但 `applyClearFort` 中沒有讀取此旗標的邏輯。僅攻擊時的 +2 有效。

6. **`agile` 的 `bonusToughness +4` 為暫時性加成**
   加到 `bonusToughness` 後不會自動還原，需設計修正。

7. **軍團卡 defensiveSupport 未使用**
   `cards.ts` 的 `LegionCardDef` 只記錄 `bonusSupport = offensiveSupport`，`defensiveSupport` 欄位在資料轉換時被捨棄。

8. **applyRecover 在「無 HP」系統下的語義**
   此遊戲沒有 HP 條，`applyRecover` 實際效果：解暈眩 / 縮短 KO 倒計時 / 對 normal 首領無實質效果（只發 event）。

---

*以引擎原始碼為準，說明書將隨引擎更新維護。*
