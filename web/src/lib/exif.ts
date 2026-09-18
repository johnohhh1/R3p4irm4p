/**
 * Just enough EXIF to answer two questions: when was this taken, and does it
 * carry a location. We never re-embed EXIF — resizing through a canvas drops it,
 * which is how GPS gets stripped by default. PRD §5, Phase 1 photos.
 */

export interface ExifFacts {
  takenAt: string | null
  gps: { lat: number; lon: number } | null
  /** Orientation 1–8, so a portrait phone photo is not printed on its side. */
  orientation: number
}

const EMPTY: ExifFacts = { takenAt: null, gps: null, orientation: 1 }

const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME = 0x0132
const TAG_EXIF_IFD = 0x8769
const TAG_GPS_IFD = 0x8825
const TAG_ORIENTATION = 0x0112
const GPS_LAT_REF = 0x0001
const GPS_LAT = 0x0002
const GPS_LON_REF = 0x0003
const GPS_LON = 0x0004

/** Bytes per component, indexed by EXIF type code. */
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

export async function readExif(file: Blob): Promise<ExifFacts> {
  try {
    // The APP1 segment lives near the front; 256 KB is generous.
    const head = await file.slice(0, 256 * 1024).arrayBuffer()
    return parse(new DataView(head))
  } catch {
    return EMPTY
  }
}

function parse(view: DataView): ExifFacts {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return EMPTY // not a JPEG

  let offset = 2
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    const size = view.getUint16(offset + 2)
    if (marker === 0xe1) {
      const start = offset + 4
      // "Exif\0\0"
      if (view.getUint32(start) === 0x45786966) return parseTiff(view, start + 6)
    }
    if (marker === 0xda) break // start of scan — no more metadata
    offset += 2 + size
  }
  return EMPTY
}

function parseTiff(view: DataView, tiff: number): ExifFacts {
  if (tiff + 8 > view.byteLength) return EMPTY
  const endian = view.getUint16(tiff)
  const le = endian === 0x4949
  if (!le && endian !== 0x4d4d) return EMPTY

  const u16 = (o: number) => view.getUint16(o, le)
  const u32 = (o: number) => view.getUint32(o, le)

  const ifd0 = tiff + u32(tiff + 4)
  const out: ExifFacts = { takenAt: null, gps: null, orientation: 1 }

  const readIfd = (start: number, visit: (tag: number, type: number, count: number, valueAt: number) => void) => {
    if (start + 2 > view.byteLength) return
    const entries = u16(start)
    for (let i = 0; i < entries; i++) {
      const entry = start + 2 + i * 12
      if (entry + 12 > view.byteLength) return
      const tag = u16(entry)
      const type = u16(entry + 2)
      const count = u32(entry + 4)
      const bytes = (TYPE_SIZE[type] ?? 1) * count
      const valueAt = bytes > 4 ? tiff + u32(entry + 8) : entry + 8
      visit(tag, type, count, valueAt)
    }
  }

  const ascii = (at: number, count: number) => {
    let s = ''
    for (let i = 0; i < count && at + i < view.byteLength; i++) {
      const c = view.getUint8(at + i)
      if (c === 0) break
      s += String.fromCharCode(c)
    }
    return s
  }

  const rational = (at: number) => {
    const n = u32(at)
    const d = u32(at + 4)
    return d ? n / d : 0
  }

  let exifIfd = 0
  let gpsIfd = 0

  readIfd(ifd0, (tag, _type, count, at) => {
    if (tag === TAG_EXIF_IFD) exifIfd = tiff + u32(at)
    else if (tag === TAG_GPS_IFD) gpsIfd = tiff + u32(at)
    else if (tag === TAG_ORIENTATION) out.orientation = u16(at) || 1
    else if (tag === TAG_DATETIME && !out.takenAt) out.takenAt = exifDate(ascii(at, count))
  })

  if (exifIfd) {
    readIfd(exifIfd, (tag, _type, count, at) => {
      if (tag === TAG_DATETIME_ORIGINAL) out.takenAt = exifDate(ascii(at, count)) ?? out.takenAt
    })
  }

  if (gpsIfd) {
    let lat = 0
    let lon = 0
    let latRef = 'N'
    let lonRef = 'E'
    let seen = false
    readIfd(gpsIfd, (tag, _type, count, at) => {
      if (tag === GPS_LAT_REF) latRef = ascii(at, count) || 'N'
      else if (tag === GPS_LON_REF) lonRef = ascii(at, count) || 'E'
      else if (tag === GPS_LAT && count >= 3) {
        lat = rational(at) + rational(at + 8) / 60 + rational(at + 16) / 3600
        seen = true
      } else if (tag === GPS_LON && count >= 3) {
        lon = rational(at) + rational(at + 8) / 60 + rational(at + 16) / 3600
        seen = true
      }
    })
    if (seen && (lat || lon)) {
      out.gps = {
        lat: latRef.startsWith('S') ? -lat : lat,
        lon: lonRef.startsWith('W') ? -lon : lon,
      }
    }
  }

  return out
}

/** EXIF writes "2026:09:17 14:03:22". Treat it as local time, which is what it is. */
function exifDate(raw: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim())
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
