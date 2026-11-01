import { useApp } from '../lib/state'
import { WINTER_SOURCE, WINTER_STEPS, WINTER_STATUSES, winterCounts } from '../lib/winter'
import type { WinterResult } from '../lib/types'

export function WinterChecklist() {
  const project = useApp(s => s.project)!
  const update = useApp(s => s.setWinterResult)
  const counts = winterCounts(project.winterPreparation)
  return <main className="winter-work">
    <div className="winter-intro">
      <h2>Prepare for winter</h2>
      <p>Complete the seasonal preparation before cold weather arrives. Opening and closing extreme-weather procedures are not part of this checklist.</p>
      <p aria-live="polite"><strong>{counts.done} of 12 complete</strong> · {counts.attention} need attention · {counts.pending} not started · {counts.na} not applicable</p>
      <p className="meta">Ice-melt and snow-clearing items confirm seasonal readiness; follow those standards throughout winter. Use Not applicable only where appropriate and explain why in the notes.</p>
    </div>
    {['Building & exterior', 'Seasonal readiness', 'Mechanical room'].map(group => <section key={group} className="winter-section">
      <h3>{group}</h3>
      {WINTER_STEPS.filter(step => step.group === group).map(step => {
        const result = project.winterPreparation?.[step.id] ?? { status: 'pending', note: '' }
        return <article key={step.id} className="winter-step">
          <h4>{WINTER_STEPS.indexOf(step) + 1}. {step.title}</h4><p>{step.text}</p>
          <div className="field"><label htmlFor={`winter-${step.id}`}>Status</label>
            <select id={`winter-${step.id}`} value={result.status} onChange={e => update(step.id, { status: e.target.value as WinterResult['status'] })}>
              {Object.entries(WINTER_STATUSES).map(([id,label]) => <option value={id} key={id}>{label}</option>)}
            </select>
          </div>
          <div className="field"><label htmlFor={`note-${step.id}`}>Notes / follow-up</label>
            <textarea id={`note-${step.id}`} value={result.note} placeholder="Record findings, vendor arrangements, or why this does not apply." onChange={e => update(step.id, { note: e.target.value })}/>
          </div>
        </article>
      })}
    </section>)}
    <p className="meta">Source: {WINTER_SOURCE}. All 12 preparation items included.</p>
  </main>
}
