import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { VideoClip } from '@/types'

function toLocalVideoUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  // Encode each path segment separately so the URL parser sees proper "/" separators.
  // Use an explicit host ("local") because the protocol is registered as `standard`,
  // which requires a non-empty authority for reliable parsing across Chromium versions.
  const encoded = normalized.split('/').map(encodeURIComponent).join('/')
  return `local-video://local/${encoded}`
}

export function useVideoPlayer() {
  const store = useProjectStore()

  const videoSrc = ref('')
  const currentTime = ref(0)
  const duration = ref(0)
  const isPlaying = ref(false)
  const volume = ref(1)
  const videoElement = ref<HTMLVideoElement | null>(null)

  // When a seek-after-load is pending, loadeddata will trigger it
  const pendingSeekTime = ref<number | null>(null)
  const pendingPlay = ref(false)

  const totalTimelineDuration = computed(() =>
    store.videoClips.reduce((sum, c) => sum + c.duration, 0)
  )

  function loadClip(clip: VideoClip): void {
    videoSrc.value = toLocalVideoUrl(clip.path)
  }

  function seekTo(time: number): void {
    if (videoElement.value) {
      videoElement.value.currentTime = time
    }
  }

  function seekTimeline(timestampSeconds: number): void {
    let accumulated = 0
    for (const clip of store.videoClips) {
      if (accumulated + clip.duration > timestampSeconds) {
        const offset = timestampSeconds - accumulated
        pendingSeekTime.value = offset
        pendingPlay.value = true
        loadClip(clip)
        return
      }
      accumulated += clip.duration
    }
  }

  function play(): void {
    videoElement.value?.play().catch(() => {})
    isPlaying.value = true
  }

  function pause(): void {
    videoElement.value?.pause()
    isPlaying.value = false
  }

  function togglePlay(): void {
    if (isPlaying.value) {
      pause()
    } else {
      play()
    }
  }

  function seekForward(seconds: number = 5): void {
    if (videoElement.value) {
      videoElement.value.currentTime = Math.min(
        videoElement.value.currentTime + seconds,
        videoElement.value.duration
      )
    }
  }

  function seekBackward(seconds: number = 5): void {
    if (videoElement.value) {
      videoElement.value.currentTime = Math.max(
        videoElement.value.currentTime - seconds,
        0
      )
    }
  }

  function onVideoLoaded(clipId: string): void {
    if (!videoElement.value) return
    store.updateVideoClip(clipId, {
      duration: videoElement.value.duration,
      width: videoElement.value.videoWidth,
      height: videoElement.value.videoHeight
    })

    // Execute pending seek after the new source has loaded
    if (pendingSeekTime.value !== null) {
      seekTo(pendingSeekTime.value)
      pendingSeekTime.value = null
      if (pendingPlay.value) {
        pendingPlay.value = false
        play()
      }
    }
  }

  function onTimeUpdate(): void {
    if (videoElement.value) {
      currentTime.value = videoElement.value.currentTime
    }
  }

  function onDurationChange(): void {
    if (videoElement.value) {
      duration.value = videoElement.value.duration
    }
  }

  function onPlay(): void {
    isPlaying.value = true
  }

  function onPause(): void {
    isPlaying.value = false
  }

  function setVolume(v: number): void {
    volume.value = v
    if (videoElement.value) {
      videoElement.value.volume = v
    }
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return {
    videoSrc,
    currentTime,
    duration,
    isPlaying,
    volume,
    videoElement,
    totalTimelineDuration,
    loadClip,
    seekTo,
    seekTimeline,
    play,
    pause,
    togglePlay,
    seekForward,
    seekBackward,
    onVideoLoaded,
    onTimeUpdate,
    onDurationChange,
    onPlay,
    onPause,
    setVolume,
    formatTime
  }
}
