/**
 * Plan intake. Nobody has a PNG of their floor plan; everybody has a PDF, so
 * page 1 is rendered to a canvas and treated as an image from then on. PRD §6.
 */
import { copy } from './copy'
import { measureImage } from './images'

/** Render wide enough that pin placement is precise and the printed plan is sharp. */
const PDF_TARGET_PX = 2400

export interface LoadedPlan {
  blob: Blob
  w: number
  h: number
  source: string
  name: string
}

export class PlanError extends Error {}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

export async function loadPlan(file: File): Promise<LoadedPlan> {
  if (isPdfFile(file)) return loadPdfPlan(file)
  try {
    const { w, h } = await measureImage(file)
    return { blob: file, w, h, source: 'image', name: file.name }
  } catch {
    throw new PlanError(copy.errors.badImage)
  }
}

async function loadPdfPlan(file: File): Promise<LoadedPlan> {
  try {
    const pdfjs = await import('pdfjs-dist')
    // Vite resolves the worker next to the library; without it pdf.js runs
    // on the main thread and large plans stall the tab.
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

    const data = await file.arrayBuffer()
    const doc = await pdfjs.getDocument({ data }).promise
    const page = await doc.getPage(1)

    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(4, PDF_TARGET_PX / Math.max(base.width, base.height))
    const viewport = page.getViewport({ scale })

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no 2d context')
    // Plans are line art on white; painting the background keeps it opaque.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    doc.destroy()
    if (!blob) throw new Error('encode failed')

    return {
      blob,
      w: canvas.width,
      h: canvas.height,
      source: 'pdf:page1',
      name: file.name,
    }
  } catch {
    throw new PlanError(copy.errors.badPdf)
  }
}

export function planSourceLabel(source: string): string {
  const m = /^pdf:page(\d+)$/.exec(source)
  return m ? copy.plan.pdfPage(Number(m[1])) : 'Picture'
}
