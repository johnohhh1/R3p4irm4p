import { useApp } from '../lib/state'
import { isValidation } from '../lib/catalog'
import { labCopy as c } from '../lib/labCopy'
import { walkOrder } from '../lib/util'

export function WalkOverview() {
  const project = useApp(s => s.project)
  const select = useApp(s => s.select)
  if (!project) return null
  const total = project.pins.length
  const validation = isValidation(project.subject)
  const covered = project.pins.filter(p => p.photoIds.length > 0).length
  const checked = project.pins.filter(p => ['verified', 'missing', 'wrong'].includes(p.status)).length
  const progress = validation ? checked : covered
  const next = walkOrder(project.pins).find(p => validation ? !['verified', 'missing', 'wrong'].includes(p.status) : p.photoIds.length === 0)
  return <section className="walk-overview" aria-label={c.overview}>
    <div className="walk-meter" aria-hidden="true"><i style={{ width: `${total ? progress / total * 100 : 0}%` }} /></div>
    <div className="walk-overview-copy">
      <strong>{!total ? c.addFirst : validation ? c.checked(checked, total) : c.covered(covered, total)}</strong>
      <span>{c.counts(total, project.photos.length)}</span>
    </div>
    {next ? <button className="btn small" onClick={() => select(next.id)}>{validation ? c.remaining : c.missingPhotos(total - covered)}</button>
      : total > 0 && <span className="walk-complete">✓ {validation ? c.allChecked : c.photosReady}</span>}
  </section>
}
