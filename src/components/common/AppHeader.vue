<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NTabs, NTabPane, NButton, NSpace, NPopover } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { useExport } from '@/composables/useExport'
import { useProject } from '@/composables/useProject'
import SettingsModal from '@/components/common/SettingsModal.vue'
import type { AppSettings } from '@/types'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const { handleExportPDF, handleExportExcel, hasShots } = useExport()
const { loadWorkspace } = useProject()

const showSettings = ref(false)
const workspacePath = ref('')
const appSettings = ref<AppSettings>({
  defaultShotDuration: 3,
  frameRate: 24,
  aspectRatio: '16:9'
})

const activeTab = computed(() => {
  const name = route.name as string
  if (name === 'shot-edit') return 'edit'
  if (name === 'storyboard') return 'storyboard'
  return 'script'
})

function handleTabChange(tab: string): void {
  if (tab === 'script') {
    router.push({ name: 'script' })
  } else if (tab === 'storyboard') {
    router.push({ name: 'storyboard' })
  } else if (tab === 'edit') {
    router.push({ name: 'shot-edit', params: { shotId: 'new' } })
  }
}

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
  try {
    const ws = await loadWorkspace()
    workspacePath.value = ws.workspacePath
    appSettings.value = ws.settings
  } catch {
    // non-critical
  }
})
</script>

<template>
  <div class="app-header">
    <div class="header-left">
      <span class="app-logo">🎬</span>
      <span class="app-title">Storyboard</span>
    </div>

    <div class="header-tabs">
      <NTabs
        :value="activeTab"
        type="line"
        size="medium"
        @update:value="handleTabChange"
      >
        <NTabPane name="script" tab="📝 剧本编辑" />
        <NTabPane name="storyboard" tab="📊 分镜表" />
        <NTabPane name="edit" tab="✏️ 镜头绘图" />
      </NTabs>
    </div>

    <div class="header-right">
      <span class="project-name">{{ projectStore.hasOpenProject ? projectStore.projectName : '未打开项目' }}</span>

      <NButton size="small" quaternary circle @click="handleOpenSettings" title="设置">
        ⚙️
      </NButton>

      <NPopover trigger="click" placement="bottom-end" v-if="projectStore.hasOpenProject">
        <template #trigger>
          <NButton size="small" quaternary circle>📤</NButton>
        </template>
        <NSpace vertical :size="4" style="min-width: 140px;">
          <NButton
            size="small"
            :disabled="!hasShots()"
            @click="handleExportPDF"
          >
            📄 导出 PDF 分镜表
          </NButton>
          <NButton
            size="small"
            :disabled="!hasShots()"
            @click="handleExportExcel"
          >
            📊 导出 Excel 数据
          </NButton>
        </NSpace>
      </NPopover>
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
.app-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  user-select: none;
  -webkit-app-region: drag;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 160px;
}

.app-logo {
  font-size: 20px;
}

.app-title {
  font-weight: 700;
  font-size: 16px;
  color: #6366f1;
}

.header-tabs {
  flex: 1;
  display: flex;
  justify-content: center;
  -webkit-app-region: no-drag;
}

.header-tabs :deep(.n-tabs-nav) {
  border-bottom: none;
}

.header-right {
  min-width: 220px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.project-name {
  font-size: 12px;
  color: #888;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
