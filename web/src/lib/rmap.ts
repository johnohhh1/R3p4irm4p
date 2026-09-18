/**
 * The .rmap project file: a zip of project.json plus every blob the project
 * owns. Work moves between machines and can be emailed, which is the Phase 1
 * answer to "never lose someone's walk" when a browser profile goes away.
 */
import type { Project } from './types'
import type { ProjectStore } from './store'
import { collectBlobIds } from './localStore'
import { unzip, zip, type ZipEntry } from './zip'
import { copy } from './copy'
import { nowIso, uid } from './util'

const MANIFEST = 'project.json'
const BLOB_DIR = 'blobs/'

export async function exportProject(project: Project, store: ProjectStore): Promise<Blob> {
  const entries: ZipEntry[] = [
    { name: MANIFEST, data: new TextEncoder().encode(JSON.stringify(project, null, 2)) },
  ]
  for (const blobId of collectBlobIds(project)) {
    const blob = await store.getBlob(blobId)
    if (!blob) continue
    entries.push({ name: BLOB_DIR + blobId, data: new Uint8Array(await blob.arrayBuffer()) })
  }
  return zip(entries)
}

export interface ImportedProject {
  project: Project
  blobs: Map<string, Blob>
}

/**
 * Read a .rmap back. Ids are rewritten so importing a file twice gives two
 * separate sites rather than silently overwriting the first.
 */
export async function importProject(file: Blob): Promise<ImportedProject> {
  let files: Map<string, Uint8Array>
  try {
    files = await unzip(file)
  } catch {
    throw new Error(copy.errors.importFailed)
  }

  const manifest = files.get(MANIFEST)
  if (!manifest) throw new Error(copy.errors.importFailed)

  let parsed: Project
  try {
    parsed = JSON.parse(new TextDecoder().decode(manifest)) as Project
  } catch {
    throw new Error(copy.errors.importFailed)
  }
  if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.pins)) {
    throw new Error(copy.errors.importFailed)
  }

  // Remap every blob id, so the import cannot collide with existing blobs.
  const remap = new Map<string, string>()
  const blobs = new Map<string, Blob>()
  const rename = (oldId: string, type: string): string => {
    const existing = remap.get(oldId)
    if (existing) return existing
    const bytes = files.get(BLOB_DIR + oldId)
    const fresh = uid('b')
    remap.set(oldId, fresh)
    if (bytes) blobs.set(fresh, new Blob([bytes as unknown as BlobPart], { type }))
    return fresh
  }

  const project: Project = {
    ...parsed,
    id: uid('proj'),
    updatedAt: nowIso(),
    plan: parsed.plan ? { ...parsed.plan, blobId: rename(parsed.plan.blobId, 'image/png') } : null,
    photos: parsed.photos.map((photo) => ({
      ...photo,
      blobId: rename(photo.blobId, 'image/jpeg'),
      thumbId: rename(photo.thumbId, 'image/jpeg'),
    })),
    report: {
      ...parsed.report,
      logoBlobId: parsed.report.logoBlobId ? rename(parsed.report.logoBlobId, 'image/png') : null,
    },
  }

  return { project, blobs }
}
