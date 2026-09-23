// lib/export/filename.ts
import { toISODate } from './filters'

const MAX_LENGTH = 100

export function defaultFilename(now: Date = new Date()): string {
  return `expenses-${toISODate(now)}`
}

/**
 * Makes a user-typed name safe to use as a download filename: strips
 * characters that are illegal on common filesystems, collapses whitespace,
 * and drops any extension the user typed (the format decides the extension).
 */
export function sanitizeFilename(input: string, extension: string): string {
  let name = input
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const typedExt = `.${extension}`
  if (name.toLowerCase().endsWith(typedExt)) name = name.slice(0, -typedExt.length)
  name = name.replace(/^\.+|\.+$/g, '').slice(0, MAX_LENGTH).trim()
  return name
}

export function buildFilename(input: string, extension: string, now?: Date): string {
  const base = sanitizeFilename(input, extension) || defaultFilename(now)
  return `${base}.${extension}`
}
