<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NButton } from 'naive-ui'
import { useIpc } from '@/composables/useIpc'
import { useProject } from '@/composables/useProject'
import SettingsModal from '@/components/common/SettingsModal.vue'
import type { AppSettings } from '@/types'

const { invoke, on } = useIpc()
const { loadWorkspace } = useProject()

const isMaximized = ref(false)
const showSettings = ref(false)
const workspacePath = ref('')
const appSettings = ref<AppSettings>({
  defaultShotDuration: 3,
  frameRate: 24,
  aspectRatio: '16:9'
})

let unsubscribeMaximizeChange: (() => void) | null = null

async function handleMinimize(): Promise<void> { await invoke('window:minimize') }
async function handleMaximize(): Promise<void> { await invoke('window:maximize') }
async function handleClose(): Promise<void> { await invoke('window:close') }
function handleDblClick(): void { handleMaximize() }

async function handleOpenSettings(): Promise<void> {
  const ws = await loadWorkspace()
  workspacePath.value = ws.workspacePath
  appSettings.value = ws.settings
  showSettings.value = true
}

function handleSettingsUpdated(): void {
  loadWorkspace().then((ws) => {
    workspacePath.value = ws.workspacePath
    appSettings.value = ws.settings
  })
}

onMounted(async () => {
  const maximized = await invoke<boolean>('window:is-maximized')
  isMaximized.value = maximized

  unsubscribeMaximizeChange = on('window:maximize-change', (maximized: unknown) => {
    isMaximized.value = !!maximized
  })

  try {
    const ws = await loadWorkspace()
    workspacePath.value = ws.workspacePath
    appSettings.value = ws.settings
  } catch { /* non-critical */ }
})

onUnmounted(() => {
  if (unsubscribeMaximizeChange) {
    unsubscribeMaximizeChange()
    unsubscribeMaximizeChange = null
  }
})
</script>

<template>
  <div class="title-bar" @dblclick="handleDblClick">
    <div class="title-bar-left">
      <span class="title-bar-logo">🎬</span>
      <span class="title-bar-text">ShotForge</span>
      <NButton
        size="tiny"
        quaternary
        circle
        @click="handleOpenSettings"
        title="设置"
        class="settings-btn"
      >
        ⚙️
      </NButton>
    </div>

    <div class="title-bar-center" />

    <div class="title-bar-controls">
      <div class="window-btn minimize-btn" @click="handleMinimize" title="最小化">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
        </svg>
      </div>
      <div class="window-btn max-btn" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
        <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
          <rect x="3" y="0" width="8" height="8" rx="0.5" fill="none" stroke="currentColor" stroke-width="1" />
          <rect x="0.5" y="3.5" width="8" height="8" rx="0.5" fill="currentColor" />
          <rect x="1.5" y="4.5" width="6" height="6" rx="0.3" fill="#fff" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="1" width="10" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1" />
        </svg>
      </div>
      <div class="window-btn close-btn" @click="handleClose" title="关闭">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" stroke-width="1.2" />
          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </div>
    </div>
  </div>

  <SettingsModal
    :show="showSettings"
    :workspace-path="workspacePath"
    :settings="appSettings"
    @update:show="showSettings = $event"
    @updated="handleSettingsUpdated"
  />
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  height: 32px;
  background: #f5f5f7;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 12px;
  -webkit-app-region: no-drag;
}

.title-bar-logo {
  font-size: 14px;
  line-height: 1;
}

.title-bar-text {
  font-weight: 700;
  font-size: 13px;
  color: #6366f1;
}

.settings-btn {
  opacity: 0.45;
  transition: opacity 0.15s;
  color: #555;
}

.settings-btn:hover {
  opacity: 1;
}

.title-bar-center {
  flex: 1;
}

.title-bar-controls {
  display: flex;
  -webkit-app-region: no-drag;
}

.window-btn {
  width: 46px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  transition: background 0.1s;
  cursor: pointer;
}

.window-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.window-btn:active {
  background: rgba(0, 0, 0, 0.10);
}

.close-btn:hover {
  background: #e81123;
  color: #fff;
}

.close-btn:active {
  background: #bf0f1b;
  color: #fff;
}
</style>
