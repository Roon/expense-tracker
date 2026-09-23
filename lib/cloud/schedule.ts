// lib/cloud/schedule.ts
import type { Frequency, Schedule } from './types'

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type Timing = Pick<Schedule, 'frequency' | 'weekday' | 'dayOfMonth' | 'time'>

/** Next local run time strictly after `after`. */
export function computeNextRun(t: Timing, after: Date): Date {
  const [hh, mm] = t.time.split(':').map(Number)
  const at = (y: number, m: number, d: number) => new Date(y, m, d, hh, mm, 0, 0)
  const y = after.getFullYear()
  const m = after.getMonth()
  const d = after.getDate()

  if (t.frequency === 'daily') {
    const today = at(y, m, d)
    return today > after ? today : at(y, m, d + 1)
  }
  if (t.frequency === 'weekly') {
    const delta = (t.weekday - after.getDay() + 7) % 7
    const candidate = at(y, m, d + delta)
    return candidate > after ? candidate : at(y, m, d + delta + 7)
  }
  const thisMonth = at(y, m, t.dayOfMonth)
  return thisMonth > after ? thisMonth : at(y, m + 1, t.dayOfMonth)
}

export function isDue(s: Schedule, now: Date): boolean {
  return s.enabled && new Date(s.nextRunAt) <= now
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `${n}${suffix}`
}

function formatTime(time: string): string {
  const [hh, mm] = time.split(':').map(Number)
  return new Date(2000, 0, 1, hh, mm).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function describeTiming(t: Timing): string {
  const at = formatTime(t.time)
  if (t.frequency === 'daily') return `Every day at ${at}`
  if (t.frequency === 'weekly') return `Every ${WEEKDAYS[t.weekday]} at ${at}`
  return `Monthly on the ${ordinal(t.dayOfMonth)} at ${at}`
}

export const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]
