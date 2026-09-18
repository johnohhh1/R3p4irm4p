/**
 * Drawing primitives over pdf-lib: the cap/frame/wrap/para/fit helpers that
 * tools/build_pdf.py defines as closures, so the page code below reads the same.
 */
import { rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from 'pdf-lib'
import type { Theme } from './theme'

export const PW = 612 // US Letter, points
export const PH = 792
export const M = 54 // margin

export interface Fonts {
  body: PDFFont
  bodyBold: PDFFont
  label: PDFFont
  display: PDFFont
}

export function hex(color: string): RGB {
  const c = color.replace('#', '')
  const n = c.length === 3 ? c.split('').map((x) => x + x).join('') : c
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  )
}

/** A page under construction, with the cursor the Python version carries in `y`. */
export class Sheet {
  y: number

  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
    readonly theme: Theme,
    readonly landscape = false,
  ) {
    this.y = this.height - 80
  }

  get width(): number {
    return this.landscape ? PH : PW
  }

  get height(): number {
    return this.landscape ? PW : PH
  }

  text(
    value: string,
    x: number,
    y: number,
    opts: { font?: PDFFont; size?: number; color?: string; align?: 'l' | 'r' | 'c'; spacing?: number } = {},
  ): void {
    const font = opts.font ?? this.fonts.body
    const size = opts.size ?? 9
    const spacing = opts.spacing ?? 0
    const width = textWidth(value, font, size, spacing)
    let drawX = x
    if (opts.align === 'r') drawX = x - width
    else if (opts.align === 'c') drawX = x - width / 2

    if (spacing) {
      // pdf-lib has no charSpace, so letter-spaced labels are drawn per glyph.
      let cursor = drawX
      for (const ch of value) {
        this.page.drawText(ch, { x: cursor, y, size, font, color: hex(opts.color ?? this.theme.ink) })
        cursor += font.widthOfTextAtSize(ch, size) + spacing
      }
      return
    }
    this.page.drawText(value, { x: drawX, y, size, font, color: hex(opts.color ?? this.theme.ink) })
  }

  /** An all-caps letter-spaced label, the report's small-print voice. */
  cap(value: string, x: number, y: number, size = 7.5, color?: string, spacing = 1.1): void {
    this.text(value.toUpperCase(), x, y, {
      font: this.fonts.label,
      size,
      color: color ?? this.theme.muted,
      spacing,
    })
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { fill?: string; stroke?: string; lineWidth?: number } = {},
  ): void {
    this.page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: opts.fill ? hex(opts.fill) : undefined,
      borderColor: opts.stroke ? hex(opts.stroke) : undefined,
      borderWidth: opts.stroke ? (opts.lineWidth ?? 1) : undefined,
    })
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 0.8): void {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color: hex(color), thickness: lineWidth })
  }

  circle(cx: number, cy: number, r: number, fill: string): void {
    this.page.drawCircle({ x: cx, y: cy, size: r, color: hex(fill) })
  }

  /**
   * The running frame. The header carries the site and who prepared it — the
   * reader's own words, not the tool's name. Ported from the `frame()` closure
   * in tools/build_pdf.py, which is what a facilities director already approves.
   */
  frame(header: { site: string; byline: string; right: string; pageNo: number }): void {
    const w = this.width
    const h = this.height
    this.rect(0, 0, w, h, { fill: this.theme.page })

    // The right-hand section label is fixed; the site name yields to it, so a
    // long "Chili's Grill & Bar #605 - Baldwin Rd, ..." cannot collide with it.
    let rightWidth = 0
    if (header.right) {
      rightWidth = textWidth(header.right.toUpperCase(), this.fonts.label, 7.5, 1.1)
      this.text(header.right.toUpperCase(), w - M - rightWidth, h - 30, {
        font: this.fonts.label,
        size: 7.5,
        color: this.theme.structure,
        spacing: 1.1,
      })
    }
    const siteRoom = w - 2 * M - (rightWidth ? rightWidth + 18 : 0)
    this.cap(spacedEllipsize(header.site, this.fonts.label, 7.5, 1.1, siteRoom), M, h - 30, 7.5, this.theme.structure, 1.1)

    const pageLabel = `Page ${header.pageNo}`
    const pageWidth = textWidth(pageLabel, this.fonts.body, 7.5)
    if (header.byline) {
      this.text(ellipsize(header.byline, this.fonts.body, 7.5, w - 2 * M - pageWidth - 18), M, h - 42, {
        size: 7.5,
        color: this.theme.muted,
      })
    }
    this.text(pageLabel, w - M, h - 42, { size: 7.5, color: this.theme.muted, align: 'r' })
    this.line(M, h - 50, w - M, h - 50, this.theme.rule, 0.8)
    this.line(M, 40, w - M, 40, this.theme.rule, 0.8)
  }

  /** A section heading with the accent rule under it. Returns the new cursor. */
  heading(value: string, y: number, ruleWidth = 120): number {
    this.text(value.toUpperCase(), M, y, { font: this.fonts.display, size: 13, color: this.theme.structure })
    this.line(M, y - 9, M + ruleWidth, y - 9, this.theme.accent, 3)
    return y - 26
  }

  /** Wrapped body copy. Returns the cursor below the last line. */
  para(
    value: string,
    x: number,
    y: number,
    maxW: number,
    opts: { size?: number; leading?: number; font?: PDFFont; color?: string } = {},
  ): number {
    const size = opts.size ?? 9.5
    const leading = opts.leading ?? 13.5
    const font = opts.font ?? this.fonts.body
    let cursor = y
    for (const line of wrap(value, font, size, maxW)) {
      this.text(line, x, cursor, { font, size, color: opts.color ?? this.theme.ink })
      cursor -= leading
    }
    return cursor
  }

  /** Fit an image inside a box, centred, preserving aspect. */
  fit(
    image: PDFImage,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { background?: string; border?: string } = {},
  ): void {
    const scale = Math.min(w / image.width, h / image.height)
    const iw = image.width * scale
    const ih = image.height * scale
    const ix = x + (w - iw) / 2
    const iy = y + (h - ih) / 2
    if (opts.background) this.rect(x, y, w, h, { fill: opts.background })
    this.page.drawImage(image, { x: ix, y: iy, width: iw, height: ih })
    if (opts.border) this.rect(ix, iy, iw, ih, { stroke: opts.border, lineWidth: 0.6 })
  }
}

export function textWidth(value: string, font: PDFFont, size: number, spacing = 0): number {
  const base = font.widthOfTextAtSize(value, size)
  return spacing ? base + spacing * Math.max(0, value.length - 1) : base
}

export function wrap(value: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = word
    // A single word longer than the column gets hard-broken rather than clipped.
    while (font.widthOfTextAtSize(line, size) > maxW && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxW) cut -= 1
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Truncate to fit a column, with an ellipsis, rather than overrunning a rule. */
export function ellipsize(value: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(value, size) <= maxW) return value
  let out = value
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxW) out = out.slice(0, -1)
  return `${out}…`
}

/** Ellipsize a letter-spaced string, which is wider than its plain measurement. */
export function spacedEllipsize(
  value: string,
  font: PDFFont,
  size: number,
  spacing: number,
  maxW: number,
): string {
  const upper = value.toUpperCase()
  if (textWidth(upper, font, size, spacing) <= maxW) return value
  let out = upper
  while (out.length > 1 && textWidth(`${out}…`, font, size, spacing) > maxW) out = out.slice(0, -1)
  return `${out}…`
}

/**
 * Wrap into at most `maxLines`, ellipsizing the last one. Cover blocks have a
 * fixed vertical budget, so a long free-text field grows a little and then stops
 * rather than pushing the rest of the page off the bottom.
 */
export function clampLines(
  value: string,
  font: PDFFont,
  size: number,
  maxW: number,
  maxLines: number,
): string[] {
  const lines = wrap(value, font, size, maxW)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines].trim()}`, font, size, maxW)
  return kept
}
