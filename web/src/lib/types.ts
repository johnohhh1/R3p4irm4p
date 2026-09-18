/** The v1 data model. Mirrors docs/PRD.md §7 — keep them in step. */

export type TemplateId =
  | 'repair-request'
  | 'scope-bid'
  | 'condition-report'
  | 'insurance'
  | 'record'
  | 'rollout-validation'
  | 'placement-validation'

/**
 * Q1 — what is being documented. Seeds issue sets and area suggestions.
 * `rollout` and `placement` are validation jobs: the spots are known before the
 * walk and each one is confirmed, rather than problems being found as you go.
 */
export type SubjectId =
  | 'restaurant'
  | 'property'
  | 'punchlist'
  | 'bid'
  | 'other'
  | 'rollout'
  | 'placement'

/** Q2 — families of problems. Each contributes issues to the pin panel. */
export type IssueSetId =
  | 'floors'
  | 'plumbing'
  | 'walls'
  | 'equipment'
  | 'safety'
  | 'damage'
  | 'finish'

export interface Plan {
  blobId: string
  w: number
  h: number
  /** 'image' or 'pdf:pageN' — shown to the user when a plan is replaced. */
  source: string
  name: string
}

export interface Pin {
  id: string
  /** Assigned once, never reused, never renumbered. */
  no: number
  /** Position as a fraction of the plan, 0–1. */
  x: number
  y: number
  area: string
  issue: string
  status: string
  note: string
  photoIds: string[]
  createdAt: string
  updatedAt: string
}

export interface Photo {
  id: string
  blobId: string
  thumbId: string
  name: string
  takenAt: string | null
  /** Only present when the user opted in to keeping location data. */
  gps: { lat: number; lon: number } | null
  w: number
  h: number
  bytes: number
}

export interface ReportSettings {
  site: string
  preparedBy: string
  date: string
  logoBlobId: string | null
  accent: string
  /** Free text describing what was walked, e.g. "kitchen and service floor". */
  surface: string
  /** The reader's voice: what was actually found. Printed on the sign-off page. */
  findings: string
  /** An optional live-map link printed on the cover. */
  link: string
}

export interface Project {
  id: string
  name: string
  template: TemplateId
  subject: SubjectId
  issueSet: IssueSetId[]
  plan: Plan | null
  pins: Pin[]
  photos: Photo[]
  /** Tray order — the order photos were added. */
  order: string[]
  nextNo: number
  report: ReportSettings
  onboarded: boolean
  /** Off by default — location data travels with a photo if the file is shared. */
  keepGps: boolean
  createdAt: string
  updatedAt: string
  schemaVersion: 1
}

/** What the project list needs without loading pins, photos or blobs. */
export interface ProjectSummary {
  id: string
  name: string
  site: string
  template: TemplateId
  subject: SubjectId
  pinCount: number
  photoCount: number
  hasPlan: boolean
  updatedAt: string
}
