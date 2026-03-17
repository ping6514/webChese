# Attack Resolve 規格

## 目的

本文件定義 `app2` MVP 戰鬥中單次攻擊的最小結算流程。

目標是讓以下語言先固定：

- 主攻擊類別：`slash` / `pierce` / `impact` / `arcane`
- 附加元素語言：`none` / `fire` / `ice` / `lightning` / `wind` / `light` / `shadow`
- 相對方位：`front_core` / `front_flank` / `rear`
- 正面減傷、背刺、抗性、一次性防禦的套用順序

---

## 一、單次攻擊輸入

一次攻擊至少需要以下輸入：

- `attacker`
- `target`
- `baseDamage`
- `damageType`
- `elementType`
- `attackClass`
- `isProjectile`
- `canBackstab`
- `elementDamageRatio`
- `statusPayload`（可空）

其中：

- `damageType` 決定主對位與主抗性
- `elementType` 決定附加元素語言與元素附傷
- `attackClass` 決定投射物 / 區域 / 吐息 / 近戰等規則差異

---

## 二、結算順序

MVP 第一版採固定順序：

1. **合法性檢查**
   - 目標是否存在
   - 目標是否存活
   - 是否在攻擊形狀 / 射程 / LOS 內

2. **目標改寫**
   - 若有 `protect` / `intercept`，先決定最後承傷目標
   - 投射物可被正面攔截或障礙阻擋

3. **相對方位判定**
   - 依目標 `facing` 與攻擊來源位置求出：
     - `front_core`
     - `front_flank`
     - `rear`
   - 第一版先用預設扇區模板
   - 未來可擴充為特殊兵種的自定義模板

4. **一次性防禦判定**
   - `evadeNextHit`
   - `evadeNextProjectile`
   - `negateNextDamage`
   - 若被完全取消，本次直接結束

5. **基礎主傷害計算**
   - 以 `baseDamage` 作為基礎
   - 乘上攻擊方的 `damageMult` 與對應 `slash/pierce/impact/arcaneDamageMult`

6. **正面減傷 / 背刺修正**
   - `front_core`：套 `frontCoreDamageReduction`
   - `front_flank`：套 `frontFlankDamageReduction`
   - `rear`：不吃正面減傷
   - 若允許背刺且命中 `rear`，再套 `onBackHitDamageBonus`

7. **主傷害抗性 / 易傷**
   - 主傷害吃：
     - `slashResist`
     - `pierceResist`
     - `impactResist`
     - `arcaneResist`
   - 再吃對應 `Expose` 與通用 `Vulnerable`

8. **元素附加傷害**
   - 若 `elementType !== none` 且 `elementDamageRatio > 0`
   - 以 `baseDamage × elementDamageRatio` 建立元素附加段
   - 附加段吃對應元素抗性：
     - `fireResist`
     - `iceResist`
     - `lightningResist`
     - `windResist`
     - `lightResist`
     - `shadowResist`

9. **最終修正**
   - 套 `reduceNextHitBy`
   - 最終傷害不低於 `0`
   - 向上取整或四捨五入由引擎統一決定

10. **扣血與附加效果**
   - 扣除 HP
   - 若有 `statusPayload`，再做狀態積蓄或狀態施加
   - 若造成死亡，發出 `UNIT_DIED`

---

## 三、相對方位定義

MVP 第一版先使用預設模板：

- `front_core`：面朝方向正前方 1 格
- `front_flank`：面朝方向左右相鄰 2 格
- `rear`：其餘 3 格

這代表：

- `front_core` 吃最高的正面減傷
- `front_flank` 吃次級正面減傷
- `rear` 不吃正面減傷，並可作為背刺方向

未來若有特殊兵種，可覆寫成其他模板，例如：

- 背面只有 1 格
- 側面有 4 格

---

## 四、主攻擊類別與元素語言

### 主攻擊類別

- `slash`
- `pierce`
- `impact`
- `arcane`

用途：

- 對應主傷害抗性
- 對應 `Expose Slash / Pierce / Impact`
- `arcane` 承接暫時無法自然歸入三種物理對位的攻擊，例如吐息、咒爆、靈壓衝擊

### 附加元素語言

- `none`
- `fire`
- `ice`
- `lightning`
- `wind`
- `light`
- `shadow`

用途：

- 定義附加傷害語言
- 定義附加狀態語言
- 不取代主攻擊類別

---

## 五、元素附加傷害原則

元素可以直接造成 HP 傷害。

但第一版不把元素視為獨立主攻擊類別，而是視為附加傷害層。

範例：

- `裂牙突進`
  - 主傷害：`pierce`
  - 元素：`none`
- `焰羽墜爆`
  - 主傷害：`arcane`
  - 元素：`fire`
- `裂響羽矢`
  - 主傷害：`pierce`
  - 元素：`wind`

---

## 六、一次性防禦原則

MVP 第一版優先支援下列防禦效果，而不是常駐高權重閃避率：

- `evadeNextHit`
- `evadeNextProjectile`
- `negateNextDamage`
- `reduceNextHitBy`

這些效果應在主傷害結算前判定，讓玩家能透過主動技能或工具做穩定的戰術防禦。

---

## 七、第一版暫不處理

以下內容暫不作為 MVP 第一版必要條件：

- 常駐 `accuracy vs evasion`
- 多段複合 damage component 疊太多層
- 特殊兵種自定義 facing profile 的完整編輯器
- 完整投射物物件模擬

---

## 八、後續實作順序

1. `src/engine/damage.ts`
2. `src/engine/actions.ts`
3. `src/engine/reduce.ts`
4. `src/components` 顯示相對方位與最終傷害
