import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSelectionStore = defineStore('selection', () => {
  const selectedParagraphIndex = ref(-1)
  const selectedShotId = ref('')

  function selectParagraph(index: number): void {
    selectedParagraphIndex.value = index
  }

  function clearParagraphSelection(): void {
    selectedParagraphIndex.value = -1
  }

  function selectShot(shotId: string): void {
    selectedShotId.value = shotId
  }

  function clearShotSelection(): void {
    selectedShotId.value = ''
  }

  return {
    selectedParagraphIndex,
    selectedShotId,
    selectParagraph,
    clearParagraphSelection,
    selectShot,
    clearShotSelection
  }
})
