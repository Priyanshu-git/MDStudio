import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShellLayout } from '../layout/AppShellLayout'
import { MarkdownPreview } from '../../preview/MarkdownPreview'
import { getSharedDocumentById } from '../../storage/shareDocuments'
import { createDocument } from '../../storage/documents'
import type { SharedDocument } from '../../types'
import { useAppStore } from '../../state/useAppStore'

export function SharePlaceholderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const linkActiveShare = useAppStore((state) => state.linkActiveShare)
  const setLastLocalSavedMarkdown = useAppStore((state) => state.setLastLocalSavedMarkdown)
  const setActiveDocId = useAppStore((state) => state.setActiveDocId)
  const setDraftMarkdown = useAppStore((state) => state.setDraftMarkdown)
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

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

  async function handleEdit() {
    if (!document) {
      return
    }

    setActionError(null)
    setIsCreatingDraft(true)
    try {
      const localDoc = await createDocument(document.markdown)
      setActiveDocId(localDoc.id)
      setDraftMarkdown(document.markdown)
      linkActiveShare(document.id, document.markdown)
      setLastLocalSavedMarkdown(document.markdown)
      navigate('/editor')
    } catch {
      setActionError('Unable to create an editable copy right now.')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!id || !navigator.clipboard) {
      setCopyState('failed')
      return
    }
    const path = `/share/${id}`
    const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <AppShellLayout
      title="Shared Document"
      actions={
        document ? (
          <div className="topbar-actions">
            <label className="theme-select-label">
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
                <option value="github-light">GitHub Light</option>
                <option value="dracula">Dracula</option>
                <option value="lavender-fields">Lavender Fields</option>
                <option value="blue-eclipse">Blue Eclipse</option>
                <option value="lush-forest">Lush Forest</option>
                <option value="ink-wash">Ink Wash</option>
                <option value="cherry-blossom">Cherry Blossom</option>
              </select>
            </label>
            <button type="button" className="secondary-button" onClick={() => void handleCopyShareUrl()}>
              Copy Link
            </button>
            <button type="button" className="primary-button" onClick={() => void handleEdit()} disabled={isCreatingDraft}>
              {isCreatingDraft ? 'Opening Editor...' : 'Edit'}
            </button>
          </div>
        ) : undefined
      }
    >
      {copyState === 'copied' ? (
        <section className="publish-banner" role="status">
          Link copied
        </section>
      ) : null}
      {copyState === 'failed' ? (
        <section className="publish-banner publish-banner-error" role="status">
          Copy failed
        </section>
      ) : null}
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
          <MarkdownPreview markdown={document.markdown} theme={theme} />
        </section>
      ) : null}
    </AppShellLayout>
  )
}
