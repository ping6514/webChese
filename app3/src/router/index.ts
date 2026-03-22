import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue')
  },
  {
    path: '/cards',
    name: 'Cards',
    component: () => import('../views/CardsGallery.vue')
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('../views/GameRules.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
