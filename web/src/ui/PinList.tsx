import { useState } from 'react'
import { labCopy as c } from '../lib/labCopy'
import { useApp } from '../lib/state'
import {
  CLOSED_STATUS,
  isValidation,
  issueLabel,
  pinColor,
  RESULT_COLORS,
  statusesFor,
  statusLabel,
} from '../lib/catalog'
import { copy } from '../lib/copy'
import { walkOrder } from '../lib/util'

export function PinList() {
  const [search, setSearch] = useState('')
  const project = useApp((s) => s.project)
  const filter = useApp((s) => s.listFilter)
  const setFilter = useApp((s) => s.setListFilter)
  const select = useApp((s) => s.select)

  if (!project) return null

  const statuses = statusesFor(project.subject)
  // The list reads in walk order, matching the report's page order.
  const ordered = walkOrder(project.pins)
  const shown = ordered.filter(p => (filter === 'all' || p.status === filter) && `${p.no} ${p.area} ${issueLabel(project.issueSet, p.issue)} ${p.note}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="pane"><input className="list-search" type="search" aria-label={c.search} placeholder={c.search} value={search} onChange={e => setSearch(e.target.value)} />
      {project.pins.length > 0 && (
        <div className="listtools">
          <button
            type="button"
            className={filter === 'all' ? 'btn small armed' : 'btn small'}
            onClick={() => setFilter('all')}
          >
            {copy.pins.all} {project.pins.length}
          </button>
          {statuses.map((status) => {
            const n = project.pins.filter((p) => p.status === status.id).length
            if (!n) return null
            return (
              <button
                key={status.id}
                type="button"
                className={filter === status.id ? 'btn small armed' : 'btn small'}
                onClick={() => setFilter(status.id)}
              >
                {status.label} {n}
              </button>
            )
          })}
        </div>
      )}

      {!project.pins.length && <div className="empty">{copy.pins.empty}</div>}
      {!!project.pins.length && !shown.length && <div className="empty">{c.noSpots}</div>}

      <ol className="plist">
        {shown.map((pin) => {
          const closed = pin.status === CLOSED_STATUS
          return (
            <li key={pin.id}>
              <button type="button" className="prow" onClick={() => select(pin.id)}>
                <span
                  className="badge"
                  style={{ background: pinColor(project.subject, project.issueSet, pin) }}
                >
                  {pin.no}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="t">{pin.area || copy.pins.spotNo(pin.no)}</span>
                  <span className="m">
                    {issueLabel(project.issueSet, pin.issue)} · {pin.photoIds.length}
                    {pin.photoIds.length === 1 ? ' photo' : ' photos'} · stop {ordered.findIndex(p => p.id === pin.id) + 1}
                  </span>
                </span>
                <span
                  className={closed ? 'st closed' : 'st'}
                  style={
                    isValidation(project.subject)
                      ? { color: RESULT_COLORS[pin.status], borderColor: 'currentColor' }
                      : undefined
                  }
                >
                  {statusLabel(project.subject, pin.status)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
