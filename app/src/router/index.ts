import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import GameOver from '../views/GameOver.vue'
import IntroPage from '../views/IntroPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: Home },
    { path: '/intro', name: 'intro', component: IntroPage },
    { path: '/game', name: 'game', component: () => import('../views/GameV2.vue') },
    { path: '/game-v2', name: 'gameV2', component: () => import('../views/GameV2.vue') },
    { path: '/game-over', name: 'gameOver', component: GameOver, props: (route) => ({ winner: route.query.winner }) },
  ],
})
