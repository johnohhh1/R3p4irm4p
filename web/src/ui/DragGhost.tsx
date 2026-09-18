import { useEffect, useState } from 'react'
import { subscribeDrag, type Drag } from '../lib/drag'
import { BlobImg } from './bits'

/** The photo that follows the pointer while a drag is in flight. */
export function DragGhost() {
  const [drag, setDrag] = useState<Drag>(null)
  useEffect(() => subscribeDrag(setDrag), [])

  if (!drag || drag.type !== 'photos') return null

  return (
    <div className="draghost" style={{ transform: `translate(${drag.x}px, ${drag.y}px) translate(-50%, -60%) rotate(-4deg)` }}>
      <BlobImg blobId={drag.thumbBlobId} alt="" />
      {drag.ids.length > 1 && <b>{drag.ids.length}</b>}
    </div>
  )
}
