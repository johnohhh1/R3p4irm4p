import { useApp } from '../lib/state'
import { CLOSED_STATUS, DONE_COLOR, issueColor, issueLabel, statusesFor, statusLabel } from '../lib/catalog'
import { copy } from '../lib/copy'
import { walkOrder } from '../lib/util'

export function PinList() {
  const project = useApp((s) => s.project)
  const filter = useApp((s) => s.listFilter)
  const setFilter = useApp((s) => s.setListFilter)
  const select = useApp((s) => s.select)

  if (!project) return null

  const statuses = statusesFor(project.subject)
  // The list reads in walk order, matching the report's page order.
  const ordered = walkOrder(project.pins)
  const shown = filter === 'all' ? ordered : ordered.filter((p) => p.status === filter)

  return (
    <div className="pane">
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
      {!!project.pins.length && !shown.length && <div className="empty">{copy.pins.emptyFiltered}</div>}

      <ol className="plist">
        {shown.map((pin, i) => {
          const closed = pin.status === CLOSED_STATUS
          return (
            <li key={pin.id}>
              <button type="button" className="prow" onClick={() => select(pin.id)}>
                <span
                  className="badge"
                  style={{ background: closed ? DONE_COLOR : issueColor(project.issueSet, pin.issue) }}
                >
                  {pin.no}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="t">{pin.area || copy.pins.spotNo(pin.no)}</span>
                  <span className="m">
                    {issueLabel(project.issueSet, pin.issue)} · {pin.photoIds.length}
                    {pin.photoIds.length === 1 ? ' photo' : ' photos'} · stop {i + 1}
                  </span>
                </span>
                <span className={closed ? 'st closed' : 'st'}>{statusLabel(project.subject, pin.status)}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
