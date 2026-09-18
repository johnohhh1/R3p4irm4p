/**
 * Photo resizing, off the main thread, so 200 photos do not freeze a drag.
 * Re-encoding through a canvas is also what drops EXIF — including GPS.
 */

export interface ResizeRequest {
  id: string
  file: Blob
  maxPx: number
  quality: number
  thumbPx: number
}

export interface ResizeResult {
  id: string
  ok: true
  full: Blob
  thumb: Blob
  w: number
  h: number
}

export interface ResizeFailure {
  id: string
  ok: false
  error: string
}

async function draw(bitmap: ImageBitmap, maxPx: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  return { blob, w, h }
}

self.onmessage = async (event: MessageEvent<ResizeRequest>) => {
  const { id, file, maxPx, quality, thumbPx } = event.data
  let bitmap: ImageBitmap | null = null
  try {
    // 'from-image' applies the EXIF rotation, so portrait photos stay upright.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const full = await draw(bitmap, maxPx, quality)
    const thumb = await draw(bitmap, thumbPx, 0.72)
    const result: ResizeResult = { id, ok: true, full: full.blob, thumb: thumb.blob, w: full.w, h: full.h }
    ;(self as unknown as Worker).postMessage(result)
  } catch (err) {
    const failure: ResizeFailure = { id, ok: false, error: String(err) }
    ;(self as unknown as Worker).postMessage(failure)
  } finally {
    bitmap?.close()
  }
}
