import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { MarkdownPreview } from '../../preview/MarkdownPreview'
import { getSharedDocumentById } from '../../storage/shareDocuments'
import type { SharedDocument } from '../../types'

export function SharePlaceholderPage() {
  const { id } = useParams()
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true

    async function loadSharedDocument() {
      if (!id) {
        setIsLoading(false)
        setDocument(null)
        return
      }
      setIsLoading(true)
      setError(null)

      try {
        const sharedDocument = await getSharedDocumentById(id)
        if (isCurrent) {
          setDocument(sharedDocument)
        }
      } catch {
        if (isCurrent) {
          setError('Unable to load shared document.')
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false)
        }
      }
    }

    void loadSharedDocument()
    return () => {
      isCurrent = false
    }
  }, [id])

  return (
    <AppShellLayout title="Shared Document" subtitle={id ? `Share ID: ${id}` : 'Invalid share ID'}>
      {isLoading ? (
        <section className="panel">
          <div className="placeholder-surface">Loading shared document...</div>
        </section>
      ) : null}
      {!isLoading && error ? (
        <section className="panel">
          <div className="placeholder-surface">{error}</div>
        </section>
      ) : null}
      {!isLoading && !error && !document ? (
        <section className="panel">
          <div className="placeholder-surface">Shared document not found.</div>
        </section>
      ) : null}
      {!isLoading && !error && document ? (
        <section className="docs-mode-panel">
          <MarkdownPreview markdown={document.markdown} theme="github-light" />
        </section>
      ) : null}
    </AppShellLayout>
  )
}
