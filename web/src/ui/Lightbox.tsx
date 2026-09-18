import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../lib/state'
import { copy } from '../lib/copy'
import { formatWhen } from '../lib/util'
import { BlobImg, ConfirmButton } from './bits'
import { photoLabel } from '../lib/labels'

/** Full-size view of one photo, with the arrow keys walking the set. */
export function Lightbox({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const project = useApp((s) => s.project)
  const deletePhoto = useApp((s) => s.deletePhoto)
  const needUrl = useApp((s) => s.needUrl)

  const ids = useMemo(() => project?.order.filter((id) => project.photos.some((p) => p.id === id)) ?? [], [project])
  const [index, setIndex] = useState(() => Math.max(0, ids.indexOf(photoId)))

  const currentId = ids[index]
  const photo = project?.photos.find((p) => p.id === currentId)

  useEffect(() => {
    if (photo) needUrl(photo.blobId)
  }, [photo, needUrl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(ids.length - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ids.length, onClose])

  useEffect(() => {
    if (!ids.length) onClose()
  }, [ids.length, onClose])

  if (!photo) return null

  const pin = project?.pins.find((p) => p.photoIds.includes(photo.id))

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.name}>
      <div className="lbimg">
        <BlobImg blobId={photo.blobId} alt={photo.name} />
      </div>
      <div className="lbbar">
        <button type="button" className="btn" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
          ‹ Prev
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setIndex(Math.min(ids.length - 1, index + 1))}
          disabled={index >= ids.length - 1}
        >
          Next ›
        </button>
        <span className="cap">
          {pin ? `${photoLabel(pin, photo.id)} · ${copy.pins.spotNo(pin.no)}` : photo.name}
          {photo.takenAt ? ` · ${formatWhen(photo.takenAt)}` : ''}
        </span>
        <ConfirmButton
          label="Delete photo"
          confirmLabel="Delete it"
          className="btn danger"
          onConfirm={() => {
            const next = Math.min(index, ids.length - 2)
            void deletePhoto(photo.id)
            setIndex(Math.max(0, next))
          }}
        />
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
