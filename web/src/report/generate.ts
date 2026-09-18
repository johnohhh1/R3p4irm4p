/**
 * The report. Generated in the browser so nobody's site photos are uploaded
 * anywhere. Page order and layout are ported from tools/build_pdf.py, which
 * stays in the repo as the reference the output is checked against.
 */
import { PDFDocument, StandardFonts, type PDFImage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Photo, Pin, Project } from '../lib/types'
import type { ProjectStore } from '../lib/store'
import { CLOSED_STATUS, DONE_COLOR, issueColor, issueLabel, statusLabel, statusesFor } from '../lib/catalog'
import { reportCopy } from '../lib/copy'
import { formatDate, walkOrder } from '../lib/util'
import { photoLabel } from '../lib/labels'
import { clampLines, ellipsize, M, PH, PW, Sheet, textWidth, type Fonts } from './page'
import { loadPlanBitmap, renderLocator, renderMarkedPlan } from './planRender'
import { specFor, templateName, themeFor, type Theme } from './theme'

export interface ReportProgress {
  (step: string, done: number, total: number): void
}

interface Ctx {
  doc: PDFDocument
  fonts: Fonts
  theme: Theme
  pageNo: number
  /** The running header: the site and who prepared it, on every page. */
  site: string
  byline: string
}

/** Optional real fonts. Drop the four TTFs in public/fonts and the report uses them. */
const FONT_FILES = {
  body: 'Montserrat-Regular.ttf',
  bodyBold: 'Montserrat-Bold.ttf',
  label: 'Montserrat-ExtraBold.ttf',
  display: 'RobotoSlab-ExtraBold.ttf',
}

async function embedFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit)
  try {
    const bytes = await Promise.all(
      Object.values(FONT_FILES).map(async (file) => {
        const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
        if (!res.ok) throw new Error('missing')
        const buf = await res.arrayBuffer()
        // A 404 that returns index.html would embed as a broken font.
        if (buf.byteLength < 4096) throw new Error('not a font')
        return buf
      }),
    )
    const [body, bodyBold, label, display] = await Promise.all(
      bytes.map((b) => doc.embedFont(b, { subset: true })),
    )
    return { body, bodyBold, label, display }
  } catch {
    // Same fallback the Python reference takes when --fonts is not given.
    const [body, bodyBold, label, display] = await Promise.all([
      doc.embedStandardFont(StandardFonts.Helvetica),
      doc.embedStandardFont(StandardFonts.HelveticaBold),
      doc.embedStandardFont(StandardFonts.HelveticaBold),
      doc.embedStandardFont(StandardFonts.HelveticaBold),
    ])
    return { body, bodyBold, label, display }
  }
}

function newSheet(ctx: Ctx, right: string, landscape = false): Sheet {
  const page = ctx.doc.addPage(landscape ? [PH, PW] : [PW, PH])
  ctx.pageNo += 1
  const sheet = new Sheet(page, ctx.fonts, ctx.theme, landscape)
  sheet.frame({ site: ctx.site, byline: ctx.byline, right, pageNo: ctx.pageNo })
  return sheet
}

export async function generateReport(
  project: Project,
  store: ProjectStore,
  onProgress?: ReportProgress,
): Promise<Blob> {
  if (!project.plan) throw new Error('no plan')

  const spec = specFor(project.template)
  const theme = themeFor(project.report.accent)
  const pins = walkOrder(project.pins).map((pin, i) => ({ pin, stop: i + 1 }))
  const total = pins.length
  const photoById = new Map(project.photos.map((p) => [p.id, p]))
  const photoCount = project.pins.reduce((n, p) => n + p.photoIds.length, 0)

  const doc = await PDFDocument.create()
  doc.setTitle(`${templateName(project.template)} — ${project.report.site || project.name}`)
  doc.setCreator('Repair Map')
  doc.setProducer('Repair Map')

  const site = project.report.site || project.name
  const byline = [
    project.report.preparedBy ? `Prepared by ${project.report.preparedBy}` : '',
    formatDate(project.report.date || new Date().toISOString()),
  ]
    .filter(Boolean)
    .join(' · ')

  const ctx: Ctx = { doc, fonts: await embedFonts(doc), theme, pageNo: 0, site, byline }

  onProgress?.('plan', 0, total + 3)

  const planBlob = await store.getBlob(project.plan.blobId)
  if (!planBlob) throw new Error('plan missing')
  const planSource = await loadPlanBitmap(planBlob, project.plan)

  const pinColor = (pin: Pin) =>
    pin.status === CLOSED_STATUS ? DONE_COLOR : issueColor(project.issueSet, pin.issue)
  const markedPng = await renderMarkedPlan(planSource, project.pins, pinColor)
  const markedImage = await doc.embedPng(await markedPng.arrayBuffer())

  const logo = await embedLogo(doc, store, project.report.logoBlobId)

  /* ------------------------------------------------------------------ cover */
  cover(ctx, project, pins, photoCount, logo, spec.title)

  /* ------------------------------------------------------------ marked plan */
  onProgress?.('plan', 1, total + 3)
  const planSheet = newSheet(ctx, 'marked plan', true)
  const lw = planSheet.width
  const lh = planSheet.height
  planSheet.text('MARKED FLOOR PLAN', M, lh - 74, {
    font: ctx.fonts.display,
    size: 15,
    color: theme.structure,
  })
  planSheet.line(M, lh - 84, M + 120, lh - 84, theme.accent, 3)
  planSheet.text(reportCopy.planSubtitle(total), lw - M, lh - 74, {
    size: 8.5,
    color: theme.muted,
    align: 'r',
  })
  planSheet.fit(markedImage, M, 76, lw - 2 * M, lh - 174, { background: theme.white })
  planLegend(planSheet, project, pinColor)
  planSheet.text(reportCopy.planNote, M, 52, { size: 7.5, color: theme.muted })

  /* -------------------------------------------------------------- worksheet */
  onProgress?.('worksheet', 2, total + 3)
  worksheet(ctx, project, pins, spec)

  /* ------------------------------------------------- one page per location */
  for (let i = 0; i < pins.length; i++) {
    const { pin, stop } = pins[i]
    onProgress?.('locations', 3 + i, total + 3)
    const locatorPng = await renderLocator(planSource, pin, theme.structure)
    const locator = await doc.embedPng(await locatorPng.arrayBuffer())
    const images = await loadPhotos(doc, store, pin, photoById)
    await locationPages(ctx, project, pin, stop, total, locator, images, spec)
  }

  /* ---------------------------------------------------------------- signoff */
  if (spec.signOff) signOff(ctx, project, total, spec)

  planSource.bitmap.close()
  const bytes = await doc.save()
  onProgress?.('done', total + 3, total + 3)
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

/* ------------------------------------------------------------------ pieces */

/**
 * The cover title is set at 30pt, which only fits about two words a line. Break
 * it after an ampersand and keep the ampersand, rather than swallowing it.
 */
function titleLines(title: string): string[] {
  const upper = title.toUpperCase()
  const at = upper.indexOf(' & ')
  if (at < 0) return [upper]
  return [`${upper.slice(0, at)} &`, upper.slice(at + 3)]
}

function cover(
  ctx: Ctx,
  project: Project,
  pins: { pin: Pin; stop: number }[],
  photoCount: number,
  logo: PDFImage | null,
  title: string,
) {
  const { theme, fonts } = ctx
  const s = newSheet(ctx, '')
  const date = formatDate(project.report.date || new Date().toISOString())
  const spec = specFor(project.template)
  const colW = (PW - 2 * M) / 2

  let y = PH - 110
  if (logo) {
    const h = 30
    const w = (logo.width / logo.height) * h
    s.page.drawImage(logo, { x: M, y, width: Math.min(w, 150), height: h })
    y -= 22
  }

  /* title block */
  s.cap(templateName(project.template), M, y, 8, theme.accent, 1.6)
  y -= 34
  for (const line of titleLines(title)) {
    s.text(line, M, y, { font: fonts.display, size: 28, color: theme.structure })
    y -= 32
  }
  s.line(M, y + 16, M + 150, y + 16, theme.accent, 4)

  y -= 2
  s.text(ctx.site, M, y, { font: fonts.bodyBold, size: 11, color: theme.ink })
  y -= 15
  // "Walkthrough 17 September · kitchen and service floor" — what and when. A GM
  // writes a whole clause here, so it wraps; two lines, then it stops.
  const walkLine = [`Walkthrough ${date}`, project.report.surface].filter(Boolean).join(' · ')
  for (const line of clampLines(walkLine, fonts.body, 9.5, PW - 2 * M, 2)) {
    s.text(line, M, y, { size: 9.5, color: theme.muted })
    y -= 13
  }
  y += 13

  /* the four numbers */
  y -= 28
  const cw = PW - 2 * M
  const ch = 100
  s.rect(M, y - ch, cw, ch, { fill: theme.card })
  s.rect(M, y - ch, cw, ch, { stroke: theme.structure, lineWidth: 1.2 })

  const kinds = [...new Set(project.pins.map((p) => issueLabel(project.issueSet, p.issue)))].sort()
  const closed = project.pins.filter((p) => p.status === CLOSED_STATUS).length
  const closedWord = statusesFor(project.subject).find((x) => x.id === CLOSED_STATUS)?.label ?? 'Closed'
  const tiles: [string, string][] = [
    [String(pins.length), plural(pins.length, 'Location marked', 'Locations marked')],
    [String(photoCount), plural(photoCount, 'Photo taken', 'Photos taken')],
    [String(kinds.length), plural(kinds.length, 'Problem type', 'Problem types')],
    [String(closed), `${closedWord} so far`],
  ]
  tiles.forEach(([value, label], i) => {
    const cx = M + 22 + (i * (cw - 30)) / 4
    s.text(value, cx, y - 50, {
      font: fonts.display,
      size: 26,
      color: i === 1 ? theme.highlight : theme.structure,
    })
    s.cap(label, cx, y - 66, 7, theme.muted)
  })
  if (kinds.length) {
    // One condition reads better as a sentence than as a list of one; a long
    // list is trimmed to what fits with a count, rather than an ellipsis that
    // hides how much was left out.
    const line =
      kinds.length === 1
        ? reportCopy.oneCondition(kinds[0])
        : reportCopy.manyConditions(fitList(kinds, fonts.body, 8.5, cw - 44 - 110))
    s.text(line, M + 22, y - ch + 14, { size: 8.5, color: theme.muted })
  }
  y -= ch + 22

  /* what's in this package — two columns so it earns its vertical space */
  y = s.heading(reportCopy.contentsHeading, y, 100)
  const contents = spec.pricing ? reportCopy.contents : reportCopy.contentsNoPricing
  for (let row = 0; row < 2; row++) {
    let lowest = y
    for (let col = 0; col < 2; col++) {
      const item = contents[row * 2 + col]
      if (!item) continue
      const cx = M + col * colW
      s.text(item[0], cx, y, { font: fonts.bodyBold, size: 9, color: theme.structure })
      const bottom = s.para(item[1], cx, y - 12, colW - 22, { size: 8.2, leading: 10.5, color: theme.muted })
      lowest = Math.min(lowest, bottom)
    }
    y = lowest - 8
  }

  /* where the work is */
  y = s.heading(reportCopy.whereWork, y - 4, 100)
  const areas = new Map<string, { pins: number[]; photos: number }>()
  for (const { pin } of pins) {
    const key = pin.area || 'Unnamed'
    const entry = areas.get(key) ?? { pins: [], photos: 0 }
    entry.pins.push(pin.no)
    entry.photos += pin.photoIds.length
    areas.set(key, entry)
  }
  const rows = [...areas.entries()].sort((a, b) => b[1].photos - a[1].photos || a[0].localeCompare(b[0]))
  const half = Math.ceil(rows.length / 2)
  let lowest = y
  for (let col = 0; col < 2; col++) {
    let cy = y
    const cx = M + col * colW
    for (const [name, data] of rows.slice(col * half, (col + 1) * half)) {
      s.text(ellipsize(name, fonts.bodyBold, 9, colW - 84), cx, cy, {
        font: fonts.bodyBold,
        size: 9,
        color: theme.ink,
      })
      const tag = `${data.pins.length === 1 ? 'pin' : 'pins'} ${[...data.pins].sort((a, b) => a - b).join(', ')}`
      s.text(`${tag} · ${data.photos}p`, cx + colW - 24, cy, { size: 8.5, color: theme.muted, align: 'r' })
      cy -= 12.5
    }
    lowest = Math.min(lowest, cy)
  }
  y = lowest - 14

  /* how to read the numbers */
  const bh = 66
  const boxTop = Math.max(y, 62 + bh + (project.report.link ? 30 : 0))
  s.rect(M, boxTop - bh, PW - 2 * M, bh, { fill: theme.warn })
  s.rect(M, boxTop - bh, PW - 2 * M, bh, { stroke: theme.structure, lineWidth: 2 })
  s.cap(reportCopy.numbersHeading, M + 14, boxTop - 18, 8.5, theme.ink, 0.8)
  s.para(reportCopy.numbersExplainer, M + 14, boxTop - 33, PW - 2 * M - 28, { size: 8.4, leading: 11 })

  if (project.report.link) {
    const ly = Math.max(58, boxTop - bh - 20)
    s.text(reportCopy.liveMap, M, ly, { size: 8.5, color: theme.muted })
    s.text(ellipsize(project.report.link, fonts.bodyBold, 8.5, PW - 2 * M), M, ly - 11, {
      font: fonts.bodyBold,
      size: 8.5,
      color: theme.structure,
    })
  }
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** As many list items as fit on one line, then "+N more". */
function fitList(items: string[], font: Fonts['body'], size: number, maxW: number): string {
  const lower = items.map((x) => x.toLowerCase())
  for (let take = lower.length; take > 1; take--) {
    const rest = lower.length - take
    const text = lower.slice(0, take).join(', ') + (rest ? ` +${rest} more` : '')
    if (textWidth(text, font, size) <= maxW) return text
  }
  return `${lower[0]} +${lower.length - 1} more`
}

/** A key to the pin colours, so a multi-issue plan reads without the app. */
function planLegend(s: Sheet, project: Project, colorOf: (pin: Pin) => string) {
  const closedWord = statusesFor(project.subject).find((x) => x.id === CLOSED_STATUS)?.label ?? 'Closed'
  const issues = new Map<string, string>()
  let anyClosed: string | null = null
  for (const pin of project.pins) {
    if (pin.status === CLOSED_STATUS) {
      anyClosed = colorOf(pin)
      continue
    }
    const label = issueLabel(project.issueSet, pin.issue)
    if (!issues.has(label)) issues.set(label, colorOf(pin))
  }
  const entries = [...issues.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  if (anyClosed) entries.push([closedWord, anyClosed])
  let x = M
  const y = 62
  for (const [label, color] of entries) {
    const w = textWidth(label, s.fonts.body, 7.5) + 20
    if (x + w > s.width - M) break
    s.circle(x + 4, y + 2.5, 4, color)
    s.text(label, x + 12, y, { size: 7.5, color: s.theme.ink })
    x += w
  }
}

function worksheet(
  ctx: Ctx,
  project: Project,
  pins: { pin: Pin; stop: number }[],
  spec: ReturnType<typeof specFor>,
) {
  const { theme, fonts } = ctx
  let s = newSheet(ctx, spec.worksheetTitle)
  let y = PH - 80

  s.text(spec.worksheetTitle, M, y, { font: fonts.display, size: 15, color: theme.structure })
  s.line(M, y - 10, M + 120, y - 10, theme.accent, 3)
  y -= 26
  if (spec.pricing) {
    s.text(reportCopy.worksheetNote, M, y, { size: 9, color: theme.ink })
    y -= 22
  } else {
    y -= 8
  }

  const cols: [string, number][] = spec.pricing
    ? [
        ['STOP', 34],
        ['PIN', 28],
        ['LOCATION', 132],
        ['CONDITION', 96],
        ['PHOTOS', 40],
        ['AREA / SQ FT', 74],
        ['PRICE', 82],
      ]
    : [
        ['STOP', 36],
        ['PIN', 30],
        ['LOCATION', 168],
        ['CONDITION', 130],
        ['STATUS', 78],
        ['PHOTOS', 44],
      ]

  const xs: { name: string; x: number; w: number }[] = []
  let x = M
  for (const [name, w] of cols) {
    xs.push({ name, x, w })
    x += w
  }
  const rh = 22

  const header = (sheet: Sheet, atY: number) => {
    sheet.rect(M, atY - rh, x - M, rh, { fill: theme.structure })
    for (const col of xs) sheet.cap(col.name, col.x + 6, atY - 14, 7, theme.white, 0.8)
  }

  header(s, y)
  y -= rh

  pins.forEach(({ pin, stop }, i) => {
    if (y < 150) {
      s = newSheet(ctx, spec.worksheetTitle)
      y = PH - 90
      header(s, y)
      y -= rh
    }
    s.rect(M, y - rh, x - M, rh, { fill: i % 2 === 0 ? theme.white : theme.card })
    const values: Record<string, string> = {
      STOP: String(stop),
      PIN: String(pin.no),
      LOCATION: pin.area || 'Unnamed',
      CONDITION: issueLabel(project.issueSet, pin.issue),
      STATUS: statusLabel(project.subject, pin.status),
      PHOTOS: String(pin.photoIds.length),
      'AREA / SQ FT': '',
      PRICE: '',
    }
    for (const col of xs) {
      const value = values[col.name] ?? ''
      if (!value) continue
      const strong = col.name === 'STOP' || col.name === 'PIN'
      const font = strong ? fonts.bodyBold : fonts.body
      s.text(ellipsize(value, font, 8.5, col.w - 10), col.x + 6, y - 15, {
        font,
        size: 8.5,
        color: strong ? theme.structure : theme.ink,
      })
    }
    s.line(M, y - rh, x, y - rh, theme.rule, 0.5)
    y -= rh
  })

  y -= 10
  if (spec.pricing) {
    s.text('TOTAL', M, y, { font: fonts.bodyBold, size: 9, color: theme.structure })
    const qty = xs.find((c) => c.name === 'AREA / SQ FT')
    const price = xs.find((c) => c.name === 'PRICE')
    if (qty) s.text('____________', qty.x + 6, y, { font: fonts.bodyBold, size: 9, color: theme.structure })
    if (price) s.text('______________', price.x + 6, y, { font: fonts.bodyBold, size: 9, color: theme.structure })
    y -= 30

    const bh = 64
    if (y - bh > 60) {
      s.rect(M, y - bh, PW - 2 * M, bh, { fill: theme.alarm })
      s.line(M + 2, y - bh, M + 2, y, theme.accent, 5)
      s.cap('Next actions', M + 16, y - 18, 8.5, theme.ink, 0.8)
      s.text('Walk the site with the contractor: ______________   Owner: ____________   Date: _________', M + 16, y - 34, { size: 9 })
      s.text('Quote returned and submitted: _________________   Owner: ____________   Date: _________', M + 16, y - 50, { size: 9 })
    }
  }
}

async function locationPages(
  ctx: Ctx,
  project: Project,
  pin: Pin,
  stop: number,
  total: number,
  locator: PDFImage,
  images: { image: PDFImage; photo: Photo }[],
  spec: ReturnType<typeof specFor>,
) {
  const { theme, fonts } = ctx
  const chunks: { image: PDFImage; photo: Photo }[][] = []
  for (let i = 0; i < images.length; i += 4) chunks.push(images.slice(i, i + 4))
  if (!chunks.length) chunks.push([])

  chunks.forEach((chunk, ci) => {
    const s = newSheet(ctx, `stop ${stop} of ${total}`)
    let y = PH - 80

    s.circle(M + 15, y - 4, 15, theme.structure)
    const noWidth = textWidth(String(pin.no), fonts.label, 13)
    s.text(String(pin.no), M + 15 - noWidth / 2, y - 9, { font: fonts.label, size: 13, color: theme.white })

    const title = (pin.area || 'Unnamed location').toUpperCase() + (ci ? ' (CONT.)' : '')
    const fitted = ellipsize(title, fonts.display, 15, PW - M - (M + 42) - 180)
    s.text(fitted, M + 42, y - 10, { font: fonts.display, size: 15, color: theme.structure })
    s.line(M + 42, y - 22, M + 42 + Math.min(260, textWidth(fitted, fonts.display, 15)), y - 22, theme.accent, 3)

    const locW = 168
    const locH = locW / 1.5
    s.fit(locator, PW - M - locW, y - locH - 4, locW, locH, { background: theme.white })
    s.cap('where it is', PW - M - locW, y - locH - 16, 6.5, theme.muted)

    y -= 44
    // These were fixed 82pt columns, so a long built-in label such as
    // "Chipped / broken tile" ran into STATUS. Status and photo count take the
    // room they measure; condition gets the rest and is clipped to it.
    const fields: [string, string][] = [
      ['CONDITION', issueLabel(project.issueSet, pin.issue)],
      ['STATUS', statusLabel(project.subject, pin.status)],
      ['PHOTOS', String(images.length)],
    ]
    const fieldGap = 20
    const fieldRoom = PW - 2 * M - locW - 20
    const measure = (label: string, value: string) =>
      Math.max(
        textWidth(label, fonts.label, 7.5, 1.1),
        fonts.bodyBold.widthOfTextAtSize(value, 10),
      )
    const wStatus = measure(fields[1][0], fields[1][1])
    const wPhotos = measure(fields[2][0], fields[2][1])
    const wCondition = Math.max(70, fieldRoom - wStatus - wPhotos - fieldGap * 2)
    fields[0][1] = ellipsize(fields[0][1], fonts.bodyBold, 10, wCondition)
    const fieldX = [
      M,
      M + wCondition + fieldGap,
      M + wCondition + fieldGap + wStatus + fieldGap,
    ]
    fields.forEach(([label], i) => s.cap(label, fieldX[i], y, 7.5, theme.muted))
    y -= 15
    fields.forEach(([, value], i) =>
      s.text(value, fieldX[i], y, { font: fonts.bodyBold, size: 10, color: theme.structure }),
    )
    y -= 20

    if (pin.note && !ci) {
      y = s.para(`Note from the site: ${pin.note}`, M, y, PW - 2 * M - locW - 20, { size: 9 }) - 6
    }
    y = Math.min(y, PH - 80 - locH - 34)

    /* photo grid */
    const n = chunk.length
    if (n) {
      const colsN = n === 1 ? 1 : 2
      const rowsN = Math.max(1, Math.ceil(n / colsN))
      const gap = 14
      const capSp = 14
      const floor = spec.contractorBlock ? 140 : 76
      const gw = (PW - 2 * M - (colsN - 1) * gap) / colsN
      const gh = Math.min(430, (y - floor - rowsN * capSp - (rowsN - 1) * gap) / rowsN)
      chunk.forEach(({ image, photo }, i) => {
        const gx = M + (i % colsN) * (gw + gap)
        const gy = y - (Math.floor(i / colsN) + 1) * (gh + capSp + gap) + gap
        s.fit(image, gx, gy, gw, gh, { border: theme.rule })
        s.text(photoLabel(pin, photo.id), gx, gy - 11, { size: 7.5, color: theme.muted })
      })
      y -= rowsN * (gh + capSp + gap)
    } else {
      s.text('No photographs on this location.', M, y, { size: 9, color: theme.muted })
      y -= 20
    }

    /* contractor-use block, on the last page of a location */
    if (spec.contractorBlock && ci === chunks.length - 1) {
      const bh = 58
      const by = Math.max(66 + bh, y - 10)
      s.rect(M, by - bh, PW - 2 * M, bh, { fill: theme.card })
      s.rect(M, by - bh, PW - 2 * M, bh, { stroke: theme.rule, lineWidth: 0.8 })
      s.cap(reportCopy.contractorUse, M + 12, by - 16, 6.5, theme.muted)
      s.text('Area (sq ft): ____________     Units to replace: ____________     Repair only:  Y / N', M + 12, by - 34, { size: 9 })
      s.text('Price: ____________     Notes: ______________________________________________________', M + 12, by - 50, { size: 9 })
    }
  })
}

function signOff(ctx: Ctx, project: Project, total: number, spec: ReturnType<typeof specFor>) {
  const { theme, fonts } = ctx
  const s = newSheet(ctx, 'approval')
  const site = project.report.site || project.name
  const date = formatDate(project.report.date || new Date().toISOString())
  // The cover shows the whole descriptor ("kitchen floor · quarry tile"); the
  // approval sentence reads as prose, so it takes only the leading noun phrase.
  const surface = project.report.surface.split('·')[0].trim() || 'the areas walked'

  let y = PH - 90
  s.text('APPROVAL & SIGN-OFF', M, y, { font: fonts.display, size: 15, color: theme.structure })
  s.line(M, y - 10, M + 150, y - 10, theme.accent, 3)
  y = s.para(reportCopy.approvalBody(surface, site, date, total), M, y - 40, PW - 2 * M, {
    size: 10,
    leading: 15,
  }) - 6
  if (project.report.findings) {
    y = s.para(project.report.findings, M, y, PW - 2 * M, { size: 10, leading: 15 }) - 6
  }
  y -= 12

  const lines: [string, string][] = [
    [spec.requestedByLabel, project.report.preparedBy],
    ['Site', site],
    ...spec.signOffLines.map((label) => [label, ''] as [string, string]),
  ]
  for (const [label, value] of lines) {
    s.cap(label, M, y, 7.5, theme.muted)
    s.line(M + 150, y - 3, PW - M, y - 3, theme.rule, 0.8)
    if (value) s.text(value, M + 156, y, { font: fonts.bodyBold, size: 10, color: theme.structure })
    y -= 34
  }
  s.text(reportCopy.snapshot(date), M, y - 10, { size: 8.5, color: theme.muted })
}

/* ----------------------------------------------------------------- loaders */

async function embedLogo(
  doc: PDFDocument,
  store: ProjectStore,
  blobId: string | null,
): Promise<PDFImage | null> {
  if (!blobId) return null
  try {
    const blob = await store.getBlob(blobId)
    if (!blob) return null
    const bytes = await blob.arrayBuffer()
    return blob.type === 'image/png' ? doc.embedPng(bytes) : doc.embedJpg(bytes)
  } catch {
    return null
  }
}

async function loadPhotos(
  doc: PDFDocument,
  store: ProjectStore,
  pin: Pin,
  photoById: Map<string, Photo>,
): Promise<{ image: PDFImage; photo: Photo }[]> {
  const out: { image: PDFImage; photo: Photo }[] = []
  for (const id of pin.photoIds) {
    const photo = photoById.get(id)
    if (!photo) continue
    const blob = await store.getBlob(photo.blobId)
    if (!blob) continue
    try {
      const bytes = await blob.arrayBuffer()
      // Photos are re-encoded to JPEG on import, so embedJpg is the normal path.
      const image = blob.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
      out.push({ image, photo })
    } catch {
      // A photo that will not embed is skipped rather than failing the report.
    }
  }
  return out
}
