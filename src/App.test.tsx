import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { DocumentList, FilesView } from './editor/EditorShellPage'
import { useRelativeTimeNow } from './editor/useRelativeTimeNow'
import { listenToAuthState, signOutCurrentUser } from './firebase/auth'
import { useAppStore } from './state/useAppStore'
import { db } from './storage/db'
import { createDocument, setActiveDocumentId } from './storage/documents'
import { backUpLocalDocument } from './storage/documentSync'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './storage/shareDocuments'

const authMockState = vi.hoisted(() => ({
  currentUser: null as unknown,
}))

vi.mock('./storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
  updateSharedDocument: vi.fn(),
}))

vi.mock('./storage/documentSync', () => ({
  backUpLocalDocument: vi.fn(async (_uid: string, doc: unknown) => doc),
  deleteRecentDocument: vi.fn(),
  refreshLocalRecentDocuments: vi.fn(async () => []),
  refreshRecentDocumentsForUser: vi.fn(async () => []),
}))

vi.mock('./firebase/auth', () => ({
  listenToAuthState: vi.fn((callback: (user: unknown) => void) => {
    callback(authMockState.currentUser)
    return vi.fn()
  }),
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  getOwnerProfile: vi.fn(() => ({ uid: 'user-1', displayName: 'Ada', email: 'ada@example.com' })),
}))

function mockMobileViewport(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)' ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('App routing shell', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.documents.clear()
    await db.appState.clear()
    authMockState.currentUser = null
    mockMobileViewport(false)
    useAppStore.setState({
      activeDocId: null,
      activeShareId: null,
      documents: [],
      recentDocuments: [],
      recentDocumentsState: 'signed-out',
      draftTitle: 'Markdown Rendering Test File',
      draftMarkdown: '# Markdown Rendering Test File\n\n## Core markdown features\n',
      lastLocalSavedTitle: 'Markdown Rendering Test File',
      lastLocalSavedMarkdown: '# Markdown Rendering Test File\n\n## Core markdown features\n',
      isHydrated: false,
      mobileTab: 'write',
      desktopViewMode: 'split',
      saveStatus: 'local-only',
      saveError: null,
    })
    HTMLElement.prototype.scrollTo = vi.fn() as unknown as typeof HTMLElement.prototype.scrollTo
    document.title = 'MD Studio'
    vi.mocked(publishSharedDocument).mockResolvedValue({ shareId: 'share-id' })
    vi.mocked(getSharedDocumentById).mockResolvedValue(null)
    vi.mocked(updateSharedDocument).mockResolvedValue()
  })

  it('redirects root to editor shell', () => {
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(screen.getByText('MD Studio')).toBeInTheDocument()
    expect(document.title).toBe('Markdown Rendering Test File | MD Studio')
  })

  async function seedUnsavedDocumentSwitch(signedIn = false) {
    authMockState.currentUser = signedIn ? { uid: 'user-1', displayName: 'Ada', email: 'ada@example.com' } : null
    const active = await createDocument({ title: 'Active Doc', markdown: '# Active Doc' })
    const other = await createDocument({ title: 'Other Doc', markdown: '# Other Doc' })
    await setActiveDocumentId(active.id)
    const recentDocuments = [
      {
        id: other.id,
        localDocumentId: other.id,
        title: other.title,
        markdown: other.markdown,
        createdAt: other.createdAt,
        updatedAt: other.updatedAt,
        contentUpdatedAt: other.contentUpdatedAt,
        source: other.source,
        syncStatus: 'local-only' as const,
      },
    ]
    useAppStore.setState({
      isHydrated: true,
      activeDocId: active.id,
      draftTitle: active.title,
      draftMarkdown: '# Active Doc\n\nChanged',
      lastLocalSavedTitle: active.title,
      lastLocalSavedMarkdown: active.markdown,
      saveStatus: 'unsaved',
      recentDocumentsState: 'ready',
      recentDocuments,
    })
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    useAppStore.setState({ recentDocumentsState: 'ready', recentDocuments })
    fireEvent.click(screen.getByRole('button', { name: 'Documents' }))
    const otherDocButtons = await screen.findAllByRole('button', { name: /Other Doc/ })
    const otherDocOpenButton = otherDocButtons.find((button) => button.classList.contains('document-row-main'))
    expect(otherDocOpenButton).toBeDefined()
    fireEvent.click(otherDocOpenButton as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Unsaved changes' })
    return { active, other }
  }

  it('prompts before opening another document with unsaved changes', async () => {
    const { active } = await seedUnsavedDocumentSwitch()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument()
    expect(useAppStore.getState().activeDocId).toBe(active.id)
    expect(useAppStore.getState().draftMarkdown).toBe('# Active Doc\n\nChanged')
  })

  it('can save locally before opening another document without Firestore backup', async () => {
    const { other } = await seedUnsavedDocumentSwitch()

    fireEvent.click(screen.getByRole('button', { name: 'Save locally' }))

    await waitFor(() => {
      expect(useAppStore.getState().activeDocId).toBe(other.id)
    })
    expect(backUpLocalDocument).not.toHaveBeenCalled()
  })

  it('can save and back up before opening another document when signed in', async () => {
    const { other } = await seedUnsavedDocumentSwitch(true)

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unsaved changes' })).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(useAppStore.getState().activeDocId).toBe(other.id)
    })
    expect(backUpLocalDocument).toHaveBeenCalledTimes(1)
  })

  it('can discard unsaved changes before opening another document', async () => {
    const { other } = await seedUnsavedDocumentSwitch()

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(useAppStore.getState().activeDocId).toBe(other.id)
    })
    expect(backUpLocalDocument).not.toHaveBeenCalled()
  })

  it('updates the browser title from the editor draft title', async () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(document.title).toBe('Markdown Rendering Test File | MD Studio')

    fireEvent.change(screen.getByDisplayValue('Markdown Rendering Test File'), { target: { value: 'Draft Rename' } })

    await waitFor(() => {
      expect(document.title).toBe('Draft Rename | MD Studio')
    })
  })

  it('switches to preview mode from editor', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
    fireEvent.click(previewButton)
    expect(previewButton).toHaveClass('active')
    expect(screen.getByRole('heading', { level: 1, name: 'Markdown Rendering Test File' })).toBeInTheDocument()
  })

  it('does not expose focus view mode', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument()
  })

  it('defaults to outline and switches desktop sidebar to documents', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.queryByRole('heading', { name: 'Recent Documents' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Core markdown features/ })).toBeInTheDocument()
    const outlineTab = container.querySelector<HTMLButtonElement>('.desktop-sidebar .sidebar-tab:nth-child(1)')
    const documentsTab = container.querySelector<HTMLButtonElement>('.desktop-sidebar .sidebar-tab:nth-child(2)')
    expect(outlineTab).toHaveClass('active')
    expect(documentsTab).not.toBeNull()

    fireEvent.click(documentsTab as HTMLButtonElement)

    expect(documentsTab).toHaveClass('active')
    expect(screen.getByRole('heading', { name: 'Recent Documents' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to see your backed up documents')).toBeInTheDocument()
  })

  it('shows recent document source icons and relative time on desktop', () => {
    const now = new Date('2026-05-17T10:00:00.000Z').getTime()
    const documents = [
      {
        id: 'firebase-doc',
        title: 'Cloud Notes',
        markdown: '# Cloud Notes',
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        updatedAt: now - 2 * 24 * 60 * 60 * 1000,
        source: 'firebase',
        syncStatus: 'backed-up',
      },
      {
        id: 'local-doc',
        title: 'Local Notes',
        markdown: '# Local Notes',
        createdAt: now - 5 * 60 * 1000,
        updatedAt: now - 5 * 60 * 1000,
        source: 'local',
        syncStatus: 'local-only',
      },
    ] as ReturnType<typeof useAppStore.getState>['recentDocuments']

    render(
      <DocumentList
        documents={documents}
        recentDocumentsState="ready"
        activeDocId="local-doc"
        now={now}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Local Notes')).toBeInTheDocument()
    expect(screen.getByText('5 mins ago')).toBeInTheDocument()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Local document').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Backed up document').length).toBeGreaterThan(0)
    expect(screen.queryByText(new Date(now - 5 * 60 * 1000).toLocaleDateString())).not.toBeInTheDocument()
  })

  it('updates desktop relative document time every minute', () => {
    const initialNow = new Date('2026-05-17T10:00:00.000Z').getTime()
    vi.useFakeTimers({ now: initialNow })
    const documents = [
      {
        id: 'local-doc',
        title: 'Local Notes',
        markdown: '# Local Notes',
        createdAt: initialNow,
        updatedAt: initialNow,
        contentUpdatedAt: initialNow,
        source: 'local',
        syncStatus: 'local-only',
      },
    ] as ReturnType<typeof useAppStore.getState>['recentDocuments']

    function RelativeTimeHarness() {
      const now = useRelativeTimeNow()
      return (
        <DocumentList
          documents={documents}
          recentDocumentsState="ready"
          activeDocId="local-doc"
          now={now}
          onOpen={vi.fn()}
          onDelete={vi.fn()}
        />
      )
    }

    render(<RelativeTimeHarness />)

    expect(screen.getByText('just now')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(screen.getByText('1 min ago')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(60 * 1000)
    })
    expect(screen.getByText('2 mins ago')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('exposes delete action for desktop recent documents', () => {
    const onDelete = vi.fn()
    const document = {
      id: 'local-doc',
      localDocumentId: 'local-doc',
      title: 'Local Notes',
      markdown: '# Local Notes',
      createdAt: 1,
      updatedAt: 2,
      source: 'local',
      syncStatus: 'local-only',
    } as ReturnType<typeof useAppStore.getState>['recentDocuments'][number]

    render(
      <DocumentList
        documents={[document]}
        recentDocumentsState="ready"
        activeDocId={null}
        now={2}
        onOpen={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Local Notes' }))

    expect(onDelete).toHaveBeenCalledWith(document)
  })

  it('shows recent document source icons and relative time on mobile files view', () => {
    const now = new Date('2026-05-17T10:00:00.000Z').getTime()
    const documents = [
      {
        id: 'firebase-doc',
        title: 'Cloud Notes',
        markdown: '# Cloud Notes',
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        updatedAt: now - 2 * 24 * 60 * 60 * 1000,
        source: 'firebase',
        syncStatus: 'backed-up',
      },
    ] as ReturnType<typeof useAppStore.getState>['recentDocuments']

    render(
      <FilesView
        documents={documents}
        recentDocumentsState="ready"
        activeDocId="firebase-doc"
        now={now}
        search=""
        onSearch={vi.fn()}
        onNew={vi.fn()}
        onImport={vi.fn()}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByText('Cloud Notes')).toBeInTheDocument()
    expect(screen.getByText('2 days ago · 1 KB')).toBeInTheDocument()
    expect(screen.getByLabelText('Backed up document')).toBeInTheDocument()

  })

  it('scrolls editor and preview when selecting an outline item from preview mode', async () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0])
    fireEvent.click(screen.getByRole('button', { name: /Core markdown features/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Split' })).toHaveClass('active')
      expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    })
  })

  it('switches theme from editor topbar', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Select theme' }))
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Blue Eclipse' }))
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
  })

  it('opens the account menu without signing out immediately', () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Priyanshu Gaurav',
      email: 'priyanshu.grv11@gmail.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(container.querySelector<HTMLButtonElement>('.studio-topbar .avatar-button')!)

    expect(screen.getByText('Priyanshu Gaurav')).toBeInTheDocument()
    expect(screen.getByText('priyanshu.grv11@gmail.com')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    expect(signOutCurrentUser).not.toHaveBeenCalled()
    expect(listenToAuthState).toHaveBeenCalled()
  })

  it('requires inline confirmation before signing out', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Priyanshu Gaurav',
      email: 'priyanshu.grv11@gmail.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(container.querySelector<HTMLButtonElement>('.studio-topbar .avatar-button')!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    expect(screen.getByText('Sign out?')).toBeInTheDocument()
    expect(signOutCurrentUser).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel sign out' }))
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm sign out' }))

    await waitFor(() => {
      expect(signOutCurrentUser).toHaveBeenCalledTimes(1)
    })
  })

  it('closes and resets the account menu from escape and outside clicks', () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Priyanshu Gaurav',
      email: 'priyanshu.grv11@gmail.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    const accountButton = container.querySelector<HTMLButtonElement>('.studio-topbar .avatar-button')!

    fireEvent.click(accountButton)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()

    fireEvent.click(accountButton)
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('creates and cleans up ripple on pointerdown and keyboard activation', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const saveButton = screen.getAllByRole('button', { name: /Share/ })[0]

    fireEvent.pointerDown(saveButton, { button: 0, clientX: 24, clientY: 16 })
    const pointerRipple = saveButton.querySelector('.button-ripple')
    expect(pointerRipple).toBeInTheDocument()
    fireEvent.animationEnd(pointerRipple as Element)
    expect(saveButton.querySelector('.button-ripple')).not.toBeInTheDocument()

    fireEvent.keyDown(saveButton, { key: 'Enter' })
    const keyboardRipple = saveButton.querySelector('.button-ripple')
    expect(keyboardRipple).toBeInTheDocument()
    fireEvent.animationEnd(keyboardRipple as Element)
    expect(saveButton.querySelector('.button-ripple')).not.toBeInTheDocument()
  })

  it('does not create ripples on outline rows', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const outlineRow = screen.getByRole('button', { name: /Core markdown features/ })

    fireEvent.pointerDown(outlineRow, { button: 0, clientX: 24, clientY: 16 })

    expect(outlineRow.querySelector('.button-ripple')).not.toBeInTheDocument()
  })

  it('mounts only the visible desktop editor instance', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(container.querySelectorAll('.markdown-editor')).toHaveLength(1)
    expect(container.querySelector('.desktop-main-panels .markdown-editor')).toBeInTheDocument()
    expect(container.querySelector('.mobile-panel-surface .markdown-editor')).not.toBeInTheDocument()
  })

  it('mounts only the mobile write editor and unmounts it on non-write tabs', () => {
    mockMobileViewport(true)
    useAppStore.setState({ isHydrated: true, draftTitle: 'Mobile Test', draftMarkdown: 'Body' })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(container.querySelectorAll('.markdown-editor')).toHaveLength(1)
    expect(container.querySelector('.mobile-panel-surface .markdown-editor')).toBeInTheDocument()
    expect(container.querySelector('.desktop-main-panels .markdown-editor')).not.toBeInTheDocument()

    fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.mobile-mode-tab')[1])

    expect(container.querySelectorAll('.markdown-editor')).toHaveLength(0)
  })

  it('shows account access in the mobile topbar', () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Priyanshu Gaurav',
      email: 'priyanshu.grv11@gmail.com',
      photoURL: null,
    }
    mockMobileViewport(true)
    useAppStore.setState({ isHydrated: true, draftTitle: 'Mobile Test', draftMarkdown: 'Body' })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.queryByRole('button', { name: 'More options' })).not.toBeInTheDocument()
    fireEvent.click(container.querySelector<HTMLButtonElement>('.mobile-topbar .avatar-button')!)
    expect(screen.getByText('Priyanshu Gaurav')).toBeInTheDocument()
  })

  it('hides and shows the mobile appbar from active panel scroll direction', () => {
    mockMobileViewport(true)
    useAppStore.setState({ isHydrated: true, draftTitle: 'Mobile Test', draftMarkdown: 'Body' })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.mobile-topbar')!
    const panel = container.querySelector<HTMLElement>('.mobile-panel-surface')!

    Object.defineProperty(panel, 'scrollTop', { configurable: true, value: 30 })
    fireEvent.scroll(panel)
    expect(topbar).toHaveClass('appbar-hidden')

    Object.defineProperty(panel, 'scrollTop', { configurable: true, value: 12 })
    fireEvent.scroll(panel)
    expect(topbar).not.toHaveClass('appbar-hidden')
  })

  it('queues mobile sheet toolbar actions until the write editor is mounted', async () => {
    mockMobileViewport(true)
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Mobile Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Mobile Test',
      lastLocalSavedMarkdown: 'Body',
      mobileTab: 'write',
    })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(container.querySelectorAll<HTMLButtonElement>('.mobile-mode-tab')[1])
    expect(container.querySelectorAll('.markdown-editor')).toHaveLength(0)

    fireEvent.click(container.querySelector<HTMLButtonElement>('.mobile-bottom-bar .bottom-action:nth-child(3)')!)
    fireEvent.click(container.querySelector<HTMLButtonElement>('.insert-action[aria-label="Bold"]')!)

    await waitFor(() => {
      expect(useAppStore.getState().mobileTab).toBe('write')
      expect(useAppStore.getState().draftMarkdown).toBe('****Body')
    })
  })

  it('undoes and redoes editor toolbar edits', async () => {
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Undo Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Undo Test',
      lastLocalSavedMarkdown: 'Body',
    })
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    await waitFor(() => {
      expect(useAppStore.getState().draftMarkdown).toBe('****Body')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => {
      expect(useAppStore.getState().draftMarkdown).toBe('Body')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await waitFor(() => {
      expect(useAppStore.getState().draftMarkdown).toBe('****Body')
    })
  })

  it('opens a link popup and inserts a complete link', async () => {
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Link Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Link Test',
      lastLocalSavedMarkdown: 'Body',
    })
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Link' }))

    expect(screen.getByRole('dialog', { name: 'Insert link' })).toBeInTheDocument()
    expect(useAppStore.getState().draftMarkdown).toBe('Body')

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Docs' } })
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Insert link' })).getByRole('button', { name: 'Insert' }))

    await waitFor(() => {
      expect(useAppStore.getState().draftMarkdown).toBe('[Docs](https://example.com)Body')
    })
  })

  it('opens an image popup and inserts a complete image', async () => {
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Image Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Image Test',
      lastLocalSavedMarkdown: 'Body',
    })
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Image from URL' }))
    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Logo' } })
    fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/logo.png' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Insert image' })).getByRole('button', { name: 'Insert' }))

    await waitFor(() => {
      expect(useAppStore.getState().draftMarkdown).toBe('![Logo](https://example.com/logo.png)Body')
    })
  })

  it('cancels link popup without changing markdown', () => {
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Cancel Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Cancel Test',
      lastLocalSavedMarkdown: 'Body',
    })
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'Docs' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Insert link' })).not.toBeInTheDocument()
    expect(useAppStore.getState().draftMarkdown).toBe('Body')
  })

  it('opens the image popup from the mobile insert sheet after switching to write mode', async () => {
    mockMobileViewport(true)
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Mobile Image Test',
      draftMarkdown: 'Body',
      lastLocalSavedTitle: 'Mobile Image Test',
      lastLocalSavedMarkdown: 'Body',
      mobileTab: 'preview',
    })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(container.querySelector<HTMLButtonElement>('.mobile-bottom-bar .bottom-action:nth-child(3)')!)
    fireEvent.click(container.querySelector<HTMLButtonElement>('.insert-action[aria-label="Image from URL"]')!)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Insert image' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Alt text'), { target: { value: 'Logo' } })
    fireEvent.change(screen.getByLabelText('Image URL'), { target: { value: 'https://example.com/logo.png' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Insert image' })).getByRole('button', { name: 'Insert' }))

    await waitFor(() => {
      expect(useAppStore.getState().mobileTab).toBe('write')
      expect(useAppStore.getState().draftMarkdown).toBe('![Logo](https://example.com/logo.png)Body')
    })
  })

  it('renders local document route loading state', () => {
    window.history.pushState({}, '', '/doc/test-doc')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(screen.getByText(/Opening document/)).toBeInTheDocument()
    expect(screen.getByText('test-doc')).toBeInTheDocument()
  })

  it('renders share route missing state', async () => {
    window.history.pushState({}, '', '/share/public-123')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Shared document not found.')).toBeInTheDocument()
    })
    expect(screen.getByText('Shared Document')).toBeInTheDocument()
    expect(document.title).toBe('MD Studio')
    expect(screen.queryByText(/Share ID:/)).not.toBeInTheDocument()
  })

  it('shows shared document actions directly on desktop and switches theme', async () => {
    authMockState.currentUser = {
      uid: 'viewer',
      displayName: 'Viewer',
      email: 'viewer@example.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/share/public-123')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-123',
      title: 'Shared Menu Test',
      markdown: '# Shared Menu Test',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Shared Menu Test' })
    expect(document.title).toBe('Shared Menu Test | MD Studio')
    expect(screen.queryByRole('button', { name: 'Shared document menu' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy Link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make a Copy' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'blue-eclipse' } })
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
  })

  it('opens shared document menu actions on mobile and switches theme', async () => {
    mockMobileViewport(true)
    authMockState.currentUser = {
      uid: 'viewer',
      displayName: 'Viewer',
      email: 'viewer@example.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/share/public-123-mobile')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-123-mobile',
      title: 'Shared Mobile Menu Test',
      markdown: '# Shared Mobile Menu Test',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Shared Mobile Menu Test' })
    expect(screen.queryByRole('button', { name: 'Copy Link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make a Copy' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shared document menu' }))
    expect(screen.getByRole('menuitem', { name: 'Copy Link' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Make a Copy' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'blue-eclipse' } })
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
  })

  it('hides and shows the shared appbar from window scroll direction', async () => {
    window.history.pushState({}, '', '/share/public-scroll')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-scroll',
      title: 'Shared Scroll Test',
      markdown: '# Shared Scroll Test',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Shared Scroll Test' })
    const topbar = container.querySelector<HTMLElement>('.shared-topbar')!

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 30 })
    fireEvent.scroll(window)
    expect(topbar).toHaveClass('appbar-hidden')

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 12 })
    fireEvent.scroll(window)
    expect(topbar).not.toHaveClass('appbar-hidden')
  })
})
