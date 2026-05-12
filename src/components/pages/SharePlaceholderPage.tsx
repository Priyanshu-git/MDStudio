import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { MarkdownPreview } from '../../preview/MarkdownPreview'
import { getSharedDocumentById } from '../../storage/shareDocuments'
import { createDocument } from '../../storage/documents'
import type { SharedDocument } from '../../types'

export function SharePlaceholderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

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

  async function handleEditAsNewDocument() {
    if (!document) {
      return
    }

    setActionError(null)
    setIsCreatingDraft(true)
    try {
      await createDocument(document.markdown)
      navigate('/editor')
    } catch {
      setActionError('Unable to create an editable copy right now.')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  return (
    <AppShellLayout
      title="Shared Document"
      subtitle={id ? `Share ID: ${id}` : 'Invalid share ID'}
      actions={
        document ? (
          <button
            type="button"
            className="primary-button"
            onClick={() => void handleEditAsNewDocument()}
            disabled={isCreatingDraft}
          >
            {isCreatingDraft ? 'Creating Draft...' : 'Edit as New Document'}
          </button>
        ) : undefined
      }
    >
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
          {actionError ? <p>{actionError}</p> : null}
          <MarkdownPreview markdown={document.markdown} theme="github-light" />
        </section>
      ) : null}
    </AppShellLayout>
  )
}
