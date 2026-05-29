import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from '@/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')

const _ResizeObserver = window.ResizeObserver
window.ResizeObserver = class ResizeObserver extends _ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    super((entries, observer) => {
      requestAnimationFrame(() => {
        try {
          callback(entries, observer)
        } catch {
          // suppress ResizeObserver loop limit exceeded
        }
      })
    })
  }
}
