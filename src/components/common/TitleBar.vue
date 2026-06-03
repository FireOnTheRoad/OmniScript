<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useIpc } from '@/composables/useIpc'

const { invoke, on } = useIpc()

const isMaximized = ref(false)

let unsubscribeMaximizeChange: (() => void) | null = null

async function handleMinimize(): Promise<void> {
  await invoke('window:minimize')
}

async function handleMaximize(): Promise<void> {
  await invoke('window:maximize')
}

async function handleClose(): Promise<void> {
  await invoke('window:close')
}

function handleDblClick(): void {
  handleMaximize()
}

onMounted(async () => {
  const maximized = await invoke<boolean>('window:is-maximized')
  isMaximized.value = maximized

  unsubscribeMaximizeChange = on('window:maximize-change', (maximized: unknown) => {
    isMaximized.value = !!maximized
  })
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
      <span class="title-bar-text">Storyboard - 分镜设计</span>
    </div>
    <div class="title-bar-center"></div>
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
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  height: 32px;
  background: #ffffff;
  user-select: none;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.title-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 16px;
  min-width: 160px;
}

.title-bar-text {
  font-weight: 700;
  font-size: 13px;
  color: #6366f1;
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
