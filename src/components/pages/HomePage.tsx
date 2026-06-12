import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  Copy,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  MoreVertical,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { AccountButton, AccountMenu } from '../layout/AccountMenu'
import { getSelectedThemeLabel, themeGroups, type AccountMenuView } from '../layout/accountMenuConfig'
import { getOwnerProfile, listenToAuthState, signInWithGoogle, signOutCurrentUser } from '../../firebase/auth'
import { useRelativeTimeNow } from '../../editor/useRelativeTimeNow'
import { useAppStore } from '../../state/useAppStore'
import { backUpLocalDocument, deleteRecentDocument } from '../../storage/documentSync'
import { getDocumentById, updateDocument } from '../../storage/documents'
import { publishSharedDocument } from '../../storage/shareDocuments'
import { formatShareClipboardText } from '../../sharing/clipboard'
import type { RecentDocumentItem, RecentDocumentsState } from '../../types'

type DashboardAuthStatus = 'loading' | 'signed-in' | 'signed-out'

function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - timestamp)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const month = 30 * day
  const year = 365 * day

  if (diffMs < minute) {
    return 'just now'
  }

  const units = [
    { label: 'year', value: year },
    { label: 'month', value: month },
    { label: 'day', value: day },
    { label: 'hour', value: hour },
    { label: 'min', value: minute },
  ]
  const unit = units.find((item) => diffMs >= item.value) ?? units[units.length - 1]
  const count = Math.floor(diffMs / unit.value)
  const suffix = count === 1 ? unit.label : `${unit.label}s`
  return `${count} ${suffix} ago`
}

function getUserFirstName(user: User): string {
  const source = user.displayName || user.email || ''
  const firstName = source.trim().split(/\s+/)[0]?.replace(/@.*$/, '')
  return firstName || 'there'
}

function getShareUrl(shareId: string): string {
  const path = `/share/${shareId}`
  return typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
}

function useIsPhoneViewport() {
  const [isPhoneViewport, setIsPhoneViewport] = useState(() => {
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
    const handleChange = () => setIsPhoneViewport(mediaQuery.matches)
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isPhoneViewport
}

export function HomePage() {
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const accountRef = useRef<HTMLDivElement | null>(null)
  const newMenuRef = useRef<HTMLDivElement | null>(null)
  const shareDialogCloseRef = useRef<HTMLButtonElement | null>(null)
  const shareReturnFocusRef = useRef<HTMLElement | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState<DashboardAuthStatus>('loading')
  const [isLoaderVisible, setIsLoaderVisible] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const [accountMenuView, setAccountMenuView] = useState<AccountMenuView>('main')
  const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false)
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false)
  const [shareDocument, setShareDocument] = useState<RecentDocumentItem | null>(null)
  const [isDashboardSharing, setIsDashboardSharing] = useState(false)
  const [dashboardShareError, setDashboardShareError] = useState<string | null>(null)
  const [dashboardCopyState, setDashboardCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const recentDocuments = useAppStore((state) => state.recentDocuments)
  const recentDocumentsState = useAppStore((state) => state.recentDocumentsState)
  const refreshRecentDocuments = useAppStore((state) => state.refreshRecentDocuments)
  const clearRecentDocumentsForSignedOut = useAppStore((state) => state.clearRecentDocumentsForSignedOut)
  const createNewDraft = useAppStore((state) => state.createNewDraft)
  const createSampleDraft = useAppStore((state) => state.createSampleDraft)
  const openDocument = useAppStore((state) => state.openDocument)
  const importMarkdownDraft = useAppStore((state) => state.importMarkdownDraft)
  const refreshDocuments = useAppStore((state) => state.refreshDocuments)
  const setMobileTab = useAppStore((state) => state.setMobileTab)
  const setDesktopViewMode = useAppStore((state) => state.setDesktopViewMode)
  const now = useRelativeTimeNow()
  const selectedThemeLabel = getSelectedThemeLabel(theme)
  const isDashboardShareOpen = Boolean(shareDocument)
  const dashboardShareUrl = shareDocument?.sourceShareId ? getShareUrl(shareDocument.sourceShareId) : null

  const filteredDocuments = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) {
      return recentDocuments
    }
    return recentDocuments.filter((doc) => doc.title.toLowerCase().includes(query))
  }, [recentDocuments, search])

  useEffect(() => {
    document.title = 'Dashboard | MD Studio'
  }, [])

  useEffect(() => listenToAuthState((nextUser) => {
    setUser(nextUser)
    setAuthStatus(nextUser ? 'signed-in' : 'signed-out')
    setIsAccountMenuOpen(false)
    setAccountMenuView('main')
    setIsConfirmingSignOut(false)
    if (!nextUser) {
      clearRecentDocumentsForSignedOut()
      return
    }
    void refreshRecentDocuments(nextUser.uid).catch(() => {
      setAuthError('Unable to load backed up documents.')
    })
  }), [clearRecentDocumentsForSignedOut, refreshRecentDocuments])

  useEffect(() => {
    if (authStatus === 'loading') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoaderVisible(false)
    }, 260)
    return () => window.clearTimeout(timeoutId)
  }, [authStatus])

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return
    }

    function closeAccountMenu() {
      setIsAccountMenuOpen(false)
      setAccountMenuView('main')
      setIsConfirmingSignOut(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (accountRef.current?.contains(target)) {
        return
      }
      closeAccountMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeAccountMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAccountMenuOpen])

  useEffect(() => {
    if (!isDashboardShareOpen) {
      return
    }

    shareDialogCloseRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShareDocument(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      shareReturnFocusRef.current?.focus()
    }
  }, [isDashboardShareOpen])

  useEffect(() => {
    if (!isNewMenuOpen) {
      return
    }

    function closeNewMenu() {
      setIsNewMenuOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (newMenuRef.current?.contains(target)) {
        return
      }
      closeNewMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeNewMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isNewMenuOpen])

  async function handleSignIn() {
    setAuthError(null)
    setIsAccountMenuOpen(false)
    setAccountMenuView('main')
    try {
      const signedInUser = await signInWithGoogle()
      setUser(signedInUser)
      await refreshRecentDocuments(signedInUser.uid)
    } catch {
      setAuthError('Unable to sign in with Google.')
    }
  }

  async function handleSignOut() {
    setAuthError(null)
    try {
      await signOutCurrentUser()
      clearRecentDocumentsForSignedOut()
      setIsAccountMenuOpen(false)
      setAccountMenuView('main')
      setIsConfirmingSignOut(false)
    } catch {
      setAuthError('Unable to sign out right now.')
    }
  }

  function toggleAccountMenu() {
    setIsAccountMenuOpen((isOpen) => {
      if (isOpen) {
        setAccountMenuView('main')
      }
      return !isOpen
    })
    setIsConfirmingSignOut(false)
  }

  function handleNewDocument() {
    createNewDraft()
    navigate('/editor')
  }

  function handleSampleDocument() {
    createSampleDraft()
    navigate('/editor', { state: { editorIntent: 'open-existing' } })
  }

  function handleImportClick() {
    setIsNewMenuOpen(false)
    if (importInputRef.current) {
      importInputRef.current.value = ''
      importInputRef.current.click()
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    setImportError(null)
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.md')) {
      setImportError('Only .md files are supported right now.')
      return
    }
    const markdown = await file.text()
    importMarkdownDraft(file.name, markdown)
    navigate('/editor', { state: { editorIntent: 'open-existing' } })
  }

  async function handleOpenDocument(docId: string) {
    await openDocument(docId)
    setDesktopViewMode('split')
    setMobileTab('write')
    navigate('/editor', { state: { editorIntent: 'open-existing' } })
  }

  async function handlePreviewDocument(docId: string) {
    await openDocument(docId)
    setDesktopViewMode('preview')
    setMobileTab('preview')
    navigate('/editor', { state: { editorIntent: 'open-existing' } })
  }

  function handleOpenDashboardShare(item: RecentDocumentItem) {
    shareReturnFocusRef.current = document.activeElement as HTMLElement | null
    setShareDocument(item)
    setDashboardShareError(null)
    setDashboardCopyState('idle')
  }

  async function handleCreateDashboardShare() {
    if (!user || !shareDocument) {
      setDashboardShareError('Sign in with Google to share documents.')
      return
    }

    const localDocumentId = shareDocument.localDocumentId ?? shareDocument.id
    setIsDashboardSharing(true)
    setDashboardShareError(null)
    setDashboardCopyState('idle')

    try {
      const result = await publishSharedDocument({
        title: shareDocument.title,
        markdown: shareDocument.markdown,
        sourceDocId: localDocumentId,
        owner: getOwnerProfile(user),
      })
      await updateDocument(localDocumentId, {
        source: 'firebase',
        sourceShareId: result.shareId,
        sourceOwnerUid: user.uid,
      })
      const localDocument = await getDocumentById(localDocumentId)
      if (!localDocument) {
        throw new Error('Local document unavailable after sharing.')
      }
      await backUpLocalDocument(user.uid, localDocument)
      await refreshDocuments()
      await refreshRecentDocuments(user.uid)
      setShareDocument((current) => current?.id === shareDocument.id
        ? {
            ...current,
            source: 'firebase',
            sourceShareId: result.shareId,
            sourceOwnerUid: user.uid,
            syncStatus: 'backed-up',
          }
        : current)
    } catch {
      setDashboardShareError('Unable to share document. Please try again.')
    } finally {
      setIsDashboardSharing(false)
    }
  }

  async function handleCopyDashboardShareUrl() {
    if (!dashboardShareUrl || !shareDocument || !navigator.clipboard) {
      setDashboardCopyState('failed')
      return
    }

    try {
      await navigator.clipboard.writeText(formatShareClipboardText(shareDocument.title, dashboardShareUrl))
      setDashboardCopyState('copied')
    } catch {
      setDashboardCopyState('failed')
    }
  }

  async function handleDeleteDocument(item: RecentDocumentItem) {
    if (!window.confirm(`Delete "${item.title}" from Documents?`)) {
      return
    }

    setAuthError(null)
    try {
      await deleteRecentDocument(user?.uid ?? null, item)
      await refreshDocuments()
      if (user) {
        await refreshRecentDocuments(user.uid)
      }
    } catch {
      setAuthError('Unable to delete document right now.')
    }
  }

  const signedInUser = authStatus === 'signed-in' ? user : null

  if (authStatus === 'loading') {
    return <MDPulseLoader />
  }

  return (
    <main className="dashboard-shell">
      {isLoaderVisible ? <MDPulseLoader isLeaving /> : null}
      <header className="dashboard-topbar">
        <div className="brand-lockup">
          <span className="app-mark" aria-hidden="true">
            <Edit3 size={18} />
          </span>
          <strong>MD Studio</strong>
        </div>

        {signedInUser ? (
          <label className="dashboard-search">
            <Search size={19} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents..." />
          </label>
        ) : (
          <div className="dashboard-topbar-spacer" />
        )}

        {signedInUser ? (
          <>
            <div className="dashboard-new-menu" ref={newMenuRef}>
              <button type="button" className="primary-button dashboard-new-primary" onClick={handleNewDocument}>
                <Plus size={18} />
                New
              </button>
              <button
                type="button"
                className="primary-button dashboard-new-toggle"
                aria-label="New options"
                aria-haspopup="menu"
                aria-expanded={isNewMenuOpen}
                onClick={() => setIsNewMenuOpen((open) => !open)}
              >
                <ChevronDown size={16} />
              </button>
              {isNewMenuOpen ? (
                <div className="save-export-popover dashboard-new-popover" role="menu" aria-label="New document options">
                  <button type="button" role="menuitem" onClick={handleNewDocument}>New Blank Doc</button>
                  <button type="button" role="menuitem" onClick={handleImportClick}>Import Markdown</button>
                </div>
              ) : null}
            </div>
            <div className="account-menu-anchor" ref={accountRef}>
              <AccountButton user={user} isOpen={isAccountMenuOpen} onClick={toggleAccountMenu} />
              {isAccountMenuOpen ? (
                <AccountMenu
                  user={user}
                  view={accountMenuView}
                  theme={theme}
                  themeGroups={themeGroups}
                  selectedThemeLabel={selectedThemeLabel}
                  isConfirmingSignOut={isConfirmingSignOut}
                  onViewChange={setAccountMenuView}
                  onSelectTheme={(nextTheme) => {
                    setTheme(nextTheme)
                    setIsAccountMenuOpen(false)
                    setAccountMenuView('main')
                  }}
                  onSignIn={() => void handleSignIn()}
                  onRequestSignOut={() => {
                    setAccountMenuView('main')
                    setIsConfirmingSignOut(true)
                  }}
                  onCancelSignOut={() => setIsConfirmingSignOut(false)}
                  onConfirmSignOut={() => void handleSignOut()}
                />
              ) : null}
            </div>
          </>
        ) : (
          <>
            <button type="button" className="primary-button" onClick={() => void handleSignIn()}>
              Get started
            </button>
            <div className="account-menu-anchor" ref={accountRef}>
              <AccountButton user={null} isOpen={isAccountMenuOpen} onClick={toggleAccountMenu} />
              {isAccountMenuOpen ? (
                <AccountMenu
                  user={null}
                  view={accountMenuView}
                  theme={theme}
                  themeGroups={themeGroups}
                  selectedThemeLabel={selectedThemeLabel}
                  isConfirmingSignOut={false}
                  onViewChange={setAccountMenuView}
                  onSelectTheme={(nextTheme) => {
                    setTheme(nextTheme)
                    setIsAccountMenuOpen(false)
                    setAccountMenuView('main')
                  }}
                  onSignIn={() => void handleSignIn()}
                  onRequestSignOut={() => undefined}
                  onCancelSignOut={() => undefined}
                  onConfirmSignOut={() => undefined}
                />
              ) : null}
            </div>
          </>
        )}
      </header>

      {authError ? <div className="studio-banner error">{authError}</div> : null}
      {importError ? <div className="studio-banner error">{importError}</div> : null}
      <input ref={importInputRef} className="visually-hidden" type="file" accept=".md,text/markdown" onChange={handleImportFile} />

      {signedInUser ? (
        <section className="dashboard-content">
          <div className="dashboard-heading">
            <h1>Hi, {getUserFirstName(signedInUser)}</h1>
            <p>Create and continue your documents.</p>
          </div>

          <section className="dashboard-action-grid" aria-label="Document actions">
            <DashboardActionCard
              icon={<FileText size={34} />}
              title="New Blank Doc"
              description="Create a new Markdown document"
              onClick={handleNewDocument}
            />
            <DashboardActionCard
              icon={<Upload size={34} />}
              title="Import Markdown"
              description="Import .md files to get started"
              tone="green"
              onClick={handleImportClick}
            />
          </section>

          <DashboardDocuments
            documents={filteredDocuments}
            state={recentDocumentsState}
            now={now}
            onOpen={(id) => void handleOpenDocument(id)}
            onPreview={(id) => void handlePreviewDocument(id)}
            onShare={handleOpenDashboardShare}
            onDelete={(item) => void handleDeleteDocument(item)}
            onNew={handleNewDocument}
            onImport={handleImportClick}
          />
        </section>
      ) : (
        <section className="dashboard-content signed-out">
          <section className="dashboard-hero">
            <p className="dashboard-welcome">Welcome!</p>
            <h1>Write, preview, and manage Markdown documents.</h1>
            <p>Create clean Markdown documents with live preview, export options, and a distraction-free writing experience.</p>
            <div className="dashboard-hero-actions">
              <button type="button" className="primary-button" onClick={() => void handleSignIn()}>
                Get started
              </button>
              <button type="button" className="secondary-button" onClick={handleNewDocument}>
                Try without signing in
              </button>
            </div>
          </section>

          <section className="dashboard-action-grid signed-out-actions" aria-label="Quick actions">
            <DashboardActionCard
              icon={<FileText size={34} />}
              title="New Blank Doc"
              description="Create a new Markdown document from scratch."
              onClick={handleNewDocument}
            />
            <DashboardActionCard
              icon={<Upload size={34} />}
              title="Import Markdown"
              description="Import an existing .md file into MD Studio."
              onClick={handleImportClick}
            />
            <DashboardActionCard
              icon={<FolderOpen size={34} />}
              title="View sample document"
              description="Explore a sample Markdown document in the editor."
              onClick={handleSampleDocument}
            />
          </section>

          <section className="dashboard-documents-card signed-out-empty">
            <h2>Recent Documents</h2>
            <div className="dashboard-empty-state">
              <div className="dashboard-empty-illustration" aria-hidden="true">
                <FolderOpen size={76} />
              </div>
              <h3>Sign in to view your saved documents.</h3>
              <p>Your documents will appear here once you create or import them.</p>
              <button type="button" className="secondary-button" onClick={() => void handleSignIn()}>
                Sign in
              </button>
            </div>
          </section>
        </section>
      )}

      {shareDocument ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShareDocument(null)}>
          <section
            className="dialog-sheet dashboard-share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-share-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dashboard-share-heading">
              <div>
                <h2 id="dashboard-share-title">Share document</h2>
                <p>{shareDocument.title}</p>
              </div>
              <button
                ref={shareDialogCloseRef}
                type="button"
                className="icon-button"
                aria-label="Close share dialog"
                title="Close"
                onClick={() => setShareDocument(null)}
              >
                <X size={18} />
              </button>
            </div>
            <p>Anyone with this link can view this document. Only the creator can edit the original.</p>
            {dashboardShareError ? <p className="error-text">{dashboardShareError}</p> : null}
            {dashboardShareUrl ? (
              <div className="share-link-row">
                <input value={dashboardShareUrl} readOnly aria-label="Read-only share link" />
                <button type="button" className="secondary-button" onClick={() => void handleCopyDashboardShareUrl()}>
                  <Copy size={16} />
                  Copy Link
                </button>
              </div>
            ) : (
              <div className="dialog-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleCreateDashboardShare()}
                  disabled={isDashboardSharing}
                >
                  <Share2 size={16} />
                  {isDashboardSharing ? 'Sharing...' : 'Create Link'}
                </button>
              </div>
            )}
            {dashboardCopyState === 'copied' ? <p className="success-text">Link copied</p> : null}
            {dashboardCopyState === 'failed' ? <p className="error-text">Copy failed</p> : null}
          </section>
        </div>
      ) : null}
    </main>
  )
}

function MDPulseLoader({ isLeaving = false }: { isLeaving?: boolean }) {
  return (
    <div className={isLeaving ? 'md-pulse-loader leaving' : 'md-pulse-loader'} role="status" aria-label="Loading dashboard">
      <div className="md-pulse-loader-mark" aria-hidden="true">
        <span>MD</span>
      </div>
    </div>
  )
}

function DashboardActionCard({
  icon,
  title,
  description,
  tone = 'accent',
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  tone?: 'accent' | 'green'
  onClick: () => void
}) {
  return (
    <button type="button" className="dashboard-action-card" onClick={onClick}>
      <span className={`dashboard-action-icon dashboard-action-icon-${tone}`}>{icon}</span>
      <span className="dashboard-action-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="dashboard-action-arrow" aria-hidden="true">
        <ArrowRight size={22} />
      </span>
    </button>
  )
}

function DashboardDocuments({
  documents,
  state,
  now,
  onOpen,
  onPreview,
  onShare,
  onDelete,
  onNew,
  onImport,
}: {
  documents: RecentDocumentItem[]
  state: RecentDocumentsState
  now: number
  onOpen: (id: string) => void
  onPreview: (id: string) => void
  onShare: (item: RecentDocumentItem) => void
  onDelete: (item: RecentDocumentItem) => void
  onNew: () => void
  onImport: () => void
}) {
  const isPhoneViewport = useIsPhoneViewport()
  const mobileMenuRef = useRef<HTMLDivElement | null>(null)
  const mobileMenuTriggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const [openMobileMenuId, setOpenMobileMenuId] = useState<string | null>(null)

  useEffect(() => {
    if (!openMobileMenuId) {
      return
    }

    const mobileMenuId = openMobileMenuId
    mobileMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()

    function closeMobileMenu(restoreFocus: boolean) {
      const trigger = mobileMenuTriggerRefs.current.get(mobileMenuId)
      setOpenMobileMenuId(null)
      if (restoreFocus) {
        trigger?.focus()
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const element = event.target as HTMLElement | null
      if (element?.closest('.dashboard-mobile-row-menu')) {
        return
      }
      closeMobileMenu(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMobileMenu(true)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openMobileMenuId])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const handleChange = () => {
      if (!mediaQuery.matches) {
        setOpenMobileMenuId(null)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  function runMobileAction(docId: string, action: () => void) {
    const trigger = mobileMenuTriggerRefs.current.get(docId)
    setOpenMobileMenuId(null)
    trigger?.focus()
    action()
  }

  return (
    <section className="dashboard-documents-card">
      <h2>Recent Documents</h2>
      {state === 'loading' ? <p className="dashboard-documents-state">Loading documents...</p> : null}
      {state === 'error' ? <p className="dashboard-documents-state error-text">Unable to load cloud documents. Showing local documents when available.</p> : null}
      {state !== 'loading' && documents.length === 0 ? (
        <div className="dashboard-empty-state">
          <h3>No documents yet.</h3>
          <p>Create a new document or import a Markdown file to start your library.</p>
          <div className="dashboard-empty-actions">
            <button type="button" className="primary-button" onClick={onNew}>
              <Plus size={16} />
              New Blank Doc
            </button>
            <button type="button" className="secondary-button" onClick={onImport}>
              <Upload size={16} />
              Import Markdown
            </button>
          </div>
        </div>
      ) : null}
      {documents.length ? (
        <div className="dashboard-document-list">
          {documents.map((doc) => {
            const updatedAt = doc.contentUpdatedAt ?? doc.updatedAt
            return (
              <div key={doc.id} className="dashboard-document-row">
                <button type="button" className="dashboard-document-main" onClick={() => onOpen(doc.id)}>
                  <span className="dashboard-document-icon" aria-hidden="true">
                    <FileText size={22} />
                  </span>
                  <span className="dashboard-document-copy">
                    <strong>{doc.title}</strong>
                    <small className="dashboard-document-time">{formatRelativeTime(updatedAt, now)}</small>
                  </span>
                </button>
                {isPhoneViewport ? (
                  <div className="dashboard-mobile-row-menu">
                    <button
                      ref={(node) => {
                        if (node) {
                          mobileMenuTriggerRefs.current.set(doc.id, node)
                        } else {
                          mobileMenuTriggerRefs.current.delete(doc.id)
                        }
                      }}
                      type="button"
                      className="secondary-button dashboard-mobile-row-trigger"
                      aria-label={`${doc.title} actions`}
                      aria-haspopup="menu"
                      aria-expanded={openMobileMenuId === doc.id}
                      title={`${doc.title} actions`}
                      onClick={() => setOpenMobileMenuId((openId) => openId === doc.id ? null : doc.id)}
                    >
                      <MoreVertical size={18} />
                    </button>
                    {openMobileMenuId === doc.id ? (
                      <div
                        ref={mobileMenuRef}
                        className="dashboard-mobile-row-popover"
                        role="menu"
                        aria-label={`${doc.title} actions`}
                      >
                        <button type="button" role="menuitem" onClick={() => runMobileAction(doc.id, () => onPreview(doc.id))}>
                          <Eye size={16} />
                          Preview
                        </button>
                        <button type="button" role="menuitem" onClick={() => runMobileAction(doc.id, () => onShare(doc))}>
                          <Share2 size={16} />
                          Share
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="dashboard-mobile-row-delete"
                          onClick={() => runMobileAction(doc.id, () => onDelete(doc))}
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="dashboard-document-actions" aria-label={`${doc.title} actions`}>
                    <button
                      type="button"
                      className="secondary-button dashboard-document-action"
                      aria-label={`Preview ${doc.title}`}
                      title={`Preview ${doc.title}`}
                      onClick={() => onPreview(doc.id)}
                    >
                      <Eye size={16} />
                      <span className="dashboard-document-action-label">Preview</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button dashboard-document-action"
                      aria-label={`Share ${doc.title}`}
                      title={`Share ${doc.title}`}
                      onClick={() => onShare(doc)}
                    >
                      <Share2 size={16} />
                      <span className="dashboard-document-action-label">Share</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button dashboard-document-action dashboard-document-action-danger"
                      aria-label={`Delete ${doc.title}`}
                      title={`Delete ${doc.title}`}
                      onClick={() => onDelete(doc)}
                    >
                      <Trash2 size={16} />
                      <span className="dashboard-document-action-label">Delete</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
