/** Photo intake: resize, keep the date, drop the location unless asked otherwise. */
import type { ResizeFailure, ResizeRequest, ResizeResult } from '../workers/resize.worker'
import { readExif } from './exif'
import { uid } from './util'

/** Matches the Python reference: 1100 px at quality 68 lands ~40 photos in 5 MB. */
export const MAX_PX = 1100
export const QUALITY = 0.68
export const THUMB_PX = 320

export interface PreparedPhoto {
  id: string
  blobId: string
  thumbId: string
  name: string
  takenAt: string | null
  gps: { lat: number; lon: number } | null
  w: number
  h: number
  bytes: number
  full: Blob
  thumb: Blob
}

type Pending = {
  resolve: (r: ResizeResult) => void
  reject: (e: Error) => void
}

/** One worker, reused. Falls back to the main thread where OffscreenCanvas is missing. */
class ResizePool {
  private worker: Worker | null = null
  private pending = new Map<string, Pending>()

  private ensure(): Worker | null {
    if (this.worker) return this.worker
    if (typeof OffscreenCanvas === 'undefined') return null
    try {
      this.worker = new Worker(new URL('../workers/resize.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (event: MessageEvent<ResizeResult | ResizeFailure>) => {
        const msg = event.data
        const waiting = this.pending.get(msg.id)
        if (!waiting) return
        this.pending.delete(msg.id)
        if (msg.ok) waiting.resolve(msg)
        else waiting.reject(new Error(msg.error))
      }
      this.worker.onerror = () => {
        for (const [, waiting] of this.pending) waiting.reject(new Error('resize worker failed'))
        this.pending.clear()
        this.worker?.terminate()
        this.worker = null
      }
      return this.worker
    } catch {
      return null
    }
  }

  async run(file: Blob): Promise<{ full: Blob; thumb: Blob; w: number; h: number }> {
    const worker = this.ensure()
    if (!worker) return resizeOnMainThread(file)
    const id = uid('r')
    const request: ResizeRequest = { id, file, maxPx: MAX_PX, quality: QUALITY, thumbPx: THUMB_PX }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      worker.postMessage(request)
    }).then((r) => r as ResizeResult)
  }
}

const pool = new ResizePool()

async function drawToBlob(source: CanvasImageSource, sw: number, sh: number, maxPx: number, quality: number) {
  const scale = Math.min(1, maxPx / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('encode failed')
  return { blob, w, h }
}

async function resizeOnMainThread(file: Blob) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const full = await drawToBlob(bitmap, bitmap.width, bitmap.height, MAX_PX, QUALITY)
    const thumb = await drawToBlob(bitmap, bitmap.width, bitmap.height, THUMB_PX, 0.72)
    return { full: full.blob, thumb: thumb.blob, w: full.w, h: full.h }
  } finally {
    bitmap.close()
  }
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name)
}

export function baseName(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

/** Resize one file and read what we keep from its EXIF. */
export async function preparePhoto(file: File, keepGps: boolean): Promise<PreparedPhoto> {
  const facts = await readExif(file)
  const { full, thumb, w, h } = await pool.run(file)
  return {
    id: uid('p'),
    blobId: uid('b'),
    thumbId: uid('t'),
    name: baseName(file.name),
    takenAt: facts.takenAt,
    gps: keepGps ? facts.gps : null,
    w,
    h,
    bytes: full.size,
    full,
    thumb,
  }
}

/** Load a plan image at full size — plans are line art, so no re-encode. */
export async function measureImage(blob: Blob): Promise<{ w: number; h: number }> {
  const bitmap = await createImageBitmap(blob)
  const size = { w: bitmap.width, h: bitmap.height }
  bitmap.close()
  return size
}

/**
 * Group photos by the leading word of the file name, as the prototype tray does.
 * A leading digit run counts as part of the word, so "3comp" and "3comp2" land
 * together rather than in two groups of one.
 */
export function groupKey(name: string): string {
  const m = /^(\d*[A-Za-z]+)/.exec(name)
  return m ? m[1].toLowerCase() : name.slice(0, 6).toLowerCase()
}
