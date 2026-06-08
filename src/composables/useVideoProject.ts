import { ref } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import { useIpc } from './useIpc'
import { useProject } from './useProject'
import { notify } from '@/utils/notify'
import { exportVideoTimeline } from '@/utils/export-video-timeline'
import type { VideoClip } from '@/types'

export function useVideoProject() {
  const store = useProjectStore()
  const { invoke } = useIpc()
  const { saveProject } = useProject()

  const scanning = ref(false)
  const activeClipId = ref<string | null>(null)

  async function scanFolder(): Promise<boolean> {
    if (!store.hasOpenProject) return false
    scanning.value = true
    try {
      const result = await invoke<{
        success: boolean
        clips?: VideoClip[]
        sourceFolder?: string
        error?: string
        canceled?: boolean
      }>('video:scan-folder', store.projectPath)

      if (result.canceled) {
        scanning.value = false
        return false
      }

      if (result.success && result.clips) {
        store.setVideoClips(result.clips)
        await saveProject(true)

        // Warn about formats Chromium may not support
        const unsupportedExts = ['.avi', '.mkv', '.mov']
        const badClips = result.clips.filter(c => {
          const ext = '.' + (c.name.split('.').pop()?.toLowerCase() || '')
          return unsupportedExts.includes(ext)
        })
        if (badClips.length > 0) {
          notify().warning(
            `${badClips.length} 个文件可能无法播放（${badClips.map(c => c.name).join('、')}），建议转换为 MP4 (H.264) 格式`
          )
        }

        notify().success(`已扫描到 ${result.clips.length} 个视频文件`)
        if (result.clips.length > 0 && !activeClipId.value) {
          activeClipId.value = result.clips[0].id
        }
        scanning.value = false
        return true
      }

      notify().error(result.error || '扫描失败')
      scanning.value = false
      return false
    } catch (err) {
      notify().error(`扫描失败：${String(err)}`)
      scanning.value = false
      return false
    }
  }

  function selectClip(clipId: string): void {
    activeClipId.value = clipId
  }

  function insertTimestamp(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600)
    const m = Math.floor((totalSeconds % 3600) / 60)
    const s = Math.floor(totalSeconds % 60)
    return `[${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
  }

  function parseTimestamp(ts: string): number | null {
    const match = ts.match(/\[(\d{2}):(\d{2}):(\d{2})\]/)
    if (!match) return null
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  async function exportMarkdown(): Promise<void> {
    const content = store.videoMarkdown
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${store.projectName || 'video'}-稿件.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportPlainText(): Promise<void> {
    const content = store.videoMarkdown
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${store.projectName || 'video'}-纯文本.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function exportTimeline(): Promise<void> {
    await exportVideoTimeline(store.projectName || 'video', store.videoClips)
  }

  return {
    scanning,
    activeClipId,
    scanFolder,
    selectClip,
    insertTimestamp,
    parseTimestamp,
    formatTime,
    exportMarkdown,
    exportPlainText,
    exportTimeline
  }
}
