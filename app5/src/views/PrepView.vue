<template>
  <div class="prep-view">
    <h1>備戰編輯</h1>

    <div class="squad-list">
      <div v-for="(squad, idx) in store.playerSquadConfigs" :key="idx" class="squad-card">
        <div class="squad-header">
          <div class="squad-title">
            <span class="squad-num">小隊 {{ idx + 1 }}</span>
            <span class="captain-tag">{{ getCaptainType(squad.captainId) }}</span>
          </div>
          <button class="remove-btn" @click="store.removeSquad(idx)">移除</button>
        </div>

        <!-- 隊長選擇 -->
        <div class="field-row">
          <label class="field-label">隊長</label>
          <select :value="squad.captainId" @change="(e) => onChangeCaptain(idx, e)" class="select">
            <option v-for="c in store.captainDefs" :key="c.id" :value="c.id">
              {{ c.name }}（{{ c.unitType }}）
            </option>
          </select>
        </div>

        <!-- 從者槽 -->
        <div class="field-row">
          <label class="field-label">從者 {{ squad.followerIds.length }}/{{ getMaxSlots(squad.captainId) }}</label>
          <div class="follower-row">
            <div v-for="(fid, fi) in squad.followerIds" :key="fi" class="follower-chip">
              {{ getFollowerName(fid) }}
              <button class="chip-remove" @click="store.removeFollower(idx, fi)">×</button>
            </div>
            <select
              v-if="squad.followerIds.length < getMaxSlots(squad.captainId)"
              @change="(e) => onAddFollower(idx, e)"
              class="select select-sm"
            >
              <option value="">+ 加從者</option>
              <option v-for="f in store.followerDefs" :key="f.id" :value="f.id">
                {{ f.name }}（{{ f.unitType }}）
              </option>
            </select>
          </div>
        </div>

        <!-- AI：移動序列 -->
        <div class="field-row">
          <label class="field-label">移動序列</label>
          <div class="seq-section">
            <div class="priority-list">
              <div
                v-for="(zone, zi) in squad.aiConfig.moveSequence"
                :key="zi"
                class="priority-item"
              >
                <span class="priority-rank">{{ zi + 1 }}</span>
                <span class="priority-name">{{ zoneLabel(zone) }}</span>
                <div class="priority-arrows">
                  <button :disabled="zi === 0" @click="moveSeq(idx, zi, -1)">▲</button>
                  <button :disabled="zi === squad.aiConfig.moveSequence.length - 1" @click="moveSeq(idx, zi, 1)">▼</button>
                  <button class="seq-remove" @click="removeSeq(idx, zi)">×</button>
                </div>
              </div>
            </div>
            <div class="seq-add-row">
              <select @change="(e) => onAddSeq(idx, e)" class="select select-sm">
                <option value="">+ 加入區域</option>
                <option v-for="(label, key) in ZONE_LABELS" :key="key" :value="key">{{ label }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- AI：警戒範圍 -->
        <div class="field-row">
          <label class="field-label">警戒範圍</label>
          <div class="radio-group">
            <label v-for="r in [1,2,3]" :key="r" class="radio-label">
              <input type="radio" :name="`alert_${idx}`" :value="r"
                :checked="squad.aiConfig.alertRange === r"
                @change="store.updateAIConfig(idx, { alertRange: r as 1|2|3 })" />
              {{ r }} 格
            </label>
          </div>
        </div>

        <!-- AI：目標優先 -->
        <div class="field-row">
          <label class="field-label">目標優先</label>
          <div class="priority-list">
            <div
              v-for="(item, pi) in squad.aiConfig.targetPriority"
              :key="item"
              class="priority-item"
            >
              <span class="priority-rank">{{ pi + 1 }}</span>
              <span class="priority-name">{{ targetLabel(item) }}</span>
              <div class="priority-arrows">
                <button :disabled="pi === 0" @click="moveTargetPriority(idx, pi, -1)">▲</button>
                <button :disabled="pi === squad.aiConfig.targetPriority.length - 1" @click="moveTargetPriority(idx, pi, 1)">▼</button>
              </div>
            </div>
          </div>
        </div>

        <!-- AI：動作優先 -->
        <div class="field-row">
          <label class="field-label">動作優先</label>
          <div class="priority-list">
            <div
              v-for="(item, pi) in squad.aiConfig.actionPriority"
              :key="item"
              class="priority-item"
            >
              <span class="priority-rank">{{ pi + 1 }}</span>
              <span class="priority-name">{{ actionLabel(item) }}</span>
              <div class="priority-arrows">
                <button :disabled="pi === 0" @click="moveActionPriority(idx, pi, -1)">▲</button>
                <button :disabled="pi === squad.aiConfig.actionPriority.length - 1" @click="moveActionPriority(idx, pi, 1)">▼</button>
              </div>
            </div>
          </div>
        </div>

        <!-- AI：其他 -->
        <div class="field-row">
          <label class="field-label">其他</label>
          <div class="check-row">
            <label class="check-label">
              <input type="checkbox" :checked="squad.aiConfig.loopSequence"
                @change="(e) => store.updateAIConfig(idx, { loopSequence: (e.target as HTMLInputElement).checked })" />
              重複移動序列
            </label>
            <label class="check-label">
              <input type="checkbox" :checked="squad.aiConfig.autoSP"
                @change="(e) => store.updateAIConfig(idx, { autoSP: (e.target as HTMLInputElement).checked })" />
              SP 自動施放
            </label>
          </div>
        </div>
      </div>

      <!-- 新增小隊 -->
      <div class="add-squad-card" v-if="store.playerSquadConfigs.length < 3">
        <label class="field-label">新增小隊 — 選擇隊長</label>
        <select @change="(e) => onAddSquad(e)" class="select">
          <option value="">選擇隊長 →</option>
          <option v-for="c in store.captainDefs" :key="c.id" :value="c.id">
            {{ c.name }}（{{ c.unitType }}）
          </option>
        </select>
      </div>
    </div>

    <div class="prep-footer">
      <router-link to="/battle">
        <button class="start-btn" :disabled="store.playerSquadConfigs.length === 0" @click="store.startBattle()">
          開始戰鬥 →
        </button>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/gameStore'

const store = useGameStore()

function getCaptainName(id: string) { return store.captainDefs.find(c => c.id === id)?.name ?? id }
function getCaptainType(id: string) { return store.captainDefs.find(c => c.id === id)?.unitType ?? '' }
function getMaxSlots(id: string) { return store.captainDefs.find(c => c.id === id)?.maxFollowerSlots ?? 0 }
function getFollowerName(id: string) { return store.followerDefs.find(f => f.id === id)?.name ?? id }

function onAddSquad(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val) { store.addSquad(val); (e.target as HTMLSelectElement).value = '' }
}
function onChangeCaptain(idx: number, e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val) store.playerSquadConfigs[idx].captainId = val
}
function onAddFollower(squadIdx: number, e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val) { store.addFollower(squadIdx, val); (e.target as HTMLSelectElement).value = '' }
}

const ZONE_LABELS: Record<string, string> = {
  player_base:    '我方主堡區',
  front_mid:      '前線中段',
  center:         '中央爭奪區',
  enemy_base:     '敵方主堡區',
}
function zoneLabel(k: string) { return ZONE_LABELS[k] ?? k }

function moveSeq(idx: number, zi: number, dir: -1 | 1) {
  const arr = [...store.playerSquadConfigs[idx].aiConfig.moveSequence] as string[]
  const ni = zi + dir
  ;[arr[zi], arr[ni]] = [arr[ni], arr[zi]]
  store.updateAIConfig(idx, { moveSequence: arr as any })
}
function removeSeq(idx: number, zi: number) {
  const arr = [...store.playerSquadConfigs[idx].aiConfig.moveSequence] as string[]
  arr.splice(zi, 1)
  store.updateAIConfig(idx, { moveSequence: arr as any })
}
function onAddSeq(idx: number, e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (!val) return
  const arr = [...store.playerSquadConfigs[idx].aiConfig.moveSequence, val] as any
  store.updateAIConfig(idx, { moveSequence: arr })
  ;(e.target as HTMLSelectElement).value = ''
}

const targetLabels: Record<string, string> = {
  nearest: '最近的敵隊',
  lowest_hp: '血量最低的敵隊',
  most_members: '成員最多的敵隊',
}
const actionLabels: Record<string, string> = {
  attack: '攻擊敵方',
  capture: '佔領設施',
  move: '只移動',
}
function targetLabel(k: string) { return targetLabels[k] ?? k }
function actionLabel(k: string) { return actionLabels[k] ?? k }

function moveTargetPriority(idx: number, pi: number, dir: -1 | 1) {
  const arr = [...store.playerSquadConfigs[idx].aiConfig.targetPriority] as string[]
  const ni = pi + dir
  ;[arr[pi], arr[ni]] = [arr[ni], arr[pi]]
  store.updateAIConfig(idx, { targetPriority: arr as any })
}
function moveActionPriority(idx: number, pi: number, dir: -1 | 1) {
  const arr = [...store.playerSquadConfigs[idx].aiConfig.actionPriority] as string[]
  const ni = pi + dir
  ;[arr[pi], arr[ni]] = [arr[ni], arr[pi]]
  store.updateAIConfig(idx, { actionPriority: arr as any })
}
</script>

<style scoped>
.prep-view {
  padding: 32px 24px;
  max-width: 960px;
  margin: 0 auto;
  color: #3a2e1e;
}
h1 {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  color: #5a3e1e;
  border-bottom: 2px solid #c8b090;
  padding-bottom: 8px;
}
.squad-list { display: flex; flex-direction: column; gap: 16px; }

.squad-card, .add-squad-card {
  border: 1px solid #c8b090;
  border-radius: 10px;
  padding: 18px 20px;
  background: #fdf6e8;
  box-shadow: 0 2px 6px rgba(0,0,0,0.07);
}
.squad-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px;
}
.squad-title { display: flex; align-items: center; gap: 10px; }
.squad-num { font-weight: 700; font-size: 16px; color: #5a3e1e; }
.captain-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 10px;
  background: #e8d4b0; color: #7a5a2e;
}
.remove-btn {
  background: none; border: 1px solid #c8a080; color: #a05030;
  padding: 3px 10px; border-radius: 6px; font-size: 12px; cursor: pointer;
}
.remove-btn:hover { background: #fce8d8; }

.field-row {
  display: flex; align-items: flex-start; gap: 16px;
  padding: 8px 0; border-top: 1px solid #e8dcc8;
}
.field-label {
  width: 80px; flex-shrink: 0;
  font-size: 12px; font-weight: 600; color: #8a6a3e;
  padding-top: 4px;
}
.select {
  padding: 5px 10px; border: 1px solid #c8b090;
  background: #fff8ee; color: #3a2e1e;
  border-radius: 6px; font-size: 13px; cursor: pointer;
}
.select:focus { outline: 2px solid #c8901e; }
.select-sm { font-size: 12px; padding: 3px 8px; }

.follower-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.follower-chip {
  display: flex; align-items: center; gap: 4px;
  background: #e8d4b0; padding: 3px 8px; border-radius: 14px;
  font-size: 12px; color: #5a3e1e;
}
.chip-remove {
  background: none; border: none; color: #a05030;
  cursor: pointer; font-size: 13px; line-height: 1; padding: 0;
}

.radio-group { display: flex; gap: 16px; padding-top: 4px; }
.radio-label { display: flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }

.priority-list { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.priority-item {
  display: flex; align-items: center; gap: 8px;
  background: #f4ead8; border: 1px solid #d8c8a8;
  border-radius: 6px; padding: 4px 10px;
}
.priority-rank {
  width: 18px; height: 18px; border-radius: 50%;
  background: #c8901e; color: #fff;
  font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.priority-name { flex: 1; font-size: 13px; }
.priority-arrows { display: flex; gap: 3px; }
.priority-arrows button {
  width: 22px; height: 22px; padding: 0;
  border: 1px solid #c8b090; border-radius: 4px;
  background: #fff8ee; color: #5a3e1e;
  font-size: 10px; cursor: pointer;
}
.priority-arrows button:disabled { opacity: 0.3; cursor: default; }
.priority-arrows button:not(:disabled):hover { background: #e8d4b0; }

.check-row { display: flex; gap: 20px; padding-top: 4px; }
.check-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }

.seq-section { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.seq-add-row { margin-top: 2px; }
.seq-remove { background: none; border: 1px solid #c8a080; color: #a05030; border-radius: 4px; width: 22px; height: 22px; font-size: 12px; cursor: pointer; }
.seq-remove:hover { background: #fce8d8; }

.add-squad-card { display: flex; align-items: center; gap: 12px; }

.prep-footer { margin-top: 24px; text-align: right; }
.start-btn {
  padding: 12px 40px; background: #c8701e;
  border: none; color: #fff; border-radius: 8px;
  font-size: 16px; font-weight: 700; cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.start-btn:hover { background: #a85c10; }
.start-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
