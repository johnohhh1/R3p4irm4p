import { useEffect, useState } from 'react'
import { unplacedIds, useApp } from '../lib/state'
import { copy } from '../lib/copy'
import { statusesFor, TEMPLATE_NAMES } from '../lib/catalog'
import { exportProject } from '../lib/rmap'
import { downloadBlob, safeFilename } from '../lib/util'
import { labCopy as c } from '../lib/labCopy'
import { WalkOverview } from './WalkOverview'
import { isValidation } from '../lib/catalog'
import { PlanStage } from './PlanStage'
import { PhotoTray } from './PhotoTray'
import { PinList } from './PinList'
import { PinPanel } from './PinPanel'
import { ReportDialog } from './ReportDialog'
import { Lightbox } from './Lightbox'
import { Onboarding } from './Onboarding'
import { DragGhost } from './DragGhost'
import { useFilePicker } from './bits'

export function Workspace() {
  const project = useApp((s) => s.project)
  const store = useApp((s) => s.store)
  const saveState = useApp((s) => s.saveState)
  const sidebar = useApp((s) => s.sidebar)
  const setSidebar = useApp((s) => s.setSidebar)
  const selectedPinId = useApp((s) => s.selectedPinId)
  const goProjects = useApp((s) => s.goProjects)
  const setPlan = useApp((s) => s.setPlan)
  const say = useApp((s) => s.say)
  const renameProject = useApp((s) => s.renameProject)

  const [sheetOpen, setSheetOpen] = useState(false)
  const armed = useApp(s => s.armed)
  useEffect(() => { if (selectedPinId) setSheetOpen(true) }, [selectedPinId])
  useEffect(() => { if (armed) setSheetOpen(false) }, [armed])

  const [reportOpen, setReportOpen] = useState(false)
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [naming, setNaming] = useState<string | null>(null)

  const planPicker = useFilePicker((files) => {
    setReplacing(false)
    void setPlan(files[0])
  }, 'image/*,application/pdf')

  /* A tab close mid-walk must lose nothing, so warn only while a save is in flight. */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState !== 'saved') e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [saveState])

  if (!project) return null

  // One chip per status the project actually uses, in the user's own words.
  const statusCounts = statusesFor(project.subject)
    .map((status) => ({ status, n: project.pins.filter((p) => p.status === status.id).length }))
    .filter((entry) => entry.n > 0)
  const unplaced = unplacedIds(project).length

  // Enter commits directly rather than by blurring: blur() does nothing when the
  // field never held focus, and the rename would silently not happen.
  const commitName = () => {
    if (naming === null) return
    void renameProject(project.id, naming)
    setNaming(null)
  }

  const exportRmap = async () => {
    const blob = await exportProject(project, store)
    downloadBlob(blob, `${safeFilename(project.name, 'repair-map')}.rmap`)
    say(copy.toasts.exported)
  }

  return (
    <div className={`app editing ${sheetOpen ? "sheet-open" : ""}`}><div className="lab-ribbon">{c.preview}<span>{c.local}</span></div>
      <header className="bar">
        <button type="button" className="btn ghost small" onClick={goProjects}>
          ‹ {copy.projects.title}
        </button>
        <div className="brand">
          {naming === null ? (
            <h1>
              <button
                type="button"
                className="rename"
                title={copy.projects.renameHint}
                onClick={() => setNaming(project.name)}
              >
                {project.name}
              </button>
            </h1>
          ) : (
            <input
              id="project-name"
              className="rename-input"
              autoFocus
              value={naming}
              aria-label={copy.projects.rename}
              onChange={(e) => setNaming(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitName()
                if (e.key === 'Escape') setNaming(null)
              }}
            />
          )}
          <span className="sub">{TEMPLATE_NAMES[project.template]}</span>
        </div>
        <div className="stats workspace-stats">
          <span className="stat">
            <b>{project.pins.length}</b>
            {project.pins.length === 1 ? 'spot' : 'spots'}
          </span>
          {statusCounts.map(({ status, n }) => (
            <span className="stat" key={status.id}>
              <b>{n}</b>
              {status.label.toLowerCase()}
            </span>
          ))}
          {unplaced > 0 && (
            <span className="stat">
              <b>{unplaced}</b>to place
            </span>
          )}
        </div>
        <div className="actions">
          <span className={`savestate ${saveState}`} aria-live="polite">
            {saveState === 'saving' ? copy.save.saving : saveState === 'failed' ? copy.save.failed : copy.save.saved}
          </span>
          <button type="button" className="btn small" onClick={() => void exportRmap()}>
            {c.backup}
          </button>
          <button type="button" className="btn primary" onClick={() => setReportOpen(true)}>
            {c.report}
          </button>
        </div>
      </header>

      <WalkOverview />
      {project.plan && (
        <div className="banner">
          <span className="grow">
            {project.plan.name}
          </span>
          {!replacing ? (
            <button type="button" className="btn small" onClick={() => setReplacing(true)}>
              {copy.plan.replace}
            </button>
          ) : (
            <>
              <span className="grow">{copy.plan.replaceWarning}</span>
              <button type="button" className="btn small danger confirm" onClick={planPicker.open}>
                {copy.plan.replaceConfirm}
              </button>
              <button type="button" className="btn small ghost" onClick={() => setReplacing(false)}>
                {c.cancel}
              </button>
            </>
          )}
          {planPicker.input}
        </div>
      )}

      <main className="work">
        <PlanStage />
        <aside className="side" aria-label="Photos and spots">
          <button className="sheet-toggle" aria-expanded={sheetOpen} onClick={() => { if (sheetOpen) useApp.getState().select(null); setSheetOpen(!sheetOpen) }}><span aria-hidden="true" />{sheetOpen ? c.map : c.details}</button>
          <div className="tabs" role="tablist">
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={sidebar === 'tray' && !selectedPinId}
              onClick={() => { setSidebar('tray'); setSheetOpen(true) }}
            >
              {copy.photos.tabLabel}
              <b>{unplaced}</b>
            </button>
            <button
              type="button"
              className="tab"
              role="tab"
              aria-selected={sidebar === 'list' && !selectedPinId}
              onClick={() => { setSidebar('list'); setSheetOpen(true) }}
            >
              {isValidation(project.subject) ? c.checklist : copy.pins.tabLabel}
              <b>{project.pins.length}</b>
            </button>
          </div>
          {selectedPinId ? (
            <PinPanel pinId={selectedPinId} onZoom={setZoomPhoto} />
          ) : sidebar === 'tray' ? (
            <PhotoTray onZoom={setZoomPhoto} />
          ) : (
            <PinList />
          )}
        </aside>
      </main>

      {!project.onboarded && <Onboarding />}
      {reportOpen && <ReportDialog onClose={() => setReportOpen(false)} />}
      {zoomPhoto && <Lightbox photoId={zoomPhoto} onClose={() => setZoomPhoto(null)} />}
      <DragGhost />
    </div>
  )
}
