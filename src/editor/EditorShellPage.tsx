import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from 'firebase/auth'
import {
  Bold,
  BookOpen,
  CheckSquare,
  Code,
  Copy,
  Download,
  Edit3,
  Eye,
  FileText,
  GitBranch,
  Cloud,
  ChevronDown,
  Heading1,
  Heading2,
  HardDrive,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  LogIn,
  LogOut,
  Minus,
  Plus,
  Quote,
  Redo2,
  Save,
  Search,
  Share2,
  Sigma,
  Table,
  Trash2,
  Undo2,
  Upload,
  UserCircle,
} from 'lucide-react'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { useAppStore, hasUnsavedChanges } from '../state/useAppStore'
import { getDocumentById, updateDocument } from '../storage/documents'
import { publishSharedDocument, updateSharedDocument } from '../storage/shareDocuments'
import { getOwnerProfile, listenToAuthState, signInWithGoogle, signOutCurrentUser } from '../firebase/auth'
import { useAutoHideAppbar } from '../hooks/useAutoHideAppbar'
import { MarkdownEditor, type EditorSelectionSnapshot, type MarkdownEditorHandle } from './MarkdownEditor'
import type { DesktopViewMode, MobileTab, RecentDocumentItem, RecentDocumentsState, SaveStatus, ThemeName } from '../types'
import type { MarkdownInsertAction } from './markdownInsert'
import { backUpLocalDocument, deleteRecentDocument } from '../storage/documentSync'

type OutlineItem = {
  id: string
  text: string
  level: number
  line: number
}

type ToolbarItem = {
  action: MarkdownInsertAction
  label: string
  icon: typeof Bold
}

type DesktopSidebarTab = 'documents' | 'outline'

type LinkDialogState = {
  mode: 'link' | 'image'
  text: string
  url: string
  selection: EditorSelectionSnapshot | null
}

type ThemeOption = {
  value: ThemeName
  label: string
}

type ThemeGroup = {
  label: string
  options: ThemeOption[]
}

const toolbarItems: ToolbarItem[] = [
  { action: 'bold', label: 'Bold', icon: Bold },
  { action: 'italic', label: 'Italic', icon: Italic },
  { action: 'h1', label: 'Heading 1', icon: Heading1 },
  { action: 'h2', label: 'Heading 2', icon: Heading2 },
  { action: 'link', label: 'Link', icon: Link },
  { action: 'image', label: 'Image from URL', icon: Image },
  { action: 'table', label: 'Table', icon: Table },
  { action: 'code', label: 'Code block', icon: Code },
  { action: 'math', label: 'Math equation', icon: Sigma },
  { action: 'mermaid', label: 'Mermaid diagram', icon: GitBranch },
  { action: 'checklist', label: 'Checklist', icon: CheckSquare },
  { action: 'bullet-list', label: 'Bullet list', icon: List },
  { action: 'numbered-list', label: 'Numbered list', icon: ListOrdered },
  { action: 'quote', label: 'Quote', icon: Quote },
  { action: 'hr', label: 'Horizontal rule', icon: Minus },
]

const mobileTabs: Array<{ id: MobileTab; label: string }> = [
  { id: 'write', label: 'Write' },
  { id: 'preview', label: 'Preview' },
  { id: 'outline', label: 'Outline' },
  { id: 'files', label: 'Files' },
]

const themeGroups: ThemeGroup[] = [
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

const statusLabels: Record<SaveStatus, string> = {
  'local-only': 'Local Only',
  unsaved: 'Unsaved Changes',
  saving: 'Saving',
  saved: 'Saved',
  synced: 'Synced',
  error: 'Error',
}

function buildOutline(markdown: string): OutlineItem[] {
  return markdown
    .split('\n')
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (!match) {
        return null
      }
      const text = match[2].replace(/[#*_`]/g, '').trim()
      return {
        id: `${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        text,
        level: match[1].length,
        line: index + 1,
      }
    })
    .filter(Boolean) as OutlineItem[]
}

function countWords(markdown: string): number {
  return markdown.trim() ? markdown.trim().split(/\s+/).length : 0
}

function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

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

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function useIsMobileViewport(): boolean {
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
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
    const handleChange = () => setIsMobileViewport(mediaQuery.matches)
    handleChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  return isMobileViewport
}

export function EditorShellPage() {
  const editorRef = useRef<MarkdownEditorHandle | null>(null)
  const previewScrollRef = useRef<HTMLDivElement | null>(null)
  const pendingPreviewLineRef = useRef<number | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const desktopAccountRef = useRef<HTMLDivElement | null>(null)
  const mobileAccountRef = useRef<HTMLDivElement | null>(null)
  const themeMenuRef = useRef<HTMLDivElement | null>(null)
  const mobilePanelRef = useRef<HTMLElement | null>(null)
  const linkTextInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingInsertAction, setPendingInsertAction] = useState<MarkdownInsertAction | null>(null)
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isInsertOpen, setIsInsertOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [fileSearch, setFileSearch] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [desktopSidebarTab, setDesktopSidebarTab] = useState<DesktopSidebarTab>('outline')
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)

  const activeDocId = useAppStore((state) => state.activeDocId)
  const activeShareId = useAppStore((state) => state.activeShareId)
  const recentDocuments = useAppStore((state) => state.recentDocuments)
  const recentDocumentsState = useAppStore((state) => state.recentDocumentsState)
  const draftTitle = useAppStore((state) => state.draftTitle)
  const draftMarkdown = useAppStore((state) => state.draftMarkdown)
  const lastLocalSavedMarkdown = useAppStore((state) => state.lastLocalSavedMarkdown)
  const theme = useAppStore((state) => state.theme)
  const mobileTab = useAppStore((state) => state.mobileTab)
  const desktopViewMode = useAppStore((state) => state.desktopViewMode)
  const saveStatus = useAppStore((state) => state.saveStatus)
  const saveError = useAppStore((state) => state.saveError)
  const hydrateDocument = useAppStore((state) => state.hydrateDocument)
  const refreshDocuments = useAppStore((state) => state.refreshDocuments)
  const refreshRecentDocuments = useAppStore((state) => state.refreshRecentDocuments)
  const clearRecentDocumentsForSignedOut = useAppStore((state) => state.clearRecentDocumentsForSignedOut)
  const setDraftTitle = useAppStore((state) => state.setDraftTitle)
  const setDraftMarkdown = useAppStore((state) => state.setDraftMarkdown)
  const setTheme = useAppStore((state) => state.setTheme)
  const setMobileTab = useAppStore((state) => state.setMobileTab)
  const setDesktopViewMode = useAppStore((state) => state.setDesktopViewMode)
  const createNewDraft = useAppStore((state) => state.createNewDraft)
  const openDocument = useAppStore((state) => state.openDocument)
  const importMarkdownDraft = useAppStore((state) => state.importMarkdownDraft)
  const saveDraft = useAppStore((state) => state.saveDraft)
  const linkActiveShare = useAppStore((state) => state.linkActiveShare)
  const setLastCloudSavedSnapshot = useAppStore((state) => state.setLastCloudSavedSnapshot)

  const deferredMarkdown = useDeferredValue(draftMarkdown)
  const outline = useMemo(() => buildOutline(draftMarkdown), [draftMarkdown])
  const lines = useMemo(() => draftMarkdown.split('\n').length, [draftMarkdown])
  const words = useMemo(() => countWords(draftMarkdown), [draftMarkdown])
  const filteredDocuments = useMemo(
    () =>
      recentDocuments.filter((doc) =>
        doc.title.toLowerCase().includes(fileSearch.trim().toLowerCase()),
      ),
    [recentDocuments, fileSearch],
  )
  const markdownOk = saveStatus === 'error' ? 'Check errors' : 'Markdown OK'
  const isMobileViewport = useIsMobileViewport()
  const showSidebar = true
  const showEditor = desktopViewMode === 'edit' || desktopViewMode === 'split'
  const showPreview = desktopViewMode === 'preview' || desktopViewMode === 'split'
  const isLinkDialogOpen = linkDialog !== null
  const selectedThemeLabel =
    themeGroups.flatMap((group) => group.options).find((option) => option.value === theme)?.label ?? 'Theme'
  const isMobileAppbarHidden = useAutoHideAppbar({
    enabled: isMobileViewport,
    resetKey: mobileTab,
    scrollRef: mobilePanelRef,
  })

  const openLinkDialog = useCallback((action: 'link' | 'image') => {
    const selection = editorRef.current?.getSelectionSnapshot() ?? null
    setLinkDialog({
      mode: action,
      text: selection?.text ?? '',
      url: '',
      selection,
    })
  }, [])

  useEffect(() => {
    void hydrateDocument()
    void refreshDocuments()
  }, [hydrateDocument, refreshDocuments])

  useEffect(() => listenToAuthState((nextUser) => {
    setUser(nextUser)
    if (!nextUser) {
      setIsProfileMenuOpen(false)
      setIsConfirmingSignOut(false)
      clearRecentDocumentsForSignedOut()
      return
    }
    void refreshRecentDocuments(nextUser.uid).catch(() => {
      setAuthError('Unable to load backed up documents.')
    })
  }), [clearRecentDocumentsForSignedOut, refreshRecentDocuments])

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return
    }

    function closeProfileMenu() {
      setIsProfileMenuOpen(false)
      setIsConfirmingSignOut(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (desktopAccountRef.current?.contains(target) || mobileAccountRef.current?.contains(target)) {
        return
      }
      closeProfileMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeProfileMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isProfileMenuOpen])

  useEffect(() => {
    if (!isThemeMenuOpen) {
      return
    }

    function closeThemeMenu() {
      setIsThemeMenuOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (themeMenuRef.current?.contains(target)) {
        return
      }
      closeThemeMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeThemeMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isThemeMenuOpen])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasUnsavedChanges()) {
        return
      }
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    if (!activeShareId) {
      setShareUrl(null)
      return
    }
    const path = `/share/${activeShareId}`
    setShareUrl(typeof window !== 'undefined' ? `${window.location.origin}${path}` : path)
  }, [activeShareId])

  useEffect(() => {
    if (!showPreview || pendingPreviewLineRef.current === null) {
      return
    }
    requestAnimationFrame(() => {
      scrollPreviewToLine(pendingPreviewLineRef.current)
    })
  }, [deferredMarkdown, showPreview])

  useEffect(() => {
    if (!pendingInsertAction || mobileTab !== 'write') {
      return
    }

    const frame = requestAnimationFrame(() => {
      if (!editorRef.current) {
        return
      }
      if (pendingInsertAction === 'link' || pendingInsertAction === 'image') {
        openLinkDialog(pendingInsertAction)
        setPendingInsertAction(null)
        return
      }
      editorRef.current.applyAction(pendingInsertAction)
      setPendingInsertAction(null)
    })

    return () => cancelAnimationFrame(frame)
  }, [mobileTab, openLinkDialog, pendingInsertAction])

  useEffect(() => {
    if (!isLinkDialogOpen) {
      return
    }

    linkTextInputRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setLinkDialog(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isLinkDialogOpen])

  async function guardedOpenDocument(docId: string) {
    if (hasUnsavedChanges() && !window.confirm('You have unsaved changes. Save before leaving?')) {
      return
    }
    await openDocument(docId)
  }

  async function handleDeleteRecentDocument(item: RecentDocumentItem) {
    if (!window.confirm(`Delete "${item.title}" from Documents?`)) {
      return
    }

    setAuthError(null)
    try {
      await deleteRecentDocument(user?.uid ?? null, item)
      if (item.localDocumentId === activeDocId) {
        createNewDraft()
      }
      await refreshDocuments()
      if (user) {
        await refreshRecentDocuments(user.uid)
      } else {
        clearRecentDocumentsForSignedOut()
      }
    } catch {
      setAuthError('Unable to delete document right now.')
    }
  }

  function handleInsert(action: MarkdownInsertAction) {
    setIsInsertOpen(false)
    setMobileTab('write')
    if (editorRef.current) {
      if (action === 'link' || action === 'image') {
        openLinkDialog(action)
        return
      }
      editorRef.current.applyAction(action)
      return
    }
    setPendingInsertAction(action)
  }

  function handleLinkDialogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!linkDialog) {
      return
    }

    const url = linkDialog.url.trim()
    const text = linkDialog.text.trim()
    if (!url || (linkDialog.mode === 'link' && !text)) {
      return
    }

    editorRef.current?.applyLink(
      {
        text,
        url,
        image: linkDialog.mode === 'image',
      },
      linkDialog.selection ?? undefined,
    )
    setLinkDialog(null)
  }

  function handleRedo() {
    editorRef.current?.redo()
  }

  function handleUndo() {
    editorRef.current?.undo()
  }

  function handleOutlineSelect(item: OutlineItem) {
    if (mobileTab === 'outline') {
      setMobileTab('write')
    }
    if (desktopViewMode !== 'split') {
      setDesktopViewMode('split')
    }
    pendingPreviewLineRef.current = item.line
    requestAnimationFrame(() => {
      editorRef.current?.scrollToLine(item.line)
      scrollPreviewToLine(item.line)
    })
  }

  function scrollPreviewToLine(lineNumber: number | null) {
    if (lineNumber === null) {
      return
    }
    const container = previewScrollRef.current
    const target = container?.querySelector<HTMLElement>(`[data-source-line="${lineNumber}"]`)
    if (!container || !target) {
      return
    }
    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const nextTop = targetRect.top - containerRect.top + container.scrollTop - container.clientHeight * 0.2
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' })
    pendingPreviewLineRef.current = null
  }

  async function handleSave() {
    const doc = await saveDraft()
    if (user) {
      await backUpLocalDocument(user.uid, doc)
      await refreshRecentDocuments(user.uid)
    }
  }

  async function handleSharePublish() {
    setShareError(null)
    setCopyState('idle')

    if (!user) {
      setShareError('Sign in with Google to share documents.')
      return
    }

    setIsSharing(true)
    try {
      const doc = await saveDraft()
      if (activeShareId) {
        await updateSharedDocument(activeShareId, {
          title: draftTitle,
          markdown: draftMarkdown,
          sourceDocId: doc.id,
        })
        await updateDocument(doc.id, {
          source: 'firebase',
          sourceShareId: activeShareId,
          sourceOwnerUid: user.uid,
        })
        await backUpLocalDocument(user.uid, (await getDocumentById(doc.id)) ?? doc)
        await refreshDocuments()
        await refreshRecentDocuments(user.uid)
        setLastCloudSavedSnapshot(draftTitle, draftMarkdown)
      } else {
        const result = await publishSharedDocument({
          title: draftTitle,
          markdown: draftMarkdown,
          sourceDocId: doc.id,
          owner: getOwnerProfile(user),
        })
        await updateDocument(doc.id, {
          source: 'firebase',
          sourceShareId: result.shareId,
          sourceOwnerUid: user.uid,
        })
        await backUpLocalDocument(user.uid, (await getDocumentById(doc.id)) ?? doc)
        await refreshDocuments()
        await refreshRecentDocuments(user.uid)
        linkActiveShare(result.shareId, draftTitle, draftMarkdown)
      }
    } catch {
      setShareError('Unable to share document. Please try again.')
    } finally {
      setIsSharing(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl || !navigator.clipboard) {
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

  async function handleSignIn() {
    setAuthError(null)
    try {
      const signedInUser = await signInWithGoogle()
      setUser(signedInUser)
      await refreshRecentDocuments(signedInUser.uid)
    } catch {
      setAuthError('Unable to sign in with Google.')
    }
  }

  function toggleProfileMenu() {
    setIsProfileMenuOpen((isOpen) => !isOpen)
    setIsConfirmingSignOut(false)
  }

  async function handleConfirmedSignOut() {
    const didSignOut = await handleSignOut()
    if (didSignOut) {
      setIsProfileMenuOpen(false)
      setIsConfirmingSignOut(false)
    }
  }

  async function handleSignOut(): Promise<boolean> {
    setAuthError(null)
    try {
      if (hasUnsavedChanges()) {
        const doc = await saveDraft()
        if (user) {
          await backUpLocalDocument(user.uid, doc)
        }
      }
      await signOutCurrentUser()
      clearRecentDocumentsForSignedOut()
      return true
    } catch {
      setAuthError('Unable to sign out right now.')
      return false
    }
  }

  function handleImportClick() {
    importInputRef.current?.click()
  }

  async function handleImportFile(file: File | undefined) {
    setImportError(null)
    if (!file) {
      return
    }
    if (!file.name.toLowerCase().endsWith('.md')) {
      setImportError('Only .md files are supported right now.')
      return
    }
    const text = await file.text()
    importMarkdownDraft(file.name, text)
  }

  function handleExport(format: 'md' | 'html' | 'pdf') {
    const filename = draftTitle.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'document'
    if (format === 'md') {
      downloadFile(`${filename}.md`, 'text/markdown;charset=utf-8', draftMarkdown)
      return
    }
    if (format === 'html') {
      downloadFile(
        `${filename}.html`,
        'text/html;charset=utf-8',
        `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(draftTitle)}</title></head><body><pre>${escapeHtml(draftMarkdown)}</pre></body></html>`,
      )
      return
    }
    window.print()
  }

  return (
    <main className={`studio-shell studio-mode-${desktopViewMode}`}>
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,text/markdown"
        onChange={(event) => void handleImportFile(event.target.files?.[0])}
      />

      <header className="studio-topbar">
        <div className="brand-lockup">
          <span className="app-mark" aria-hidden="true">
            <Edit3 size={18} />
          </span>
          <strong>Markdown Studio</strong>
        </div>
        <input
          className="title-input"
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          aria-label="Document title"
        />
        <span className={`save-badge save-badge-${saveStatus}`}>
          {statusLabels[saveStatus]}
        </span>
        <nav className="view-switch" aria-label="View mode">
          {(['edit', 'split', 'preview'] as DesktopViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={desktopViewMode === mode ? 'view-switch-button active' : 'view-switch-button'}
              onClick={() => setDesktopViewMode(mode)}
            >
              {mode[0].toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </nav>
        <div className="topbar-spacer" />
        <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={saveStatus === 'saving'}>
          <Save size={16} />
          Save
        </button>
        <div className="theme-menu" ref={themeMenuRef}>
          <button
            type="button"
            className="theme-select"
            aria-haspopup="menu"
            aria-expanded={isThemeMenuOpen}
            aria-label="Select theme"
            onClick={() => setIsThemeMenuOpen((open) => !open)}
          >
            <span>{selectedThemeLabel}</span>
            <ChevronDown size={16} />
          </button>
          {isThemeMenuOpen ? (
            <section className="theme-menu-popover" role="menu" aria-label="Theme options">
              {themeGroups.map((group) => (
                <div key={group.label} className="theme-menu-group">
                  <p className="theme-select-group-label">{group.label}</p>
                  {group.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.value === theme}
                      className={option.value === theme ? 'theme-menu-option active' : 'theme-menu-option'}
                      onClick={() => {
                        setTheme(option.value)
                        setIsThemeMenuOpen(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ))}
            </section>
          ) : null}
        </div>
        <button type="button" className="secondary-button" onClick={() => setIsShareOpen(true)}>
          <Share2 size={16} />
          Share
        </button>
        <div className="export-menu">
          <button type="button" className="secondary-button">
            <Download size={16} />
            Export
          </button>
          <div className="export-popover">
            <button type="button" onClick={() => handleExport('md')}>Markdown</button>
            <button type="button" onClick={() => handleExport('html')}>HTML</button>
            <button type="button" onClick={() => handleExport('pdf')}>PDF</button>
          </div>
        </div>
        {user ? (
          <div className="account-menu-anchor" ref={desktopAccountRef}>
            <AccountButton user={user} isOpen={isProfileMenuOpen} onClick={toggleProfileMenu} />
            {!isMobileViewport && isProfileMenuOpen ? (
              <AccountMenu
                user={user}
                isConfirmingSignOut={isConfirmingSignOut}
                onRequestSignOut={() => setIsConfirmingSignOut(true)}
                onCancelSignOut={() => setIsConfirmingSignOut(false)}
                onConfirmSignOut={() => void handleConfirmedSignOut()}
              />
            ) : null}
          </div>
        ) : (
          <button type="button" className="secondary-button compact" onClick={() => void handleSignIn()}>
            <LogIn size={16} />
            Sign in
          </button>
        )}
      </header>

      <header className={isMobileAppbarHidden && !isProfileMenuOpen ? 'mobile-topbar appbar-hidden' : 'mobile-topbar'}>
        <div className="mobile-title-block">
          <strong>{mobileTab === 'files' ? 'Markdown Studio' : draftTitle}</strong>
        </div>
        <span className={`save-badge save-badge-${saveStatus}`}>{statusLabels[saveStatus]}</span>
        {user ? (
          <div className="account-menu-anchor mobile-account-anchor" ref={mobileAccountRef}>
            <AccountButton user={user} isOpen={isProfileMenuOpen} onClick={toggleProfileMenu} />
            {isMobileViewport && isProfileMenuOpen ? (
              <AccountMenu
                user={user}
                isConfirmingSignOut={isConfirmingSignOut}
                onRequestSignOut={() => setIsConfirmingSignOut(true)}
                onCancelSignOut={() => setIsConfirmingSignOut(false)}
                onConfirmSignOut={() => void handleConfirmedSignOut()}
              />
            ) : null}
          </div>
        ) : (
          <button type="button" className="icon-button" onClick={() => void handleSignIn()} aria-label="Sign in">
            <LogIn size={20} />
          </button>
        )}
      </header>
      <nav className="mobile-mode-tabs" aria-label="Mobile mode">
        {mobileTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={mobileTab === tab.id ? 'mobile-mode-tab active' : 'mobile-mode-tab'}
            onClick={() => setMobileTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {authError ? <div className="studio-banner error">{authError}</div> : null}
      {saveError ? <div className="studio-banner error">{saveError}</div> : null}
      {importError ? <div className="studio-banner error">{importError}</div> : null}

      <section className="studio-workspace">
        {showSidebar ? (
          <aside className="desktop-sidebar">
            <div className="sidebar-tabs">
              <button
                type="button"
                className={desktopSidebarTab === 'outline' ? 'sidebar-tab active' : 'sidebar-tab'}
                onClick={() => setDesktopSidebarTab('outline')}
              >
                <BookOpen size={16} />
                Outline
              </button>
              <button
                type="button"
                className={desktopSidebarTab === 'documents' ? 'sidebar-tab active' : 'sidebar-tab'}
                onClick={() => setDesktopSidebarTab('documents')}
              >
                <FileText size={16} />
                Documents
              </button>
            </div>
            {desktopSidebarTab === 'documents' ? (
              <>
                <div className="sidebar-actions">
                  <button type="button" className="primary-button" onClick={createNewDraft}>
                    <Plus size={18} />
                    New
                  </button>
                  <button type="button" className="icon-button bordered" onClick={handleImportClick} aria-label="Import .md">
                    <Upload size={18} />
                  </button>
                </div>
                <DocumentList
                  documents={filteredDocuments}
                  recentDocumentsState={recentDocumentsState}
                  activeDocId={activeDocId}
                  onOpen={(id) => void guardedOpenDocument(id)}
                  onDelete={(item) => void handleDeleteRecentDocument(item)}
                />
              </>
            ) : (
              <Outline outline={outline} onSelect={handleOutlineSelect} />
            )}
          </aside>
        ) : null}

        <section className="desktop-main-panels">
          {!isMobileViewport && showEditor ? (
            <article className="workspace-panel editor-panel">
              <PanelHeader title="Editor" />
              <EditorToolbar onInsert={handleInsert} onRedo={handleRedo} onUndo={handleUndo} />
              <MarkdownEditor ref={editorRef} value={draftMarkdown} onChange={setDraftMarkdown} />
            </article>
          ) : null}
          {!isMobileViewport && showPreview ? (
            <article className="workspace-panel preview-panel">
              <PanelHeader title="Preview" />
              <div className="preview-scroll" ref={previewScrollRef}>
                <MarkdownPreview markdown={deferredMarkdown} theme={theme} />
              </div>
            </article>
          ) : null}
        </section>

        <section ref={mobilePanelRef} className={`mobile-panel-surface mobile-panel-${mobileTab}`}>
          {isMobileViewport && mobileTab === 'write' ? (
            <>
              <EditorToolbar onInsert={handleInsert} onRedo={handleRedo} onUndo={handleUndo} compact />
              <MarkdownEditor ref={editorRef} value={draftMarkdown} onChange={setDraftMarkdown} />
              <div className="mobile-status-strip">Words: {words} · Lines: {lines} · {markdownOk}</div>
            </>
          ) : null}
          {isMobileViewport && mobileTab === 'preview' ? (
            <div className="preview-scroll mobile-preview">
              <MarkdownPreview markdown={deferredMarkdown} theme={theme} />
            </div>
          ) : null}
          {isMobileViewport && mobileTab === 'outline' ? <Outline outline={outline} mobile onSelect={handleOutlineSelect} /> : null}
          {isMobileViewport && mobileTab === 'files' ? (
            <FilesView
              documents={filteredDocuments}
              recentDocumentsState={recentDocumentsState}
              activeDocId={activeDocId}
              search={fileSearch}
              onSearch={setFileSearch}
              onNew={createNewDraft}
              onImport={handleImportClick}
              onOpen={(id) => void guardedOpenDocument(id)}
              onDelete={(item) => void handleDeleteRecentDocument(item)}
            />
          ) : null}
        </section>
      </section>

      <footer className="status-bar">
        <span>Words: {words}</span>
        <span>Lines: {lines}</span>
        <span>Markdown OK</span>
        <span>{statusLabels[saveStatus]}</span>
        <span className="status-fill" />
        <span>{lastLocalSavedMarkdown === draftMarkdown ? '100%' : 'Edited'}</span>
      </footer>

      <footer className="mobile-bottom-bar">
        <button type="button" className="bottom-action primary" onClick={() => void handleSave()}>
          <Save size={18} />
          Save
        </button>
        <button type="button" className="bottom-action" onClick={() => setMobileTab('preview')}>
          <Eye size={18} />
          Preview
        </button>
        <button type="button" className="bottom-action" onClick={() => setIsInsertOpen(true)}>
          <Plus size={18} />
          Insert
        </button>
        <button type="button" className="bottom-action" onClick={() => setIsShareOpen(true)}>
          <Share2 size={18} />
          Share
        </button>
      </footer>

      {isShareOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsShareOpen(false)}>
          <section
            className="dialog-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2 id="share-title">Share document</h2>
            <p>Anyone with this link can view this document. Only the creator can edit the original.</p>
            {shareError ? <p className="error-text">{shareError}</p> : null}
            {shareUrl ? (
              <div className="share-link-row">
                <input value={shareUrl} readOnly aria-label="Read-only share link" />
                <button type="button" className="secondary-button" onClick={() => void handleCopyShareUrl()}>
                  <Copy size={16} />
                  Copy Link
                </button>
              </div>
            ) : null}
            {copyState === 'copied' ? <p className="success-text">Link copied</p> : null}
            {copyState === 'failed' ? <p className="error-text">Copy failed</p> : null}
            {!user || !activeShareId ? (
              <div className="dialog-actions">
                {!user ? (
                  <button type="button" className="secondary-button" onClick={() => void handleSignIn()}>
                    <LogIn size={16} />
                    Sign in with Google
                  </button>
                ) : (
                  <button type="button" className="primary-button" onClick={() => void handleSharePublish()} disabled={isSharing}>
                    <Share2 size={16} />
                    {isSharing ? 'Sharing...' : 'Create Link'}
                  </button>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {linkDialog ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setLinkDialog(null)}>
          <form
            className="dialog-sheet insert-link-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="insert-link-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={handleLinkDialogSubmit}
          >
            <h2 id="insert-link-title">
              {linkDialog.mode === 'image' ? 'Insert image' : 'Insert link'}
            </h2>
            <label className="dialog-field">
              <span>{linkDialog.mode === 'image' ? 'Alt text' : 'Text'}</span>
              <input
                ref={linkTextInputRef}
                value={linkDialog.text}
                onChange={(event) => setLinkDialog({ ...linkDialog, text: event.target.value })}
              />
            </label>
            <label className="dialog-field">
              <span>{linkDialog.mode === 'image' ? 'Image URL' : 'URL'}</span>
              <input
                value={linkDialog.url}
                onChange={(event) => setLinkDialog({ ...linkDialog, url: event.target.value })}
                inputMode="url"
              />
            </label>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={() => setLinkDialog(null)}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!linkDialog.url.trim() || (linkDialog.mode === 'link' && !linkDialog.text.trim())}
              >
                Insert
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isInsertOpen ? (
        <div className="modal-backdrop mobile-only" role="presentation" onMouseDown={() => setIsInsertOpen(false)}>
          <section className="bottom-sheet" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Insert Markdown</h2>
            <EditorToolbar onInsert={handleInsert} sheet />
          </section>
        </div>
      ) : null}
    </main>
  )
}

function PanelHeader({ title }: { title: string }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
    </div>
  )
}

function getUserInitial(user: User): string | null {
  const source = user.displayName || user.email
  return source ? source.trim().charAt(0).toUpperCase() : null
}

function AccountAvatar({ user, size = 20 }: { user: User; size?: number }) {
  const initial = getUserInitial(user)
  if (user.photoURL) {
    return <img src={user.photoURL} alt="" />
  }
  if (initial) {
    return <span className="avatar-initial">{initial}</span>
  }
  return <UserCircle size={size} />
}

function AccountButton({
  user,
  isOpen,
  onClick,
}: {
  user: User
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="avatar-button"
      onClick={onClick}
      aria-label="Account menu"
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      <AccountAvatar user={user} />
    </button>
  )
}

function AccountMenu({
  user,
  isConfirmingSignOut,
  onRequestSignOut,
  onCancelSignOut,
  onConfirmSignOut,
}: {
  user: User
  isConfirmingSignOut: boolean
  onRequestSignOut: () => void
  onCancelSignOut: () => void
  onConfirmSignOut: () => void
}) {
  return (
    <section className="account-menu" role={isConfirmingSignOut ? 'dialog' : 'menu'} aria-label="Account">
      <div className="account-menu-profile">
        <span className="account-menu-avatar" aria-hidden="true">
          <AccountAvatar user={user} size={28} />
        </span>
        <span className="account-menu-identity">
          <strong>{user.displayName || 'Signed in user'}</strong>
          <small>{user.email || 'No email available'}</small>
        </span>
      </div>
      <div className="account-menu-divider" />
      {isConfirmingSignOut ? (
        <div className="account-confirm">
          <strong>Sign out?</strong>
          <div className="account-confirm-actions">
            <button type="button" className="secondary-button compact" onClick={onCancelSignOut} aria-label="Cancel sign out">
              Cancel
            </button>
            <button type="button" className="primary-button compact" onClick={onConfirmSignOut} aria-label="Confirm sign out">
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="account-menu-action" onClick={onRequestSignOut} role="menuitem">
          <LogOut size={16} />
          Sign out
        </button>
      )}
    </section>
  )
}

function EditorToolbar({
  onInsert,
  onRedo,
  onUndo,
  compact = false,
  sheet = false,
}: {
  onInsert: (action: MarkdownInsertAction) => void
  onRedo?: () => void
  onUndo?: () => void
  compact?: boolean
  sheet?: boolean
}) {
  return (
    <div className={sheet ? 'insert-grid' : compact ? 'editor-toolbar compact' : 'editor-toolbar'}>
      {!sheet ? (
        <>
          <button
            type="button"
            className="toolbar-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onUndo}
            aria-label="Undo"
            title="Undo"
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            className="toolbar-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRedo}
            aria-label="Redo"
            title="Redo"
          >
            <Redo2 size={17} />
          </button>
        </>
      ) : null}
      {toolbarItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.action}
            type="button"
            className={sheet ? 'insert-action' : 'toolbar-button'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(item.action)}
            aria-label={item.label}
            title={item.label}
          >
            <Icon size={sheet ? 18 : 17} />
            {sheet ? <span>{item.label}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function DocumentList({
  documents,
  recentDocumentsState,
  activeDocId,
  onOpen,
  onDelete,
}: {
  documents: RecentDocumentItem[]
  recentDocumentsState: RecentDocumentsState
  activeDocId: string | null
  onOpen: (id: string) => void
  onDelete: (item: RecentDocumentItem) => void
}) {
  if (recentDocumentsState === 'signed-out') {
    return (
      <section className="sidebar-section">
        <h2>Recent Documents</h2>
        <p className="muted-text">Sign in to see your backed up documents</p>
      </section>
    )
  }

  return (
    <section className="sidebar-section">
      <h2>Recent Documents</h2>
      <div className="document-list">
        {documents.slice(0, 6).map((doc) => {
          const SourceIcon = doc.syncStatus === 'backed-up' ? Cloud : HardDrive
          const sourceLabel = doc.syncStatus === 'backed-up' ? 'Backed up document' : 'Local document'
          return (
            <div
              key={doc.id}
              className={doc.id === activeDocId ? 'document-row active' : 'document-row'}
            >
              <button type="button" className="document-row-main" onClick={() => onOpen(doc.id)}>
                <span className="document-source-icon" role="img" aria-label={sourceLabel} title={sourceLabel}>
                  <SourceIcon size={17} aria-hidden="true" />
                </span>
                <span className="document-row-copy">
                  <span className="document-title">{doc.title}</span>
                  <small>{formatRelativeTime(doc.updatedAt)}</small>
                </span>
              </button>
              <button type="button" className="document-delete-button" onClick={() => onDelete(doc)} aria-label={`Delete ${doc.title}`} title="Delete">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Outline({
  outline,
  mobile = false,
  onSelect,
}: {
  outline: OutlineItem[]
  mobile?: boolean
  onSelect: (item: OutlineItem) => void
}) {
  return (
    <section className={mobile ? 'outline-panel mobile' : 'sidebar-section outline-panel'}>
      <h2>Outline</h2>
      {outline.length ? (
        <div className="outline-list">
          {outline.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`outline-row outline-level-${item.level}`}
              onClick={() => onSelect(item)}
            >
              <span>{item.text}</span>
              <small>H{item.level}</small>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted-text">No headings yet.</p>
      )}
    </section>
  )
}

export function FilesView({
  documents,
  recentDocumentsState,
  activeDocId,
  search,
  onSearch,
  onNew,
  onImport,
  onOpen,
  onDelete,
}: {
  documents: RecentDocumentItem[]
  recentDocumentsState: RecentDocumentsState
  activeDocId: string | null
  search: string
  onSearch: (value: string) => void
  onNew: () => void
  onImport: () => void
  onOpen: (id: string) => void
  onDelete: (item: RecentDocumentItem) => void
}) {
  return (
    <div className="files-view">
      <label className="file-search">
        <Search size={18} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search documents" />
      </label>
      <button type="button" className="primary-button full-width" onClick={onNew}>
        <Plus size={18} />
        New Document
      </button>
      <button type="button" className="secondary-button full-width" onClick={onImport}>
        <Upload size={18} />
        Import .md file only
      </button>
      <div className="section-title-row">
        <h2>Recent Documents</h2>
        <button type="button">View all</button>
      </div>
      {recentDocumentsState === 'signed-out' ? (
        <p className="muted-text">Sign in to see your backed up documents</p>
      ) : (
      <section className="mobile-document-list">
        {documents.map((doc) => {
          const SourceIcon = doc.syncStatus === 'backed-up' ? Cloud : HardDrive
          const sourceLabel = doc.syncStatus === 'backed-up' ? 'Backed up document' : 'Local document'
          return (
            <div
              key={doc.id}
              className={doc.id === activeDocId ? 'mobile-document-row active' : 'mobile-document-row'}
            >
              <button type="button" className="mobile-document-row-main" onClick={() => onOpen(doc.id)}>
              <span className="document-source-icon mobile" role="img" aria-label={sourceLabel} title={sourceLabel}>
                <SourceIcon size={26} aria-hidden="true" />
              </span>
              <span className="document-row-copy">
                <span className="document-title">{doc.title}</span>
                <small>
                  {formatRelativeTime(doc.updatedAt)} · {Math.max(1, Math.round(doc.markdown.length / 1024))} KB
                </small>
              </span>
              </button>
              <button type="button" className="document-delete-button mobile" onClick={() => onDelete(doc)} aria-label={`Delete ${doc.title}`} title="Delete">
                <Trash2 size={18} />
              </button>
            </div>
          )
        })}
      </section>
      )}
      <div className="info-callout">
        <strong>Import supports .md files only.</strong>
        <span>Images must be added by URL.</span>
      </div>
    </div>
  )
}
