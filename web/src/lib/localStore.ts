/** IndexedDB implementation of ProjectStore. Phase 1 has no server. */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Project, ProjectSummary } from './types'
import { isQuotaError, StorageFullError, type ProjectStore } from './store'

interface RepairMapDB extends DBSchema {
  projects: { key: string; value: Project }
  blobs: { key: string; value: Blob }
}

const DB_NAME = 'repairmap-ui-lab'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<RepairMapDB>> | null = null

function db(): Promise<IDBPDatabase<RepairMapDB>> {
  if (!dbPromise) {
    dbPromise = openDB<RepairMapDB>(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs')
      },
    })
  }
  return dbPromise
}

export function summarize(p: Project): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    site: p.report.site,
    template: p.template,
    subject: p.subject,
    pinCount: p.pins.length,
    photoCount: p.photos.length,
    hasPlan: !!p.plan,
    updatedAt: p.updatedAt,
  }
}

async function guard<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (isQuotaError(err)) throw new StorageFullError()
    throw err
  }
}

export const localStore: ProjectStore = {
  async list() {
    const all = await (await db()).getAll('projects')
    return all
      .map(summarize)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  },

  async get(id) {
    return (await (await db()).get('projects', id)) ?? null
  },

  async put(project) {
    await guard(async () => {
      await (await db()).put('projects', project)
    })
  },

  async remove(id) {
    const d = await db()
    const project = await d.get('projects', id)
    if (project) {
      const blobIds = collectBlobIds(project)
      if (blobIds.length) await this.removeBlobs(blobIds)
    }
    await d.delete('projects', id)
  },

  async putBlob(id, blob) {
    await guard(async () => {
      await (await db()).put('blobs', blob, id)
    })
  },

  async getBlob(id) {
    return (await (await db()).get('blobs', id)) ?? null
  },

  async removeBlobs(ids) {
    const d = await db()
    const tx = d.transaction('blobs', 'readwrite')
    await Promise.all(ids.map((id) => tx.store.delete(id)))
    await tx.done
  },

  async usage() {
    if (!navigator.storage?.estimate) return null
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate()
      return { used: usage, quota }
    } catch {
      return null
    }
  },
}

/** Every blob a project owns — used when deleting it, so nothing is orphaned. */
export function collectBlobIds(p: Project): string[] {
  const ids: string[] = []
  if (p.plan) ids.push(p.plan.blobId)
  if (p.report.logoBlobId) ids.push(p.report.logoBlobId)
  for (const photo of p.photos) {
    ids.push(photo.blobId, photo.thumbId)
  }
  return ids
}
