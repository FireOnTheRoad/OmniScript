import { useProjectStore } from '@/stores/projectStore'
import { exportPDF, savePDFFile } from '@/utils/export-pdf'
import { exportExcel } from '@/utils/export-excel'

export function useExport() {
  const store = useProjectStore()

  function handleExportPDF(): void {
    if (!store.meta || store.shots.length === 0) return

    const doc = exportPDF(
      store.meta.name,
      store.meta.author,
      store.meta.createdAt,
      store.shots
    )

    const fileName = `${store.meta.name}-分镜表.pdf`
    savePDFFile(doc, fileName)
  }

  async function handleExportExcel(): Promise<void> {
    if (!store.meta || store.shots.length === 0) return

    await exportExcel(store.meta.name, store.shots, store.projectPath)
  }

  const hasShots = (): boolean => store.shots.length > 0

  return {
    handleExportPDF,
    handleExportExcel,
    hasShots
  }
}
