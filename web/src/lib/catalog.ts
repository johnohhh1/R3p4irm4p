/**
 * The vocabulary. Q1/Q2/Q3 answers pick from here; nothing else in the app
 * hard-codes an issue, a status word or an area name.
 */
import type { IssueSetId, SubjectId, TemplateId } from './types'

export interface IssueDef {
  id: string
  label: string
  /** Pin colour. Kept distinguishable in both themes. */
  color: string
}

export interface IssueSetDef {
  id: IssueSetId
  label: string
  issues: IssueDef[]
}

export const ISSUE_SETS: IssueSetDef[] = [
  {
    id: 'floors',
    label: 'Floors & tile',
    issues: [
      { id: 'grout', label: 'Grout repair', color: '#C07C00' },
      { id: 'cracked', label: 'Cracked tile', color: '#CC2F2F' },
      { id: 'chipped', label: 'Chipped / broken tile', color: '#2D6BD1' },
      { id: 'loose', label: 'Loose or missing tile', color: '#8549CC' },
      { id: 'worn', label: 'Worn or failed finish', color: '#7A5C3E' },
      { id: 'trip', label: 'Trip hazard', color: '#D4581F' },
    ],
  },
  {
    id: 'plumbing',
    label: 'Plumbing & leaks',
    issues: [
      { id: 'leak', label: 'Active leak', color: '#1F8AA8' },
      { id: 'drain', label: 'Drain or floor sink', color: '#2F6E7A' },
      { id: 'fixture', label: 'Fixture damaged', color: '#4A76C4' },
      { id: 'water-damage', label: 'Water damage', color: '#5C4CA8' },
    ],
  },
  {
    id: 'walls',
    label: 'Walls & ceilings',
    issues: [
      { id: 'wall-crack', label: 'Crack in wall', color: '#B8442C' },
      { id: 'hole', label: 'Hole or impact damage', color: '#9C3B6B' },
      { id: 'ceiling', label: 'Ceiling tile or panel', color: '#3D7CA8' },
      { id: 'stain', label: 'Stain or discolouration', color: '#8A7020' },
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment',
    issues: [
      { id: 'not-working', label: 'Not working', color: '#C22F4F' },
      { id: 'damaged', label: 'Damaged', color: '#A64B1F' },
      { id: 'service', label: 'Needs service', color: '#3E7F5C' },
      { id: 'missing-part', label: 'Missing part', color: '#6B5BA8' },
    ],
  },
  {
    id: 'safety',
    label: 'Safety hazards',
    issues: [
      { id: 'trip-hazard', label: 'Trip hazard', color: '#D4581F' },
      { id: 'blocked', label: 'Blocked exit or aisle', color: '#C22F2F' },
      { id: 'electrical', label: 'Electrical hazard', color: '#B88A00' },
      { id: 'guard', label: 'Missing guard or cover', color: '#7A4FB5' },
    ],
  },
  {
    id: 'damage',
    label: 'Damage / insurance',
    issues: [
      { id: 'water', label: 'Water damage', color: '#1F7FA8' },
      { id: 'fire', label: 'Fire or smoke damage', color: '#C0392B' },
      { id: 'impact', label: 'Impact damage', color: '#8A5320' },
      { id: 'vandalism', label: 'Vandalism', color: '#8E3B8E' },
      { id: 'wear', label: 'Normal wear', color: '#5C6874' },
    ],
  },
  {
    id: 'finish',
    label: 'Finish work',
    issues: [
      { id: 'paint', label: 'Paint or touch-up', color: '#3E7FA8' },
      { id: 'caulk', label: 'Caulk or sealant', color: '#2F8A6B' },
      { id: 'trim', label: 'Trim or moulding', color: '#8A6B20' },
      { id: 'alignment', label: 'Out of alignment', color: '#6B5BA8' },
      { id: 'cleanup', label: 'Clean-up needed', color: '#5C6874' },
    ],
  },
]

export const OTHER_ISSUE: IssueDef = { id: 'other', label: 'Other', color: '#5C6874' }
export const DONE_COLOR = '#2B8653'

/** Every issue offered by a project, in set order, with Other last. */
export function issuesFor(sets: IssueSetId[]): IssueDef[] {
  const out: IssueDef[] = []
  const seen = new Set<string>()
  for (const set of ISSUE_SETS) {
    if (!sets.includes(set.id)) continue
    for (const issue of set.issues) {
      if (seen.has(issue.id)) continue
      seen.add(issue.id)
      out.push(issue)
    }
  }
  out.push(OTHER_ISSUE)
  return out
}

export function issueLabel(sets: IssueSetId[], id: string): string {
  return issuesFor(sets).find((i) => i.id === id)?.label ?? id
}

export function issueColor(sets: IssueSetId[], id: string): string {
  return issuesFor(sets).find((i) => i.id === id)?.color ?? OTHER_ISSUE.color
}

/* ---------------------------------------------------------------- statuses */

export interface StatusDef {
  id: string
  label: string
}

const STATUS_DEFAULT: StatusDef[] = [
  { id: 'open', label: 'Open' },
  { id: 'sched', label: 'Scheduled' },
  { id: 'done', label: 'Done' },
]

const STATUS_PUNCHLIST: StatusDef[] = [
  { id: 'open', label: 'Open' },
  { id: 'progress', label: 'In progress' },
  { id: 'verify', label: 'Ready to verify' },
  { id: 'done', label: 'Accepted' },
]

export function statusesFor(subject: SubjectId): StatusDef[] {
  return subject === 'punchlist' ? STATUS_PUNCHLIST : STATUS_DEFAULT
}

export function statusLabel(subject: SubjectId, id: string): string {
  return statusesFor(subject).find((s) => s.id === id)?.label ?? id
}

/** The one status that means "no longer outstanding", whatever it is called. */
export const CLOSED_STATUS = 'done'

/* ------------------------------------------------------------ area names */

const AREAS: Record<SubjectId, string[]> = {
  restaurant: [
    'Dish area', 'Cook line', 'Walk-in cooler', 'Soda station', 'Expo',
    'Prep area', 'Dry storage', 'Front counter', 'Dining room', 'Restrooms',
    'Bar', 'Back dock', 'Office',
  ],
  property: [
    'Kitchen', 'Living room', 'Bedroom', 'Bathroom', 'Hallway', 'Stairs',
    'Garage', 'Basement', 'Laundry', 'Exterior', 'Roof', 'Common area',
  ],
  punchlist: [
    'Lobby', 'Corridor', 'Stairwell', 'Mechanical room', 'Electrical room',
    'Restrooms', 'Roof', 'Exterior', 'Parking', 'Unit',
  ],
  bid: [
    'Entry', 'Main floor', 'Back of house', 'Storage', 'Restrooms',
    'Exterior', 'Roof', 'Mechanical',
  ],
  other: ['Entry', 'Main area', 'Back area', 'Storage', 'Restrooms', 'Exterior'],
}

export function areasFor(subject: SubjectId): string[] {
  return AREAS[subject] ?? AREAS.other
}

/* -------------------------------------------------------------- defaults */

/** Q1 seeds which problem families are pre-ticked in Q2. */
export const SUBJECT_ISSUE_SETS: Record<SubjectId, IssueSetId[]> = {
  restaurant: ['floors', 'plumbing', 'equipment'],
  property: ['walls', 'plumbing', 'finish'],
  punchlist: ['finish', 'walls', 'equipment'],
  bid: ['floors', 'walls', 'finish'],
  other: ['floors', 'walls'],
}

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  'repair-request': 'Repair request',
  'scope-bid': 'Scope & bid worksheet',
  'condition-report': 'Condition report',
  insurance: 'Condition report — insurance',
  record: 'Site record',
}

/** Templates that print blank quantity and price columns. */
export const TEMPLATES_WITH_PRICING: TemplateId[] = ['scope-bid', 'repair-request']
