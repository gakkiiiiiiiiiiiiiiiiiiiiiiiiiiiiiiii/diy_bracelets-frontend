// #ifdef H5
;(globalThis as any).__VITE_API_BASE__ = (import.meta as any).env?.VITE_API_BASE || ''
// #endif
import { createSSRApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  app.use(createPinia())
  return { app }
}
