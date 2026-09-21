/**
 * Report text is drawn with fonts that cover a fixed character set (WinAnsi for
 * the built-in fallback). One character outside it — an arrow, a checkmark
 * emoji, a pasted "▪" bullet, an invisible zero-width space — used to throw and
 * abort the whole report. Text is now cleaned to what the fonts can draw: close
 * substitutes where there are any, and anything else is left out.
 */
import type { PDFFont } from 'pdf-lib'
import type { Project } from '../lib/types'

const SUBSTITUTES: Record<string, string> = {
  '→': '->',
  '←': '<-',
  '⇒': '=>',
  '↔': '<->',
  '≥': '>=',
  '≤': '<=',
  '≠': '!=',
  '✓': 'v',
  '✔': 'v',
  '✗': 'x',
  '✘': 'x',
  '▪': '•',
  '▫': '•',
  '●': '•',
  '◦': '•',
  '■': '•',
  '□': '•',
  '‣': '•',
  '⁃': '-',
  '−': '-',
  '‐': '-',
  '‑': '-',
  '⁄': '/',
  '′': "'",
  '″': '"',
}

/** Zero-width and direction marks: invisible on screen, fatal in a PDF. */
const INVISIBLE = /[​-‏‪-‮⁠-⁤︎️﻿]/

/** Code points every report font can draw, so any text is safe in any face. */
export function drawable(fonts: PDFFont[]): Set<number> {
  const sets = fonts.map((font) => new Set(font.getCharacterSet()))
  return new Set([...sets[0]].filter((cp) => sets.every((set) => set.has(cp))))
}

function fits(text: string, ok: Set<number>): boolean {
  return [...text].every((ch) => ok.has(ch.codePointAt(0)!))
}

export function printable(value: string, ok: Set<number>): string {
  let out = ''
  for (const ch of value) {
    if (ok.has(ch.codePointAt(0)!)) {
      out += ch
      continue
    }
    if (INVISIBLE.test(ch)) continue
    if (/\s/.test(ch)) {
      out += ' '
      continue
    }
    const sub = SUBSTITUTES[ch]
    if (sub && fits(sub, ok)) {
      out += sub
      continue
    }
    // "ő" becomes "o" only when the font cannot draw it as it is.
    const bare = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    if (bare && bare !== ch && fits(bare, ok)) {
      out += bare
      continue
    }
    // Emoji and anything else the fonts cannot draw are left out.
  }
  return out.replace(/\s{2,}/g, ' ').trim()
}

/** A copy of the project with every user-written string made drawable. */
export function printableProject(project: Project, ok: Set<number>): Project {
  const p = (value: string) => printable(value, ok)
  return {
    ...project,
    name: p(project.name),
    pins: project.pins.map((pin) => ({
      ...pin,
      area: p(pin.area),
      issue: p(pin.issue),
      note: p(pin.note),
    })),
    photos: project.photos.map((photo) => ({ ...photo, name: p(photo.name) })),
    report: {
      ...project.report,
      site: p(project.report.site),
      preparedBy: p(project.report.preparedBy),
      surface: p(project.report.surface),
      findings: p(project.report.findings),
      link: p(project.report.link),
    },
  }
}
