import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { useAppStore } from '../../state/useAppStore'
import { getDocumentById } from '../../storage/documents'

export function LocalDocumentPage() {
  const { id } = useParams()
  const setActiveDocId = useAppStore((state) => state.setActiveDocId)
  const setDraftMarkdown = useAppStore((state) => state.setDraftMarkdown)
  const clearShareLink = useAppStore((state) => state.clearShareLink)
  const setLastLocalSavedMarkdown = useAppStore((state) => state.setLastLocalSavedMarkdown)

  useEffect(() => {
    clearShareLink()
    setActiveDocId(id ?? null)
    if (id) {
      void getDocumentById(id).then((doc) => {
        if (doc) {
          setDraftMarkdown(doc.markdown)
          setLastLocalSavedMarkdown(doc.markdown)
        }
      })
    }
    return () => setActiveDocId(null)
  }, [id, setActiveDocId, setDraftMarkdown])

  return (
    <AppShellLayout title="Local Document Route">
      <section className="panel">
        <div className="placeholder-surface">
          <p>
            Route scaffold active for local document ID:{' '}
            <code className="code-inline">{id}</code>
          </p>
        </div>
      </section>
    </AppShellLayout>
  )
}
