/**
 * The vocabulary. Q1/Q2/Q3 answers pick from here; nothing else in the app
 * hard-codes an issue, a status word or an area name.
 */
import type { IssueSetId, Pin, SubjectId, TemplateId } from './types'

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

/*
 * Validation walks share four outcomes with fixed ids, so coverage can be
 * counted the same way for both; only the words change with the job.
 */
export const PENDING = 'pending'
export const VERIFIED = 'verified'
export const MISSING = 'missing'
export const WRONG = 'wrong'

const STATUS_ROLLOUT: StatusDef[] = [
  { id: PENDING, label: 'Not checked' },
  { id: VERIFIED, label: 'Verified' },
  { id: MISSING, label: 'Missing' },
  { id: WRONG, label: 'Needs fixing' },
]

const STATUS_PLACEMENT: StatusDef[] = [
  { id: PENDING, label: 'Not checked' },
  { id: VERIFIED, label: 'In place' },
  { id: MISSING, label: 'Missing' },
  { id: WRONG, label: 'Wrong spot' },
]

/** Result colours for a validation walk: the colour is the answer. */
export const RESULT_COLORS: Record<string, string> = {
  [PENDING]: '#8A8F98',
  [VERIFIED]: '#2B8653',
  [MISSING]: '#CC2F2F',
  [WRONG]: '#C07C00',
}

export function isValidation(subject: SubjectId): boolean {
  return subject === 'rollout' || subject === 'placement'
}

export function statusesFor(subject: SubjectId): StatusDef[] {
  if (subject === 'rollout') return STATUS_ROLLOUT
  if (subject === 'placement') return STATUS_PLACEMENT
  return subject === 'punchlist' ? STATUS_PUNCHLIST : STATUS_DEFAULT
}

/**
 * The colour a pin is drawn in, on screen and in print. A repair walk colours
 * by what is wrong; a validation walk colours by the result.
 */
export function pinColor(subject: SubjectId, sets: IssueSetId[], pin: Pin): string {
  if (isValidation(subject)) return RESULT_COLORS[pin.status] ?? RESULT_COLORS[PENDING]
  return pin.status === CLOSED_STATUS ? DONE_COLOR : issueColor(sets, pin.issue)
}

/**
 * What a validation walk is checking at each spot. Free text, because a rollout
 * is usually one or two specific things ("New allergen sticker") repeated across
 * many spots; these only seed the suggestions.
 */
const VALIDATION_ITEMS: Record<'rollout' | 'placement', string[]> = {
  rollout: [
    'New equipment', 'Station setup', 'Menu board', 'Signage', 'POS / tech',
    'Smallwares', 'Recipe card', 'Uniform',
  ],
  placement: [
    'Allergen sticker', 'Promo sticker', 'Price label', 'Table tent', 'Menu board',
    'Product display', 'Safety sign', 'Hand-wash sign',
  ],
}

export function validationItemsFor(subject: SubjectId): string[] {
  return subject === 'rollout' || subject === 'placement' ? VALIDATION_ITEMS[subject] : []
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
  rollout: [
    'Front counter', 'Host stand', 'Bar', 'Expo', 'Cook line', 'Dish area',
    'Walk-in cooler', 'Prep area', 'To-Go', 'Dining room', 'Patio', 'Restrooms', 'Office',
  ],
  placement: [
    'Entry doors', 'Host stand', 'Front counter', 'Register', 'Bar', 'Booths',
    'Dining room', 'Patio', 'Expo', 'To-Go', 'Restrooms', 'Hand sink', 'Walk-in cooler',
  ],
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
  // Validation walks do not use problem families; the item is typed per spot.
  rollout: [],
  placement: [],
}

export const TEMPLATE_NAMES: Record<TemplateId, string> = {
  'repair-request': 'Repair request',
  'scope-bid': 'Scope & bid worksheet',
  'condition-report': 'Condition report',
  insurance: 'Condition report — insurance',
  record: 'Site record',
  'rollout-validation': 'Rollout validation',
  'placement-validation': 'Placement validation',
}

const REPAIR_TEMPLATES: TemplateId[] = [
  'repair-request', 'scope-bid', 'condition-report', 'insurance', 'record',
]

/** The templates that make sense for this kind of walk. */
export function templatesFor(subject: SubjectId): TemplateId[] {
  if (subject === 'rollout') return ['rollout-validation']
  if (subject === 'placement') return ['placement-validation']
  return REPAIR_TEMPLATES
}

/** Templates that print blank quantity and price columns. */
export const TEMPLATES_WITH_PRICING: TemplateId[] = ['scope-bid', 'repair-request']
