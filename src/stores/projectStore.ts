import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ProjectData, ProjectMeta, Shot, StoryboardData } from '@/types'

export const useProjectStore = defineStore('project', () => {
  const projectPath = ref('')
  const projectName = ref('')
  const meta = ref<ProjectMeta | null>(null)
  const script = ref('')
  const shots = ref<Shot[]>([])

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
    meta: meta.value,
    script: script.value,
    storyboard: storyboard.value,
    projectPath: projectPath.value
  }))

  const hasOpenProject = computed(() => projectPath.value !== '')

  function setProject(data: ProjectData): void {
    projectPath.value = data.projectPath
    projectName.value = data.meta?.name || ''
    meta.value = data.meta
    script.value = data.script
    shots.value = data.storyboard.shots || []
  }

  function clearProject(): void {
    projectPath.value = ''
    projectName.value = ''
    meta.value = null
    script.value = ''
    shots.value = []
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

  return {
    projectPath,
    projectName,
    meta,
    script,
    shots,
    totalDuration,
    shotCount,
    storyboard,
    projectData,
    hasOpenProject,
    setProject,
    clearProject,
    addShot,
    updateShot,
    removeShot,
    reorderShots,
    renumberShots,
    updateScript,
    updateMeta,
    getShotsByParagraph
  }
})
