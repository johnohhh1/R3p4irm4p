/**
 * Application state. One store, autosaved to a ProjectStore on every change.
 * "Never lose someone's walk" is a principle, not a nicety — every mutation
 * goes through `touch`, which schedules the save and flips the saved indicator.
 */
import { create } from 'zustand'
import { produce } from 'immer'
import type {
  IssueSetId,
  Photo,
  Pin,
  Project,
  ProjectSummary,
  ReportSettings,
  SubjectId,
  TemplateId,
} from './types'
import { localStore } from './localStore'
import { isQuotaError, type ProjectStore } from './store'
import { blobUrl, releaseAll, releaseUrl } from './blobUrls'
import { copy } from './copy'
import { isValidation, issuesFor, statusesFor, SUBJECT_ISSUE_SETS, templatesFor } from './catalog'
import { clamp, nowIso, todayIso, uid } from './util'
import { loadPlan, type LoadedPlan } from './plan'
import { isImageFile, preparePhoto } from './images'

export type SaveState = 'saved' | 'saving' | 'failed'
export type Route = { name: 'projects' } | { name: 'project'; id: string }

/** What the tray is carrying, for tap-then-tap on a phone and click-to-place. */
export type Armed =
  | { kind: 'photos'; ids: string[] }
  | { kind: 'pin' }
  | null

export interface ImportProgress {
  done: number
  total: number
}

interface AppState {
  store: ProjectStore
  route: Route
  projects: ProjectSummary[]
  project: Project | null
  saveState: SaveState
  storageFull: boolean

  selectedPinId: string | null
  armed: Armed
  sidebar: 'tray' | 'list'
  listFilter: string
  importing: ImportProgress | null
  toast: string | null
  error: string | null

  /** blobId -> object URL, mirrored from the cache so React re-renders. */
  urls: Record<string, string>

  init(): Promise<void>
  goProjects(): void
  openProject(id: string): Promise<void>

  createProject(name?: string): Promise<string>
  renameProject(id: string, name: string): Promise<void>
  deleteProject(id: string): Promise<void>
  /** A fresh walk of the same site layout: plan and spots kept, results and photos cleared. */
  duplicateProject(id: string): Promise<void>

  finishOnboarding(subject: SubjectId, sets: IssueSetId[], template: TemplateId): void
  setIssueSets(sets: IssueSetId[]): void
  setTemplate(template: TemplateId): void
  setReport(patch: Partial<ReportSettings>): void
  setKeepGps(keep: boolean): void

  setPlan(file: File): Promise<void>
  addPhotos(files: File[]): Promise<void>
  addPhotosToPin(pinId: string, files: File[]): Promise<void>

  addPin(x: number, y: number, photoIds: string[]): string
  movePin(id: string, x: number, y: number): void
  nudgePin(id: string, dx: number, dy: number): void
  updatePin(id: string, patch: Partial<Pin>): void
  deletePin(id: string): void
  attachPhotos(pinId: string, photoIds: string[]): void
  detachPhoto(pinId: string, photoId: string): void
  deletePhoto(photoId: string): Promise<void>

  select(id: string | null): void
  arm(armed: Armed): void
  setSidebar(tab: 'tray' | 'list'): void
  setListFilter(filter: string): void
  needUrl(blobId: string | null | undefined): void
  say(message: string | null): void
  fail(message: string | null): void

  replaceProject(project: Project, blobs: Map<string, Blob>): Promise<void>
}

function blankReport(): ReportSettings {
  return {
    site: '',
    preparedBy: '',
    date: todayIso(),
    logoBlobId: null,
    accent: '#22235B',
    surface: '',
    findings: '',
    link: '',
  }
}

function blankProject(name: string): Project {
  const subject: SubjectId = 'restaurant'
  return {
    id: uid('proj'),
    name,
    template: 'repair-request',
    subject,
    issueSet: SUBJECT_ISSUE_SETS[subject],
    plan: null,
    pins: [],
    photos: [],
    order: [],
    nextNo: 1,
    report: blankReport(),
    onboarded: false,
    keepGps: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    schemaVersion: 1,
  }
}

/** Fields added after a project was written get their defaults here. */
function migrate(p: Project): Project {
  return {
    ...p,
    keepGps: p.keepGps ?? false,
    order: p.order ?? p.photos.map((ph) => ph.id),
    report: { ...blankReport(), ...p.report },
  }
}

let saveTimer: number | undefined
let savingNow = false
let saveAgain = false

export const useApp = create<AppState>((set, get) => {
  /** Mutate the open project, mark it dirty and schedule the save. */
  function touch(recipe: (draft: Project) => void) {
    const current = get().project
    if (!current) return
    const next = produce(current, (draft) => {
      recipe(draft)
      draft.updatedAt = nowIso()
    })
    if (next === current) return
    set({ project: next, saveState: 'saving' })
    scheduleSave()
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(flush, 300)
  }

  async function flush() {
    if (savingNow) {
      saveAgain = true
      return
    }
    const { project, store } = get()
    if (!project) return
    savingNow = true
    try {
      await store.put(project)
      set((s) => ({
        saveState: 'saved',
        projects: s.projects.map((p) =>
          p.id === project.id
            ? {
                ...p,
                name: project.name,
                site: project.report.site,
                template: project.template,
                subject: project.subject,
                pinCount: project.pins.length,
                photoCount: project.photos.length,
                hasPlan: !!project.plan,
                updatedAt: project.updatedAt,
              }
            : p,
        ),
      }))
    } catch (err) {
      set({ saveState: 'failed', storageFull: isQuotaError(err), error: isQuotaError(err) ? copy.errors.storageFull : copy.save.failed })
    } finally {
      savingNow = false
      if (saveAgain) {
        saveAgain = false
        void flush()
      }
    }
  }

  async function primeUrl(blobId: string) {
    if (get().urls[blobId]) return
    const url = await blobUrl(get().store, blobId)
    if (url) set((s) => ({ urls: { ...s.urls, [blobId]: url } }))
  }

  return {
    store: localStore,
    route: { name: 'projects' },
    projects: [],
    project: null,
    saveState: 'saved',
    storageFull: false,
    selectedPinId: null,
    armed: null,
    sidebar: 'tray',
    listFilter: 'all',
    importing: null,
    toast: null,
    error: null,
    urls: {},

    async init() {
      const projects = await get().store.list()
      set({ projects })
      // Reopening after a closed tab lands back in the walk, not on the site list.
      const last = readLastOpened()
      if (last && projects.some((p) => p.id === last)) await get().openProject(last)
    },

    goProjects() {
      window.clearTimeout(saveTimer)
      void flush()
      releaseAll()
      writeLastOpened(null)
      set({ route: { name: 'projects' }, project: null, selectedPinId: null, armed: null, urls: {} })
    },

    async openProject(id) {
      const loaded = await get().store.get(id)
      if (!loaded) {
        set({ error: copy.errors.loadFailed })
        return
      }
      releaseAll()
      writeLastOpened(id)
      const project = migrate(loaded)
      set({
        route: { name: 'project', id },
        project,
        urls: {},
        selectedPinId: null,
        armed: null,
        sidebar: project.pins.length && !unplacedIds(project).length ? 'list' : 'tray',
        listFilter: 'all',
        saveState: 'saved',
      })
      if (project.plan) void primeUrl(project.plan.blobId)
      for (const photo of project.photos) void primeUrl(photo.thumbId)
    },

    async createProject(name) {
      const project = blankProject(name?.trim() || copy.projects.nameDefault)
      await get().store.put(project)
      releaseAll()
      writeLastOpened(project.id)
      set((s) => ({
        projects: [
          {
            id: project.id,
            name: project.name,
            site: '',
            template: project.template,
            subject: project.subject,
            pinCount: 0,
            photoCount: 0,
            hasPlan: false,
            updatedAt: project.updatedAt,
          },
          ...s.projects,
        ],
        project,
        urls: {},
        route: { name: 'project', id: project.id },
        selectedPinId: null,
        armed: null,
        sidebar: 'tray',
        saveState: 'saved',
      }))
      return project.id
    },

    async renameProject(id, name) {
      const trimmed = name.trim() || copy.projects.nameDefault
      if (get().project?.id === id) {
        touch((d) => {
          d.name = trimmed
        })
        return
      }
      const project = await get().store.get(id)
      if (!project) return
      project.name = trimmed
      project.updatedAt = nowIso()
      await get().store.put(project)
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)) }))
    },

    async deleteProject(id) {
      await get().store.remove(id)
      if (get().project?.id === id) {
        releaseAll()
        writeLastOpened(null)
        set({ project: null, route: { name: 'projects' }, urls: {} })
      }
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }))
    },

    async duplicateProject(id) {
      const store = get().store
      const source = get().project?.id === id ? get().project : await store.get(id)
      if (!source) return
      const plan = source.plan
      let planBlobId: string | null = null
      if (plan) {
        // Each site owns its blobs outright, so deleting one never breaks the other.
        const blob = await store.getBlob(plan.blobId)
        if (blob) {
          planBlobId = uid('plan')
          await store.putBlob(planBlobId, blob)
        }
      }
      const statuses = statusesFor(source.subject)
      const now = nowIso()
      const copyOf: Project = {
        ...source,
        id: uid('proj'),
        name: copy.validation.copyName(source.name),
        plan: plan && planBlobId ? { ...plan, blobId: planBlobId } : null,
        pins: source.pins.map((pin) => ({
          ...pin,
          status: statuses[0]?.id ?? pin.status,
          note: '',
          photoIds: [],
          createdAt: now,
          updatedAt: now,
        })),
        photos: [],
        order: [],
        report: { ...source.report, date: todayIso(), findings: '', logoBlobId: null },
        createdAt: now,
        updatedAt: now,
      }
      await store.put(copyOf)
      set({ projects: await store.list(), toast: copy.validation.duplicated(copyOf.name) })
    },

    finishOnboarding(subject, sets, template) {
      const validation = isValidation(subject)
      touch((d) => {
        d.subject = subject
        d.issueSet = sets.length ? sets : SUBJECT_ISSUE_SETS[subject]
        // A validation walk has exactly one report shape, so the answer is implied.
        d.template = validation ? templatesFor(subject)[0] : template
        d.onboarded = true
        // Re-home any pin whose issue or status is no longer offered. A validation
        // item is free text ("New allergen sticker"), so it is left alone.
        const issues = issuesFor(d.issueSet).map((i) => i.id)
        const statuses = statusesFor(d.subject).map((s) => s.id)
        for (const pin of d.pins) {
          if (!validation && !issues.includes(pin.issue)) pin.issue = issues[0] ?? 'other'
          if (!statuses.includes(pin.status)) pin.status = statuses[0] ?? 'open'
        }
      })
    },

    setIssueSets(sets) {
      touch((d) => {
        d.issueSet = sets
        const issues = issuesFor(sets).map((i) => i.id)
        for (const pin of d.pins) if (!issues.includes(pin.issue)) pin.issue = 'other'
      })
    },

    setTemplate(template) {
      touch((d) => {
        d.template = template
      })
    },

    setReport(patch) {
      touch((d) => {
        Object.assign(d.report, patch)
        // The tester named the site in the report dialog and the workspace and
        // .rmap file stayed "Untitled site". An untitled project takes the name.
        if (patch.site?.trim() && d.name === copy.projects.nameDefault) d.name = patch.site.trim()
      })
    },

    setKeepGps(keep) {
      touch((d) => {
        d.keepGps = keep
      })
    },

    async setPlan(file) {
      let loaded: LoadedPlan
      try {
        loaded = await loadPlan(file)
      } catch (err) {
        set({ error: err instanceof Error ? err.message : copy.errors.badImage })
        return
      }
      const project = get().project
      if (!project) return
      const replacing = project.plan
      const blobId = uid('plan')
      try {
        await get().store.putBlob(blobId, loaded.blob)
      } catch (err) {
        set({ error: isQuotaError(err) ? copy.errors.storageFull : copy.errors.badImage, storageFull: isQuotaError(err) })
        return
      }
      if (replacing) {
        releaseUrl(replacing.blobId)
        void get().store.removeBlobs([replacing.blobId])
      }
      touch((d) => {
        d.plan = { blobId, w: loaded.w, h: loaded.h, source: loaded.source, name: loaded.name }
      })
      set((s) => {
        const next = { ...s.urls }
        if (replacing) delete next[replacing.blobId]
        return { urls: next, toast: replacing ? copy.toasts.planReplaced : null }
      })
      void primeUrl(blobId)
    },

    async addPhotos(files) {
      const usable = files.filter(isImageFile)
      const skipped = files.filter((f) => !isImageFile(f))
      if (skipped.length) set({ error: copy.errors.unsupported(skipped[0].name) })
      if (!usable.length) return

      const keepGps = get().project?.keepGps ?? false
      set({ importing: { done: 0, total: usable.length } })

      let added = 0
      for (const file of usable) {
        try {
          const prepared = await preparePhoto(file, keepGps)
          await get().store.putBlob(prepared.blobId, prepared.full)
          await get().store.putBlob(prepared.thumbId, prepared.thumb)
          const photo: Photo = {
            id: prepared.id,
            blobId: prepared.blobId,
            thumbId: prepared.thumbId,
            name: prepared.name,
            takenAt: prepared.takenAt,
            gps: prepared.gps,
            w: prepared.w,
            h: prepared.h,
            bytes: prepared.bytes,
          }
          touch((d) => {
            d.photos.push(photo)
            d.order.push(photo.id)
          })
          void primeUrl(photo.thumbId)
          added += 1
        } catch (err) {
          if (isQuotaError(err)) {
            set({ error: copy.errors.storageFull, storageFull: true, importing: null })
            return
          }
        }
        set({ importing: { done: added, total: usable.length } })
      }

      set({ importing: null, sidebar: 'tray' })
    },

    /**
     * Pin-first capture: tap the plan, name the area, then take or pick photos
     * and they land on that pin directly, never passing through the tray.
     */
    async addPhotosToPin(pinId, files) {
      const usable = files.filter(isImageFile)
      if (!usable.length) return
      const keepGps = get().project?.keepGps ?? false
      set({ importing: { done: 0, total: usable.length } })
      let added = 0
      for (const file of usable) {
        try {
          const prepared = await preparePhoto(file, keepGps)
          await get().store.putBlob(prepared.blobId, prepared.full)
          await get().store.putBlob(prepared.thumbId, prepared.thumb)
          const photo: Photo = {
            id: prepared.id,
            blobId: prepared.blobId,
            thumbId: prepared.thumbId,
            name: prepared.name,
            takenAt: prepared.takenAt,
            gps: prepared.gps,
            w: prepared.w,
            h: prepared.h,
            bytes: prepared.bytes,
          }
          touch((d) => {
            const pin = d.pins.find((p) => p.id === pinId)
            if (!pin) return
            d.photos.push(photo)
            d.order.push(photo.id)
            pin.photoIds.push(photo.id)
            pin.updatedAt = nowIso()
          })
          void primeUrl(photo.thumbId)
          added += 1
        } catch (err) {
          if (isQuotaError(err)) {
            set({ error: copy.errors.storageFull, storageFull: true, importing: null })
            return
          }
        }
        set({ importing: { done: added, total: usable.length } })
      }
      set({ importing: null, toast: added ? copy.toasts.pinned(added) : null })
    },

    addPin(x, y, photoIds) {
      const project = get().project
      if (!project) return ''
      const issues = issuesFor(project.issueSet)
      const statuses = statusesFor(project.subject)
      const first = photoIds[0] ? project.photos.find((p) => p.id === photoIds[0]) : undefined
      const id = uid('k')
      // A rollout is usually one thing checked at many spots, so a new spot starts
      // with whatever the last spot was checking. Setting up 40 stickers is 40 taps.
      const lastItem = isValidation(project.subject)
        ? ([...project.pins].reverse().find((p) => p.issue.trim())?.issue ?? '')
        : null
      touch((d) => {
        const pin: Pin = {
          id,
          no: d.nextNo,
          x: clamp(x, 0, 1),
          y: clamp(y, 0, 1),
          // A new pin borrows its name from the photo that made it, as the prototype does.
          area: first ? titleCase(first.name.replace(/[_-]?\d+$/, '').replace(/[_-]+/g, ' ')) : '',
          issue: lastItem ?? issues[0]?.id ?? 'other',
          status: statuses[0]?.id ?? 'open',
          note: '',
          photoIds: [...photoIds],
          createdAt: nowIso(),
          updatedAt: nowIso(),
        }
        d.nextNo += 1
        d.pins.push(pin)
      })
      set({ selectedPinId: id, armed: null })
      if (photoIds.length) set({ toast: copy.toasts.pinned(photoIds.length) })
      return id
    },

    movePin(id, x, y) {
      touch((d) => {
        const pin = d.pins.find((p) => p.id === id)
        if (!pin) return
        pin.x = clamp(x, 0, 1)
        pin.y = clamp(y, 0, 1)
        pin.updatedAt = nowIso()
      })
    },

    nudgePin(id, dx, dy) {
      touch((d) => {
        const pin = d.pins.find((p) => p.id === id)
        if (!pin) return
        pin.x = clamp(pin.x + dx, 0, 1)
        pin.y = clamp(pin.y + dy, 0, 1)
        pin.updatedAt = nowIso()
      })
    },

    updatePin(id, patch) {
      touch((d) => {
        const pin = d.pins.find((p) => p.id === id)
        if (!pin) return
        Object.assign(pin, patch)
        pin.updatedAt = nowIso()
      })
    },

    deletePin(id) {
      const pin = get().project?.pins.find((p) => p.id === id)
      if (!pin) return
      // Photos return to the tray rather than being deleted. PRD §7.
      touch((d) => {
        d.pins = d.pins.filter((p) => p.id !== id)
      })
      set({ selectedPinId: null, toast: copy.toasts.pinRemoved(pin.no) })
    },

    attachPhotos(pinId, photoIds) {
      touch((d) => {
        const pin = d.pins.find((p) => p.id === pinId)
        if (!pin) return
        for (const photoId of photoIds) {
          // A photo belongs to one pin at a time.
          for (const other of d.pins) {
            if (other.id === pinId) continue
            other.photoIds = other.photoIds.filter((x) => x !== photoId)
          }
          if (!pin.photoIds.includes(photoId)) pin.photoIds.push(photoId)
        }
        pin.updatedAt = nowIso()
      })
      set({ armed: null, toast: copy.toasts.pinned(photoIds.length) })
    },

    detachPhoto(pinId, photoId) {
      touch((d) => {
        const pin = d.pins.find((p) => p.id === pinId)
        if (!pin) return
        pin.photoIds = pin.photoIds.filter((x) => x !== photoId)
        pin.updatedAt = nowIso()
      })
      set({ toast: copy.toasts.unpinned })
    },

    async deletePhoto(photoId) {
      const project = get().project
      const photo = project?.photos.find((p) => p.id === photoId)
      if (!photo) return
      touch((d) => {
        d.photos = d.photos.filter((p) => p.id !== photoId)
        d.order = d.order.filter((id) => id !== photoId)
        for (const pin of d.pins) pin.photoIds = pin.photoIds.filter((id) => id !== photoId)
      })
      releaseUrl(photo.blobId)
      releaseUrl(photo.thumbId)
      set((s) => {
        const urls = { ...s.urls }
        delete urls[photo.blobId]
        delete urls[photo.thumbId]
        return { urls }
      })
      await get().store.removeBlobs([photo.blobId, photo.thumbId])
    },

    select(id) {
      set({ selectedPinId: id, armed: null })
      if (id) {
        const project = get().project
        const pin = project?.pins.find((p) => p.id === id)
        for (const photoId of pin?.photoIds ?? []) {
          const photo = project?.photos.find((p) => p.id === photoId)
          if (photo) void primeUrl(photo.thumbId)
        }
      }
    },

    arm(armed) {
      set({ armed })
    },

    setSidebar(tab) {
      set({ sidebar: tab, selectedPinId: null })
    },

    setListFilter(filter) {
      set({ listFilter: filter })
    },

    needUrl(blobId) {
      if (blobId) void primeUrl(blobId)
    },

    say(message) {
      set({ toast: message })
    },

    fail(message) {
      set({ error: message })
    },

    async replaceProject(project, blobs) {
      const store = get().store
      for (const [id, blob] of blobs) await store.putBlob(id, blob)
      await store.put(project)
      const projects = await store.list()
      set({ projects })
      await get().openProject(project.id)
      set({ toast: copy.toasts.imported(project.name) })
    },
  }
})

const LAST_OPENED_KEY = 'repairmap.lastOpened'

/** Which site was open last. A per-browser convenience; the data lives in IndexedDB. */
function readLastOpened(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY)
  } catch {
    return null
  }
}

function writeLastOpened(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST_OPENED_KEY, id)
    else localStorage.removeItem(LAST_OPENED_KEY)
  } catch {
    // Private windows and blocked site data are fine — the walk is still saved.
  }
}

/** Photos not yet on a pin, in tray order. */
export function unplacedIds(project: Project): string[] {
  const used = new Set<string>()
  for (const pin of project.pins) for (const id of pin.photoIds) used.add(id)
  const known = new Set(project.photos.map((p) => p.id))
  return project.order.filter((id) => known.has(id) && !used.has(id))
}

export function pinOfPhoto(project: Project, photoId: string): Pin | undefined {
  return project.pins.find((p) => p.photoIds.includes(photoId))
}

function titleCase(s: string): string {
  const trimmed = s.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
