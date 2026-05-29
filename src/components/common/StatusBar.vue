<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'

const projectStore = useProjectStore()

const statusText = computed(() => {
  if (!projectStore.hasOpenProject) return '就绪 — 请打开或新建项目'
  return `项目已加载 — ${projectStore.projectPath}`
})
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span v-if="projectStore.hasOpenProject">📊 {{ projectStore.shotCount }} 个镜头</span>
      <span v-if="projectStore.hasOpenProject">| ⏱ {{ projectStore.totalDuration.toFixed(1) }}s</span>
    </div>
    <div class="status-right">
      <span>{{ statusText }}</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  height: 28px;
  background: #f0f0f0;
  border-top: 1px solid #e5e7eb;
  font-size: 12px;
  color: #888;
}

.status-left {
  display: flex;
  gap: 16px;
}

.status-right {
  color: #aaa;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
