import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProjectData, ProjectMeta, ProjectType, Shot, StoryboardData, VideoClip } from '@/types'

export const useProjectStore = defineStore('project', () => {
  const projectPath = ref('')
  const projectName = ref('')
  const meta = ref<ProjectMeta | null>(null)
  const script = ref('')
  const shots = ref<Shot[]>([])
  const projectType = ref<ProjectType>('script')
  const videoClips = ref<VideoClip[]>([])
  const videoMarkdown = ref('')

  const totalDuration = computed(() => {
    let total = 0
    for (const shot of shots.value) {
      total += shot.duration || 0
    }
    return total
  })

  const shotCount = computed(() => shots.value.length)

  const storyboard = computed<StoryboardData>(() => ({
    shots: shots.value,
    totalDuration: totalDuration.value,
    shotCount: shotCount.value
  }))

  const projectData = computed<ProjectData>(() => ({
    meta: meta.value ? { ...meta.value, projectType: projectType.value } : null,
    script: script.value,
    storyboard: storyboard.value,
    projectPath: projectPath.value,
    video: projectType.value === 'video'
      ? { clips: videoClips.value, sourceFolder: '', markdown: videoMarkdown.value }
      : undefined
  }))

  const hasOpenProject = computed(() => projectPath.value !== '')

  const isVideoProject = computed(() => projectType.value === 'video')
  const isScriptProject = computed(() => projectType.value === 'script')

  function setProject(data: ProjectData): void {
    projectPath.value = data.projectPath
    projectName.value = data.meta?.name || ''
    meta.value = data.meta
    script.value = data.script
    shots.value = data.storyboard.shots || []
    projectType.value = data.meta?.projectType || 'script'
    if (data.video) {
      videoClips.value = data.video.clips || []
      videoMarkdown.value = data.video.markdown || ''
    } else {
      videoClips.value = []
      videoMarkdown.value = ''
    }
  }

  function clearProject(): void {
    projectPath.value = ''
    projectName.value = ''
    meta.value = null
    script.value = ''
    shots.value = []
    projectType.value = 'script'
    videoClips.value = []
    videoMarkdown.value = ''
  }

  function addShot(shot: Shot): void {
    shots.value.push(shot)
  }

  function updateShot(shotId: string, updates: Partial<Shot>): void {
    const index = shots.value.findIndex((s) => s.id === shotId)
    if (index !== -1) {
      shots.value[index] = { ...shots.value[index], ...updates }
    }
  }

  function removeShot(shotId: string): void {
    shots.value = shots.value.filter((s) => s.id !== shotId)
    renumberShots()
  }

  function reorderShots(fromIndex: number, toIndex: number): void {
    const item = shots.value.splice(fromIndex, 1)[0]
    shots.value.splice(toIndex, 0, item)
    renumberShots()
  }

  function renumberShots(): void {
    shots.value.forEach((shot, index) => {
      shot.number = index + 1
    })
  }

  function updateScript(newScript: string): void {
    script.value = newScript
  }

  function updateMeta(updates: Partial<ProjectMeta>): void {
    if (meta.value) {
      meta.value = { ...meta.value, ...updates }
    }
  }

  function getShotsByParagraph(paragraphIndex: number): Shot[] {
    return shots.value.filter(
      (s) => s.scriptRef?.paragraphIndex === paragraphIndex
    )
  }

  function updateVideoMarkdown(text: string): void {
    videoMarkdown.value = text
  }

  function setVideoClips(clips: VideoClip[]): void {
    videoClips.value = clips
  }

  function updateVideoClip(clipId: string, updates: Partial<VideoClip>): void {
    const idx = videoClips.value.findIndex((c) => c.id === clipId)
    if (idx !== -1) {
      videoClips.value[idx] = { ...videoClips.value[idx], ...updates }
    }
  }

  function removeVideoClip(clipId: string): void {
    videoClips.value = videoClips.value.filter((c) => c.id !== clipId)
  }

  function reorderVideoClips(fromIndex: number, toIndex: number): void {
    const item = videoClips.value.splice(fromIndex, 1)[0]
    videoClips.value.splice(toIndex, 0, item)
    videoClips.value.forEach((c, i) => {
      c.order = i + 1
    })
  }

  return {
    projectPath,
    projectName,
    meta,
    script,
    shots,
    projectType,
    videoClips,
    videoMarkdown,
    totalDuration,
    shotCount,
    storyboard,
    projectData,
    hasOpenProject,
    isVideoProject,
    isScriptProject,
    setProject,
    clearProject,
    addShot,
    updateShot,
    removeShot,
    reorderShots,
    renumberShots,
    updateScript,
    updateMeta,
    getShotsByParagraph,
    updateVideoMarkdown,
    setVideoClips,
    updateVideoClip,
    removeVideoClip,
    reorderVideoClips
  }
})
