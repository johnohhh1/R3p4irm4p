import type { PDFDocument } from 'pdf-lib'
import type { Project } from '../lib/types'
import { WINTER_SOURCE, WINTER_STEPS, WINTER_STATUSES, winterCounts } from '../lib/winter'
import { M, PH, PW, Sheet, wrap, type Fonts } from './page'
import { themeFor } from './theme'
import { drawable, printable } from './printable'

/** Preparation pages; the shared report pipeline appends the real map and evidence. */
export async function winterReport(project: Project, doc: PDFDocument, fonts: Fonts): Promise<void> {
  const theme = themeFor(project.report.accent)
  const allowed = drawable(Object.values(fonts))
  const clean = (value: string) => printable(value, allowed)
  let pageNo = 0
  let sheet: Sheet
  let y = 0
  const newPage = () => {
    sheet = new Sheet(doc.addPage([PW, PH]), fonts, theme)
    sheet.frame({ site: project.report.site || project.name, byline: clean([project.report.preparedBy, project.report.date].filter(Boolean).join(' | ')), right: 'Winter preparation', pageNo: ++pageNo })
    y = PH - 80
  }
  const paragraph = (value: string, bold = false, size = 10) => {
    const font = bold ? fonts.bodyBold : fonts.body
    for (const line of wrap(clean(value), font, size, PW - M * 2)) {
      if (y < 66) newPage()
      sheet.text(line, M, y, {font, size, color: theme.structure})
      y -= 15
    }
    y -= 7
  }
  newPage()
  doc.setTitle(`Winter Preparation - ${project.report.site || project.name}`)
  doc.setCreator('Repair Map')
  paragraph('WINTER PREPARATION', true, 21)
  paragraph('Preparation checklist only. Opening and closing extreme-weather response procedures are excluded.')
  const counts = winterCounts(project.winterPreparation)
  paragraph(`${counts.done}/12 complete | ${counts.attention} need attention | ${counts.pending} not started | ${counts.na} not applicable`, true)
  paragraph('Seasonal readiness items confirm the ice-melt and snow-clearing standards to follow throughout winter.')
  if (project.report.surface) paragraph(`Scope: ${project.report.surface}`)
  let group = ''
  for (const [index, step] of WINTER_STEPS.entries()) {
    if (y < 210) newPage()
    if (group !== step.group) { group = step.group; paragraph(group.toUpperCase(), true, 12) }
    paragraph(`${index + 1}. ${step.title}`, true)
    paragraph(step.text)
    const result = project.winterPreparation?.[step.id]
    paragraph(`Status: ${WINTER_STATUSES[result?.status ?? 'pending']}`, true)
    const pins = project.pins.filter(pin => pin.winterStepId === step.id)
    if (pins.length) paragraph(`Evidence spots: ${pins.map(pin => pin.no).join(', ')} | ${pins.reduce((n,pin) => n + pin.photoIds.length, 0)} photos`)
    if (result?.note) paragraph(`Notes: ${result.note}`)
    y -= 7
  }
  const followUps = project.pins.filter(pin => pin.needsWorkOrder || pin.workOrder)
  if (followUps.length) {
    newPage()
    paragraph('WORK-ORDER FOLLOW-UP', true, 16)
    for (const pin of followUps) {
      paragraph(`Spot ${pin.no}: ${pin.area || 'Unnamed location'}`, true)
      paragraph(pin.issue)
      paragraph(pin.note)
    }
  }
  if (project.report.findings) { paragraph('FINDINGS / FOLLOW-UP', true); paragraph(project.report.findings) }
  paragraph(`Source: ${WINTER_SOURCE}`, false, 8)
  paragraph('Statuses and notes are recorded by the preparer; this report does not independently verify completion.', false, 8)

}
