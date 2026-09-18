import { useEffect } from 'react'
import { useApp } from './lib/state'
import { ProjectList } from './ui/ProjectList'
import { Workspace } from './ui/Workspace'

export function App() {
  const init = useApp((s) => s.init)
  const route = useApp((s) => s.route)
  const toast = useApp((s) => s.toast)
  const error = useApp((s) => s.error)
  const say = useApp((s) => s.say)
  const fail = useApp((s) => s.fail)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => say(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast, say])

  return (
    <>
      {error && (
        <div className="banner bad">
          <span className="grow">{error}</span>
          <button type="button" className="btn small" onClick={() => fail(null)}>
            Dismiss
          </button>
        </div>
      )}
      {route.name === 'projects' ? <ProjectList /> : <Workspace />}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
