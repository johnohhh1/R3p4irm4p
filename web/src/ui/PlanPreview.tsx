import { useEffect, useState } from 'react'
import { useApp } from '../lib/state'
import type { Project } from '../lib/types'
import { pinColor } from '../lib/catalog'
import { labCopy as c } from '../lib/labCopy'

export function PlanPreview({ id, updatedAt }: { id: string; updatedAt: string }) {
  const store = useApp(s => s.store)
  const [data, setData] = useState<{ project: Project; url: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    setData(null)
    void (async () => {
      const project = await store.get(id)
      if (!project?.plan || cancelled) return
      const blob = await store.getBlob(project.plan.blobId)
      if (!blob || cancelled) return
      url = URL.createObjectURL(blob)
      setData({ project, url })
    })().catch(() => {})
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [store, id, updatedAt])
  return <div className="plan-preview" aria-label={c.mapPreview}>
    {data ? <div className="plan-preview-image" style={{ aspectRatio: `${data.project.plan!.w} / ${data.project.plan!.h}` }}>
      <img src={data.url} alt="" />
      {data.project.pins.map(p => <i key={p.id} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, background: pinColor(data.project.subject, data.project.issueSet, p) }}>{p.no}</i>)}
    </div> : <span className="plan-placeholder">+ Add your floor plan</span>}
  </div>
}
