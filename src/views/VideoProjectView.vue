<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { NButton, NSpace, NEmpty } from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useVideoProject } from '@/composables/useVideoProject'
import { useProject } from '@/composables/useProject'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import MarkdownEditor from '@/components/video/MarkdownEditor.vue'
import VideoClipBar from '@/components/video/VideoClipBar.vue'
import type { VideoClip } from '@/types'

const store = useProjectStore()
const videoProject = useVideoProject()
const { saveProject } = useProject()

// Ref to the VideoPlayer child — we drive seek/load through its exposed API
// so we share state with the actual <video> element instead of creating a
// detached useVideoPlayer() instance here.
const playerRef = ref<{
  seekTimeline: (totalSeconds: number) => void
  loadClip: (clip: VideoClip) => void
} | null>(null)

const currentTimestamp = ref(0)

function handleTimeUpdate(totalSeconds: number): void {
  currentTimestamp.value = totalSeconds
}

function handleTimestampClick(totalSeconds: number): void {
  playerRef.value?.seekTimeline(totalSeconds)
}

function handleSelectClip(clipId: string): void {
  videoProject.selectClip(clipId)
}

async function handleAddClip(): Promise<void> {
  await videoProject.scanFolder()
}

async function handleScanFolder(): Promise<void> {
  await videoProject.scanFolder()
}

function handleSave(): void {
  saveProject()
}

// Total timeline duration for toolbar display (computed from store directly,
// not from a separate useVideoPlayer instance).
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const totalDuration = (): number =>
  store.videoClips.reduce((sum, c) => sum + c.duration, 0)

watch(() => videoProject.activeClipId.value, (newId) => {
  if (newId && store.videoClips.length > 0) {
    const clip = store.videoClips.find(c => c.id === newId)
    if (clip) {
      playerRef.value?.loadClip(clip)
    }
  }
})

onMounted(() => {
  if (store.videoClips.length > 0 && !videoProject.activeClipId.value) {
    const sorted = [...store.videoClips].sort((a, b) => a.order - b.order)
    videoProject.selectClip(sorted[0].id)
  }
})
</script>

<template>
  <div class="video-project-view">
    <!-- Toolbar -->
    <div class="video-toolbar">
      <NSpace :size="8">
        <NButton size="small" @click="handleScanFolder" :loading="videoProject.scanning.value">
          📂 打开素材文件夹
        </NButton>
        <NButton size="small" type="primary" @click="handleSave">
          💾 保存
        </NButton>
      </NSpace>
      <span class="toolbar-info" v-if="store.videoClips.length > 0">
        {{ store.videoClips.length }} 个片段 · 总时长 {{ formatTime(totalDuration()) }}
      </span>
    </div>

    <!-- Main workspace -->
    <div class="workspace">
      <template v-if="store.videoClips.length > 0 || videoProject.scanning.value">
        <!-- Left: Video Player -->
        <div class="workspace-left">
          <VideoPlayer
            ref="playerRef"
            :currentClipId="videoProject.activeClipId.value"
            @timeUpdate="handleTimeUpdate"
          />
        </div>

        <!-- Right: Markdown Editor -->
        <div class="workspace-right">
          <MarkdownEditor
            :currentTimestamp="currentTimestamp"
            @update:markdown="(v) => store.updateVideoMarkdown(v)"
            @timestampClick="handleTimestampClick"
          />
        </div>
      </template>

      <template v-else>
        <div class="workspace-empty">
          <NEmpty description="暂无视频素材">
            <template #extra>
              <NButton type="primary" @click="handleScanFolder">
                📂 选择视频素材文件夹
              </NButton>
            </template>
          </NEmpty>
        </div>
      </template>
    </div>

    <!-- Bottom: Clip Bar -->
    <VideoClipBar
      :clips="store.videoClips"
      :currentClipId="videoProject.activeClipId.value"
      @selectClip="handleSelectClip"
      @addClip="handleAddClip"
    />
  </div>
</template>

<style scoped>
.video-project-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.video-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
  flex-shrink: 0;
}

.toolbar-info {
  font-size: 12px;
  color: #888;
}

.workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.workspace-left {
  flex: 1;
  min-width: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
}

.workspace-right {
  flex: 1;
  min-width: 0;
  padding: 8px 8px 8px 0;
  display: flex;
  flex-direction: column;
}

.workspace-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
