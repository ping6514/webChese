import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import GameView from '../views/GameView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/game', component: GameView },
  ],
})
