# 魔物娘反應卡設計

## 📖 設計理念

反應卡是安裝在首領身上的防禦卡牌，在特定時機觸發以保護首領或反擊敵人。

### **核心概念**
- **反應卡** - 安裝在首領身上，在被攻擊或特定事件時觸發
- **觸發時機** - 受到對敵、進入暈眩、被清磚、敵人移動等
- **一次性效果** - 觸發後棄置（部分卡牌可能有多次觸發）
- **職業匹配** - 通用反應卡（ALL）+ 職業專屬反應卡

### **反應卡使用規則**
1. **安裝時機** - 在反應階段可以不限次數安裝反應卡
2. **安裝限制** - 1位首領最多安裝1張反應卡
3. **替換規則** - 安裝新反應卡時，舊反應卡棄置
4. **觸發規則** - 滿足觸發條件時，玩家可以選擇是否發動
5. **棄置規則** - 觸發後反應卡棄置（除非有特殊說明）

---

## 🎯 反應卡分類

### **1. 通用反應卡（ALL）**
- 所有職業都可以使用
- 基礎防禦和戰術效果

### **2. 破壞者反應卡（Destroyer）**
- 強化攻擊反擊
- 清磚相關效果

### **3. 征服者反應卡（Conqueror）**
- 移動相關反應
- 快速反擊

### **4. 指揮官反應卡（Commander）**
- 戰術性反應
- 削弱敵人

### **5. 守護者反應卡（Guardian）**
- 防禦強化
- 保護效果

---

## 📊 設計原則

### **觸發時機分類**

| 觸發時機 | 說明 | 適用反應卡 |
|---------|------|-----------|
| **受到對敵** | 被敵人攻擊時 | 閃避、誤導、靈動等 |
| **進入暈眩** | 堅韌歸0進入暈眩時 | 玉石俱焚、反擊等 |
| **進入擊敗** | 被擊敗時 | 冷靜思考、遺言等 |
| **被清磚** | 區域內敵人清磚時 | 阻擋、反制等 |
| **敵人移動** | 敵人移動進入區域時 | 威嚇、陷阱等 |

### **效果強度**

| 強度 | 效果類型 | 職業限制 |
|------|---------|---------|
| **基礎** | 抽牌、減傷 | 通用（ALL） |
| **中等** | 反擊、移動 | 通用或職業專屬 |
| **強力** | 無效化、大傷害 | 職業專屬 |

---

## 🛡️ 通用反應卡（ALL）

### **1. 閃避**
```typescript
{
  id: 'dodge',
  name: '閃避',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵判定時'
  },
  
  effect: {
    type: 'negate_damage',
    description: '那個對敵改為0，抽1張牌',
    actions: [
      {
        type: 'negate_damage',
        value: 'all',
        description: '那個對敵改為0'
      },
      {
        type: 'draw_card',
        value: 1,
        description: '抽1張牌'
      }
    ]
  },
  
  afterUse: 'discard'  // 使用後棄置
}
```
**參考舊版**：閃避

---

### **2. 冷靜思考**
```typescript
{
  id: 'calm_thinking',
  name: '冷靜思考',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_ko',
    description: '此首領進入擊敗狀態時'
  },
  
  effect: {
    type: 'draw_cards',
    description: '抽3張牌',
    actions: [
      {
        type: 'draw_card',
        value: 3,
        description: '抽3張牌'
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：冷靜思考

---

### **3. 阻擋**
```typescript
{
  id: 'block',
  name: '阻擋',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_enemy_clear_brick',
    description: '本首領區域內的敵首領進行「清磚動作」時'
  },
  
  effect: {
    type: 'negate_clear_brick',
    description: '無效那次清磚並抽1張牌',
    actions: [
      {
        type: 'negate_action',
        targetAction: 'clear_brick',
        description: '無效那次清磚'
      },
      {
        type: 'draw_card',
        value: 1,
        description: '抽1張牌'
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：阻擋

---

### **4. 玉石俱焚**
```typescript
{
  id: 'mutual_destruction',
  name: '玉石俱焚',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_stunned',
    description: '本首領進入暈眩狀態時'
  },
  
  effect: {
    type: 'counter_damage',
    description: '對區域內1位敵首領對敵5',
    actions: [
      {
        type: 'single_target_damage',
        value: 5,
        target: 'enemy_leader_in_zone',
        description: '對區域內1位敵首領對敵5'
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：玉石俱焚

---

### **5. 誤導**
```typescript
{
  id: 'mislead',
  name: '誤導',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到「對敵行動」時'
  },
  
  effect: {
    type: 'negate_and_clear',
    description: '那個對敵改為0，本區域清磚1',
    actions: [
      {
        type: 'negate_damage',
        value: 'all',
        description: '那個對敵改為0'
      },
      {
        type: 'clear_brick',
        value: 1,
        target: 'current_zone',
        description: '本區域清磚1'
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：誤導

---

### **6. 堅韌意志**
```typescript
{
  id: 'iron_will',
  name: '堅韌意志',
  type: 'reaction',
  suitableClass: ['all'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'reduce_damage',
    description: '本次對敵-3（最少0），抽1張牌',
    actions: [
      {
        type: 'reduce_damage',
        value: 3,
        minimum: 0,
        description: '本次對敵-3（最少0）'
      },
      {
        type: 'draw_card',
        value: 1,
        description: '抽1張牌'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

## 💥 破壞者反應卡（Destroyer）

### **7. 反擊打擊**
```typescript
{
  id: 'counter_strike',
  name: '反擊打擊',
  type: 'reaction',
  suitableClass: ['destroyer'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'counter_attack',
    description: '對攻擊來源對敵3，本區域清磚1',
    actions: [
      {
        type: 'counter_damage',
        value: 3,
        target: 'attacker',
        description: '對攻擊來源對敵3'
      },
      {
        type: 'clear_brick',
        value: 1,
        target: 'current_zone',
        description: '本區域清磚1'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **8. 破壞本能**
```typescript
{
  id: 'destructive_instinct',
  name: '破壞本能',
  type: 'reaction',
  suitableClass: ['destroyer'],
  
  trigger: {
    timing: 'on_stunned',
    description: '本首領進入暈眩狀態時'
  },
  
  effect: {
    type: 'area_destruction',
    description: '本區域及相鄰區域清磚1，對區域內所有敵首領對敵2',
    actions: [
      {
        type: 'clear_brick',
        value: 1,
        target: 'current_and_adjacent_zones',
        description: '本區域及相鄰區域清磚1'
      },
      {
        type: 'area_damage',
        value: 2,
        target: 'all_enemy_leaders_in_zone',
        description: '對區域內所有敵首領對敵2'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **9. 狂暴反擊**
```typescript
{
  id: 'berserk_counter',
  name: '狂暴反擊',
  type: 'reaction',
  suitableClass: ['destroyer'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'berserk_mode',
    description: '本次對敵-2，下回合本首領對敵+4、清磚+2',
    actions: [
      {
        type: 'reduce_damage',
        value: 2,
        minimum: 0,
        description: '本次對敵-2'
      },
      {
        type: 'delayed_buff',
        timing: 'next_turn',
        attackBonus: 4,
        clearBrickBonus: 2,
        description: '下回合本首領對敵+4、清磚+2'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

## ⚔️ 征服者反應卡（Conqueror）

### **10. 靈動**
```typescript
{
  id: 'agility',
  name: '靈動',
  type: 'reaction',
  suitableClass: ['conqueror'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'dodge_and_move',
    description: '本回合堅韌+4，並且可以執行一次角色移動（無視磚堆阻擋）',
    actions: [
      {
        type: 'toughness_bonus',
        value: 4,
        duration: 'this_turn',
        description: '本回合堅韌+4'
      },
      {
        type: 'grant_move',
        ignoreObstacles: true,
        description: '可以執行一次角色移動（無視磚堆阻擋）'
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：靈動（ATK職業）

---

### **11. 威嚇**
```typescript
{
  id: 'intimidate',
  name: '威嚇',
  type: 'reaction',
  suitableClass: ['conqueror'],
  
  trigger: {
    timing: 'on_enemy_enter_zone',
    description: '敵首領移動進入本首領所在的區域時'
  },
  
  effect: {
    type: 'intimidation',
    description: '對方玩家選擇一項執行：A. 該首領受到對敵4  B. 回到移動前的位置',
    actions: [
      {
        type: 'opponent_choice',
        options: [
          {
            label: 'A',
            effect: {
              type: 'single_target_damage',
              value: 4,
              target: 'moving_enemy',
              description: '該首領受到對敵4'
            }
          },
          {
            label: 'B',
            effect: {
              type: 'force_move',
              target: 'moving_enemy',
              destination: 'previous_zone',
              description: '回到移動前的位置'
            }
          }
        ]
      }
    ]
  },
  
  afterUse: 'discard'
}
```
**參考舊版**：威嚇（SHT職業）

---

### **12. 快速反擊**
```typescript
{
  id: 'swift_counter',
  name: '快速反擊',
  type: 'reaction',
  suitableClass: ['conqueror'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'swift_retaliation',
    description: '對攻擊來源對敵4，本首領可以移動到相鄰區域',
    actions: [
      {
        type: 'counter_damage',
        value: 4,
        target: 'attacker',
        description: '對攻擊來源對敵4'
      },
      {
        type: 'grant_move',
        range: 'adjacent_zone',
        description: '本首領可以移動到相鄰區域'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

## 🎯 指揮官反應卡（Commander）

### **13. 戰術撤退**
```typescript
{
  id: 'tactical_withdrawal',
  name: '戰術撤退',
  type: 'reaction',
  suitableClass: ['commander'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'withdraw',
    description: '本次對敵-2，區域內所有我方首領下回合防護協助+2',
    actions: [
      {
        type: 'reduce_damage',
        value: 2,
        minimum: 0,
        description: '本次對敵-2'
      },
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        defensiveSupportBonus: 2,
        duration: 'next_turn',
        description: '區域內所有我方首領下回合防護協助+2'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **14. 指揮反制**
```typescript
{
  id: 'command_counter',
  name: '指揮反制',
  type: 'reaction',
  suitableClass: ['commander'],
  
  trigger: {
    timing: 'on_stunned',
    description: '本首領進入暈眩狀態時'
  },
  
  effect: {
    type: 'command_debuff',
    description: '選擇區域內1位敵首領，下回合該首領對敵-3、不能使用技能',
    actions: [
      {
        type: 'debuff',
        target: 'single_enemy_leader_in_zone',
        attackDebuff: 3,
        duration: 'next_turn',
        description: '下回合該首領對敵-3'
      },
      {
        type: 'disable_skill',
        target: 'single_enemy_leader_in_zone',
        duration: 'next_turn',
        description: '下回合不能使用技能'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **15. 智謀陷阱**
```typescript
{
  id: 'cunning_trap',
  name: '智謀陷阱',
  type: 'reaction',
  suitableClass: ['commander'],
  
  trigger: {
    timing: 'on_enemy_enter_zone',
    description: '敵首領移動進入本首領所在的區域時'
  },
  
  effect: {
    type: 'trap',
    description: '該敵首領下回合不能移動、不能攻城，抽1張牌',
    actions: [
      {
        type: 'immobilize',
        target: 'moving_enemy',
        duration: 'next_turn',
        description: '下回合不能移動、不能攻城'
      },
      {
        type: 'draw_card',
        value: 1,
        description: '抽1張牌'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

## 🛡️ 守護者反應卡（Guardian）

### **16. 鋼鐵之軀**
```typescript
{
  id: 'iron_body',
  name: '鋼鐵之軀',
  type: 'reaction',
  suitableClass: ['guardian'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'damage_reduction',
    description: '本次對敵-4（最少0），在區域內堆磚1',
    actions: [
      {
        type: 'reduce_damage',
        value: 4,
        minimum: 0,
        description: '本次對敵-4（最少0）'
      },
      {
        type: 'build_brick',
        value: 1,
        target: 'current_zone',
        description: '在區域內堆磚1'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **17. 守護之盾**
```typescript
{
  id: 'guardian_shield',
  name: '守護之盾',
  type: 'reaction',
  suitableClass: ['guardian'],
  
  trigger: {
    timing: 'on_receive_damage',
    description: '本首領受到對敵時'
  },
  
  effect: {
    type: 'protect_allies',
    description: '本次對敵-2，區域內所有我方首領本回合堅韌+2',
    actions: [
      {
        type: 'reduce_damage',
        value: 2,
        minimum: 0,
        description: '本次對敵-2'
      },
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        toughnessBonus: 2,
        duration: 'this_turn',
        description: '區域內所有我方首領本回合堅韌+2'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **18. 再生之力**
```typescript
{
  id: 'regeneration',
  name: '再生之力',
  type: 'reaction',
  suitableClass: ['guardian'],
  
  trigger: {
    timing: 'on_stunned',
    description: '本首領進入暈眩狀態時'
  },
  
  effect: {
    type: 'regenerate',
    description: '回復3，若在我方主堡區則修城1',
    actions: [
      {
        type: 'heal_self',
        value: 3,
        description: '回復3'
      },
      {
        type: 'repair_fortress',
        value: 1,
        condition: 'in_ally_fortress_zone',
        description: '若在我方主堡區則修城1'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **19. 犧牲防護**
```typescript
{
  id: 'sacrifice_protection',
  name: '犧牲防護',
  type: 'reaction',
  suitableClass: ['guardian'],
  
  trigger: {
    timing: 'on_ko',
    description: '本首領進入擊敗狀態時'
  },
  
  effect: {
    type: 'sacrifice',
    description: '在我方主堡區堆磚2，修城1，區域內所有我方首領回復2',
    actions: [
      {
        type: 'build_brick',
        value: 2,
        target: 'ally_fortress_zone',
        description: '在我方主堡區堆磚2'
      },
      {
        type: 'repair_fortress',
        value: 1,
        description: '修城1'
      },
      {
        type: 'area_heal',
        value: 2,
        target: 'all_ally_leaders_in_zone',
        description: '區域內所有我方首領回復2'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

### **20. 不屈之志**
```typescript
{
  id: 'unyielding_will',
  name: '不屈之志',
  type: 'reaction',
  suitableClass: ['guardian'],
  
  trigger: {
    timing: 'on_receive_lethal_damage',
    description: '本首領受到致命傷害（會進入暈眩）時'
  },
  
  effect: {
    type: 'survive',
    description: '本次對敵後堅韌變為1（不會進入暈眩），下回合本首領回復3',
    actions: [
      {
        type: 'set_toughness',
        value: 1,
        description: '本次對敵後堅韌變為1'
      },
      {
        type: 'delayed_heal',
        value: 3,
        timing: 'next_turn',
        description: '下回合本首領回復3'
      }
    ]
  },
  
  afterUse: 'discard'
}
```

---

## 📊 反應卡設計總覽

### **通用反應卡（6張）**
| 卡名 | 觸發時機 | 效果 |
|------|---------|------|
| 閃避 | 受到對敵 | 對敵改為0，抽1張牌 |
| 冷靜思考 | 進入擊敗 | 抽3張牌 |
| 阻擋 | 敵人清磚 | 無效清磚，抽1張牌 |
| 玉石俱焚 | 進入暈眩 | 對區域內1位敵首領對敵5 |
| 誤導 | 受到對敵 | 對敵改為0，清磚1 |
| 堅韌意志 | 受到對敵 | 對敵-3，抽1張牌 |

### **破壞者反應卡（3張）**
| 卡名 | 觸發時機 | 效果 |
|------|---------|------|
| 反擊打擊 | 受到對敵 | 反擊對敵3，清磚1 |
| 破壞本能 | 進入暈眩 | 範圍清磚1，範圍對敵2 |
| 狂暴反擊 | 受到對敵 | 對敵-2，下回合對敵+4、清磚+2 |

### **征服者反應卡（3張）**
| 卡名 | 觸發時機 | 效果 |
|------|---------|------|
| 靈動 | 受到對敵 | 堅韌+4，可移動1次 |
| 威嚇 | 敵人進入區域 | 敵人選擇：受傷4或退回 |
| 快速反擊 | 受到對敵 | 反擊對敵4，可移動 |

### **指揮官反應卡（3張）**
| 卡名 | 觸發時機 | 效果 |
|------|---------|------|
| 戰術撤退 | 受到對敵 | 對敵-2，友軍防護+2 |
| 指揮反制 | 進入暈眩 | 敵人對敵-3、禁技能 |
| 智謀陷阱 | 敵人進入區域 | 敵人禁錮，抽1張牌 |

### **守護者反應卡（5張）**
| 卡名 | 觸發時機 | 效果 |
|------|---------|------|
| 鋼鐵之軀 | 受到對敵 | 對敵-4，堆磚1 |
| 守護之盾 | 受到對敵 | 對敵-2，友軍堅韌+2 |
| 再生之力 | 進入暈眩 | 回復3，條件修城1 |
| 犧牲防護 | 進入擊敗 | 堆磚2、修城1、友軍回復2 |
| 不屈之志 | 受致命傷 | 堅韌變為1，下回合回復3 |

---

## ✅ 設計完成總結

**20張反應卡設計完成！**

**設計特點：**
- ✅ 6張通用反應卡（所有職業可用）
- ✅ 14張職業專屬反應卡（破壞者3、征服者3、指揮官3、守護者5）
- ✅ 參考舊版經典卡牌（閃避、冷靜思考、阻擋、玉石俱焚、誤導、靈動、威嚇）
- ✅ 多樣化觸發時機（受到對敵、進入暈眩、進入擊敗、敵人清磚、敵人移動）
- ✅ 職業特色鮮明（破壞者反擊、征服者移動、指揮官控制、守護者防禦）

**觸發時機分布：**
- 受到對敵：10張（最常見）
- 進入暈眩：5張
- 進入擊敗：3張
- 敵人清磚：1張
- 敵人移動：2張
- **總計：20張**

**職業分布：**
- 通用（ALL）：6張
- 破壞者：3張
- 征服者：3張
- 指揮官：3張
- 守護者：5張（最多防禦選項）
- **總計：20張**

**參考舊版卡牌：**
- 閃避 → 閃避
- 冷靜思考 → 冷靜思考
- 阻擋 → 阻擋
- 玉石俱焚 → 玉石俱焚
- 誤導 → 誤導
- 靈動 → 靈動（ATK職業）
- 威嚇 → 威嚇（SHT職業）
