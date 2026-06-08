<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NPopover, NSpace } from 'naive-ui'
import { useRouter, useRoute } from 'vue-router'
import { useProjectStore } from '@/stores/projectStore'
import { useExport } from '@/composables/useExport'
import { useProject } from '@/composables/useProject'
import { useVideoProject } from '@/composables/useVideoProject'
import { notify } from '@/utils/notify'

const router = useRouter()
const route = useRoute()
const projectStore = useProjectStore()
const { handleExportPDF, handleExportExcel, hasShots } = useExport()
const { saveProject } = useProject()
const { exportMarkdown, exportPlainText, exportTimeline } = useVideoProject()
const goingHome = ref(false)

const tabs = computed(() => {
  if (projectStore.projectType === 'video') {
    return [{ key: 'video', label: '🎬 视频稿件' }]
  }
  return [
    { key: 'script', label: '📝 剧本编辑' },
    { key: 'storyboard', label: '📊 分镜表' },
    { key: 'shot', label: '✏️ 镜头绘图' }
  ]
})

const activeTab = computed(() => {
  const name = route.name as string
  if (projectStore.projectType === 'video') return 'video'
  if (name === 'shot-edit') return 'shot'
  if (name === 'storyboard') return 'storyboard'
  return 'script'
})

function handleTabClick(key: string): void {
  if (key === 'video') router.push({ name: 'video' })
  else if (key === 'script') router.push({ name: 'script' })
  else if (key === 'storyboard') router.push({ name: 'storyboard' })
  else if (key === 'shot') router.push({ name: 'shot-edit', params: { shotId: 'new' } })
}

async function handleGoHome(): Promise<void> {
  if (goingHome.value) return
  goingHome.value = true
  try {
    await saveProject(true)
    notify().success('项目已保存')
    projectStore.clearProject()
    router.push({ name: 'script' })
  } catch {
    notify().error('保存失败')
  } finally {
    goingHome.value = false
  }
}
</script>

<template>
  <div class="project-header">
    <div class="header-left">
      <NButton
        size="tiny"
        quaternary
        @click="handleGoHome"
        :loading="goingHome"
        class="back-btn"
      >
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </template>
        返回
      </NButton>
    </div>

    <div class="header-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="handleTabClick(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="header-spacer" />

    <div class="header-right">
      <span class="project-name">{{ projectStore.projectName }}</span>

      <NPopover trigger="click" placement="bottom-end">
        <template #trigger>
          <NButton size="tiny" quaternary>📤 导出</NButton>
        </template>
        <NSpace vertical :size="4" style="min-width: 150px;">
          <template v-if="projectStore.isVideoProject">
            <NButton size="small" @click="exportMarkdown">
              📄 导出 Markdown
            </NButton>
            <NButton size="small" @click="exportPlainText">
              📝 导出纯文本
            </NButton>
            <NButton size="small" @click="exportTimeline">
              📊 导出时间线 Excel
            </NButton>
          </template>
          <template v-else>
            <NButton size="small" :disabled="!hasShots()" @click="handleExportPDF">
              📄 导出 PDF 分镜表
            </NButton>
            <NButton size="small" :disabled="!hasShots()" @click="handleExportExcel">
              📊 导出 Excel 数据
            </NButton>
          </template>
        </NSpace>
      </NPopover>
    </div>
  </div>
</template>

<style scoped>
.project-header {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 8px;
  background: #fff;
  flex-shrink: 0;
  user-select: none;
  box-shadow: inset 0 -1px 0 #e5e7eb;
}

.header-left {
  display: flex;
  align-items: center;
}

.back-btn {
  font-size: 12px;
  color: #6366f1;
  font-weight: 500;
}

.back-btn:hover {
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.08);
}

.header-tabs {
  display: flex;
  align-items: center;
  margin-left: 4px;
}

.tab-btn {
  position: relative;
  background: none;
  border: none;
  padding: 10px 16px;
  font-size: 13px;
  color: #5f6368;
  cursor: pointer;
  transition: color 0.2s, background 0.2s;
  line-height: 1;
  font-family: inherit;
  letter-spacing: 0.01em;
  border-radius: 8px 8px 0 0;
}

.tab-btn:hover {
  color: #1f1f1f;
  background: rgba(0, 0, 0, 0.04);
}

.tab-btn.active {
  color: #6366f1;
  font-weight: 600;
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 12px;
  right: 12px;
  height: 3px;
  background: #6366f1;
  border-radius: 3px 3px 0 0;
}

.header-spacer {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
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
