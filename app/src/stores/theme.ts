import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'dark' | 'light'

export const useThemeStore = defineStore('theme', () => {
  const current = ref<Theme>((localStorage.getItem('ymc-theme') as Theme) ?? 'dark')

  function apply(t: Theme) {
    current.value = t
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('ymc-theme', t)
  }

  function init() {
    apply(current.value)
  }

  function toggle() {
    apply(current.value === 'dark' ? 'light' : 'dark')
  }

  return { current, init, toggle, apply }
})
