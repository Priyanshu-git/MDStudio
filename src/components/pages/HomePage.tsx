import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  Edit3,
  FileText,
  FolderOpen,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { AccountButton, AccountMenu } from '../layout/AccountMenu'
import { getSelectedThemeLabel, themeGroups, type AccountMenuView } from '../layout/accountMenuConfig'
import { listenToAuthState, signInWithGoogle, signOutCurrentUser } from '../../firebase/auth'
import { useRelativeTimeNow } from '../../editor/useRelativeTimeNow'
import { useAppStore } from '../../state/useAppStore'
import { deleteRecentDocument } from '../../storage/documentSync'
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

export function HomePage() {
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const accountRef = useRef<HTMLDivElement | null>(null)
  const newMenuRef = useRef<HTMLDivElement | null>(null)
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
  const [openDocumentMenuId, setOpenDocumentMenuId] = useState<string | null>(null)
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
  const now = useRelativeTimeNow()
  const selectedThemeLabel = getSelectedThemeLabel(theme)

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
    if (!openDocumentMenuId) {
      return
    }

    function closeDocumentMenu() {
      setOpenDocumentMenuId(null)
    }

    function handlePointerDown(event: PointerEvent) {
      const element = event.target as HTMLElement | null
      if (element?.closest('.dashboard-row-menu')) {
        return
      }
      closeDocumentMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDocumentMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDocumentMenuId])

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
    navigate('/editor')
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
    navigate('/editor')
  }

  async function handleOpenDocument(docId: string) {
    await openDocument(docId)
    navigate('/editor')
  }

  async function handleDeleteDocument(item: RecentDocumentItem) {
    if (!window.confirm(`Delete "${item.title}" from Documents?`)) {
      return
    }

    setAuthError(null)
    setOpenDocumentMenuId(null)
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
            openDocumentMenuId={openDocumentMenuId}
            onOpen={(id) => void handleOpenDocument(id)}
            onToggleMenu={(id) => setOpenDocumentMenuId((openId) => (openId === id ? null : id))}
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
  openDocumentMenuId,
  onOpen,
  onToggleMenu,
  onDelete,
  onNew,
  onImport,
}: {
  documents: RecentDocumentItem[]
  state: RecentDocumentsState
  now: number
  openDocumentMenuId: string | null
  onOpen: (id: string) => void
  onToggleMenu: (id: string) => void
  onDelete: (item: RecentDocumentItem) => void
  onNew: () => void
  onImport: () => void
}) {
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
            const syncLabel = doc.syncStatus === 'backed-up' ? 'Backed up' : doc.syncStatus === 'conflict' ? 'Conflict' : 'Local only'
            return (
              <div key={doc.id} className="dashboard-document-row">
                <button type="button" className="dashboard-document-main" onClick={() => onOpen(doc.id)}>
                  <span className="dashboard-document-icon" aria-hidden="true">
                    <FileText size={22} />
                  </span>
                  <span className="dashboard-document-copy">
                    <strong>{doc.title}</strong>
                    <small>{syncLabel}</small>
                  </span>
                  <span className="dashboard-document-time">{formatRelativeTime(updatedAt, now)}</span>
                </button>
                <div className="dashboard-row-menu">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`${doc.title} actions`}
                    aria-haspopup="menu"
                    aria-expanded={openDocumentMenuId === doc.id}
                    onClick={() => onToggleMenu(doc.id)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {openDocumentMenuId === doc.id ? (
                    <div className="dashboard-row-popover" role="menu" aria-label={`${doc.title} actions`}>
                      <button type="button" role="menuitem" onClick={() => onDelete(doc)}>
                        <Trash2 size={15} />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
