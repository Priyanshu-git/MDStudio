import { useParams } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'

export function SharePlaceholderPage() {
  const { id } = useParams()

  return (
    <AppShellLayout title="Share Route" subtitle="Phase 2 Placeholder">
      <section className="panel">
        <div className="placeholder-surface">
          <p>
            Share route is intentionally not implemented in MVP. Requested share
            ID: <code className="code-inline">{id}</code>
          </p>
        </div>
      </section>
    </AppShellLayout>
  )
}
