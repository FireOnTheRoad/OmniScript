<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NScrollbar } from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import type { VideoClip } from '@/types'

const props = defineProps<{
  clips: VideoClip[]
  currentClipId: string | null
}>()

const emit = defineEmits<{
  selectClip: [clipId: string]
  addClip: []
}>()

const store = useProjectStore()

const sortedClips = computed(() =>
  [...store.videoClips].sort((a, b) => a.order - b.order)
)

function formatDuration(seconds: number): string {
  if (!seconds) return '--:--'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<template>
  <div class="video-clip-bar">
    <div class="clip-bar-header">
      <span class="clip-bar-title">🎬 素材片段 ({{ sortedClips.length }})</span>
      <NButton size="tiny" type="primary" @click="emit('addClip')">+ 添加素材</NButton>
    </div>
    <NScrollbar x-scrollable>
      <div class="clip-bar-list">
        <div
          v-for="clip in sortedClips"
          :key="clip.id"
          class="clip-card"
          :class="{ active: currentClipId === clip.id }"
          @click="emit('selectClip', clip.id)"
        >
          <div class="clip-thumb">
            <span>{{ clip.order }}</span>
          </div>
          <div class="clip-info">
            <div class="clip-name" :title="clip.name">{{ clip.name }}</div>
            <div class="clip-duration">{{ formatDuration(clip.duration) }}</div>
          </div>
        </div>
        <div v-if="sortedClips.length === 0" class="clip-empty">
          暂无素材，请点击"添加素材"按钮
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.video-clip-bar {
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
  height: 110px;
}

.clip-bar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.clip-bar-title {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.clip-bar-list {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  min-height: 70px;
}

.clip-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #fff;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  flex-shrink: 0;
  min-width: 120px;
}

.clip-card:hover {
  border-color: #818cf8;
}

.clip-card.active {
  border-color: #6366f1;
  background: #f0f0ff;
}

.clip-thumb {
  width: 36px;
  height: 36px;
  background: #e5e7eb;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #888;
  flex-shrink: 0;
}

.clip-card.active .clip-thumb {
  background: #6366f1;
  color: #fff;
}

.clip-info {
  min-width: 0;
}

.clip-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100px;
}

.clip-duration {
  font-size: 11px;
  color: #888;
  font-variant-numeric: tabular-nums;
}

.clip-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 12px;
  width: 100%;
}
</style>
