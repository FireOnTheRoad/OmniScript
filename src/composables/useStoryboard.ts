import { useProjectStore } from '@/stores/projectStore'
import { useSelectionStore } from '@/stores/selectionStore'
import { useScript } from './useScript'
import type { Shot, ShotScene, ShotCamera, ShotTransition } from '@/types'

let shotCounter = 0

export function useStoryboard() {
  const projectStore = useProjectStore()
  const selectionStore = useSelectionStore()
  const { parseParagraphs } = useScript()

  function getMaxShotNumber(): number {
    let max = 0
    for (const shot of projectStore.shots) {
      if (shot.number > max) max = shot.number
    }
    return max
  }

  function createShot(overrides: Partial<Shot> = {}): Shot {
    shotCounter++
    const number = getMaxShotNumber() + 1
    return {
      id: `shot-${Date.now()}-${shotCounter}`,
      number,
      scene: '中景' as ShotScene,
      camera: '固定' as ShotCamera,
      duration: projectStore.meta?.settings.defaultShotDuration ?? 3,
      dialogue: '',
      description: '',
      scriptRef: undefined,
      refImage: undefined,
      sketch: undefined,
      annotations: undefined,
      transition: '切' as ShotTransition,
      notes: '',
      ...overrides
    }
  }

  function addShotForParagraph(paragraphIndex: number, paragraphText: string): Shot {
    const shot = createShot({
      scriptRef: {
        paragraphIndex,
        text: paragraphText.substring(0, 100)
      }
    })
    projectStore.addShot(shot)
    return shot
  }

  function smartSplitAll(): void {
    const paragraphs = parseParagraphs(projectStore.script)

    for (let i = 0; i < paragraphs.length; i++) {
      const existing = projectStore.shots.filter(
        (s) => s.scriptRef?.paragraphIndex === i
      )
      if (existing.length === 0) {
        addShotForParagraph(i, paragraphs[i])
      }
    }
  }

  function smartSplitSelected(paragraphIndex: number, count = 1): Shot[] {
    const shots: Shot[] = []
    for (let i = 0; i < count; i++) {
      const shot = addShotForParagraph(paragraphIndex, '')
      shots.push(shot)
    }
    return shots
  }

  function getShotsForSelectedParagraph(): Shot[] {
    const idx = selectionStore.selectedParagraphIndex
    if (idx < 0) return []
    return projectStore.getShotsByParagraph(idx)
  }

  function deleteShot(shotId: string): void {
    projectStore.removeShot(shotId)
    if (selectionStore.selectedShotId === shotId) {
      selectionStore.clearShotSelection()
    }
  }

  function moveShot(fromIndex: number, toIndex: number): void {
    projectStore.reorderShots(fromIndex, toIndex)
  }

  function mergeShots(shotIds: string[]): Shot | null {
    if (shotIds.length < 2) return null

    const shotsToMerge = projectStore.shots.filter((s) => shotIds.includes(s.id))
    if (shotsToMerge.length < 2) return null

    shotsToMerge.sort((a, b) => a.number - b.number)
    const first = shotsToMerge[0]
    const last = shotsToMerge[shotsToMerge.length - 1]

    const merged: Shot = {
      ...first,
      id: `shot-${Date.now()}-merged`,
      duration: shotsToMerge.reduce((sum, s) => sum + s.duration, 0),
      dialogue: shotsToMerge.map((s) => s.dialogue).filter(Boolean).join('\n'),
      description: shotsToMerge.map((s) => s.description).filter(Boolean).join('\n'),
      transition: last.transition,
      notes: shotsToMerge.map((s) => s.notes).filter(Boolean).join('\n'),
      annotations: first.annotations
        ? shotsToMerge.reduce(
            (all, s) => (s.annotations ? [...all, ...s.annotations] : all),
            [] as NonNullable<typeof first.annotations>
          )
        : undefined
    }

    const insertIndex = projectStore.shots.indexOf(first)
    projectStore.shots.splice(insertIndex, 0, merged)

    const indices = shotIds
      .map((id) => projectStore.shots.findIndex((s) => s.id === id))
      .sort((a, b) => b - a)
    for (const idx of indices) {
      if (idx >= 0) projectStore.shots.splice(idx, 1)
    }

    projectStore.renumberShots()
    return merged
  }

  return {
    createShot,
    addShotForParagraph,
    smartSplitAll,
    smartSplitSelected,
    getShotsForSelectedParagraph,
    deleteShot,
    moveShot,
    mergeShots
  }
}
