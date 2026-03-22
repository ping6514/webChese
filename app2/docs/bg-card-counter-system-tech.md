# BG 卡片遊戲 - 反擊系統技術實作

**版本**：2.1  
**更新日期**：2026-03-21  
**主題**：反擊機制技術架構與實作細節

---

## 📊 技術架構

### 資料結構設計

```typescript
// 技能定義
type Skill = {
  id: string
  name: string
  
  // 基本屬性
  cost: Cost  // 主動使用消耗
  cooldown: number  // 主動使用冷卻
  effects: Effect[]
  condition?: Condition
  
  // ⭐ 反擊屬性（獨立參數）
  canCounter: boolean  // 是否可以反擊
  counterCost?: Cost  // 反擊消耗（獨立設定）
  counterCooldown?: number  // 反擊冷卻（獨立設定）
}

// 消耗定義
type Cost = {
  tech?: number  // 技能牌數量
  any?: number   // 任意牌數量
}

// BG 實例
type BGInstance = {
  id: string
  cardId: string
  zone: ZoneId
  state: 'normal' | 'stunned' | 'ko'
  toughness: number
  
  // 技能冷卻
  skill1Cooldown: number
  skill2Cooldown: number
  
  reactionCard: ReactionCard | null
  hasActed: boolean
}
```

---

## 🔧 核心函數實作

### 1. 獲取可反擊的技能

```typescript
function getCounterableSkills(bg: BGInstance): Skill[] {
  const skills: Skill[] = []
  
  // 檢查技能 1
  const skill1 = getSkillDefinition(bg.cardId, 1)
  if (skill1.canCounter && canUseSkillForCounter(bg, skill1, 1)) {
    skills.push(skill1)
  }
  
  // 檢查技能 2
  const skill2 = getSkillDefinition(bg.cardId, 2)
  if (skill2.canCounter && canUseSkillForCounter(bg, skill2, 2)) {
    skills.push(skill2)
  }
  
  return skills
}

function canUseSkillForCounter(
  bg: BGInstance, 
  skill: Skill, 
  skillNum: 1 | 2
): boolean {
  // 1. 檢查冷卻
  const cd = skillNum === 1 ? bg.skill1Cooldown : bg.skill2Cooldown
  if (cd > 0) return false
  
  // 2. 檢查手牌（使用反擊消耗）
  const cost = skill.counterCost || skill.cost
  if (!hasEnoughCards(bg.owner.hand, cost)) return false
  
  // 3. 反擊可以在暈眩狀態使用（如果技能允許）
  // 不需要檢查 bg.state
  
  // 4. 檢查技能條件（如果有）
  if (skill.condition && !skill.condition(gameState, bg)) {
    return false
  }
  
  return true
}
```

---

### 2. 執行反擊

```typescript
async function executeCounter(
  bg: BGInstance, 
  skillNum: 1 | 2, 
  discardedCards: CardId[]
): Promise<{ success: boolean, skillName: string }> {
  const skill = getSkillDefinition(bg.cardId, skillNum)
  
  // 1. 驗證消耗（使用反擊消耗）
  const cost = skill.counterCost || skill.cost
  if (!validateCost(discardedCards, cost)) {
    return { success: false, skillName: skill.name }
  }
  
  // 2. 支付消耗
  discardCards(bg.owner.hand, discardedCards)
  bg.owner.graveyard.push(...discardedCards)
  
  // 3. 執行技能效果
  await executeSkillEffects(skill.effects, bg)
  
  // 4. 設置冷卻（使用反擊冷卻）
  const cooldown = skill.counterCooldown || (skill.cooldown + 1)
  if (skillNum === 1) {
    bg.skill1Cooldown = cooldown
  } else {
    bg.skill2Cooldown = cooldown
  }
  
  // 5. 記錄日誌
  addLog(`⚔️ ${bg.name} 使用技能「${skill.name}」反擊！`)
  
  return { success: true, skillName: skill.name }
}
```

---

### 3. 完整的對敵流程（含反擊）

```typescript
async function executeAttack(
  attacker: BG, 
  target: BG, 
  baseDamage: number
): Promise<void> {
  // ===== 階段 1：計算基礎傷害 =====
  let finalDamage = baseDamage
  let cancelled = false
  
  // ===== 階段 2：檢查反擊技能 =====
  const counterSkills = getCounterableSkills(target)
  
  if (counterSkills.length > 0 && !cancelled) {
    // 詢問玩家是否要反擊
    const counterChoice = await askPlayerCounter(target.owner, {
      skills: counterSkills,
      incomingDamage: finalDamage,
      timeout: 30000  // 30 秒決定
    })
    
    if (counterChoice.useCounter) {
      // ⭐ 執行反擊
      const result = await executeCounter(
        target, 
        counterChoice.skillNum, 
        counterChoice.discardedCards
      )
      
      if (result.success) {
        // 反擊成功 → 閃避傷害
        cancelled = true
        finalDamage = 0
        
        addLog(`🛡️ ${target.name} 發動反擊「${result.skillName}」！閃避了攻擊！`)
      }
    }
  }
  
  // ===== 階段 3：檢查反應卡 =====
  if (!cancelled && target.reactionCard) {
    const reaction = target.reactionCard
    
    // 檢查是否可以觸發
    if (canTriggerReaction(reaction, 'BEFORE_DAMAGE') && 
        !reaction.triggeredThisTurn) {
      
      // 詢問玩家是否發動反應卡
      const shouldActivate = await askPlayerReaction(target.owner, {
        reactionCard: reaction,
        incomingDamage: finalDamage,
        timeout: 30000
      })
      
      if (shouldActivate) {
        // 執行反應卡效果
        const reactionResult = await executeReaction(reaction, {
          type: 'BEFORE_DAMAGE',
          target: target.id,
          damage: finalDamage
        })
        
        if (reactionResult.cancelled) {
          cancelled = true
          finalDamage = 0
        } else {
          finalDamage = reactionResult.modifiedDamage || finalDamage
        }
        
        // 標記已觸發
        reaction.triggeredThisTurn = true
      }
    }
  }
  
  // ===== 階段 4：執行傷害 =====
  if (!cancelled && finalDamage > 0) {
    applyDamage(target, finalDamage)
    
    addLog(`⚔️ ${attacker.name} 對 ${target.name} 造成 ${finalDamage} 點傷害`)
    
    // 檢查是否暈眩/KO
    checkBGState(target)
  } else if (cancelled) {
    addLog(`🛡️ ${target.name} 閃避了攻擊！`)
  }
  
  // ===== 階段 5：攻擊後事件 =====
  await processEvent({
    type: 'AFTER_DAMAGE',
    target: target.id,
    finalDamage: finalDamage
  })
}
```

---

### 4. 詢問玩家是否反擊（UI）

```typescript
async function askPlayerCounter(
  playerId: string,
  options: {
    skills: Skill[]
    incomingDamage: number
    timeout: number
  }
): Promise<{
  useCounter: boolean
  skillNum?: 1 | 2
  discardedCards?: CardId[]
}> {
  return new Promise((resolve) => {
    // 設置超時
    const timeoutId = setTimeout(() => {
      closeDialog()
      resolve({ useCounter: false })
    }, options.timeout)
    
    // 顯示 UI 對話框
    showCounterDialog({
      title: '⚠️ 受到攻擊！',
      message: `即將受到 ${options.incomingDamage} 點傷害`,
      skills: options.skills.map(skill => ({
        name: skill.name,
        cost: skill.counterCost || skill.cost,
        cooldown: skill.counterCooldown || (skill.cooldown + 1),
        effects: skill.effects
      })),
      
      onConfirm: (skillNum: 1 | 2, cards: CardId[]) => {
        clearTimeout(timeoutId)
        closeDialog()
        resolve({
          useCounter: true,
          skillNum,
          discardedCards: cards
        })
      },
      
      onCancel: () => {
        clearTimeout(timeoutId)
        closeDialog()
        resolve({ useCounter: false })
      }
    })
  })
}
```

---

## 🎨 UI 設計

### 反擊對話框 Vue 組件

```vue
<template>
  <div v-if="show" class="counter-dialog-overlay">
    <div class="counter-dialog">
      <div class="header">
        <h3>⚠️ 受到攻擊！</h3>
        <div class="damage-warning">
          即將受到 <span class="damage">{{ incomingDamage }}</span> 點傷害
        </div>
      </div>
      
      <div class="timer">
        <div class="timer-bar" :style="{ width: timerPercent + '%' }"></div>
        <span>{{ timeLeft }}s</span>
      </div>
      
      <div class="skills">
        <div 
          v-for="skill in skills" 
          :key="skill.name"
          class="skill-option"
          @click="selectSkill(skill)"
        >
          <h4>{{ skill.name }}</h4>
          <div class="cost">
            消耗：
            <span v-if="skill.cost.tech">技*{{ skill.cost.tech }}</span>
            <span v-if="skill.cost.any">任*{{ skill.cost.any }}</span>
          </div>
          <div class="cooldown">
            冷卻：{{ skill.cooldown }} 回合（反擊懲罰）
          </div>
          <div class="effects">
            <div v-for="effect in skill.effects" :key="effect.type">
              {{ formatEffect(effect) }}
            </div>
            <div class="highlight">✨ 閃避這次傷害</div>
          </div>
        </div>
      </div>
      
      <div v-if="selectedSkill" class="card-selection">
        <h4>選擇要捨棄的手牌：</h4>
        <div class="hand-cards">
          <div 
            v-for="card in hand" 
            :key="card.id"
            class="card"
            :class="{ selected: isCardSelected(card.id) }"
            @click="toggleCard(card.id)"
          >
            {{ card.name }}
          </div>
        </div>
        <div class="selected-count">
          已選擇：{{ selectedCards.length }} / {{ requiredCards }}
        </div>
      </div>
      
      <div class="actions">
        <button 
          @click="confirm" 
          :disabled="!canConfirm"
          class="btn-confirm"
        >
          發動反擊
        </button>
        <button @click="cancel" class="btn-cancel">
          放棄
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
  incomingDamage: number
  skills: Skill[]
  hand: Card[]
  timeout: number
}>()

const emit = defineEmits<{
  confirm: [skillNum: 1 | 2, cards: CardId[]]
  cancel: []
}>()

const selectedSkill = ref<Skill | null>(null)
const selectedCards = ref<CardId[]>([])
const timeLeft = ref(props.timeout / 1000)
const timerPercent = computed(() => (timeLeft.value / (props.timeout / 1000)) * 100)

let timerId: number

onMounted(() => {
  // 倒數計時
  timerId = setInterval(() => {
    timeLeft.value -= 0.1
    if (timeLeft.value <= 0) {
      cancel()
    }
  }, 100)
})

onUnmounted(() => {
  clearInterval(timerId)
})

function selectSkill(skill: Skill) {
  selectedSkill.value = skill
  selectedCards.value = []
}

function toggleCard(cardId: CardId) {
  const index = selectedCards.value.indexOf(cardId)
  if (index >= 0) {
    selectedCards.value.splice(index, 1)
  } else {
    selectedCards.value.push(cardId)
  }
}

function isCardSelected(cardId: CardId): boolean {
  return selectedCards.value.includes(cardId)
}

const requiredCards = computed(() => {
  if (!selectedSkill.value) return 0
  const cost = selectedSkill.value.cost
  return (cost.tech || 0) + (cost.any || 0)
})

const canConfirm = computed(() => {
  return selectedSkill.value && 
         selectedCards.value.length === requiredCards.value
})

function confirm() {
  if (!canConfirm.value || !selectedSkill.value) return
  
  const skillNum = props.skills.indexOf(selectedSkill.value) + 1 as 1 | 2
  emit('confirm', skillNum, selectedCards.value)
}

function cancel() {
  emit('cancel')
}
</script>

<style scoped>
.counter-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.counter-dialog {
  background: #2a2a2a;
  border: 3px solid #ff6b6b;
  border-radius: 12px;
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 0 30px rgba(255, 107, 107, 0.5);
}

.header h3 {
  color: #ff6b6b;
  margin: 0 0 12px 0;
  font-size: 24px;
}

.damage-warning {
  color: #fff;
  font-size: 18px;
}

.damage {
  color: #ff6b6b;
  font-weight: bold;
  font-size: 24px;
}

.timer {
  margin: 16px 0;
  background: #444;
  border-radius: 8px;
  height: 24px;
  position: relative;
  overflow: hidden;
}

.timer-bar {
  background: linear-gradient(90deg, #4ecdc4, #44a08d);
  height: 100%;
  transition: width 0.1s linear;
}

.timer span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-weight: bold;
}

.skill-option {
  background: #333;
  border: 2px solid #555;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  cursor: pointer;
  transition: all 0.2s;
}

.skill-option:hover {
  border-color: #4ecdc4;
  transform: translateY(-2px);
}

.skill-option h4 {
  color: #4ecdc4;
  margin: 0 0 8px 0;
}

.cost, .cooldown {
  color: #aaa;
  font-size: 14px;
  margin: 4px 0;
}

.effects {
  margin-top: 8px;
  color: #fff;
}

.highlight {
  color: #ffd93d;
  font-weight: bold;
  margin-top: 8px;
}

.card-selection {
  margin: 16px 0;
}

.hand-cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 12px 0;
}

.card {
  background: #444;
  border: 2px solid #666;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.card:hover {
  border-color: #4ecdc4;
}

.card.selected {
  background: #4ecdc4;
  border-color: #4ecdc4;
  color: #000;
}

.selected-count {
  color: #aaa;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.btn-confirm, .btn-cancel {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm {
  background: #4ecdc4;
  color: #000;
}

.btn-confirm:hover:not(:disabled) {
  background: #44a08d;
}

.btn-confirm:disabled {
  background: #555;
  color: #888;
  cursor: not-allowed;
}

.btn-cancel {
  background: #ff6b6b;
  color: #fff;
}

.btn-cancel:hover {
  background: #ee5a52;
}
</style>
```

---

## 📊 技能定義範例

```typescript
// 小橘技能 2：午餐時間
const skill_xiaoju_2: Skill = {
  id: 'xiaoju_skill2',
  name: '午餐時間',
  
  // 主動使用
  cost: { tech: 1 },
  cooldown: 2,
  
  // ⭐ 反擊設定（獨立參數）
  canCounter: true,
  counterCost: { tech: 1, any: 2 },  // 額外消耗 2 張任意牌
  counterCooldown: 3,  // 反擊後冷卻 3 回合
  
  effects: [
    { type: 'ADD_TOUGHNESS', target: 'self', amount: 4, duration: 1 },
    { type: 'RECOVER_FROM_STUN', target: 'self' }
  ],
  
  condition: null  // 暈眩狀態也可使用
}

// 其阿莫技能 2：忌妒
const skill_qiamuo_2: Skill = {
  id: 'qiamuo_skill2',
  name: '忌妒',
  
  // 主動使用
  cost: { tech: 1 },
  cooldown: 2,
  
  // ⭐ 反擊設定（獨立參數）
  canCounter: true,
  counterCost: { tech: 1, any: 1 },  // 額外消耗 1 張任意牌
  counterCooldown: 3,  // 反擊後冷卻 3 回合
  
  effects: [
    { type: 'ADD_TOUGHNESS', target: 'self', amount: 2, duration: 1 },
    { type: 'DAMAGE', target: 'enemy_in_zone', amount: 3, count: 1 },
    { type: 'CLEAR_BRICK', zone: 'current', count: 1 }
  ]
}

// 小白技能 1：穿刺炸彈（不可反擊）
const skill_xiaobai_1: Skill = {
  id: 'xiaobai_skill1',
  name: '穿刺炸彈',
  
  cost: { any: 1 },
  cooldown: 1,
  
  // ⭐ 不可反擊
  canCounter: false,
  
  effects: [
    { type: 'CLEAR_BRICK', zone: 'enemy_castle', count: 1 },
    { type: 'CLEAR_BRICK', zone: 'enemy_plaza', count: 1 }
  ],
  
  condition: (state, bg) => bg.zone !== 'my_castle'
}
```

---

## 🧪 測試案例

### 測試 1：基本反擊流程

```typescript
test('基本反擊流程', async () => {
  // 1. 設置場景
  const attacker = createBG('xiaobai')
  const target = createBG('xiaoju')
  target.skill2Cooldown = 0  // 技能可用
  target.owner.hand = [
    createCard('tech'),
    createCard('any'),
    createCard('any')
  ]
  
  // 2. 執行攻擊
  const result = await executeAttack(attacker, target, 4)
  
  // 3. 模擬玩家選擇反擊
  mockPlayerChoice({
    useCounter: true,
    skillNum: 2,
    discardedCards: ['tech_1', 'any_1', 'any_2']
  })
  
  // 4. 驗證結果
  expect(target.toughness).toBe(target.baseToughness)  // 沒有受傷
  expect(target.skill2Cooldown).toBe(3)  // 反擊冷卻 3 回合
  expect(target.owner.hand.length).toBe(0)  // 手牌已消耗
  expect(target.owner.graveyard.length).toBe(3)  // 進入墓地
})
```

### 測試 2：反擊冷卻懲罰

```typescript
test('反擊冷卻懲罰', async () => {
  const bg = createBG('xiaoju')
  const skill = getSkillDefinition('xiaoju', 2)
  
  // 主動使用
  await useSkill(bg, 2, ['tech_1'])
  expect(bg.skill2Cooldown).toBe(2)  // 主動冷卻 2 回合
  
  // 重置
  bg.skill2Cooldown = 0
  
  // 反擊使用
  await executeCounter(bg, 2, ['tech_1', 'any_1', 'any_2'])
  expect(bg.skill2Cooldown).toBe(3)  // 反擊冷卻 3 回合（+1 懲罰）
})
```

### 測試 3：反擊消耗驗證

```typescript
test('反擊消耗驗證', async () => {
  const bg = createBG('xiaoju')
  bg.owner.hand = [createCard('tech')]  // 只有 1 張技能牌
  
  // 嘗試反擊（需要 技*1 + 任*2）
  const canCounter = canUseSkillForCounter(bg, getSkillDefinition('xiaoju', 2), 2)
  
  expect(canCounter).toBe(false)  // 手牌不足
})
```

---

## 📝 實作檢查清單

### Phase 1：資料結構（30 分鐘）
- [ ] 在 `Skill` 類型加入 `canCounter`, `counterCost`, `counterCooldown`
- [ ] 更新所有技能定義，標註哪些可以反擊
- [ ] 設定反擊消耗和冷卻參數

### Phase 2：核心邏輯（2 小時）
- [ ] 實作 `getCounterableSkills` 函數
- [ ] 實作 `canUseSkillForCounter` 函數
- [ ] 實作 `executeCounter` 函數
- [ ] 修改 `executeAttack` 函數，加入反擊檢查

### Phase 3：UI 組件（2 小時）
- [ ] 建立 `CounterDialog.vue` 組件
- [ ] 實作倒數計時器
- [ ] 實作技能選擇
- [ ] 實作手牌選擇
- [ ] 實作確認/取消按鈕

### Phase 4：整合測試（1 小時）
- [ ] 測試基本反擊流程
- [ ] 測試反擊冷卻懲罰
- [ ] 測試反擊消耗驗證
- [ ] 測試超時自動取消
- [ ] 測試與反應卡的優先級

---

## 🎯 總結

### 實作難度：⭐⭐⭐（中等）

**總開發時間**：約 5-6 小時

**關鍵設計**：
1. ✅ 反擊消耗為獨立參數（每個技能可自訂）
2. ✅ 反擊冷卻為獨立參數（預設 = 主動冷卻 + 1）
3. ✅ 反擊優先於反應卡檢查
4. ✅ 30 秒決定時間
5. ✅ 反擊成功閃避傷害

**平衡性**：
- 反擊消耗更高（額外代價）
- 反擊冷卻更長（+1 回合懲罰）
- 不是所有技能都能反擊
- 需要即時決定（壓力）

---

**版本**：2.1  
**最後更新**：2026-03-21  
**撰寫者**：AI Assistant (Cascade)
