// lib/exporting/types.ts
//
// Small, role-specific contracts. Each consumer depends only on the one it needs.

/** A finished file, ready to hand to the user. */
export interface ExportFile {
  content: string
  mimeType: string
  filename: string
}

/** Turns items into file content. One implementation per format. */
export interface Serializer<T> {
  readonly mimeType: string
  serialize(items: readonly T[]): string
}

/** Delivers a file to the user (browser download, share sheet, test fake…). */
export interface FileSaver {
  save(file: ExportFile): void
}

/** What UI code calls. Knows nothing about formats or delivery. */
export interface Exporter<T> {
  export(items: readonly T[]): void
}
