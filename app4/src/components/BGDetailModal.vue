<template>
  <div v-if="bg" class="modal-backdrop" @click.self="close">
    <div class="modal" :class="`owner-${bg.owner}`">
      <!-- 頂部 -->
      <div class="modal-header">
        <div class="header-left">
          <span class="bg-name">{{ bg.name }}</span>
          <span class="class-badge" :class="`cls-${bg.bgClass}`">{{ bg.bgClass }}</span>
          <span class="owner-label" :class="bg.owner">{{ bg.owner === 'p1' ? 'P1' : 'P2' }}</span>
        </div>
        <button class="close-btn" @click="close">✕</button>
      </div>

      <div class="modal-body">
        <!-- 卡圖 + 基本數值 -->
        <div class="card-art-block">
          <div class="card-art">
            <img
              :src="`/assets/cards/bg/${bg.cardId}.png`"
              :alt="bg.name"
              class="card-img"
              @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
            />
          </div>
          <div class="stats-block">
            <!-- HP -->
            <div class="stat-row">
              <span class="stat-label">HP</span>
              <div class="hp-bar-wrap">
                <div class="hp-bar-fill" :style="{ width: hpPercent + '%' }"></div>
              </div>
              <span class="stat-val" :class="{ boosted: bg.tempHpBonus > 0 }">
                {{ effectiveHPVal }} / {{ bg.hpBase }}
                <span v-if="bg.tempHpBonus > 0" class="bonus">+{{ bg.tempHpBonus }}</span>
              </span>
            </div>
            <!-- ATK -->
            <div class="stat-row">
              <span class="stat-label">⚔ 對敵</span>
              <span class="stat-val" :class="{ boosted: bg.tempAttackBonus > 0 || bg.darkModeActive }">
                {{ effectiveAtkVal }}
                <span v-if="bg.tempAttackBonus > 0" class="bonus">+{{ bg.tempAttackBonus }}</span>
                <span v-if="bg.darkModeActive" class="bonus">+2(暗)</span>
              </span>
            </div>
            <!-- SUP -->
            <div class="stat-row">
              <span class="stat-label">🤝 協助</span>
              <span class="stat-val" :class="{ boosted: bg.tempSupportBonus > 0 }">
                {{ effectiveSupVal }}
                <span v-if="bg.tempSupportBonus > 0" class="bonus">+{{ bg.tempSupportBonus }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- 狀態標籤 -->
        <div class="status-tags" v-if="statusTags.length">
          <span v-for="tag in statusTags" :key="tag.label" class="tag" :class="tag.cls">
            {{ tag.label }}
          </span>
        </div>

        <!-- 反應卡 -->
        <div class="reaction-row" v-if="bg.reactionCard">
          <span class="section-title">反應卡</span>
          <span class="reaction-name">{{ reactionName }}</span>
          <span class="reaction-desc">{{ reactionDesc }}</span>
        </div>

        <!-- 技能 -->
        <div class="skills-section">
          <div class="section-title">技能</div>
          <div v-for="(skill, idx) in bgSkills" :key="idx" class="skill-block" :class="{ unavailable: !skillUsable(idx) }">
            <div class="skill-header">
              <span class="skill-name">技能{{ idx + 1 }}：{{ skill.name }}</span>
              <span class="skill-cd-badge" :class="{ ready: skillCooldown(idx) === 0 }">
                {{ skillCooldown(idx) === 0 ? '可用' : `冷卻 ${skillCooldown(idx)}` }}
              </span>
              <span v-if="skill.handCost" class="skill-cost">消耗手牌 ×{{ skill.handCost }}</span>
              <span v-if="skill.canUseWhenStunned" class="skill-stun-ok">暈眩可用</span>
            </div>
            <div class="skill-desc">{{ skill.description }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/game'
import { bgCardById } from '../data/bg-cards'
import { reactionById } from '../data/reactions'
import { effectiveAttack, effectiveSupport, effectiveHP } from '../engine'

const game = useGameStore()

const bg = computed(() => {
  const id = game.detailBGId
  if (!id || !game.state) return null
  return game.state.bgs[id] ?? null
})

function close() { game.detailBGId = null }

const bgDef = computed(() => bg.value ? bgCardById[bg.value.cardId] : null)
const bgSkills = computed(() => bgDef.value?.skills ?? [])

const effectiveHPVal = computed(() => bg.value ? effectiveHP(bg.value) : 0)
const effectiveAtkVal = computed(() => bg.value ? effectiveAttack(bg.value) : 0)
const effectiveSupVal = computed(() => bg.value ? effectiveSupport(bg.value) : 0)
const hpPercent = computed(() => bg.value ? Math.max(0, Math.min(100, (effectiveHPVal.value / bg.value.hpBase) * 100)) : 0)

function skillCooldown(idx: number) { return bg.value?.skillCooldowns[idx] ?? 0 }
function skillUsable(idx: number) {
  if (!bg.value) return false
  if (skillCooldown(idx) > 0) return false
  const skill = bgSkills.value[idx]
  if (bg.value.state === 'stunned' && !skill?.canUseWhenStunned) return false
  return true
}

const reactionDef = computed(() => bg.value?.reactionCard ? reactionById[bg.value.reactionCard] : null)
const reactionName = computed(() => reactionDef.value?.name ?? bg.value?.reactionCard ?? '')
const reactionDesc = computed(() => reactionDef.value?.description ?? '')

const statusTags = computed(() => {
  if (!bg.value) return []
  const b = bg.value
  const tags: { label: string; cls: string }[] = []
  if (b.state === 'stunned') tags.push({ label: `暈眩（剩 ${b.recoveryCountdown} 回合）`, cls: 'tag-stunned' })
  if (b.state === 'ko') tags.push({ label: `KO（剩 ${b.recoveryCountdown} 回合復活）`, cls: 'tag-ko' })
  if (b.actedThisPhase) tags.push({ label: '已行動', cls: 'tag-acted' })
  if (b.immuneThisTurn) tags.push({ label: '本回合免疫', cls: 'tag-buff' })
  if (b.immuneFirstAttack && !b.firstAttackImmunityUsed) tags.push({ label: '免第1次對敵', cls: 'tag-buff' })
  if (b.damageReduction > 0) tags.push({ label: `受傷-${b.damageReduction}（${b.damageReductionTurns}回合）`, cls: 'tag-buff' })
  if (b.darkModeActive) tags.push({ label: `暗黑模式（${b.darkModeTurns}回合）`, cls: 'tag-dark' })
  if (b.freeMovePending) tags.push({ label: '可額外移動一次', cls: 'tag-buff' })
  if (b.cantMoveThisTurn) tags.push({ label: '本回合不能移動', cls: 'tag-debuff' })
  if (b.attackBonusNextSkill > 0) tags.push({ label: `下次技能+${b.attackBonusNextSkill}`, cls: 'tag-buff' })
  return tags
})
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 200;
}
.modal {
  background: #f5f0e8; border: 3px solid #1a6eb5; border-radius: 12px;
  width: 420px; max-width: 95vw; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.modal.owner-p2 { border-color: #c01a1a; }

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.8rem 1rem; border-bottom: 1px solid #c0b5a5;
  background: #e8e0d0; border-radius: 10px 10px 0 0;
}
.header-left { display: flex; align-items: center; gap: 0.5rem; }
.bg-name { font-size: 1.1rem; font-weight: bold; color: #2a1f14; }
.class-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; color: #fff; }
.cls-BOM { background: #8b4513; }
.cls-ATK { background: #8b1010; }
.cls-SHT { background: #1055a0; }
.cls-BLC { background: #2d6a27; }
.owner-label { font-size: 0.75rem; padding: 1px 5px; border-radius: 4px; }
.owner-label.p1 { background: #cce8f4; color: #1a3a6a; border: 1px solid #1a6eb5; }
.owner-label.p2 { background: #f5d5d8; color: #6a1a1a; border: 1px solid #c01a1a; }
.close-btn {
  background: none; border: none; font-size: 1.1rem; cursor: pointer;
  color: #7a6a58; padding: 0.2rem 0.4rem; border-radius: 4px;
}
.close-btn:hover { background: #d0c8b8; }

.modal-body { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.8rem; }

.card-art-block { display: flex; gap: 0.8rem; align-items: flex-start; }
.card-art {
  width: 80px; height: 100px; flex-shrink: 0; border-radius: 6px;
  background: #b0a898; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.card-img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.stats-block { flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
.stat-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
.stat-label { width: 60px; color: #7a6a58; font-size: 0.8rem; }
.hp-bar-wrap { flex: 1; height: 8px; background: #c0b5a5; border-radius: 4px; overflow: hidden; }
.hp-bar-fill { height: 100%; background: #2a8a30; border-radius: 4px; transition: width 0.3s; }
.stat-val { font-weight: bold; color: #2a1f14; }
.stat-val.boosted { color: #1a6030; }
.bonus { font-size: 0.75rem; color: #1a7a40; margin-left: 2px; }

.status-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.tag { font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; }
.tag-stunned { background: #f0c860; color: #5a3a00; border: 1px solid #c09020; }
.tag-ko { background: #e07060; color: #fff; border: 1px solid #b04030; }
.tag-acted { background: #c8c8c8; color: #3a3a3a; border: 1px solid #909090; }
.tag-buff { background: #c8e8d8; color: #1a5030; border: 1px solid #2a8a50; }
.tag-debuff { background: #f0d8d8; color: #7a1010; border: 1px solid #c07070; }
.tag-dark { background: #2a1a4a; color: #d0b0ff; border: 1px solid #6a4aaa; }

.reaction-row { background: #e8f0e8; border: 1px solid #a0c8a0; border-radius: 6px; padding: 0.5rem 0.7rem; display: flex; flex-direction: column; gap: 0.2rem; }
.reaction-name { font-weight: bold; font-size: 0.85rem; color: #1a5030; }
.reaction-desc { font-size: 0.78rem; color: #3a5a3a; }

.section-title { font-size: 0.75rem; font-weight: bold; color: #7a6a58; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
.skills-section { display: flex; flex-direction: column; gap: 0.5rem; }
.skill-block {
  background: #eae4d8; border: 1px solid #c0b5a5; border-radius: 6px;
  padding: 0.5rem 0.7rem; transition: opacity 0.2s;
}
.skill-block.unavailable { opacity: 0.55; }
.skill-header { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; }
.skill-name { font-weight: bold; font-size: 0.85rem; color: #2a1f14; }
.skill-cd-badge { font-size: 0.72rem; padding: 1px 6px; border-radius: 4px; background: #c07040; color: #fff; }
.skill-cd-badge.ready { background: #2a8a30; }
.skill-cost { font-size: 0.72rem; padding: 1px 5px; border-radius: 4px; background: #c0a040; color: #fff; }
.skill-stun-ok { font-size: 0.7rem; padding: 1px 5px; border-radius: 4px; background: #6060c0; color: #fff; }
.skill-desc { font-size: 0.8rem; color: #4a3a28; line-height: 1.4; }
</style>
