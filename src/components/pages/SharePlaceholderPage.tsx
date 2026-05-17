import { useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Edit3, LogIn, Share2 } from 'lucide-react'
import { MarkdownPreview } from '../../preview/MarkdownPreview'
import { getSharedDocumentById } from '../../storage/shareDocuments'
import { createDocument, getDocumentById, updateDocument } from '../../storage/documents'
import type { Document, SharedDocument } from '../../types'
import { useAppStore } from '../../state/useAppStore'
import { listenToAuthState, signInWithGoogle } from '../../firebase/auth'

export function SharePlaceholderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const setActiveDocId = useAppStore((state) => state.setActiveDocId)
  const setDraftTitle = useAppStore((state) => state.setDraftTitle)
  const setDraftMarkdown = useAppStore((state) => state.setDraftMarkdown)
  const linkActiveShare = useAppStore((state) => state.linkActiveShare)
  const [user, setUser] = useState<User | null>(null)
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [isOpeningOriginal, setIsOpeningOriginal] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const shareUrl = useMemo(() => {
    if (!id) {
      return ''
    }
    const path = `/share/${id}`
    return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  }, [id])

  const isOwner = Boolean(user && document?.ownerUid && user.uid === document.ownerUid)

  useEffect(() => listenToAuthState(setUser), [])

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

  async function handleMakeCopy() {
    if (!document) {
      return
    }

    setActionError(null)
    if (!user) {
      try {
        await signInWithGoogle()
      } catch {
        setActionError('Sign in with Google to make an editable copy.')
        return
      }
    }

    setIsCreatingDraft(true)
    try {
      const localDoc = await createDocument({
        title: `Copy of ${document.title}`,
        markdown: document.markdown,
      })
      setActiveDocId(localDoc.id)
      setDraftTitle(localDoc.title)
      setDraftMarkdown(localDoc.markdown)
      navigate('/editor')
    } catch {
      setActionError('Unable to create an editable copy right now.')
    } finally {
      setIsCreatingDraft(false)
    }
  }

  async function handleEditOriginal() {
    if (!document || !id || !isOwner) {
      return
    }

    setActionError(null)
    setIsOpeningOriginal(true)
    try {
      const existingLocalDoc = document.sourceDocId ? await getDocumentById(document.sourceDocId) : undefined
      let localDoc: Document
      if (existingLocalDoc) {
        await updateDocument(existingLocalDoc.id, {
          title: document.title,
          markdown: document.markdown,
          source: 'firebase',
          sourceShareId: id,
          sourceOwnerUid: document.ownerUid,
        })
        localDoc = (await getDocumentById(existingLocalDoc.id))!
      } else {
        localDoc = await createDocument({
          title: document.title,
          markdown: document.markdown,
          source: 'firebase',
          sourceShareId: id,
          sourceOwnerUid: document.ownerUid,
        })
      }

      setActiveDocId(localDoc.id)
      setDraftTitle(localDoc.title)
      setDraftMarkdown(localDoc.markdown)
      linkActiveShare(id, localDoc.title, localDoc.markdown)
      navigate('/editor')
    } catch {
      setActionError('Unable to open the original document right now.')
    } finally {
      setIsOpeningOriginal(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!navigator.clipboard) {
      setCopyState('failed')
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <main className="shared-shell">
      <header className="shared-topbar">
        <strong>{document?.title ?? 'Shared Document'}</strong>
        <select className="theme-select" value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
          <option value="github-light">GitHub Light</option>
          <option value="github-dark">GitHub Dark</option>
          <option value="dracula">Dracula</option>
        </select>
      </header>

      {isLoading ? <section className="shared-state">Loading shared document...</section> : null}
      {!isLoading && error ? <section className="shared-state">{error}</section> : null}
      {!isLoading && !error && !document ? <section className="shared-state">Shared document not found.</section> : null}

      {!isLoading && !error && document ? (
        <>
          <section className="shared-notice">
            <Share2 size={18} />
            <span>This is a shared document. You can view it or make your own editable copy.</span>
          </section>
          <section className="shared-preview">
            {actionError ? <p className="error-text">{actionError}</p> : null}
            <MarkdownPreview markdown={document.markdown} theme={theme} />
          </section>
          <footer className="shared-actions">
            <button type="button" className="secondary-button" onClick={() => void handleCopyShareUrl()}>
              <Copy size={16} />
              Copy Link
            </button>
            {isOwner ? (
              <button type="button" className="primary-button" onClick={() => void handleEditOriginal()} disabled={isOpeningOriginal}>
                <Edit3 size={16} />
                {isOpeningOriginal ? 'Opening...' : 'Edit Original'}
              </button>
            ) : (
              <button type="button" className="primary-button" onClick={() => void handleMakeCopy()} disabled={isCreatingDraft}>
                {user ? <Copy size={16} /> : <LogIn size={16} />}
                {isCreatingDraft ? 'Making Copy...' : 'Make a Copy'}
              </button>
            )}
          </footer>
          {copyState === 'copied' ? <div className="studio-banner">Link copied</div> : null}
          {copyState === 'failed' ? <div className="studio-banner error">Copy failed</div> : null}
        </>
      ) : null}
    </main>
  )
}
