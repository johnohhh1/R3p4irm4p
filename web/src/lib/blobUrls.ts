/**
 * Blob URL cache. Photos live in IndexedDB as Blobs (never base64 — PRD §10),
 * so the UI needs a stable object URL per blob id and must revoke them when a
 * project closes, or a long walk leaks hundreds of megabytes.
 */
import type { ProjectStore } from './store'

const urls = new Map<string, string>()
const inflight = new Map<string, Promise<string | null>>()

export function peekUrl(blobId: string): string | undefined {
  return urls.get(blobId)
}

export async function blobUrl(store: ProjectStore, blobId: string): Promise<string | null> {
  const existing = urls.get(blobId)
  if (existing) return existing

  const running = inflight.get(blobId)
  if (running) return running

  const job = (async () => {
    const blob = await store.getBlob(blobId)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    urls.set(blobId, url)
    return url
  })().finally(() => inflight.delete(blobId))

  inflight.set(blobId, job)
  return job
}

export function releaseUrl(blobId: string): void {
  const url = urls.get(blobId)
  if (!url) return
  URL.revokeObjectURL(url)
  urls.delete(blobId)
}

export function releaseAll(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
  inflight.clear()
}
