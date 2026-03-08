import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'

// Apply saved body font size on startup
const savedFontSize = Number(localStorage.getItem('v2_font_size') ?? 16)
if (savedFontSize !== 16) document.documentElement.style.fontSize = `${savedFontSize}px`

createApp(App).use(createPinia()).use(router).mount('#app')
