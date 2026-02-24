import { createRouter, createWebHashHistory } from 'vue-router'
import Game from '../views/Game.vue'
import GameOver from '../views/GameOver.vue'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'game', component: Game },
    { path: '/game-over', name: 'gameOver', component: GameOver, props: (route) => ({ winner: route.query.winner }) },
  ],
})
