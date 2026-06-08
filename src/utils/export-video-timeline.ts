import ExcelJS from 'exceljs'
import type { VideoClip } from '@/types'

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export async function exportVideoTimeline(
  projectName: string,
  clips: VideoClip[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('时间线')

  const columns = [
    { header: '序号', key: 'order', width: 8 },
    { header: '文件名', key: 'name', width: 28 },
    { header: '时长(s)', key: 'duration', width: 12 },
    { header: '分辨率', key: 'resolution', width: 16 },
    { header: '时间线起点', key: 'timelineStart', width: 14 },
    { header: '时间线终点', key: 'timelineEnd', width: 14 }
  ]

  sheet.columns = columns

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' }
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 22
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })

  const sorted = [...clips].sort((a, b) => a.order - b.order)
  let offset = 0

  sorted.forEach((clip, index) => {
    const row = sheet.addRow({
      order: clip.order,
      name: clip.name,
      duration: clip.duration,
      resolution: clip.width && clip.height ? `${clip.width}×${clip.height}` : '-',
      timelineStart: formatTime(offset),
      timelineEnd: formatTime(offset + clip.duration)
    })

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      cell.font = { size: 10 }
    })

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5FF' }
        }
      })
    }

    offset += clip.duration
  })

  sheet.getColumn('order').alignment = { horizontal: 'center' }
  sheet.getColumn('duration').alignment = { horizontal: 'center' }
  sheet.getColumn('timelineStart').alignment = { horizontal: 'center' }
  sheet.getColumn('timelineEnd').alignment = { horizontal: 'center' }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${projectName}-时间线.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
