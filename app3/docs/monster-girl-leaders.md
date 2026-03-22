# 魔物娘首領卡設計

## 🎯 設計理念

- **魔物娘主題** - 每個種族都是魔物娘化
- **職業特色明確** - 破壞者（攻城）、征服者（機動）、指揮官（協助）、守護者（築城）
- **被動 + 絕招** - 被動提供持續效果，絕招提供爆發
- **冷卻平衡** - 根據效果強度調整冷卻（2-4回合）

---

## 💥 破壞者 (Destroyer) - 3個

### **1. 炎龍娘**

```typescript
{
  id: 'fire_dragon_girl',
  name: '炎龍娘',
  race: 'dragon',
  class: 'destroyer',
  
  baseToughness: 8,
  baseAttack: 4,
  baseDefensiveSupport: 0,
  baseOffensiveSupport: 2,
  baseRecovery: 0,
  
  // 被動：破壞衝動
  passive: {
    name: '破壞衝動',
    description: '攻城時，回復3',
    effect: {
      type: 'heal_on_siege',
      value: 3,
      trigger: 'on_siege',
      description: '攻城時回復3'
    }
  },
  
  // 絕招：火龍吐息
  skill: {
    name: '火龍吐息',
    description: '對區域內及前方區域清磚1，區域內所有敵首領對敵2，若範圍內有敵主堡則攻城1',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'clear_brick',
        value: 1,
        target: 'current_and_forward_zones',
        description: '對區域內及前方區域清磚1'
      },
      {
        type: 'area_damage',
        value: 2,
        target: 'enemy_leaders_in_zone',
        description: '區域內所有敵首領對敵2'
      },
      {
        type: 'siege',
        value: 1,
        condition: 'enemy_fortress_in_range',
        description: '若範圍內有敵主堡則攻城1'
      }
    ]
  }
}
```

**特色：** 攻城回復型破壞者，範圍清磚+攻城

---

### **2. 哥雷姆娘**

```typescript
{
  id: 'golem_girl',
  name: '哥雷姆娘',
  race: 'golem',
  class: 'destroyer',
  
  baseToughness: 10,
  baseAttack: 3,
  baseDefensiveSupport: 1,
  baseOffensiveSupport: 1,
  baseRecovery: 1,
  
  // 被動：易怒體質
  passive: {
    name: '易怒體質',
    description: '受到傷害的下回合，清磚效果+1',
    effect: {
      type: 'clear_brick_bonus_on_damaged',
      value: 1,
      trigger: 'on_damaged',
      duration: 'next_turn',
      description: '受到傷害的下回合清磚效果+1'
    }
  },
  
  // 絕招：撼動大地
  skill: {
    name: '撼動大地',
    description: '對區域內清磚5（可分配），區域內所有敵首領擊退至相鄰區域（朝敵主堡區方向）',
    timing: ['action_phase'],
    cooldown: 4,
    effect: [
      {
        type: 'clear_brick_distributed',
        value: 5,
        target: 'current_zone',
        description: '對區域內清磚5（可分配）'
      },
      {
        type: 'knockback',
        target: 'all_enemy_leaders_in_zone',
        direction: 'toward_enemy_fortress',
        description: '區域內所有敵首領擊退至相鄰區域（朝敵主堡區方向）'
      }
    ]
  }
}
```

**特色：** 受傷反擊型破壞者，高清磚+擊退控制

---

### **3. 牛頭人娘**

```typescript
{
  id: 'minotaur_girl',
  name: '牛頭人娘',
  race: 'minotaur',
  class: 'destroyer',
  
  baseToughness: 9,
  baseAttack: 4,
  baseDefensiveSupport: 0,
  baseOffensiveSupport: 1,
  baseRecovery: 0,
  
  // 被動：破壞欲望
  passive: {
    name: '破壞欲望',
    description: '攻城時，抽1張牌',
    effect: {
      type: 'draw_on_siege',
      value: 1,
      trigger: 'on_siege',
      description: '攻城時抽1張牌'
    }
  },
  
  // 絕招：破城錘
  skill: {
    name: '破城錘',
    description: '對區域內清磚3，若區域內有敵首領則改為清磚4',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'clear_brick_conditional',
        value: 3,
        bonusValue: 4,
        condition: 'enemy_leader_in_zone',
        target: 'current_zone',
        description: '對區域內清磚3，若區域內有敵首領則改為清磚4'
      }
    ]
  }
}
```

**特色：** 攻城抽牌型破壞者，條件清磚清晰

---

## 征服者 (Conqueror) - 3個

### **1. 哈比娘**

```typescript
{
  id: 'harpy_girl',
  name: '哈比娘',
  race: 'harpy',
  class: 'conqueror',
  
  baseToughness: 6,
  baseAttack: 3,
  baseDefensiveSupport: 1,
  baseOffensiveSupport: 2,
  baseRecovery: 1,
  
  // 被動：隨風而動
  passive: {
    name: '隨風而動',
    description: '移動後，本回合受到的第一次傷害減少2',
    effect: {
      type: 'damage_reduction_after_move',
      value: 2,
      trigger: 'after_move',
      duration: 'turn',
      limit: 'once_per_turn',
      description: '移動後本回合受到的第一次傷害減少2'
    }
  },
  
  // 絕招：滑翔斬
  skill: {
    name: '滑翔斬',
    description: '移動至相鄰區域，對該區域內1位敵首領對敵3',
    timing: ['action_phase'],
    cooldown: 2,
    effect: [
      {
        type: 'move_to_adjacent',
        description: '移動至相鄰區域'
      },
      {
        type: 'single_target_damage',
        value: 3,
        target: 'enemy_leader_in_zone',
        description: '對該區域內1位敵首領對敵3'
      }
    ]
  }
}
```

**特色：** 機動防守型征服者，移動減傷+遠程突進
---
### **2. 人馬娘**

{
  id: 'centaur_girl',
  name: '人馬娘',
  race: 'centaur',
  class: 'conqueror',
  
  baseToughness: 7,
  baseAttack: 4,
  baseDefensiveSupport: 1,
  baseOffensiveSupport: 2,
  baseRecovery: 0,
  
  // 被動：野性衝鋒
  passive: {
    name: '野性衝鋒',
    description: '移動後攻擊時，對敵+3',
    effect: {
      type: 'attack_bonus_after_move',
      value: 3,
      trigger: 'after_move',
      duration: 'turn',
      description: '移動後攻擊時對敵+3'
    }
  },
  
  // 絕招：野獸踐踏
  skill: {
    name: '野獸踐踏',
    description: '對區域內所有敵首領對敵（我方區域內首領數量×2），擊退至相鄰區域（朝敵主堡區方向）',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'area_damage_scaling',
        baseValue: 0,
        scaling: {
          type: 'ally_leaders_in_zone',
          multiplier: 2
        },
        target: 'all_enemy_leaders_in_zone',
        description: '對區域內所有敵首領對敵（我方區域內首領數量×2）'
      },
      {
        type: 'knockback',
        target: 'all_enemy_leaders_in_zone',
        direction: 'toward_enemy_fortress',
        description: '擊退至相鄰區域（朝敵主堡區方向）'
      }
    ]
  }
}

---
### **3. 狼人娘**

```typescript
{
  id: 'werewolf_girl',
  name: '狼人娘',
  race: 'werewolf',
  class: 'conqueror',
  
  baseToughness: 7,
  baseAttack: 4,
  baseDefensiveSupport: 0,
  baseOffensiveSupport: 2,
  baseRecovery: 1,
  
  // 被動：嗜血
  passive: {
    name: '嗜血',
    description: '對敵首領造成傷害時，回復3',
    effect: {
      type: 'heal_on_damage',
      value: 3,
      trigger: 'on_damage_dealt',
      description: '對敵首領造成傷害時回復3'
    }
  },
  
  // 絕招：暗影突襲
  skill: {
    name: '暗影突襲',
    description: '對區域內1位敵首領對敵5，若目標堅韌低於3則直接擊破',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'single_target_damage',
        value: 5,
        target: 'enemy_leader_in_zone',
        description: '對區域內1位敵首領對敵5'
      },
      {
        type: 'execute',
        condition: 'target_toughness_below_3',
        description: '若目標堅韌低於3則直接擊破'
      }
    ]
  }
}
```

**特色：** 斬殺型征服者，對敵回復+高傷害斬殺

---

## 🎯 指揮官 (Commander) - 3個

### **1. 拉米亞娘**

```typescript
{
  id: 'lamia_girl',
  name: '拉米亞娘',
  race: 'lamia',
  class: 'commander',
  
  baseToughness: 7,
  baseAttack: 3,
  baseDefensiveSupport: 2,
  baseOffensiveSupport: 2,
  baseRecovery: 1,
  
  // 被動：神經毒素
  passive: {
    name: '神經毒素',
    description: '對敵造成傷害時，目標下回合禁錮',
    effect: {
      type: 'immobilize_on_damage',
      trigger: 'on_damage_dealt',
      duration: 'next_turn',
      description: '對敵造成傷害時，目標下回合禁錮（不能移動）'
    }
  },
  
  // 絕招：毒蛇飛匕
  skill: {
    name: '毒蛇飛匕',
    description: '對區域內及相鄰區域所有敵首領對敵2，目標下回合禁錮（不能移動、不能攻城）',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'area_damage_wide',
        value: 2,
        target: 'current_and_adjacent_zones',
        description: '對區域內及相鄰區域所有敵首領對敵2'
      },
      {
        type: 'immobilize_and_disable_siege',
        duration: 'next_turn',
        description: '目標下回合禁錮（不能移動、不能攻城）'
      }
    ]
  }
}
```

**特色：** 控制型指揮官，對敵禁錮+範圍控制

---

### **2. 魅魔蝙蝠娘**

```typescript
{
  id: 'succubus_bat_girl',
  name: '魅魔蝙蝠娘',
  race: 'succubus',
  class: 'commander',
  
  baseToughness: 6,
  baseAttack: 3,
  baseDefensiveSupport: 2,
  baseOffensiveSupport: 3,
  baseRecovery: 0,
  
  // 被動：魅惑神智
  passive: {
    name: '魅惑神智',
    description: '對敵造成傷害時，目標下回合不能攻城',
    effect: {
      type: 'disable_siege_on_damage',
      trigger: 'on_damage_dealt',
      duration: 'next_turn',
      description: '對敵造成傷害時，目標下回合不能攻城'
    }
  },
  
  // 絕招：禁錮音波
  skill: {
    name: '禁錮音波',
    description: '選擇區域內或相鄰區域1位敵首領，下回合癱瘓（不能行動、不能提供協助）',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'paralyze',
        target: 'single_enemy_leader',
        range: 'current_or_adjacent',
        duration: 'next_turn',
        description: '目標下回合癱瘓（不能行動、不能提供協助）'
      }
    ]
  }
}
```

**特色：** 防攻城型指揮官，防止攻城+單體癱瘓

---

### **3. 妖狐娘**

```typescript
{
  id: 'kitsune_girl',
  name: '妖狐娘',
  race: 'kitsune',
  class: 'commander',
  
  baseToughness: 6,
  baseAttack: 3,
  baseDefensiveSupport: 3,
  baseOffensiveSupport: 2,
  baseRecovery: 1,
  
  // 被動：因果輪迴
  passive: {
    name: '因果輪迴',
    description: '擊暈或擊破敵首領時，抽1張牌',
    effect: {
      type: 'draw_on_stun_or_ko',
      value: 1,
      trigger: 'on_enemy_stunned_or_ko',
      description: '擊暈或擊破敵首領時抽1張牌'
    }
  },
  
  // 絕招：妖狐法陣
  skill: {
    name: '妖狐法陣',
    description: '區域內所有敵首領堅韌-2、對敵-2，目標下回合禁錮（不能移動）',
    timing: ['action_phase'],
    cooldown: 4,
    effect: [
      {
        type: 'area_debuff',
        target: 'all_enemy_leaders_in_zone',
        toughnessDebuff: 2,
        attackDebuff: 2,
        duration: 'this_turn',
        description: '區域內所有敵首領堅韌-2、對敵-2'
      },
      {
        type: 'immobilize',
        duration: 'next_turn',
        description: '目標下回合禁錮（不能移動）'
      }
    ]
  }
}
```

**特色：** 削弱型指揮官，擊破抽牌+群體削弱禁錮

---

## 🛡️ 守護者 (Guardian) - 3個

### **1. 人魚娘**

```typescript
{
  id: 'mermaid_girl',
  name: '人魚娘',
  race: 'aquatic',
  class: 'guardian',
  
  baseToughness: 8,
  baseAttack: 2,
  baseDefensiveSupport: 3,
  baseOffensiveSupport: 1,
  baseRecovery: 2,
  
  // 被動：大海氣息
  passive: {
    name: '大海氣息',
    description: '回合開始時，區域內所有我方首領回復2',
    effect: {
      type: 'area_heal_on_turn_start',
      value: 2,
      trigger: 'turn_start',
      target: 'ally_leaders_in_zone',
      description: '回合開始時，區域內我方首領回復2'
    }
  },
  
  // 絕招：潮汐庇護
  skill: {
    name: '潮汐庇護',
    description: '區域內所有敵首領擊退至相鄰區域（朝敵主堡區方向），本回合全場我方首領攻擊協助+2、防護協助+2，若在我方主堡區發動則修城1',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'knockback',
        target: 'all_enemy_leaders_in_zone',
        direction: 'toward_enemy_fortress',
        description: '區域內所有敵首領擊退至相鄰區域（朝敵主堡區方向）'
      },
      {
        type: 'global_buff',
        target: 'all_ally_leaders',
        offensiveSupportBonus: 2,
        defensiveSupportBonus: 2,
        duration: 'this_turn',
        description: '全場我方首領攻擊協助+2、防護協助+2'
      },
      {
        type: 'repair_fortress',
        value: 1,
        condition: 'in_ally_fortress_zone',
        description: '若在我方主堡區發動則修城1'
      }
    ]
  }
}
```

**特色：** 擊退防守型守護者，持續治療+擊退+全場增益

---

### **2. 史萊姆娘**

```typescript
{
  id: 'slime_girl',
  name: '史萊姆娘',
  race: 'slime',
  class: 'guardian',
  
  baseToughness: 9,
  baseAttack: 2,
  baseDefensiveSupport: 2,
  baseOffensiveSupport: 0,
  baseRecovery: 3,
  
  // 被動：分裂築城
  passive: {
    name: '分裂築城',
    description: '受到傷害時，可在任意區域堆磚1（每回合1次）',
    effect: {
      type: 'build_on_damaged',
      value: 1,
      trigger: 'on_damaged',
      limit: 'once_per_turn',
      range: 'any_zone',
      description: '受到傷害時，可在任意區域堆磚1（每回合1次）'
    }
  },
  
  // 絕招：重生
  skill: {
    name: '重生',
    description: '修城2，本首領堅韌+3（持續1回合）',
    timing: ['action_phase'],
    cooldown: 3,
    effect: [
      {
        type: 'repair_fortress',
        value: 2,
        description: '修城2'
      },
      {
        type: 'self_buff',
        toughnessBonus: 3,
        duration: 'this_turn',
        description: '本首領堅韌+3（持續1回合）'
      }
    ]
  }
}
```

**特色：** 受傷堆磚型守護者，受傷堆磚+修城自保

---

### **3. 樹精娘**

```typescript
{
  id: 'dryad_girl',
  name: '樹精娘',
  race: 'dryad',
  class: 'guardian',
  
  baseToughness: 8,
  baseAttack: 2,
  baseDefensiveSupport: 3,
  baseOffensiveSupport: 0,
  baseRecovery: 2,
  
  // 被動：糾纏樹根
  passive: {
    name: '糾纏樹根',
    description: '區域內磚堆受到清磚時減少1（每回合1次）',
    effect: {
      type: 'brick_protection',
      value: 1,
      trigger: 'on_brick_cleared',
      limit: 'once_per_turn',
      description: '區域內磚堆受到清磚時減少1（每回合1次）'
    }
  },
  
  // 絕招：森林復甦
  skill: {
    name: '森林復甦',
    description: '所有我方區域磚堆恢復到2層',
    timing: ['action_phase'],
    cooldown: 4,
    effect: [
      {
        type: 'restore_all_bricks',
        value: 2,
        target: 'all_ally_zones',
        description: '所有我方區域磚堆恢復到2層'
      }
    ]
  }
}
```

**特色：** 保護磚堆型守護者，保護磚堆+全場恢復

---

## 📊 設計總覽

| 職業 | 角色1 | 角色2 | 角色3 |
|------|-------|-------|-------|
| **破壞者** | 炎龍娘 | 哥雷姆娘 | 牛頭人娘 |
| **征服者** | 哈比娘 | 人馬娘 | 狼人娘 |
| **指揮官** | 拉米亞娘 | 魅魔蝙蝠娘 | 妖狐娘 |
| **守護者** | 人魚娘 | 史萊姆娘 | 樹精娘 |

---

## 📋 完整12個首領特色總結（標準術語版）

### **破壞者（攻城特化）**
1. **炎龍娘** - 攻城回復3，範圍清磚1+對敵2+攻城1（冷卻3）
2. **哥雷姆娘** - 受傷清磚+1，清磚5+擊退（冷卻4）⭐擊退
3. **牛頭人娘** - 攻城抽牌，條件清磚3/4（冷卻3）

### **征服者（機動特化）**
4. **哈比娘** - 移動減傷2，遠程突進+對敵3（冷卻2）
5. **人馬娘** - 移動對敵+3，數量成長對敵+擊退（冷卻3）⭐擊退
6. **狼人娘** - 對敵回復3，對敵5+斬殺（冷卻3）

### **指揮官（控制特化）**
7. **拉米亞娘** - 對敵禁錮，範圍對敵2+禁錮（冷卻3）
8. **魅魔蝙蝠娘** - 對敵防攻城，單體癱瘓（冷卻3）
9. **妖狐娘** - 擊破抽牌，群體堅韌-2對敵-2+禁錮（冷卻4）

### **守護者（防守特化）**
10. **人魚娘** - 回合開始回復2，擊退+全場協助+2+修城1（冷卻3）⭐擊退
11. **史萊姆娘** - 受傷堆磚1，修城2+堅韌+3（冷卻3）
12. **樹精娘** - 保護磚堆-1，全場磚堆恢復到2層（冷卻4）

---

## ⚖️ 冷卻平衡總覽

| 冷卻 | 角色數量 | 角色列表 |
|------|----------|----------|
| **2回合** | 1個 | 哈比娘 |
| **3回合** | 8個 | 炎龍娘、牛頭人娘、人馬娘、狼人娘、拉米亞娘、魅魔蝙蝠娘、人魚娘、史萊姆娘 |
| **4回合** | 3個 | 哥雷姆娘、妖狐娘、樹精娘 |

---

## 🎯 職業特色分析

### **破壞者特色：**
- ✅ 被動圍繞攻城（回復、抽牌、反擊）
- ✅ 絕招提供清磚+攻城能力
- ✅ 冷卻3-4回合（爆發型）

### **征服者特色：**
- ✅ 被動圍繞移動和對敵（減傷、攻擊+、回復）
- ✅ 絕招提供機動性+傷害
- ✅ 冷卻2-3回合（高運作率）

### **指揮官特色：**
- ✅ 被動提供控制效果（禁錮、防攻城、抽牌）
- ✅ 絕招提供範圍控制/削弱
- ✅ 冷卻3-4回合（控場型）

### **守護者特色：**
- ✅ 被動提供防守能力（治療、堆磚、保護）
- ✅ 絕招提供修城+增益
- ✅ 冷卻3-4回合（防守型）

---

## ✅ 設計完成總結

**12個魔物娘首領設計完成！**

**設計特點：**
- ✅ 每個職業3個角色，特色明確
- ✅ 被動效果多樣化，提供持續價值
- ✅ 絕招爆發感強，符合職業定位
- ✅ 冷卻平衡（2-4回合）
- ✅ 術語統一（禁錮、擊破、堆磚、修城）

**下一步：**
1. 為每個首領設計配套的軍團卡
2. 更新 TypeScript 類型定義
3. 創建完整的卡牌數據
| **守護者** | 史萊姆娘 | 樹精娘 | 海族娘 |

---

## 💡 設計建議

### **破壞者設計要點：**
1. **被動** - 攻城相關（回復、抽牌、增益）
2. **絕招** - 清磚 + 攻城 + 傷害
3. **冷卻** - 3-4回合

### **征服者設計要點：**
1. **被動** - 移動/攻擊相關
2. **絕招** - 機動性 + 傷害
3. **冷卻** - 2-3回合

### **指揮官設計要點：**
1. **被動** - 協助相關
2. **絕招** - 範圍傷害/控制
3. **冷卻** - 3回合

### **守護者設計要點：**
1. **被動** - 防護/回復相關
2. **絕招** - 治療 + 修城
3. **冷卻** - 3-4回合

---

## ✅ 總結

**破壞者3個設計修正：**
1. ✅ **炎龍娘** - 攻城回復，範圍清磚+傷害+攻城
2. ✅ **哥雷姆娘** - 受傷反擊，分配清磚5
3. ✅ **牛頭人娘** - 攻城抽牌，條件清磚

**征服者名稱建議：**
- 哈比娘（飛行機動）
- 人馬娘（衝鋒擊退）
- 狼人娘（狂暴連擊）

**你可以開始設計征服者的技能，我會幫你修正！**
