import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/state'
import { beginPinDrag, currentDrag, subscribeDrag, type Drag } from '../lib/drag'
import { CLOSED_STATUS, DONE_COLOR, issueColor, issuesFor } from '../lib/catalog'
import { copy } from '../lib/copy'
import { clamp } from '../lib/util'
import { BlobImg, useFilePicker } from './bits'
import type { Pin } from '../lib/types'

const ZOOMS = [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1.25, 1.6, 2, 2.6, 3.2]

export function PlanStage() {
  const project = useApp((s) => s.project)
  const selectedPinId = useApp((s) => s.selectedPinId)
  const armed = useApp((s) => s.armed)
  const select = useApp((s) => s.select)
  const arm = useApp((s) => s.arm)
  const addPin = useApp((s) => s.addPin)
  const attachPhotos = useApp((s) => s.attachPhotos)
  const nudgePin = useApp((s) => s.nudgePin)
  const setPlan = useApp((s) => s.setPlan)
  const addPhotos = useApp((s) => s.addPhotos)

  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [fitScale, setFitScale] = useState(1)
  const [drag, setDrag] = useState<Drag>(null)
  const [dropping, setDropping] = useState(false)

  const planPicker = useFilePicker((files) => void setPlan(files[0]), 'image/*,application/pdf')

  useEffect(() => subscribeDrag(setDrag), [])

  const plan = project?.plan ?? null

  /* Fit the plan to the viewport, and keep fitting it as the window changes. */
  const recomputeFit = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport || !plan) return
    const pad = 28
    const scale = Math.min(
      (viewport.clientWidth - pad) / plan.w,
      (viewport.clientHeight - pad) / plan.h,
    )
    setFitScale(clamp(scale, 0.05, 4))
  }, [plan])

  useEffect(() => {
    recomputeFit()
    const viewport = viewportRef.current
    if (!viewport) return
    const observer = new ResizeObserver(recomputeFit)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [recomputeFit])

  const scale = zoom === 'fit' ? fitScale : zoom

  /* Escape cancels an armed placement; arrow keys nudge the selected pin. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape' && armed) {
        arm(null)
        return
      }
      if (!selectedPinId) return
      const step = e.shiftKey ? 0.01 : 0.002
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      const move = moves[e.key]
      if (!move) return
      e.preventDefault()
      nudgePin(selectedPinId, move[0], move[1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed, arm, selectedPinId, nudgePin])

  if (!project) return null

  const issues = issuesFor(project.issueSet)

  const relFromEvent = (e: React.PointerEvent | React.MouseEvent) => {
    const stage = stageRef.current
    if (!stage) return null
    const rect = stage.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const onStageClick = (e: React.MouseEvent) => {
    if (!armed) return
    const rel = relFromEvent(e)
    if (!rel) return
    if (armed.kind === 'pin') addPin(rel.x, rel.y, [])
    else addPin(rel.x, rel.y, armed.ids)
  }

  const onPinClick = (pin: Pin) => {
    if (armed?.kind === 'photos') {
      attachPhotos(pin.id, armed.ids)
      return
    }
    if (armed?.kind === 'pin') {
      arm(null)
      return
    }
    select(pin.id)
  }

  /* Files dropped anywhere on the plan: a plan if it is the first, else photos. */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropping(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (!files.length) return
    if (!plan) {
      void setPlan(files[0])
      return
    }
    void addPhotos(files)
  }

  const hint = armed
    ? armed.kind === 'pin'
      ? copy.map.hintArmedPin
      : copy.map.hintArmedPhoto(armed.ids.length)
    : copy.map.hintEdit

  return (
    <section className="mapwrap" aria-label="Floor plan">
      <div className="maptools">
        <button
          type="button"
          className={armed?.kind === 'pin' ? 'btn armed' : 'btn'}
          disabled={!plan}
          onClick={() => arm(armed?.kind === 'pin' ? null : { kind: 'pin' })}
        >
          {copy.map.dropPin}
        </button>
        <span className={armed ? 'hint live' : 'hint'} aria-live="polite">
          {hint}
        </span>
        <div className="zoom">
          <button
            type="button"
            aria-label={copy.map.zoomOut}
            disabled={!plan}
            onClick={() => setZoom(stepZoom(scale, -1))}
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            aria-label={copy.map.zoomIn}
            disabled={!plan}
            onClick={() => setZoom(stepZoom(scale, 1))}
          >
            +
          </button>
          <button type="button" className="wide" disabled={!plan} onClick={() => setZoom('fit')}>
            {copy.map.fit}
          </button>
        </div>
      </div>

      <div
        className="viewport"
        ref={viewportRef}
        onDragOver={(e) => {
          e.preventDefault()
          setDropping(true)
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
        {!plan ? (
          <div style={{ display: 'grid', placeItems: 'center', height: '100%', padding: 24 }}>
            <div className="empty" style={{ maxWidth: 380 }}>
              <strong style={{ display: 'block', fontSize: 17, color: 'var(--ink)', marginBottom: 6 }}>
                {copy.plan.heading}
              </strong>
              <p style={{ margin: '0 0 14px' }}>{copy.plan.help}</p>
              <button type="button" className="btn primary" onClick={planPicker.open}>
                {copy.plan.choose}
              </button>
              {planPicker.input}
              <p style={{ margin: '12px 0 0', fontSize: 13 }}>{copy.plan.dropHere}</p>
            </div>
          </div>
        ) : (
          <div
            className={[
              'stage',
              armed ? 'armed' : '',
              dropping || drag?.type === 'photos' ? 'drop-ok' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-stage
            ref={stageRef}
            style={{ width: plan.w * scale, height: plan.h * scale }}
            onClick={onStageClick}
          >
            <BlobImg blobId={plan.blobId} alt="Floor plan" />
            <div className="pins">
              {project.pins.map((pin) => {
                const closed = pin.status === CLOSED_STATUS
                const color = closed ? DONE_COLOR : issueColor(project.issueSet, pin.issue)
                const isDragging = drag?.type === 'pin' && drag.pinId === pin.id
                return (
                  <button
                    key={pin.id}
                    type="button"
                    data-pin-id={pin.id}
                    className={[
                      'pin',
                      pin.id === selectedPinId ? 'sel' : '',
                      isDragging ? 'dragging' : '',
                      drag?.type === 'photos' && drag.over === pin.id ? 'drop-target' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%`, background: color }}
                    title={`${copy.pins.spotNo(pin.no)}${pin.area ? ` — ${pin.area}` : ''}`}
                    aria-label={`${copy.pins.spotNo(pin.no)}${pin.area ? `, ${pin.area}` : ''}`}
                    onPointerDown={(e) => {
                      if (armed) return
                      e.stopPropagation()
                      beginPinDrag(pin.id, e.nativeEvent)
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // A drag that ended on this pin should not also select it.
                      if (currentDrag()) return
                      onPinClick(pin)
                    }}
                  >
                    {pin.no}
                    {pin.photoIds.length > 1 && <span className="cnt">{pin.photoIds.length}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {plan && project.pins.length > 0 && (
        <div className="legend">
          {issues
            .filter((issue) => project.pins.some((p) => p.issue === issue.id && p.status !== CLOSED_STATUS))
            .map((issue) => (
              <span key={issue.id}>
                <i className="dot" style={{ background: issue.color }} />
                {issue.label}
              </span>
            ))}
          {project.pins.some((p) => p.status === CLOSED_STATUS) && (
            <span>
              <i className="dot" style={{ background: DONE_COLOR }} />
              Closed
            </span>
          )}
        </div>
      )}
    </section>
  )
}

function stepZoom(from: number, direction: 1 | -1): number {
  const index = ZOOMS.findIndex((z) => z >= from - 0.001)
  const next = index < 0 ? ZOOMS.length - 1 : clamp(index + direction, 0, ZOOMS.length - 1)
  return ZOOMS[next]
}
