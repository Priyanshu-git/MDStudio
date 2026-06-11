import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../state/useAppStore'

export function LocalDocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const clearShareLink = useAppStore((state) => state.clearShareLink)
  const openDocument = useAppStore((state) => state.openDocument)

  useEffect(() => {
    clearShareLink()
    if (id) {
      void openDocument(id).then(() => {
        navigate('/editor', { replace: true, state: { editorIntent: 'open-existing' } })
      })
    }
  }, [clearShareLink, id, navigate, openDocument])

  return (
    <main className="shared-state">
      Opening document <code className="code-inline">{id}</code>...
    </main>
  )
}
