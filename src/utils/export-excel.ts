import ExcelJS from 'exceljs'
import type { Shot } from '@/types'

export async function exportExcel(
  projectName: string,
  shots: Shot[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('分镜表')

  const columns = [
    { header: '镜号', key: 'number', width: 8 },
    { header: '景别', key: 'scene', width: 10 },
    { header: '运镜', key: 'camera', width: 10 },
    { header: '时长(s)', key: 'duration', width: 10 },
    { header: '对白/旁白', key: 'dialogue', width: 24 },
    { header: '转场', key: 'transition', width: 10 },
    { header: '画面描述', key: 'description', width: 40 },
    { header: '备注', key: 'notes', width: 28 },
  ]

  sheet.columns = columns

  // header row
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' },
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // data rows
  shots.forEach((shot, index) => {
    const row = sheet.addRow({
      number: shot.number,
      scene: shot.scene,
      camera: shot.camera,
      duration: shot.duration,
      dialogue: shot.dialogue || '',
      transition: shot.transition,
      description: shot.description || '',
      notes: shot.notes || '',
    })

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.font = { size: 10 }
    })

    // alternate row color
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5FF' },
        }
      })
    }
  })

  // number column center-aligned
  sheet.getColumn('number').alignment = { horizontal: 'center' }
  sheet.getColumn('duration').alignment = { horizontal: 'center' }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${projectName}-分镜表.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
