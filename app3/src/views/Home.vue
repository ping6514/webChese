<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goToCards() {
  router.push('/cards')
}

function goToRules() {
  router.push('/rules')
}
</script>

<template>
  <div class="home">
    <div class="hero">
      <h1 class="title">Beast Conquest</h1>
      <p class="subtitle">獸族征戰 - 策略卡牌對戰遊戲</p>
      <p class="version">v3.0 Alpha</p>
      <div class="actions">
        <button class="btn btn-primary" @click="goToCards">
          🎴 查看卡牌圖鑑
        </button>
        <button class="btn btn-secondary" @click="goToRules">
          📖 遊戲規則
        </button>
      </div>
    </div>
    
    <div class="features">
      <div class="feature">
        <div class="feature-icon">👑</div>
        <h3>12 張首領卡</h3>
        <p>4 個職業 × 每職業 3 張</p>
      </div>
      <div class="feature">
        <div class="feature-icon">⚔️</div>
        <h3>22 張軍團卡</h3>
        <p>通用 + 職業專屬</p>
      </div>
      <div class="feature">
        <div class="feature-icon">✨</div>
        <h3>20 張事件卡</h3>
        <p>移動、增益、控制、資源、特殊</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🛡️</div>
        <h3>20 張反應卡</h3>
        <p>觸發式防禦與反擊</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🏰</div>
        <h3>6 張建築卡</h3>
        <p>通用區域 + 基地專用</p>
      </div>
      <div class="feature">
        <div class="feature-icon">�</div>
        <h3>4 大職業</h3>
        <p>破壞者、征服者、指揮官、守護者</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  min-height: 100vh;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.hero {
  text-align: center;
  padding: 4rem 2rem;
  color: white;
}

.title {
  font-size: 4rem;
  font-weight: 800;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
}

.subtitle {
  font-size: 1.5rem;
  margin: 1rem 0;
  opacity: 0.9;
}

.version {
  font-size: 1rem;
  opacity: 0.7;
  margin-bottom: 2rem;
}

.actions {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  padding: 1rem 2rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 600;
}

.btn-primary {
  background: white;
  color: #667eea;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

.btn-secondary {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 2px solid white;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.3);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}

.features {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  padding: 2rem;
}

.feature {
  background: white;
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  transition: transform 0.3s;
}

.feature:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.2);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature h3 {
  color: #667eea;
  margin: 0.5rem 0;
}

.feature p {
  color: #666;
  margin: 0;
}
</style>
