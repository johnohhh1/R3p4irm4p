import type { Pin } from './types'
import { copy } from './copy'

/**
 * A pinned photo is named for where it is, not for what the phone called it:
 * "Dish area 3", never "IMG_4832". Derived rather than stored, so renaming the
 * area relabels every photo on the pin; the original filename stays on the photo.
 */
export function photoLabel(pin: Pin, photoId: string): string {
  const base = pin.area.trim() || copy.pins.spotNo(pin.no)
  const index = pin.photoIds.indexOf(photoId)
  return index < 0 ? base : `${base} ${index + 1}`
}
