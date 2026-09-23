// lib/export/formats/pdf.ts
import { formatCurrency, formatDate } from '@/lib/utils'
import { CATEGORIES } from '@/lib/types'
import type { ExportPayload } from '../types'

const INDIGO: [number, number, number] = [79, 70, 229]
const GRAY_900: [number, number, number] = [17, 24, 39]
const GRAY_500: [number, number, number] = [107, 114, 128]
const GRAY_200: [number, number, number] = [229, 231, 235]

export function describeDateRange(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'All dates'
  if (!startDate) return `Through ${formatDate(endDate)}`
  if (!endDate) return `From ${formatDate(startDate)}`
  return `${formatDate(startDate)} – ${formatDate(endDate)}`
}

/**
 * Renders a styled report. jsPDF is imported lazily so its ~300KB only loads
 * when someone actually exports a PDF.
 */
export async function serializePDF(payload: ExportPayload): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const { expenses, summary, filters, generatedAt } = payload

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48

  // Title block
  doc.setFillColor(...INDIGO)
  doc.rect(0, 0, pageWidth, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...GRAY_900)
  doc.text('Expense Report', margin, margin + 8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY_500)
  doc.text(
    `Generated ${generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`,
    margin,
    margin + 24,
  )

  // Summary tiles
  const allCategories = filters.categories.length === CATEGORIES.length
  const tiles = [
    { label: 'RECORDS', value: String(summary.count) },
    { label: 'TOTAL', value: formatCurrency(summary.total) },
    { label: 'PERIOD', value: describeDateRange(filters.startDate, filters.endDate) },
    {
      label: 'CATEGORIES',
      value: allCategories ? 'All' : `${filters.categories.length} of ${CATEGORIES.length}`,
    },
  ]
  const tileTop = margin + 44
  const gap = 10
  const tileWidth = (pageWidth - margin * 2 - gap * (tiles.length - 1)) / tiles.length
  tiles.forEach((tile, i) => {
    const x = margin + i * (tileWidth + gap)
    doc.setDrawColor(...GRAY_200)
    doc.roundedRect(x, tileTop, tileWidth, 44, 4, 4, 'S')
    doc.setFontSize(7)
    doc.setTextColor(...GRAY_500)
    doc.text(tile.label, x + 10, tileTop + 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(tile.value.length > 18 ? 8 : 11)
    doc.setTextColor(...GRAY_900)
    doc.text(tile.value, x + 10, tileTop + 33, { maxWidth: tileWidth - 20 })
    doc.setFont('helvetica', 'normal')
  })

  if (!allCategories) {
    doc.setFontSize(8)
    doc.setTextColor(...GRAY_500)
    doc.text(`Categories: ${filters.categories.join(', ')}`, margin, tileTop + 60, {
      maxWidth: pageWidth - margin * 2,
    })
  }

  autoTable(doc, {
    startY: tileTop + (allCategories ? 64 : 74),
    margin: { left: margin, right: margin, bottom: margin },
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: expenses.map((e) => [formatDate(e.date), e.category, e.description, formatCurrency(e.amount)]),
    foot: [['', '', 'Total', formatCurrency(summary.total)]],
    showFoot: 'lastPage',
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 6, bottom: 6, left: 6, right: 6 }, textColor: GRAY_900 },
    headStyles: { fillColor: INDIGO, textColor: 255, fontStyle: 'bold' },
    footStyles: { fontStyle: 'bold', lineColor: GRAY_200, lineWidth: { top: 1 } },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 90 },
      3: { halign: 'right', cellWidth: 80 },
    },
    didParseCell: (data) => {
      if (data.column.index === 3 && data.section !== 'body') data.cell.styles.halign = 'right'
    },
  })

  // Page footers, drawn last so the total page count is known.
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...GRAY_500)
    doc.text('Expense Tracker', margin, pageHeight - 24)
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 24, { align: 'right' })
  }

  return doc.output('blob')
}
