// lib/exporting/exporter.ts
import type { Exporter, FileSaver, Serializer } from './types'

/** Composes a format and a delivery mechanism. Depends only on their contracts. */
export function createExporter<T>({
  serializer,
  saver,
  filename,
}: {
  serializer: Serializer<T>
  saver: FileSaver
  filename: string
}): Exporter<T> {
  return {
    export: (items) => saver.save({ content: serializer.serialize(items), mimeType: serializer.mimeType, filename }),
  }
}
