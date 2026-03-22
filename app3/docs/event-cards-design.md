# 魔物娘事件卡設計

## 📖 設計理念

事件卡是在主要階段打出的戰術卡牌，提供即時效果來改變戰局。

### **核心概念**
- **事件卡** - 在主要階段打出，產生即時效果後棄置
- **即時效果** - 打出後立即生效，不佔用場地
- **戰術應對** - 提供移動、增益、控制、資源等戰術選擇
- **成本系統** - 部分事件卡需要丟棄額外手牌作為代價

### **事件卡使用規則**
1. **使用時機** - 在主要階段可以打出複數事件卡
2. **即時生效** - 效果立即執行，然後卡牌棄置
3. **成本** - 部分強力事件卡需要丟棄額外手牌
4. **限制** - 部分事件卡有發動條件或每場遊戲限制

---

## 🎯 事件卡分類

### **1. 移動類事件卡**
- 改變首領位置
- 集結部隊
- 戰術撤退

### **2. 增益類事件卡**
- 提升屬性
- 回復狀態
- 強化協助

### **3. 控制類事件卡**
- 限制移動
- 削弱敵人
- 移除效果

### **4. 資源類事件卡**
- 抽牌
- 堆磚
- 修城

### **5. 特殊類事件卡**
- 逆轉局勢
- 檢索卡牌
- 特殊條件

---

## 📊 設計原則

### **成本設計**

| 成本類型 | 說明 | 適用事件卡 |
|---------|------|-----------|
| **免費** | 不需額外丟牌 | 基礎效果事件卡 |
| **丟牌1** | 丟棄1張手牌 | 中等效果事件卡 |
| **丟牌2** | 丟棄2張手牌 | 強力效果事件卡 |

### **效果強度**

| 強度 | 效果範圍 | 持續時間 |
|------|---------|---------|
| **弱** | 單體 | 1回合 |
| **中** | 區域/多體 | 1回合 |
| **強** | 全場/永久 | 1回合或永久 |

---

## 🚀 移動類事件卡

### **1. 呼朋引伴**
```typescript
{
  id: 'call_allies',
  name: '呼朋引伴',
  type: 'event',
  category: 'movement',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'move_ally',
    description: '選擇將1位我方首領移動至距離2格內的區域的1位我方首領移動到該首領的區域（無視磚堆）',
    target: 'single_ally_leader',
    moveTarget: 'adjacent_ally_to_target_zone',
    ignoreObstacles: true
  }
}
```
**參考舊版**：呼朋引伴

---

### **2. 戰術撤退**
```typescript
{
  id: 'tactical_retreat',
  name: '戰術撤退',
  type: 'event',
  category: 'movement',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'retreat',
    description: '選擇1位非擊敗狀態的將1位我方首領移動至我方基地，回復2為正常狀態，抽1張牌',
    target: 'single_non_ko_ally',
    actions: [
      {
        type: 'force_move',
        destination: 'ally_fortress_zone',
        description: '移動到我方基地'
        description: '移動到我方主堡區'
      },
      {
        type: 'restore_state',
        description: '回復為正常狀態'
      },
      {
        type: 'draw_card',
        value: 1,
        description: '抽1張牌'
      }
    ]
  }
}
```
**參考舊版**：回家

---

### **3. 快速機動**
```typescript
{
  id: 'rapid_maneuver',
  name: '快速機動',
  type: 'event',
  category: 'movement',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'extra_movement',
    description: '選擇1位我方首領：本回合可以額外移動1次（無視磚堆）',
    target: 'single_ally_leader',
    actions: [
      {
        type: 'grant_extra_move',
        value: 1,
        ignoreObstacles: true,
        duration: 'this_turn',
        description: '本回合可以額外移動1次（無視磚堆）'
      }
    ]
  }
}
```

---

## 💪 增益類事件卡

### **4. 氣合**
```typescript
{
  id: 'fighting_spirit',
  name: '氣合',
  type: 'event',
  category: 'buff',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'buff_toughness',
    description: '選擇1位我方首領：本回合堅韌+4',
    target: 'single_ally_leader',
    actions: [
      {
        type: 'toughness_bonus',
        value: 4,
        duration: 'this_turn',
        description: '本回合堅韌+4'
      }
    ]
  }
}
```
**參考舊版**：氣合

---

### **5. 最佳拍檔**
```typescript
{
  id: 'best_partners',
  name: '最佳拍檔',
  type: 'event',
  category: 'buff',
  
  cost: {
    discard: 0  // 免費
  },
  
  activationCondition: {
    type: 'ally_count_in_zone',
    value: 2,
    description: '區域內有2位以上我方首領'
  },
  
  effect: {
    type: 'area_buff',
    description: '選擇一個區域：若區域內有2位以上我方首領，則該區域所有我方首領本回合協助+3',
    target: 'zone_with_multiple_allies',
    actions: [
      {
        type: 'area_buff',
        target: 'all_ally_leaders_in_zone',
        offensiveSupportBonus: 3,
        defensiveSupportBonus: 3,
        duration: 'this_turn',
        description: '區域內所有我方首領本回合協助+3'
      }
    ]
  }
}
```
**參考舊版**：最佳拍檔

---

### **6. 戰鬥狂熱**
```typescript
{
  id: 'battle_frenzy',
  name: '戰鬥狂熱',
  type: 'event',
  category: 'buff',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'buff_attack',
    description: '選擇1位我方首領：本回合對敵+3、清磚+1',
    target: 'single_ally_leader',
    actions: [
      {
        type: 'attack_bonus',
        value: 3,
        duration: 'this_turn',
        description: '本回合對敵+3'
      },
      {
        type: 'clear_brick_bonus',
        value: 1,
        duration: 'this_turn',
        description: '本回合清磚+1'
      }
    ]
  }
}
```

---

### **7. 全員集結**
```typescript
{
  id: 'rally_all',
  name: '全員集結',
  type: 'event',
  category: 'buff',
  
  cost: {
    discard: 2  // 丟牌2
  },
  
  effect: {
    type: 'global_buff',
    description: '所有我方首領本回合對敵+2、防護協助+2',
    target: 'all_ally_leaders',
    actions: [
      {
        type: 'global_buff',
        attackBonus: 2,
        defensiveSupportBonus: 2,
        duration: 'this_turn',
        description: '所有我方首領本回合對敵+2、防護協助+2'
      }
    ]
  }
}
```

---

## 🎯 控制類事件卡

### **8. 搖桿失靈**
```typescript
{
  id: 'control_malfunction',
  name: '搖桿失靈',
  type: 'event',
  category: 'control',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'immobilize',
    description: '選擇1位敵首領：下回合不能移動',
    target: 'single_enemy_leader',
    actions: [
      {
        type: 'immobilize',
        duration: 'next_turn',
        description: '下回合不能移動'
      }
    ]
  }
}
```
**參考舊版**：搖桿失靈

---

### **9. 看穿**
```typescript
{
  id: 'see_through',
  name: '看穿',
  type: 'event',
  category: 'control',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'remove_equipment',
    description: '選擇1位敵首領：移除其裝備的軍團卡',
    target: 'single_enemy_leader',
    actions: [
      {
        type: 'remove_legion',
        description: '移除其裝備的軍團卡'
      }
    ]
  }
}
```
**參考舊版**：看穿（移除反應卡）

---

### **10. 削弱詛咒**
```typescript
{
  id: 'weakening_curse',
  name: '削弱詛咒',
  type: 'event',
  category: 'control',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'debuff',
    description: '選擇1位敵首領：下回合對敵-3、防護協助-3',
    target: 'single_enemy_leader',
    actions: [
      {
        type: 'debuff',
        attackDebuff: 3,
        defensiveSupportDebuff: 3,
        duration: 'next_turn',
        description: '下回合對敵-3、防護協助-3'
      }
    ]
  }
}
```

---

### **11. 混亂戰場**
```typescript
{
  id: 'chaotic_battlefield',
  name: '混亂戰場',
  type: 'event',
  category: 'control',
  
  cost: {
    discard: 2  // 丟牌2
  },
  
  effect: {
    type: 'area_debuff',
    description: '選擇一個區域：該區域所有敵首領下回合不能使用技能',
    target: 'zone',
    actions: [
      {
        type: 'disable_skill',
        target: 'all_enemy_leaders_in_zone',
        duration: 'next_turn',
        description: '該區域所有敵首領下回合不能使用技能'
      }
    ]
  }
}
```

---

## 📦 資源類事件卡

### **12. 緊急補給**
```typescript
{
  id: 'emergency_supply',
  name: '緊急補給',
  type: 'event',
  category: 'resource',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'draw_cards',
    description: '抽2張牌',
    actions: [
      {
        type: 'draw_card',
        value: 2,
        description: '抽2張牌'
      }
    ]
  }
}
```

---

### **13. 築城指令**
```typescript
{
  id: 'fortify_order',
  name: '築城指令',
  type: 'event',
  category: 'resource',
  
  cost: {
    discard: 0  // 免費
  },
  
  effect: {
    type: 'build_brick',
    description: '在任意區域堆磚2',
    actions: [
      {
        type: 'build_brick',
        value: 2,
        range: 'any_zone',
        description: '在任意區域堆磚2'
      }
    ]
  }
}
```

---

### **14. 緊急修復**
```typescript
{
  id: 'emergency_repair',
  name: '緊急修復',
  type: 'event',
  category: 'resource',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'repair',
    description: '修城2',
    actions: [
      {
        type: 'repair_fortress',
        value: 2,
        description: '修城2'
      }
    ]
  }
}
```

---

### **15. 戰場治療**
```typescript
{
  id: 'battlefield_healing',
  name: '戰場治療',
  type: 'event',
  category: 'resource',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'heal',
    description: '選擇1位我方首領：回復3',
    target: 'single_ally_leader',
    actions: [
      {
        type: 'heal_self',
        value: 3,
        description: '回復3'
      }
    ]
  }
}
```

---

## ⚡ 特殊類事件卡

### **16. RUSH TIME**
```typescript
{
  id: 'rush_time',
  name: 'RUSH TIME',
  type: 'event',
  category: 'special',
  
  cost: {
    discard: 0  // 免費
  },
  
  activationCondition: {
    type: 'fortress_hp_difference',
    value: 2,
    description: '我方城牆生命力低於敵方2點以上'
  },
  
  limitPerGame: 1,  // 每場遊戲限1次
  
  effect: {
    type: 'rush_mode',
    description: '我方城牆生命力低於敵方2點以上時發動：抽5張牌、所有我方首領完全回復受到的傷害、所有首領技能冷卻重置',
    actions: [
      {
        type: 'draw_card',
        value: 5,
        description: '抽5張牌'
      },
      {
        type: 'heal_all_allies',
        value: 'full',
        description: '所有我方首領完全回復受到的傷害'
      },
      {
        type: 'reset_all_cooldowns',
        description: '所有首領技能冷卻重置'
      }
    ]
  }
}
```
**參考舊版**：RUSH TIME（逆轉卡）

---

### **17. 軍團檢索**
```typescript
{
  id: 'legion_search',
  name: '軍團檢索',
  type: 'event',
  category: 'special',
  
  cost: {
    discard: 1  // 丟牌1
  },
  
  effect: {
    type: 'search_deck',
    description: '丟棄1張手牌發動：從牌組檢索1張軍團卡展示給對手並加入手牌',
    actions: [
      {
        type: 'search_deck',
        cardType: 'legion',
        value: 1,
        reveal: true,
        description: '從牌組檢索1張軍團卡展示給對手並加入手牌'
      }
    ]
  }
}
```
**參考舊版**：反應大師（檢索反應卡）

---

### **18. 戰術重組**
```typescript
{
  id: 'tactical_reorganize',
  name: '戰術重組',
  type: 'event',
  category: 'special',
  
  cost: {
    discard: 2  // 丟牌2
  },
  
  effect: {
    type: 'reorganize',
    description: '丟棄任意數量的手牌，然後抽等量的牌',
    actions: [
      {
        type: 'discard_then_draw',
        description: '丟棄任意數量的手牌，然後抽等量的牌'
      }
    ]
  }
}
```

---

### **19. 決戰時刻**
```typescript
{
  id: 'decisive_moment',
  name: '決戰時刻',
  type: 'event',
  category: 'special',
  
  cost: {
    discard: 3  // 丟牌3
  },
  
  effect: {
    type: 'decisive_strike',
    description: '選擇1位我方首領：本回合該首領對敵+5、清磚+2、可以額外行動1次',
    target: 'single_ally_leader',
    actions: [
      {
        type: 'attack_bonus',
        value: 5,
        duration: 'this_turn',
        description: '本回合對敵+5'
      },
      {
        type: 'clear_brick_bonus',
        value: 2,
        duration: 'this_turn',
        description: '本回合清磚+2'
      },
      {
        type: 'extra_action',
        value: 1,
        duration: 'this_turn',
        description: '可以額外行動1次'
      }
    ]
  }
}
```

---

### **20. 全軍突擊**
```typescript
{
  id: 'full_assault',
  name: '全軍突擊',
  type: 'event',
  category: 'special',
  
  cost: {
    discard: 2  // 丟牌2
  },
  
  effect: {
    type: 'mass_attack',
    description: '所有我方首領本回合可以無視磚堆移動，對敵+2',
    target: 'all_ally_leaders',
    actions: [
      {
        type: 'global_buff',
        ignoreObstacles: true,
        attackBonus: 2,
        duration: 'this_turn',
        description: '所有我方首領本回合可以無視磚堆移動，對敵+2'
      }
    ]
  }
}
```

---

## 📊 事件卡設計總覽

### **移動類事件卡（3張）**
| 卡名 | 成本 | 效果 |
|------|------|------|
| 呼朋引伴 | 免費 | 集結友軍到同區域 |
| 戰術撤退 | 免費 | 撤退到主堡+回復+抽牌 |
| 快速機動 | 丟牌1 | 額外移動1次 |

### **增益類事件卡（4張）**
| 卡名 | 成本 | 效果 |
|------|------|------|
| 氣合 | 免費 | 單體堅韌+4 |
| 最佳拍檔 | 免費 | 區域協助+3（需2人以上） |
| 戰鬥狂熱 | 丟牌1 | 單體對敵+3、清磚+1 |
| 全員集結 | 丟牌2 | 全體對敵+2、防護+2 |

### **控制類事件卡（4張）**
| 卡名 | 成本 | 效果 |
|------|------|------|
| 搖桿失靈 | 免費 | 單體禁錮（不能移動） |
| 看穿 | 免費 | 移除敵軍團卡 |
| 削弱詛咒 | 丟牌1 | 單體削弱-3 |
| 混亂戰場 | 丟牌2 | 區域禁技能 |

### **資源類事件卡（4張）**
| 卡名 | 成本 | 效果 |
|------|------|------|
| 緊急補給 | 免費 | 抽2張牌 |
| 築城指令 | 免費 | 堆磚2 |
| 緊急修復 | 丟牌1 | 修城2 |
| 戰場治療 | 丟牌1 | 單體回復3 |

### **特殊類事件卡（5張）**
| 卡名 | 成本 | 效果 | 限制 |
|------|------|------|------|
| RUSH TIME | 免費 | 抽5張+回復暈眩+額外行動2次 | 每場1次、需落後2點 |
| 軍團檢索 | 丟牌1 | 檢索1張軍團卡 完全| 傷害|重置技能冷卻
| 戰術重組 | 丟牌2 | 丟牌後抽等量 | - |
| 決戰時刻 | 丟牌3 | 單體超強化+額外行動 | - |
| 全軍突擊 | 丟牌2 | 全體無視磚堆+對敵+2 | - |

---

## ✅ 設計完成總結

**20張基本事件卡設計完成！**

**設計特點：**
- ✅ 5大類事件卡（移動、增益、控制、資源、特殊）
- ✅ 參考舊版經典卡牌（呼朋引伴、氣合、搖桿失靈、RUSH TIME等）
- ✅ 成本平衡（免費、丟牌1、丟牌2、丟牌3）
- ✅ 效果多樣化（單體、區域、全場）
- ✅ 戰術深度（集結、撤退、檢索、逆轉）

**成本分布：**
- 免費：8張（基礎戰術卡）
- 丟牌1：7張（中等效果卡）
- 丟牌2：4張（強力效果卡）
- 丟牌3：1張（超強效果卡）
- **總計：20張**

**參考舊版卡牌：**
- 呼朋引伴 → 呼朋引伴
- 回家 → 戰術撤退
- 氣合 → 氣合
- 最佳拍檔 → 最佳拍檔
- 搖桿失靈 → 搖桿失靈
- 看穿 → 看穿
- RUSH TIME → RUSH TIME
- 反應大師 → 軍團檢索
