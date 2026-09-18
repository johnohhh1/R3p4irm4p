import { memo, useMemo, useState } from 'react'
import { unplacedIds, useApp } from '../lib/state'
import { beginPhotoDrag } from '../lib/drag'
import { groupKey } from '../lib/images'
import { copy } from '../lib/copy'
import { BlobImg, useFilePicker } from './bits'
import type { Photo } from '../lib/types'

export function PhotoTray({ onZoom }: { onZoom: (photoId: string) => void }) {
  const project = useApp((s) => s.project)
  const armed = useApp((s) => s.armed)
  const arm = useApp((s) => s.arm)
  const addPhotos = useApp((s) => s.addPhotos)
  const importing = useApp((s) => s.importing)
  const keepGps = useApp((s) => s.project?.keepGps ?? false)
  const setKeepGps = useApp((s) => s.setKeepGps)

  const [over, setOver] = useState(false)
  const picker = useFilePicker((files) => void addPhotos(files), 'image/*', true)

  const unplaced = project ? unplacedIds(project) : []
  /**
   * Dragging a pin changes `project` on every pointermove. Grouping 200 photos
   * again each time is wasted work, so the groups are memoised on which photos
   * are unplaced rather than on the project itself.
   */
  const signature = unplaced.join(',')
  const photos = project?.photos
  const groups = useMemo(() => {
    const byId = new Map((photos ?? []).map((p) => [p.id, p]))
    const map = new Map<string, Photo[]>()
    for (const id of signature ? signature.split(',') : []) {
      const photo = byId.get(id)
      if (!photo) continue
      const key = groupKey(photo.name)
      const list = map.get(key) ?? []
      list.push(photo)
      map.set(key, list)
    }
    return [...map.entries()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, photos])

  if (!project) return null

  const armedIds = armed?.kind === 'photos' ? armed.ids : []

  /**
   * Tapping a photo adds it to the selection rather than replacing it, so photos
   * the filename grouping split apart ("under combi", "undercomb2") can still be
   * gathered and placed as one spot. Tap again to drop one from the selection.
   */
  const toggle = (photoId: string) => {
    const next = armedIds.includes(photoId)
      ? armedIds.filter((id) => id !== photoId)
      : [...armedIds, photoId]
    arm(next.length ? { kind: 'photos', ids: next } : null)
  }

  return (
    <div
      className={over ? 'pane drop-back' : 'pane'}
      data-tray
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const files = Array.from(e.dataTransfer.files ?? [])
        if (files.length) void addPhotos(files)
      }}
    >
      <button type="button" className="drop" onClick={picker.open}>
        <strong>{copy.photos.drop}</strong>
        <span>{copy.photos.dropHelp}</span>
      </button>
      {picker.input}

      {importing && (
        <div className="progress" aria-label={copy.photos.importing(importing.done, importing.total)}>
          <i style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }} />
        </div>
      )}
      {importing && (
        <p className="meta" style={{ marginTop: 6 }}>
          {copy.photos.importing(importing.done, importing.total)}
        </p>
      )}

      {!project.photos.length && !importing && <div className="empty">{copy.photos.empty}</div>}
      {!!project.photos.length && !unplaced.length && !importing && (
        <div className="empty">{copy.photos.allPlaced}</div>
      )}

      {groups.map(([key, photos]) => (
        <div className="group" key={key}>
          <div className="ghead">
            <h3>
              {key}
              <small>{copy.photos.group(photos.length)}</small>
            </h3>
            <button
              type="button"
              className="btn small"
              onPointerDown={(e) => {
                e.preventDefault()
                beginPhotoDrag(
                  photos.map((p) => p.id),
                  photos[0].thumbId,
                  e.nativeEvent,
                )
              }}
              onClick={() => arm({ kind: 'photos', ids: photos.map((p) => p.id) })}
            >
              {copy.photos.placeAll}
            </button>
          </div>
          <div className="thumbs">
            {photos.map((photo) => (
              <Thumb
                key={photo.id}
                photo={photo}
                armed={armedIds.includes(photo.id)}
                onToggle={toggle}
                onZoom={onZoom}
              />
            ))}
          </div>
        </div>
      ))}

      <label className="meta" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 18 }}>
        <input type="checkbox" checked={keepGps} onChange={(e) => setKeepGps(e.target.checked)} />
        <span>
          {copy.photos.keepLocation}
          <br />
          {copy.photos.keepLocationHelp}
        </span>
      </label>
    </div>
  )
}

/**
 * Memoised so a pin drag does not reconcile 200 thumbnails. Immer keeps photo
 * objects identical when only pins change, which is what makes this hold.
 */
const Thumb = memo(function Thumb({
  photo,
  armed,
  onToggle,
  onZoom,
}: {
  photo: Photo
  armed: boolean
  onToggle: (photoId: string) => void
  onZoom: (photoId: string) => void
}) {
  return (
    <button
      type="button"
      className={armed ? 'thumb armed' : 'thumb'}
      title={photo.name}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('.zoomit')) return
        e.preventDefault()
        beginPhotoDrag([photo.id], photo.thumbId, e.nativeEvent)
      }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.zoomit')) return
        onToggle(photo.id)
      }}
    >
      <BlobImg blobId={photo.thumbId} alt={photo.name} />
      <span className="nm">{photo.name}</span>
      <span
        className="zoomit"
        role="button"
        tabIndex={-1}
        aria-label={`Open ${photo.name}`}
        onClick={(e) => {
          e.stopPropagation()
          onZoom(photo.id)
        }}
      >
        ⤢
      </span>
    </button>
  )
})
