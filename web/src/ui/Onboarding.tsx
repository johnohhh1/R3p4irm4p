import { useState } from 'react'
import { useApp } from '../lib/state'
import { isValidation, ISSUE_SETS, SUBJECT_ISSUE_SETS, templatesFor } from '../lib/catalog'
import { copy } from '../lib/copy'
import type { IssueSetId, SubjectId, TemplateId } from '../lib/types'

/**
 * The chip picker. Three questions, every one skippable, nothing locked in.
 * PRD §4 — the answers set defaults, they never fork the app.
 */
export function Onboarding() {
  const project = useApp((s) => s.project)
  const finish = useApp((s) => s.finishOnboarding)

  const [step, setStep] = useState(0)
  const [subject, setSubject] = useState<SubjectId>(project?.subject ?? 'restaurant')
  const [sets, setSets] = useState<IssueSetId[]>(project?.issueSet ?? SUBJECT_ISSUE_SETS.restaurant)
  const [template, setTemplate] = useState<TemplateId>(project?.template ?? 'repair-request')

  const done = () => finish(subject, sets, template)

  const pickSubject = (id: SubjectId) => {
    // Validation walks have their own statuses and a single report, so the
    // problem-family and audience questions do not apply.
    if (isValidation(id)) {
      finish(id, [], templatesFor(id)[0])
      return
    }
    setSubject(id)
    // Q1 seeds Q2 rather than deciding it — the user still sees and edits the ticks.
    setSets(SUBJECT_ISSUE_SETS[id])
    setStep(1)
  }

  const toggleSet = (id: IssueSetId) =>
    setSets((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  return (
    <div className="scrim">
      <div className="modal" role="dialog" aria-modal="true" aria-label={copy.onboarding.q1.title}>
        <p className="stepline">{copy.onboarding.stepOf(step + 1, 3)}</p>

        {step === 0 && (
          <>
            <h2>{copy.onboarding.q1.title}</h2>
            <p className="help">{copy.onboarding.q1.help}</p>
            <div className="chips">
              {copy.onboarding.q1.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="chip"
                  aria-pressed={subject === option.id}
                  onClick={() => pickSubject(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2>{copy.onboarding.q2.title}</h2>
            <p className="help">{copy.onboarding.q2.help}</p>
            <div className="chips">
              {ISSUE_SETS.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className="chip"
                  aria-pressed={sets.includes(set.id)}
                  onClick={() => toggleSet(set.id)}
                >
                  {set.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>{copy.onboarding.q3.title}</h2>
            <p className="help">{copy.onboarding.q3.help}</p>
            <div className="chips">
              {copy.onboarding.q3.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="chip"
                  aria-pressed={template === option.id}
                  onClick={() => {
                    setTemplate(option.id)
                    finish(subject, sets, option.id)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mfoot">
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              {copy.onboarding.back}
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={done}>
            {copy.onboarding.skip}
          </button>
          {step === 1 && (
            <button type="button" className="btn primary" onClick={() => setStep(2)}>
              {copy.onboarding.next}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
