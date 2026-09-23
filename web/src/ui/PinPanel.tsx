import { useMemo } from 'react'
import { useApp } from '../lib/state'
import { beginPhotoDrag } from '../lib/drag'
import {
  areasFor,
  isValidation,
  issuesFor,
  pinColor,
  RESULT_COLORS,
  statusesFor,
  validationItemsFor,
} from '../lib/catalog'
import { copy } from '../lib/copy'
import { labCopy as c } from '../lib/labCopy'
import { walkOrder } from '../lib/util'
import { formatWhen } from '../lib/util'
import { BlobImg, ConfirmButton, useFilePicker } from './bits'
import { photoLabel } from '../lib/labels'

export function PinPanel({ pinId, onZoom }: { pinId: string; onZoom: (photoId: string) => void }) {
  const project = useApp((s) => s.project)
  const updatePin = useApp((s) => s.updatePin)
  const deletePin = useApp((s) => s.deletePin)
  const detachPhoto = useApp((s) => s.detachPhoto)
  const select = useApp((s) => s.select)
  const addPhotosToPin = useApp((s) => s.addPhotosToPin)
  const importing = useApp((s) => s.importing)

  // "Take photo" opens the camera on a phone; a laptop falls back to a file picker.
  const camera = useFilePicker((files) => void addPhotosToPin(pinId, files), 'image/*', false, 'environment')
  const gallery = useFilePicker((files) => void addPhotosToPin(pinId, files), 'image/*', true)

  const pin = project?.pins.find((p) => p.id === pinId) ?? null
  const photos = useMemo(
    () =>
      (pin?.photoIds ?? [])
        .map((id) => project?.photos.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p),
    [pin, project],
  )

  if (!project || !pin) return null

  const issues = issuesFor(project.issueSet)
  const statuses = statusesFor(project.subject)
  const areaSuggestions = areasFor(project.subject)
  const listId = `areas-${project.subject}`
  const validation = isValidation(project.subject)
  // Items already used on this site come first, so the same sticker is one tap away.
  const itemSuggestions = [
    ...new Set([
      ...project.pins.map((p) => p.issue.trim()).filter(Boolean),
      ...validationItemsFor(project.subject),
    ]),
  ]

  const ordered = walkOrder(project.pins)
  const index = ordered.findIndex(p => p.id === pinId)

  return (
    <div className="pane detail-pane" key={pinId}>
      <nav className="spot-navigation" aria-label="Move between spots">
        <button className="btn small" disabled={index <= 0} onClick={() => select(ordered[index - 1].id)} aria-label={c.previous}>‹</button>
        <span>Spot {index + 1} of {ordered.length} in walking order</span>
        <button className="btn small" disabled={index >= ordered.length - 1} onClick={() => select(ordered[index + 1].id)} aria-label={c.next}>›</button>
      </nav>
      <div className="dhead">
        <span
          className="badge"
          style={{ background: pinColor(project.subject, project.issueSet, pin) }}
        >
          {pin.no}
        </span>
        <h2>{pin.area || copy.pins.spotNo(pin.no)}</h2>
        <button type="button" className="btn small ghost" onClick={() => select(null)}>
          {copy.pins.back}
        </button>
      </div>

      <div className="field">
        <label htmlFor="pin-area">{copy.pins.area}</label>
        <input
          id="pin-area"
          list={listId}
          value={pin.area}
          placeholder={copy.pins.areaPlaceholder}
          // A pin dropped on an empty spot starts with its name, which every photo inherits.
          autoFocus={!pin.area && !pin.photoIds.length}
          onChange={(e) => updatePin(pin.id, { area: e.target.value })}
        />
        <datalist id={listId}>
          {areaSuggestions.map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </div>

        <div className="capture">
          <button type="button" className="btn primary" onClick={camera.open} disabled={!!importing}>
            {copy.pins.takePhoto}
          </button>
          <button type="button" className="btn" onClick={gallery.open} disabled={!!importing}>
            {copy.pins.addPhotos}
          </button>
          {camera.input}
          {gallery.input}
        </div>

      {validation ? (
        <>
          <div className="field">
            <label htmlFor="pin-item">{copy.pins.item}</label>
            <input
              id="pin-item"
              list={`items-${project.id}`}
              value={pin.issue}
              placeholder={copy.pins.itemPlaceholder}
              onChange={(e) => updatePin(pin.id, { issue: e.target.value })}
            />
            <datalist id={`items-${project.id}`}>
              {itemSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div className="field">
            <span className="lbl">{copy.pins.result}</span>
            {/* Big targets: this is tapped standing in a dining room, phone in one hand. */}
            <div className="results" role="group" aria-label={copy.pins.result}>
              {statuses.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  aria-pressed={pin.status === status.id}
                  style={{ '--c': RESULT_COLORS[status.id] } as React.CSSProperties}
                  onClick={() => updatePin(pin.id, { status: status.id })}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="pin-issue">{copy.pins.issue}</label>
            <select
              id="pin-issue"
              value={pin.issue}
              onChange={(e) => updatePin(pin.id, { issue: e.target.value })}
            >
              {issues.map((issue) => (
                <option key={issue.id} value={issue.id}>
                  {issue.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="pin-status">{copy.pins.status}</label>
            <select
              id="pin-status"
              value={pin.status}
              onChange={(e) => updatePin(pin.id, { status: e.target.value })}
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}


      <div className="field">
        <span className="lbl">
          {copy.pins.photos} ({photos.length})
        </span>
        {importing && (
          <p className="meta" style={{ marginTop: 0 }}>
            {copy.photos.importing(importing.done, importing.total)}
          </p>
        )}
        {!photos.length && !importing && <div className="empty">{copy.pins.noPhotos}</div>}
        <div className="pgrid">
          {photos.map((photo) => (
            <div className="pcell" key={photo.id}>
              <button
                type="button"
                className="thumb"
                title={photoLabel(pin, photo.id)}
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('.unpin')) return
                  e.preventDefault()
                  beginPhotoDrag([photo.id], photo.thumbId, e.nativeEvent)
                }}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.unpin')) return
                  onZoom(photo.id)
                }}
              >
                <BlobImg blobId={photo.thumbId} alt={photoLabel(pin, photo.id)} />
                <span className="nm">{photoLabel(pin, photo.id)}</span>
              </button>
              <button
                type="button"
                className="unpin"
                onClick={() => detachPhoto(pin.id, photo.id)}
              >
                {copy.pins.unpin}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="pin-note">{copy.pins.note}</label>
        <textarea
          id="pin-note"
          value={pin.note}
          placeholder={copy.pins.notePlaceholder}
          onChange={(e) => updatePin(pin.id, { note: e.target.value })}
        />
      </div>

      <div className="dfoot">
        <ConfirmButton
          label={copy.pins.remove}
          confirmLabel={copy.pins.removeConfirm}
          onConfirm={() => deletePin(pin.id)}
        />
      </div>
      <p className="meta">
        {copy.pins.created(formatWhen(pin.createdAt))} · {copy.pins.removeNote}
      </p>
    </div>
  )
}
