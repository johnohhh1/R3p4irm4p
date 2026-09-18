/**
 * The drag model, ported from app/map-template.html. Pointer events only, so a
 * mouse, a pen and a greasy thumb all take the same path. Hit testing goes
 * through the DOM (data-stage / data-pin-id) rather than React context, which is
 * what lets a thumbnail in the sidebar be dropped onto a pin on the plan.
 */
import { useApp } from './state'
import { clamp } from './util'

export type Drag =
  | { type: 'photos'; ids: string[]; thumbBlobId: string | null; x: number; y: number; over: string | null }
  | { type: 'pin'; pinId: string; x: number; y: number }
  | null

type Listener = (drag: Drag) => void

let current: Drag = null
let pointerId: number | null = null
let moved = false
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener(current)
}

export function subscribeDrag(listener: Listener): () => void {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}

export function currentDrag(): Drag {
  return current
}

/** True when the pointer travelled far enough to count as a drag, not a tap. */
export function wasDrag(): boolean {
  return moved
}

interface StageHit {
  el: HTMLElement
  x: number
  y: number
}

function stageAt(clientX: number, clientY: number): StageHit | null {
  const stage = document.querySelector<HTMLElement>('[data-stage]')
  if (!stage) return null
  const rect = stage.getBoundingClientRect()
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null
  }
  return {
    el: stage,
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  }
}

function pinAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  return el?.closest<HTMLElement>('[data-pin-id]')?.dataset.pinId ?? null
}

function trayAt(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY)
  return !!el?.closest('[data-tray]')
}

function attach() {
  window.addEventListener('pointermove', onMove, { passive: false })
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  document.body.classList.add('dragging-any')
}

function detach() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onCancel)
  document.body.classList.remove('dragging-any')
}

export function beginPhotoDrag(ids: string[], thumbBlobId: string | null, event: PointerEvent) {
  if (current) return
  pointerId = event.pointerId
  moved = false
  current = { type: 'photos', ids, thumbBlobId, x: event.clientX, y: event.clientY, over: null }
  attach()
  emit()
}

export function beginPinDrag(pinId: string, event: PointerEvent) {
  if (current) return
  pointerId = event.pointerId
  moved = false
  current = { type: 'pin', pinId, x: event.clientX, y: event.clientY }
  attach()
  emit()
}

function onMove(event: PointerEvent) {
  if (!current || event.pointerId !== pointerId) return
  const dx = event.clientX - current.x
  const dy = event.clientY - current.y
  if (!moved && Math.hypot(dx, dy) > 4) moved = true

  if (current.type === 'pin') {
    event.preventDefault()
    const hit = stageAt(event.clientX, event.clientY)
    if (hit && moved) useApp.getState().movePin(current.pinId, hit.x, hit.y)
    current = { ...current, x: event.clientX, y: event.clientY }
    emit()
    return
  }

  event.preventDefault()
  current = {
    ...current,
    x: event.clientX,
    y: event.clientY,
    over: pinAt(event.clientX, event.clientY),
  }
  emit()
}

function onUp(event: PointerEvent) {
  if (!current || event.pointerId !== pointerId) return
  const drag = current
  finish()

  if (drag.type === 'pin') return

  if (!moved) {
    // A tap, not a drag: arm the photos and let the next tap place them.
    // Phones do this; a mouse never reaches here because of the 4px threshold.
    useApp.getState().arm({ kind: 'photos', ids: drag.ids })
    return
  }

  const onPin = pinAt(event.clientX, event.clientY)
  if (onPin) {
    useApp.getState().attachPhotos(onPin, drag.ids)
    return
  }
  const hit = stageAt(event.clientX, event.clientY)
  if (hit) {
    useApp.getState().addPin(hit.x, hit.y, drag.ids)
    return
  }
  if (trayAt(event.clientX, event.clientY)) {
    // Dragged back to the tray — unpin, which is how the prototype undoes a pin.
    const state = useApp.getState()
    const project = state.project
    if (!project) return
    for (const photoId of drag.ids) {
      const pin = project.pins.find((p) => p.photoIds.includes(photoId))
      if (pin) state.detachPhoto(pin.id, photoId)
    }
  }
}

function onCancel(event: PointerEvent) {
  if (!current || event.pointerId !== pointerId) return
  finish()
}

function finish() {
  detach()
  current = null
  pointerId = null
  emit()
}
