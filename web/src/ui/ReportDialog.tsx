import { useState } from 'react'
import { useApp } from '../lib/state'
import { copy } from '../lib/copy'
import { TEMPLATE_NAMES } from '../lib/catalog'
import { generateReport } from '../report/generate'
import { downloadBlob, safeFilename, uid } from '../lib/util'
import { Modal, useFilePicker } from './bits'
import type { TemplateId } from '../lib/types'

const ACCENTS = ['#22235B', '#1F5C4A', '#7A2E2E', '#3A3A46', '#1E4E7A', '#5C3A6E']

export function ReportDialog({ onClose }: { onClose: () => void }) {
  const project = useApp((s) => s.project)
  const store = useApp((s) => s.store)
  const setReport = useApp((s) => s.setReport)
  const setTemplate = useApp((s) => s.setTemplate)
  const fail = useApp((s) => s.fail)

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const logoPicker = useFilePicker(async (files) => {
    const blobId = uid('logo')
    await store.putBlob(blobId, files[0])
    setReport({ logoBlobId: blobId })
  }, 'image/png,image/jpeg')

  if (!project) return null

  const photoCount = project.pins.reduce((n, p) => n + p.photoIds.length, 0)
  const blocked = !project.plan
    ? copy.report.needPlan
    : !project.pins.length
      ? copy.report.needPins
      : null

  const run = async () => {
    setProgress({ done: 0, total: 1 })
    try {
      const blob = await generateReport(project, store, (_step, done, total) =>
        setProgress({ done, total }),
      )
      const name = safeFilename(project.report.site || project.name, 'repair-map')
      downloadBlob(blob, `${name}-${project.report.date || 'report'}.pdf`)
      setProgress(null)
      onClose()
    } catch {
      setProgress(null)
      fail(copy.errors.reportFailed)
    }
  }

  return (
    <Modal onClose={onClose} wide label={copy.report.heading}>
      <h2>{copy.report.heading}</h2>
      <p className="help">{blocked ?? copy.report.ready(project.pins.length, photoCount)}</p>

      <div className="rgrid">
        <div className="field wide">
          <label htmlFor="r-template">{copy.report.template}</label>
          <select
            id="r-template"
            value={project.template}
            onChange={(e) => setTemplate(e.target.value as TemplateId)}
          >
            {(Object.keys(TEMPLATE_NAMES) as TemplateId[]).map((id) => (
              <option key={id} value={id}>
                {TEMPLATE_NAMES[id]}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="r-site">{copy.report.site}</label>
          <input
            id="r-site"
            value={project.report.site}
            placeholder={copy.report.sitePlaceholder}
            onChange={(e) => setReport({ site: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="r-by">{copy.report.preparedBy}</label>
          <input
            id="r-by"
            value={project.report.preparedBy}
            placeholder={copy.report.preparedByPlaceholder}
            onChange={(e) => setReport({ preparedBy: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="r-date">{copy.report.date}</label>
          <input
            id="r-date"
            type="date"
            value={project.report.date}
            onChange={(e) => setReport({ date: e.target.value })}
          />
        </div>

        <div className="field">
          <label htmlFor="r-surface">{copy.report.surface}</label>
          <input
            id="r-surface"
            value={project.report.surface}
            placeholder={copy.report.surfacePlaceholder}
            onChange={(e) => setReport({ surface: e.target.value })}
          />
        </div>

        <div className="field wide">
          <label htmlFor="r-findings">{copy.report.findings}</label>
          <textarea
            id="r-findings"
            value={project.report.findings}
            placeholder={copy.report.findingsPlaceholder}
            onChange={(e) => setReport({ findings: e.target.value })}
          />
        </div>

        <div className="field wide">
          <label htmlFor="r-link">{copy.report.link}</label>
          <input
            id="r-link"
            value={project.report.link}
            placeholder={copy.report.linkPlaceholder}
            onChange={(e) => setReport({ link: e.target.value })}
          />
        </div>

        <div className="field">
          <span className="lbl">{copy.report.logo}</span>
          <div className="row">
            <button type="button" className="btn" onClick={logoPicker.open}>
              {copy.report.logoAdd}
            </button>
            {project.report.logoBlobId && (
              <button type="button" className="btn ghost" onClick={() => setReport({ logoBlobId: null })}>
                {copy.report.logoRemove}
              </button>
            )}
          </div>
          {logoPicker.input}
        </div>

        <div className="field">
          <span className="lbl">{copy.report.accent}</span>
          <div className="swatches">
            {ACCENTS.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                aria-label={color}
                aria-pressed={project.report.accent === color}
                onClick={() => setReport({ accent: color })}
              />
            ))}
          </div>
        </div>
      </div>

      {progress && (
        <div className="progress" aria-label={copy.report.generating}>
          <i style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
        </div>
      )}

      <div className="mfoot">
        <p className="meta" style={{ margin: 0, flex: 1 }}>
          {copy.report.filename}
        </p>
        <button type="button" className="btn" onClick={onClose} disabled={!!progress}>
          Close
        </button>
        <button type="button" className="btn primary" onClick={run} disabled={!!blocked || !!progress}>
          {progress ? copy.report.generating : copy.report.download}
        </button>
      </div>
    </Modal>
  )
}
