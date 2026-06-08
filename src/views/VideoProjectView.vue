<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { NButton, NSpace, NEmpty } from 'naive-ui'
import { useProjectStore } from '@/stores/projectStore'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { useVideoProject } from '@/composables/useVideoProject'
import { useProject } from '@/composables/useProject'
import VideoPlayer from '@/components/video/VideoPlayer.vue'
import MarkdownEditor from '@/components/video/MarkdownEditor.vue'
import VideoClipBar from '@/components/video/VideoClipBar.vue'

const store = useProjectStore()
const player = useVideoPlayer()
const videoProject = useVideoProject()
const { saveProject } = useProject()

const currentTimestamp = ref(0)

function handleTimeUpdate(totalSeconds: number): void {
  currentTimestamp.value = totalSeconds
}

function handleTimestampClick(totalSeconds: number): void {
  player.seekTimeline(totalSeconds)
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

watch(() => videoProject.activeClipId.value, (newId) => {
  if (newId && store.videoClips.length > 0) {
    const clip = store.videoClips.find(c => c.id === newId)
    if (clip) {
      player.loadClip(clip)
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
        {{ store.videoClips.length }} 个片段 · 总时长 {{ player.formatTime(player.totalTimelineDuration.value) }}
      </span>
    </div>

    <!-- Main workspace -->
    <div class="workspace">
      <template v-if="store.videoClips.length > 0 || videoProject.scanning.value">
        <!-- Left: Video Player -->
        <div class="workspace-left">
          <VideoPlayer
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
