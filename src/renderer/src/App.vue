<script setup lang="ts">
import { onMounted } from 'vue'
import { NMessageProvider, NDialogProvider, NConfigProvider, zhCN, dateZhCN } from 'naive-ui'
import AppHeader from '@/components/common/AppHeader.vue'
import StatusBar from '@/components/common/StatusBar.vue'
import MessageInit from '@/components/common/MessageInit.vue'
import { useProject } from '@/composables/useProject'

import { useIpc } from '@/composables/useIpc'
import { useRouter } from 'vue-router'

const themeOverrides = {
  common: {
    primaryColor: '#6366f1',
    primaryColorHover: '#818cf8',
    primaryColorPressed: '#4f46e5'
  }
}

const { saveProject, setupFileWatcher, setupMenuListeners } = useProject()
const { on } = useIpc()
const router = useRouter()

onMounted(() => {
  setupFileWatcher()
  setupMenuListeners()

  on('menu:new-project', () => {
    router.push({ name: 'script' })
  })

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      saveProject()
    }
  })
})
</script>

<template>
  <NConfigProvider :locale="zhCN" :date-locale="dateZhCN" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <MessageInit />
        <div class="app-layout">
          <AppHeader />
          <main class="app-main">
            <router-view />
          </main>
          <StatusBar />
        </div>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  color: #1e1e2e;
  background: #fafafa;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow: hidden;
  display: flex;
}
</style>
