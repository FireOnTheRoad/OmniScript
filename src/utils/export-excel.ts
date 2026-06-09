import ExcelJS from 'exceljs'
import type { Shot } from '@/types'

/**
 * 读取项目中的图片文件并返回 Buffer 和扩展名
 */
async function readImageBuffer(
  projectPath: string,
  refImage: string
): Promise<{ buffer: ArrayBuffer; ext: 'png' | 'jpeg' } | null> {
  try {
    const result = await window.electronAPI!.invoke('asset:read', projectPath, refImage) as {
      success: boolean
      dataUrl?: string
    }
    if (result.success && result.dataUrl) {
      const matches = result.dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
      if (matches) {
        const ext: 'png' | 'jpeg' = matches[1] === 'jpeg' ? 'jpeg' : 'png'
        const buffer = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0)).buffer
        return { buffer, ext }
      }
    }
  } catch { /* ignore */ }
  return null
}

/**
 * 计算字符串在 Excel 中的显示宽度
 * 中文字符约 2.2 倍英文字符宽度
 */
function calcTextWidth(text: string): number {
  let width = 0
  for (const char of text) {
    // 判断是否为 CJK 字符（中文、日文、韩文等）
    if (/[一-鿿㐀-䶿　-〿＀-￯]/.test(char)) {
      width += 2.2
    } else {
      width += 1
    }
  }
  return width
}

/**
 * 根据列内容自适应计算列宽
 */
function autoFitColumns(
  sheet: ExcelJS.Worksheet,
  columns: { key: string; header: string }[],
  minWidth = 8,
  maxWidth = 50
): void {
  for (const col of columns) {
    // 计算表头宽度
    let maxW = calcTextWidth(col.header) + 2

    // 遍历该列所有数据行，取最大宽度
    const column = sheet.getColumn(col.key as unknown as number)
    column.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value?.toString() || ''
      // 按换行符分割，取最长行
      const lines = value.split('\n')
      for (const line of lines) {
        const w = calcTextWidth(line) + 2
        if (w > maxW) maxW = w
      }
    })

    // 限制在 [minWidth, maxWidth] 范围内
    column.width = Math.min(maxWidth, Math.max(minWidth, Math.ceil(maxW)))
  }
}

export async function exportExcel(
  projectName: string,
  shots: Shot[],
  projectPath: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('分镜表')

  const columns = [
    { header: '镜号', key: 'number', width: 8 },
    { header: '分镜图', key: 'image', width: 18 },
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
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })

  // image column index (0-based for addImage)
  const IMAGE_COL_INDEX = 1
  const IMAGE_WIDTH = 120
  const IMAGE_HEIGHT = 80

  // data rows
  for (let index = 0; index < shots.length; index++) {
    const shot = shots[index]
    const hasImage = !!shot.refImage

    const row = sheet.addRow({
      number: shot.number,
      image: hasImage ? '' : '—',
      scene: shot.scene,
      camera: shot.camera,
      duration: shot.duration,
      dialogue: shot.dialogue || '',
      transition: shot.transition,
      description: shot.description || '',
      notes: shot.notes || '',
    })

    // 根据是否有图片设置行高
    row.height = hasImage ? 72 : 30

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      }
      cell.font = { size: 10 }
      cell.alignment = { vertical: 'middle', wrapText: true }
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

    // 嵌入图片
    if (hasImage && shot.refImage && projectPath) {
      const imageData = await readImageBuffer(projectPath, shot.refImage)
      if (imageData) {
        const imageId = workbook.addImage({
          buffer: imageData.buffer,
          extension: imageData.ext,
        })

        // ExcelJS addImage 使用 0-based 索引
        sheet.addImage(imageId, {
          tl: { col: IMAGE_COL_INDEX, row: index + 1 },
          ext: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
        })
      }
    }
  }

  // number column center-aligned
  sheet.getColumn('number').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getColumn('duration').alignment = { horizontal: 'center', vertical: 'middle' }
  // image column center-aligned
  sheet.getColumn('image').alignment = { horizontal: 'center', vertical: 'middle' }

  // 自适应列宽（分镜图列保持固定宽度）
  const autoFitCols = columns.filter(c => c.key !== 'image')
  autoFitColumns(sheet, autoFitCols)

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
