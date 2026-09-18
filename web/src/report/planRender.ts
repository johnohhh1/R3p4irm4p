/**
 * Canvas renders of the plan that the PDF embeds: the full marked plan, and one
 * locator crop per location ("where it is"). Ported from the marked()/loc crop
 * pass in tools/build_pdf.py.
 */
import type { Pin, Plan } from '../lib/types'

export interface PlanBitmap {
  bitmap: ImageBitmap
  plan: Plan
}

export async function loadPlanBitmap(blob: Blob, plan: Plan): Promise<PlanBitmap> {
  return { bitmap: await createImageBitmap(blob), plan }
}

function drawPin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  radius: number,
  fontSize: number,
  fill: string,
  ring: string | null,
) {
  if (ring) {
    ctx.beginPath()
    ctx.arc(x, y, radius + radius * 0.42, 0, Math.PI * 2)
    ctx.strokeStyle = ring
    ctx.lineWidth = Math.max(2, radius * 0.28)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = Math.max(1.5, radius * 0.16)
  ctx.stroke()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = `700 ${fontSize}px "Barlow Condensed", Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x, y + fontSize * 0.04)
}

/**
 * The whole plan with every pin on it. Landscape page in the report. Pins carry
 * their issue colour, so a site with several kinds of problem reads at a glance;
 * the reference implementation only ever had one kind.
 */
export async function renderMarkedPlan(
  source: PlanBitmap,
  pins: Pin[],
  colorOf: (pin: Pin) => string,
  maxPx = 2400,
): Promise<Blob> {
  const { bitmap, plan } = source
  const scale = Math.min(1, maxPx / Math.max(plan.w, plan.h))
  const w = Math.round(plan.w * scale)
  const h = Math.round(plan.h * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bitmap, 0, 0, w, h)

  const radius = Math.max(12, Math.round(Math.min(w, h) * 0.018))
  for (const pin of pins) {
    drawPin(ctx, pin.x * w, pin.y * h, String(pin.no), radius, radius * 1.05, colorOf(pin), null)
  }

  return toBlob(canvas)
}

/**
 * A crop of the plan around one pin, so the reader can see where the photo was
 * taken without hunting the full plan. 3:2, ringed, clamped to the plan edges.
 */
export async function renderLocator(
  source: PlanBitmap,
  pin: Pin,
  accent: string,
  outW = 720,
): Promise<Blob> {
  const { bitmap, plan } = source
  const outH = Math.round(outW / 1.5)

  // Window covers a third of the plan's smaller side — enough context to place it.
  const winW = Math.min(plan.w, Math.max(plan.w * 0.28, plan.h * 0.28 * 1.5))
  const winH = winW / 1.5
  let sx = pin.x * plan.w - winW / 2
  let sy = pin.y * plan.h - winH / 2
  sx = Math.max(0, Math.min(plan.w - Math.min(winW, plan.w), sx))
  sy = Math.max(0, Math.min(plan.h - Math.min(winH, plan.h), sy))
  const sw = Math.min(winW, plan.w)
  const sh = Math.min(winH, plan.h)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH)

  const px = ((pin.x * plan.w - sx) / sw) * outW
  const py = ((pin.y * plan.h - sy) / sh) * outH
  const radius = Math.round(outW * 0.042)
  drawPin(ctx, px, py, String(pin.no), radius, radius * 1.05, accent, accent)

  ctx.strokeStyle = '#D4D2CD'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, outW - 2, outH - 2)

  return toBlob(canvas)
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/png')
  })
}
