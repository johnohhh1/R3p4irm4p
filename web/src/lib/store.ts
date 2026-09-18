/**
 * The storage seam. The UI only ever talks to a ProjectStore, so Phase 2 can
 * drop in a cloud implementation without touching a component. PRD §6.
 */
import type { Project, ProjectSummary } from './types'

export interface ProjectStore {
  list(): Promise<ProjectSummary[]>
  get(id: string): Promise<Project | null>
  put(project: Project): Promise<void>
  remove(id: string): Promise<void>

  /** Blobs are stored apart from the document so a project loads without its photos. */
  putBlob(id: string, blob: Blob): Promise<void>
  getBlob(id: string): Promise<Blob | null>
  removeBlobs(ids: string[]): Promise<void>

  /** Rough bytes used and available, when the browser will say. */
  usage(): Promise<{ used: number; quota: number } | null>
}

/** Thrown when the browser refuses a write because storage is full. */
export class StorageFullError extends Error {
  constructor() {
    super('storage full')
    this.name = 'StorageFullError'
  }
}

export function isQuotaError(err: unknown): boolean {
  if (err instanceof StorageFullError) return true
  const e = err as { name?: string; code?: number } | null
  return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
}
