import { useEffect, useState } from 'react'
import { useApp } from '../lib/state'
import { WINTER_STEPS } from '../lib/winter'
import { BlobImg, Modal, useFilePicker } from './bits'

export function WinterEvidence({ stepId, pinId, onClose }: { stepId: string; pinId?: string; onClose: () => void }) {
  const project = useApp(s => s.project)!
  const step = WINTER_STEPS.find(s => s.id === stepId)!
  const original = project.pins.find(p => p.id === pinId)
  const [savedId, setSavedId] = useState(pinId)
  const pin = project.pins.find(p => p.id === savedId)
  const [point, setPoint] = useState(original ? { x: original.x, y: original.y } : null)
  const [area, setArea] = useState(original?.area ?? '')
  const [note, setNote] = useState(original?.note ?? '')
  const [status, setStatus] = useState(original?.status ?? 'pending')
  const [needed, setNeeded] = useState(original?.needsWorkOrder ?? false)
  const [reference, setReference] = useState(original?.workOrder ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f)); setPreviews(urls)
    return () => urls.forEach(URL.revokeObjectURL)
  }, [files])
  const add = (picked: File[]) => setFiles(current => [...current, ...picked])
  const camera = useFilePicker(add, 'image/*', false, 'environment')
  const gallery = useFilePicker(add, 'image/*', true)
  const plan = useFilePicker(picked => { void useApp.getState().setPlan(picked[0]) }, 'image/*,application/pdf')
  const save = async () => {
    if (!point || !project.plan) return
    setBusy(true); setError('')
    try {
      const app = useApp.getState()
      app.arm(null)
      const id = savedId ?? app.addPin(point.x, point.y, [])
      setSavedId(id)
      app.updatePin(id, { x: point.x, y: point.y, area: area.trim() || step.title, issue: step.title, winterStepId: stepId, note, status, needsWorkOrder: needed, workOrder: reference })
      for (let i = 0; i < files.length; i++) {
        const before = useApp.getState().project!.pins.find(p => p.id === id)!.photoIds.length
        await app.addPhotosToPin(id, [files[i]])
        const after = useApp.getState().project!.pins.find(p => p.id === id)!.photoIds.length
        if (after !== before + 1) { setFiles(files.slice(i)); throw new Error('This photo could not be added. Saved photos are kept; remove or retry the remaining photo.') }
      }
      if (needed || status === 'wrong' || status === 'missing') app.setWinterResult(stepId, { status: 'attention' })
      setFiles([]); app.select(null); onClose()
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this evidence. Try again.') }
    finally { setBusy(false) }
  }
  return <Modal wide label={`Evidence: ${step.title}`} onClose={() => { if (!busy) onClose() }}>
    <h2>{step.title}</h2>
    <p>Add pictures, tap their location, and save back to the checklist.</p>
    <fieldset disabled={busy} className="evidence-fields">
      <div className="capture"><button className="btn primary" onClick={camera.open}>Take photo</button><button className="btn" onClick={gallery.open}>Add photos</button>{camera.input}{gallery.input}</div>
      <div className="evidence-photos">
        {pin?.photoIds.map(id => { const photo = project.photos.find(p => p.id === id); return photo && <BlobImg key={id} blobId={photo.thumbId} alt={photo.name}/> })}
        {previews.map((url,i) => <div key={url}><img src={url} alt={`New photo ${i+1}`}/><button className="btn small" onClick={() => setFiles(files.filter((_,n) => n !== i))}>Remove photo {i+1}</button></div>)}
      </div>
      <h3>Pin the location</h3>
      {!project.plan ? <><p>Add your floor plan here once. It will be available for every checklist item.</p><button className="btn" onClick={plan.open}>Add floor plan</button>{plan.input}</> : <>
        <p aria-live="polite">{point ? 'Location marked. Tap elsewhere to move it.' : 'Tap the floor plan to mark this location.'}</p>
        <div className="row"><button className="btn small" onClick={() => setZoom(Math.max(1, zoom - 0.5))} disabled={zoom === 1}>Zoom out</button><button className="btn small" onClick={() => setZoom(Math.min(4, zoom + 0.5))} disabled={zoom === 4}>Zoom in</button></div>
        <div className="evidence-map-scroll"><button type="button" className="evidence-map" aria-label="Pin location on floor plan" style={{width: `${zoom*100}%`}} onClick={e => { const rect=e.currentTarget.getBoundingClientRect();setPoint({x:Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height))}) }} onKeyDown={e => { const deltas:Record<string,[number,number]>={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]}; if(deltas[e.key]){e.preventDefault();const [x,y]=deltas[e.key];setPoint(p=>({x:Math.max(0,Math.min(1,(p?.x??.5)+x)),y:Math.max(0,Math.min(1,(p?.y??.5)+y))}))}else if(e.key==='Enter'||e.key===' '){e.preventDefault();setPoint(p=>p??{x:.5,y:.5})} }}>
          <BlobImg blobId={project.plan.blobId} alt="Site floor plan"/>
          {point && <span className="evidence-marker" style={{left:`${point.x*100}%`,top:`${point.y*100}%`}}>●</span>}
        </button></div>
      </>}
      <div className="field"><label htmlFor="evidence-area">Area / location</label><input id="evidence-area" value={area} onChange={e=>setArea(e.target.value)} placeholder="e.g. Mechanical room exterior door"/></div>
      <div className="field"><label htmlFor="evidence-status">Validation result</label><select id="evidence-status" value={status} onChange={e=>setStatus(e.target.value)}><option value="pending">Not checked</option><option value="verified">Validated</option><option value="missing">Missing</option><option value="wrong">Needs attention</option></select></div>
      <div className="field"><label htmlFor="evidence-note">Issue / notes</label><textarea id="evidence-note" value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div className="field"><label className="evidence-check"><input type="checkbox" checked={needed} onChange={e=>setNeeded(e.target.checked)}/> Work order needed</label></div>
      <div className="field"><label htmlFor="evidence-reference">Work-order reference (if opened)</label><input id="evidence-reference" value={reference} onChange={e=>setReference(e.target.value)}/></div>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    <div className="mfoot evidence-footer"><button className="btn" disabled={busy} onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy || !point || !project.plan} onClick={() => void save()}>{busy ? 'Saving…' : 'Save to checklist'}</button></div>
  </Modal>
}
