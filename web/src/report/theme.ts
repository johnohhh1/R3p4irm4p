/** Report palette and the per-template differences. Colours from tools/build_pdf.py. */
import type { TemplateId } from '../lib/types'
import { TEMPLATE_NAMES } from '../lib/catalog'

export interface Theme {
  structure: string
  accent: string
  highlight: string
  page: string
  card: string
  rule: string
  muted: string
  ink: string
  white: string
  warn: string
  alarm: string
}

export const DEFAULT_THEME: Theme = {
  structure: '#22235B',
  accent: '#C0392B',
  highlight: '#B88A00',
  page: '#FAF9F5',
  card: '#EEECE7',
  rule: '#D4D2CD',
  muted: '#A19F9A',
  ink: '#17101D',
  white: '#FFFFFF',
  warn: '#FFF3CC',
  alarm: '#FDE7E8',
}

export function themeFor(accent: string): Theme {
  return { ...DEFAULT_THEME, structure: accent || DEFAULT_THEME.structure }
}

export interface TemplateSpec {
  id: TemplateId
  /** Cover title, in the report's own voice. */
  title: string
  /** Does the worksheet carry blank quantity and price columns? */
  pricing: boolean
  /** Does each location page carry a contractor-use block? */
  contractorBlock: boolean
  /** Does the package end with an approval and sign-off page? */
  signOff: boolean
  /** Label on the sign-off, and the first named line. */
  requestedByLabel: string
  worksheetTitle: string
  /** Extra sign-off lines beyond the shared ones. */
  signOffLines: string[]
}

const SPECS: Record<TemplateId, TemplateSpec> = {
  'repair-request': {
    id: 'repair-request',
    title: 'REPAIR REQUEST',
    pricing: true,
    contractorBlock: true,
    signOff: true,
    requestedByLabel: 'Requested by',
    worksheetTitle: 'REPAIR LIST',
    signOffLines: ['Facilities contact', 'Approved amount', 'Scheduled date'],
  },
  'scope-bid': {
    id: 'scope-bid',
    title: 'SCOPE & BID WORKSHEET',
    pricing: true,
    contractorBlock: true,
    signOff: true,
    requestedByLabel: 'Prepared by',
    worksheetTitle: 'SCOPE WORKSHEET',
    signOffLines: ['Contractor', 'Quoted amount', 'Quote valid until', 'Proposed start date'],
  },
  'condition-report': {
    id: 'condition-report',
    title: 'CONDITION REPORT',
    pricing: false,
    contractorBlock: false,
    signOff: true,
    requestedByLabel: 'Inspected by',
    worksheetTitle: 'CONDITION SUMMARY',
    signOffLines: ['Owner or agent', 'Reviewed on'],
  },
  insurance: {
    id: 'insurance',
    title: 'CONDITION REPORT',
    pricing: false,
    contractorBlock: false,
    signOff: true,
    requestedByLabel: 'Documented by',
    worksheetTitle: 'SCHEDULE OF DAMAGE',
    signOffLines: ['Policy number', 'Claim number', 'Adjuster', 'Date of loss'],
  },
  record: {
    id: 'record',
    title: 'SITE RECORD',
    pricing: false,
    contractorBlock: false,
    signOff: false,
    requestedByLabel: 'Walked by',
    worksheetTitle: 'LOCATION LIST',
    signOffLines: [],
  },
}

export function specFor(template: TemplateId): TemplateSpec {
  return SPECS[template] ?? SPECS['repair-request']
}

export function templateName(template: TemplateId): string {
  return TEMPLATE_NAMES[template] ?? TEMPLATE_NAMES['repair-request']
}
