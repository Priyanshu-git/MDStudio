import { useEffect, useMemo, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Edit3, LogIn, MoreVertical, Share2 } from 'lucide-react'
import { MarkdownPreview } from '../../preview/MarkdownPreview'
import { getSharedDocumentById } from '../../storage/shareDocuments'
import { createDocument, getDocumentById, updateDocument } from '../../storage/documents'
import type { Document, SharedDocument, ThemeName } from '../../types'
import { useAppStore } from '../../state/useAppStore'
import { listenToAuthState, signInWithGoogle } from '../../firebase/auth'
import { useAutoHideAppbar } from '../../hooks/useAutoHideAppbar'

const themeGroups = [
  {
    label: 'Light',
    options: [
      { value: 'github-light', label: 'GitHub Light' },
      { value: 'pastel-mint', label: 'Lavender Frost' },
      { value: 'minimal-ivory', label: 'Minimal Ivory' },
    ],
  },
  {
    label: 'Dark',
    options: [
      { value: 'github-dark', label: 'GitHub Dark' },
      { value: 'one-dark', label: 'One Dark' },
      { value: 'blue-eclipse', label: 'Blue Eclipse' },
    ],
  },
] as const

function formatPageTitle(title?: string | null): string {
  const normalizedTitle = title?.trim()
  return normalizedTitle ? `${normalizedTitle} | MD Studio` : 'MD Studio'
}

function useIsCompactSharedTopbar() {
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(max-width: 767px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = () => setIsCompact(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isCompact
}

export function SharePlaceholderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDivElement | null>(null)
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
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false)
  const isCompactTopbar = useIsCompactSharedTopbar()
  const isAppbarHidden = useAutoHideAppbar()

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
    if (!isShareMenuOpen) {
      return
    }

    function closeMenu() {
      setIsShareMenuOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) {
        return
      }
      closeMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu()
      }
    }

    window.document.addEventListener('pointerdown', handlePointerDown)
    window.document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.document.removeEventListener('pointerdown', handlePointerDown)
      window.document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isShareMenuOpen])

  useEffect(() => {
    if (!isCompactTopbar) {
      setIsShareMenuOpen(false)
    }
  }, [isCompactTopbar])

  useEffect(() => {
    window.document.title = formatPageTitle(document?.title)
  }, [document?.title])

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
    setIsShareMenuOpen(false)
    try {
      const localDoc = await createDocument({
        title: `Copy of ${document.title}`,
        markdown: document.markdown,
      })
      setActiveDocId(localDoc.id)
      setDraftTitle(localDoc.title)
      setDraftMarkdown(localDoc.markdown)
      navigate('/editor', { state: { editorIntent: 'open-existing' } })
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
    setIsShareMenuOpen(false)
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
      navigate('/editor', { state: { editorIntent: 'open-existing' } })
    } catch {
      setActionError('Unable to open the original document right now.')
    } finally {
      setIsOpeningOriginal(false)
    }
  }

  async function handleCopyShareUrl() {
    setIsShareMenuOpen(false)
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
      <header className={isAppbarHidden && !isShareMenuOpen ? 'shared-topbar appbar-hidden' : 'shared-topbar'}>
        <div className="shared-title-group">
          <button type="button" className="app-mark app-mark-button" aria-label="Dashboard" title="Dashboard" onClick={() => navigate('/')}>
            <Edit3 size={18} />
          </button>
          <strong>{document?.title ?? 'Shared Document'}</strong>
        </div>
        {isCompactTopbar ? (
          <div className="shared-menu-anchor" ref={menuRef}>
            <button
              type="button"
              className="icon-button"
              aria-label="Shared document menu"
              aria-haspopup="menu"
              aria-expanded={isShareMenuOpen}
              onClick={() => setIsShareMenuOpen((isOpen) => !isOpen)}
            >
              <MoreVertical size={20} />
            </button>
            {isShareMenuOpen ? (
              <section className="shared-menu-popover" role="menu" aria-label="Shared document actions">
                <select
                  className="shared-theme-select"
                  aria-label="Theme"
                  value={theme}
                  onChange={(event) => {
                    setTheme(event.target.value as ThemeName)
                    setIsShareMenuOpen(false)
                  }}
                >
                  {themeGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="shared-menu-divider" />
                <button type="button" className="shared-menu-action" role="menuitem" onClick={() => void handleCopyShareUrl()}>
                  <Copy size={16} />
                  Copy Link
                </button>
                {isOwner ? (
                  <button
                    type="button"
                    className="shared-menu-action primary"
                    role="menuitem"
                    onClick={() => void handleEditOriginal()}
                    disabled={isOpeningOriginal}
                  >
                    <Edit3 size={16} />
                    {isOpeningOriginal ? 'Opening...' : 'Edit Original'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="shared-menu-action primary"
                    role="menuitem"
                    onClick={() => void handleMakeCopy()}
                    disabled={isCreatingDraft}
                  >
                    {user ? <Copy size={16} /> : <LogIn size={16} />}
                    {isCreatingDraft ? 'Making Copy...' : 'Make a Copy'}
                  </button>
                )}
              </section>
            ) : null}
          </div>
        ) : (
          <div className="shared-topbar-actions">
            <select
              className="theme-select"
              aria-label="Theme"
              value={theme}
              onChange={(event) => setTheme(event.target.value as ThemeName)}
            >
              {themeGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
          </div>
        )}
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
          {copyState === 'copied' ? <div className="studio-banner">Link copied</div> : null}
          {copyState === 'failed' ? <div className="studio-banner error">Copy failed</div> : null}
        </>
      ) : null}
    </main>
  )
}
