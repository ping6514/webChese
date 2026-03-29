import { createRouter, createWebHistory } from 'vue-router'
import PrepView from '../views/PrepView.vue'
import BattleView from '../views/BattleView.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: PrepView },
    { path: '/battle', component: BattleView },
  ]
})
