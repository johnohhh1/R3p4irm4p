import { PlanPreview } from './PlanPreview'
import { labCopy as c } from '../lib/labCopy'
import { sampleWalk } from '../lib/sampleWalk'
import { useState } from 'react'
import { useApp } from '../lib/state'
import { copy } from '../lib/copy'
import { isValidation, TEMPLATE_NAMES } from '../lib/catalog'
import { importProject } from '../lib/rmap'
import { formatWhen } from '../lib/util'
import { ConfirmButton, useFilePicker } from './bits'

export function ProjectList() {
  const projects = useApp((s) => s.projects)
  const createProject = useApp((s) => s.createProject)
  const openProject = useApp((s) => s.openProject)
  const deleteProject = useApp((s) => s.deleteProject)
  const renameProject = useApp((s) => s.renameProject)
  const replaceProject = useApp((s) => s.replaceProject)
  const duplicateProject = useApp((s) => s.duplicateProject)
  const fail = useApp((s) => s.fail)

  const [search, setSearch] = useState('')
  const [loadingSample, setLoadingSample] = useState(false)
  const store = useApp(s => s.store)
  const openSample = async () => {
    setLoadingSample(true)
    try { const id = await sampleWalk(store); await useApp.getState().init(); await openProject(id) }
    catch (e) { fail(e instanceof Error ? e.message : 'Could not create sample') }
    finally { setLoadingSample(false) }
  }
  const visible = projects.filter(p => `${p.name} ${p.site} ${TEMPLATE_NAMES[p.template]}`.toLowerCase().includes(search.trim().toLowerCase()))

  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const picker = useFilePicker(async (files) => {
    try {
      const { project, blobs } = await importProject(files[0])
      await replaceProject(project, blobs)
    } catch (err) {
      fail(err instanceof Error ? err.message : copy.errors.importFailed)
    }
  }, '.rmap,application/zip')

  return (
    <div className="home">
      <header className="home-top"><a className="wordmark" href="/" aria-label="Repair Map home"><span className="brand-mark" aria-hidden="true">⌖</span>{copy.app.name}</a><span className="preview-badge">{c.preview}</span><span className="device-note">{c.local}</span></header>
      <section className="home-intro"><div><h1>{c.homeTitle}</h1><p className="tagline">{c.homeIntro}</p></div><div className="intro-stamp" aria-hidden="true"><span>Map.</span><span>Capture.</span><span>Report.</span></div></section>

      <div className="homeactions">
        <button type="button" className="btn primary" onClick={() => void createProject()}>
          {projects.length ? copy.projects.create : copy.projects.createFirst}
        </button>
        <button type="button" className="btn" onClick={picker.open}>
          {copy.projects.importFile}
        </button>
        {picker.input}
        <button className="btn ghost" disabled={loadingSample} onClick={() => void openSample()}>{loadingSample ? c.loading : c.sample}</button>
      </div>
      <div className="walks-heading"><div><h2>{c.sites}</h2><p>{c.siteCount(projects.length)}</p></div><input className="list-search" type="search" aria-label={c.homeSearch} placeholder={c.homeSearch} value={search} onChange={e => setSearch(e.target.value)} /></div>
      {!!projects.length && !visible.length && <p className="empty">{c.noMatches}</p>}

      {!projects.length ? (
        <div className="empty">{copy.projects.empty}</div>
      ) : (
        <div className="cards">
          {visible.map((p) => (
            <div className="card" key={p.id}>
              <button className="preview-open" aria-label={`Open ${p.name}`} onClick={() => void openProject(p.id)}><PlanPreview id={p.id} updatedAt={p.updatedAt} /><span className="preview-kind">{TEMPLATE_NAMES[p.template]}</span></button>
              <div style={{ minWidth: 0 }}>
                {renaming === p.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      void renameProject(p.id, draft)
                      setRenaming(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void renameProject(p.id, draft)
                        setRenaming(null)
                      }
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <h3><button className="title-open" onClick={() => void openProject(p.id)}>{p.name}</button></h3>
                )}
                <div className="m">
                  {p.site ? `${p.site} · ` : ''}
                  {copy.projects.counts(p.pinCount, p.photoCount)}
                  {p.hasPlan ? '' : ` · ${copy.projects.noPlan}`}
                </div>
                <div className="m">{copy.projects.updated(formatWhen(p.updatedAt))}</div>
              </div>
              <div className="cardbtns">
                <button type="button" className="btn primary small" onClick={() => void openProject(p.id)}>
                  {copy.projects.open}
                </button>
                <details className="card-menu"><summary aria-label={`Options for ${p.name}`}>•••</summary><div>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => {
                    setRenaming(p.id)
                    setDraft(p.name)
                  }}
                >
                  {copy.projects.rename}
                </button>
                {isValidation(p.subject) && (
                  <button
                    type="button"
                    className="btn small"
                    title={copy.validation.duplicateHelp}
                    onClick={() => void duplicateProject(p.id)}
                  >
                    {copy.validation.duplicate}
                  </button>
                )}
                <ConfirmButton
                  label={copy.projects.remove}
                  confirmLabel={copy.projects.removeConfirmYes}
                  className="btn danger small"
                  onConfirm={() => void deleteProject(p.id)}
                /></div></details>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="home-foot">{c.sampleNote} Your working app and its saved walks are separate.</p>
    </div>
  )
}
