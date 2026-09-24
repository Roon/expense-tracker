// lib/exporting/browserFileSaver.ts
import type { FileSaver } from './types'

/** Saves a file through a temporary object URL and anchor download. */
export const browserFileSaver: FileSaver = {
  save({ content, mimeType, filename }) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  },
}
