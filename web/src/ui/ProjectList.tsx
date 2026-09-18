import { useState } from 'react'
import { useApp } from '../lib/state'
import { copy } from '../lib/copy'
import { TEMPLATE_NAMES } from '../lib/catalog'
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
  const fail = useApp((s) => s.fail)

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
      <header>
        <h1>{copy.app.name}</h1>
      </header>
      <p className="tagline">{copy.app.tagline}</p>

      <div className="homeactions">
        <button type="button" className="btn primary" onClick={() => void createProject()}>
          {projects.length ? copy.projects.create : copy.projects.createFirst}
        </button>
        <button type="button" className="btn" onClick={picker.open}>
          {copy.projects.importFile}
        </button>
        {picker.input}
      </div>

      {!projects.length ? (
        <div className="empty">{copy.projects.empty}</div>
      ) : (
        <div className="cards">
          {projects.map((p) => (
            <div className="card" key={p.id}>
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
                  <h3>{p.name}</h3>
                )}
                <div className="m">
                  {p.site ? `${p.site} · ` : ''}
                  {TEMPLATE_NAMES[p.template]} · {copy.projects.counts(p.pinCount, p.photoCount)}
                  {p.hasPlan ? '' : ` · ${copy.projects.noPlan}`}
                </div>
                <div className="m">{copy.projects.updated(formatWhen(p.updatedAt))}</div>
              </div>
              <div className="cardbtns">
                <button type="button" className="btn primary small" onClick={() => void openProject(p.id)}>
                  {copy.projects.open}
                </button>
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
                <ConfirmButton
                  label={copy.projects.remove}
                  confirmLabel={copy.projects.removeConfirmYes}
                  className="btn danger small"
                  onConfirm={() => void deleteProject(p.id)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
