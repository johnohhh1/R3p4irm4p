import type { Pin } from './types'

export function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Today as a calendar date where the user is standing. toISOString() is UTC, so
 * an evening walk in Michigan would be dated tomorrow.
 */
export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * A date the user typed is a calendar date, not an instant. `new Date('2026-09-17')`
 * parses as UTC midnight and prints the day before in any western timezone, so
 * date-only strings are built in local time instead.
 */
export function parseDateOnly(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

export function formatDate(iso: string): string {
  try {
    return parseDateOnly(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function formatWhen(iso: string): string {
  try {
    const then = new Date(iso).getTime()
    const mins = Math.round((Date.now() - then) / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/**
 * Walk order: horizontal bands top to bottom, left to right inside each band.
 * Ported from tools/build_pdf.py — the report reads as a walk, not a number list.
 */
export function walkOrder<T extends Pick<Pin, 'x' | 'y'>>(pins: T[], bands = 8): T[] {
  return [...pins].sort((a, b) => {
    const ba = Math.floor(a.y * bands)
    const bb = Math.floor(b.y * bands)
    if (ba !== bb) return ba - bb
    return a.x - b.x
  })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function safeFilename(s: string, fallback: string): string {
  const cleaned = s.trim().replace(/[^\w\s.-]+/g, '').replace(/\s+/g, '-').slice(0, 60)
  return cleaned || fallback
}
