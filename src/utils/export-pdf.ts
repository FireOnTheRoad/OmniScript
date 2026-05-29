import jsPDF from 'jspdf'
import type { Shot } from '@/types'

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

export function exportPDF(
  projectName: string,
  author: string,
  createdAt: string,
  shots: Shot[]
): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2

  const colWidths = [14, 18, 18, 16, 18, 46, 42]
  const colHeaders = ['镜号', '景别', '运镜', '时长', '转场', '画面描述', '对白']

  let y = margin

  function addHeader(): void {
    doc.setFontSize(16)
    doc.text(`${projectName} — 分镜表`, pageWidth / 2, y, { align: 'center' })
    y += 7

    doc.setFontSize(9)
    doc.setTextColor(120)
    const info = [
      author ? `作者：${author}` : '',
      createdAt ? `日期：${formatDate(createdAt)}` : '',
      `共 ${shots.length} 镜`,
    ].filter(Boolean).join(' · ')
    doc.text(info, pageWidth / 2, y, { align: 'center' })
    y += 8
  }

  function addTableHeader(): void {
    doc.setFillColor(240, 240, 240)
    doc.setFontSize(9)
    doc.setTextColor(60)
    let x = margin
    colHeaders.forEach((header, i) => {
      doc.rect(x, y, colWidths[i], 7, 'FD')
      doc.text(header, x + 2, y + 5)
      x += colWidths[i]
    })
    y += 8
  }

  function checkPageBreak(lineCount: number): void {
    const needed = lineCount * 6 + 15
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  addHeader()
  addTableHeader()

  doc.setFontSize(8)
  doc.setTextColor(40)

  for (const shot of shots) {
    const descLines = doc.splitTextToSize(shot.description || '—', colWidths[5] - 4)
    const dialogueLines = shot.dialogue
      ? doc.splitTextToSize(shot.dialogue, colWidths[6] - 4)
      : ['—']

    const rowLines = Math.max(descLines.length, dialogueLines.length, 1)
    checkPageBreak(rowLines)

    let x = margin
    const cells = [
      String(shot.number),
      shot.scene,
      shot.camera,
      `${shot.duration}s`,
      shot.transition,
      descLines,
      dialogueLines
    ]

    const rowHeight = rowLines * 5 + 4
    cells.forEach((cell, i) => {
      doc.rect(x, y, colWidths[i], rowHeight)
      if (Array.isArray(cell)) {
        doc.text(cell, x + 2, y + 4)
      } else {
        doc.text(String(cell), x + 2, y + 4)
      }
      x += colWidths[i]
    })

    y += rowHeight
  }

  // page numbers
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160)
    doc.text(
      `第 ${i}/${pageCount} 页`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    )
  }

  return doc
}

export function savePDFFile(doc: jsPDF, fileName: string): void {
  doc.save(fileName)
}
