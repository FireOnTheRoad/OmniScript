<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NSlider, NSpace } from 'naive-ui'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { useProjectStore } from '@/stores/projectStore'
import { notify } from '@/utils/notify'

const props = defineProps<{
  currentClipId: string | null
}>()

const emit = defineEmits<{
  timeUpdate: [totalSeconds: number]
}>()

const store = useProjectStore()
const {
  videoSrc, currentTime, duration, isPlaying, volume, videoElement,
  loadClip, seekTo, seekTimeline, play, pause, togglePlay,
  seekForward, seekBackward, onVideoLoaded, onTimeUpdate,
  onDurationChange, onPlay, onPause, setVolume, formatTime
} = useVideoPlayer()

const videoError = ref('')

function switchToClip(clipId: string): void {
  videoError.value = ''
  const clip = store.videoClips.find(c => c.id === clipId)
  if (clip) {
    loadClip(clip)
  }
}

function handleLoadedData(): void {
  videoError.value = ''
  if (props.currentClipId) {
    onVideoLoaded(props.currentClipId)
  }
}

function handleVideoError(): void {
  const clip = store.videoClips.find(c => c.id === props.currentClipId)
  const name = clip?.name || '未知文件'
  videoError.value = `无法播放「${name}」，浏览器不支持此视频编码格式。建议转换为 MP4 (H.264/AAC) 格式。`
  notify().error(videoError.value)
}

function handleTimeUpdate(): void {
  onTimeUpdate()
  if (props.currentClipId) {
    const clip = store.videoClips.find(c => c.id === props.currentClipId)
    if (clip) {
      let offset = 0
      for (const c of store.videoClips) {
        if (c.order < clip.order) offset += c.duration
      }
      emit('timeUpdate', offset + currentTime.value)
    }
  }
}

function handleSeekSlider(value: number): void {
  seekTo(value)
}

function handlePrevClip(): void {
  if (!props.currentClipId) return
  const sorted = [...store.videoClips].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(c => c.id === props.currentClipId)
  if (idx > 0) {
    loadClip(sorted[idx - 1])
  }
}

function handleNextClip(): void {
  if (!props.currentClipId) return
  const sorted = [...store.videoClips].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex(c => c.id === props.currentClipId)
  if (idx < sorted.length - 1) {
    loadClip(sorted[idx + 1])
  }
}

watch(() => props.currentClipId, (newId) => {
  if (newId) switchToClip(newId)
})

defineExpose({ seekTimeline, loadClip })
</script>

<template>
  <div class="video-player">
    <div class="video-container">
      <video
        ref="videoElement"
        :src="videoSrc"
        @loadeddata="handleLoadedData"
        @timeupdate="handleTimeUpdate"
        @durationchange="onDurationChange"
        @play="onPlay"
        @pause="onPause"
        @error="handleVideoError"
        class="video-element"
      />
      <div v-if="videoError" class="video-placeholder video-error">
        <span>{{ videoError }}</span>
      </div>
      <div v-else-if="!videoSrc" class="video-placeholder">
        <span>请选择视频片段</span>
      </div>
    </div>

    <div class="video-controls">
      <div class="controls-row">
        <NSlider
          :value="currentTime"
          :max="duration || 100"
          :step="0.1"
          @update:value="handleSeekSlider"
          class="progress-slider"
        />
      </div>
      <div class="controls-row">
        <NSpace :size="4" align="center">
          <NButton size="tiny" quaternary @click="handlePrevClip" :disabled="!currentClipId">⏮</NButton>
          <NButton size="tiny" quaternary @click="seekBackward()">⏪</NButton>
          <NButton size="small" type="primary" circle @click="togglePlay">
            {{ isPlaying ? '⏸' : '▶' }}
          </NButton>
          <NButton size="tiny" quaternary @click="seekForward()">⏩</NButton>
          <NButton size="tiny" quaternary @click="handleNextClip" :disabled="!currentClipId">⏭</NButton>
        </NSpace>
        <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
        <NSpace :size="4" align="center" class="volume-control">
          <span style="font-size: 12px">🔊</span>
          <NSlider
            :value="volume * 100"
            :max="100"
            :step="1"
            style="width: 60px"
            @update:value="(v: number) => setVolume(v / 100)"
          />
        </NSpace>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000;
  border-radius: 6px;
  overflow: hidden;
}

.video-container {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.video-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
}

.video-error {
  color: #f87171;
  font-size: 13px;
  padding: 24px;
  text-align: center;
  line-height: 1.6;
}

.video-controls {
  background: #1a1a2e;
  padding: 6px 12px 8px;
  flex-shrink: 0;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.controls-row + .controls-row {
  margin-top: 4px;
}

.progress-slider {
  flex: 1;
}

.progress-slider :deep(.n-slider-rail) {
  height: 4px;
}

.time-display {
  font-size: 12px;
  color: #ccc;
  font-variant-numeric: tabular-nums;
  min-width: 130px;
  text-align: center;
}

.volume-control {
  margin-left: auto;
}
</style>
