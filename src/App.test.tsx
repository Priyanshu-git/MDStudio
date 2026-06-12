import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from 'firebase/auth'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { DocumentList, FilesView } from './editor/EditorShellPage'
import { useRelativeTimeNow } from './editor/useRelativeTimeNow'
import { listenToAuthState, signInWithGoogle, signOutCurrentUser } from './firebase/auth'
import { useAppStore } from './state/useAppStore'
import { db } from './storage/db'
import { createDocument, setActiveDocumentId } from './storage/documents'
import { backUpLocalDocument, deleteRecentDocument, refreshRecentDocumentsForUser } from './storage/documentSync'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './storage/shareDocuments'

const authMockState = vi.hoisted(() => ({
  currentUser: null as unknown,
}))
const clipboardWriteText = vi.fn()

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

function mockMobileViewport(matches: boolean, phoneMatches = matches) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        query === '(max-width: 1023px)'
          ? matches
          : query === '(max-width: 767px)'
            ? phoneMatches
            : query === '(min-width: 1560px)'
              ? !matches
            : false,
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
    Reflect.deleteProperty(window, 'launchQueue')
    Reflect.deleteProperty(window, 'LaunchParams')
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
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })
    document.title = 'MD Studio'
    vi.mocked(publishSharedDocument).mockResolvedValue({ shareId: 'share-id' })
    vi.mocked(getSharedDocumentById).mockResolvedValue(null)
    vi.mocked(updateSharedDocument).mockResolvedValue()
  })

  it('renders the dashboard at root', async () => {
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(await screen.findByText('MD Studio')).toBeInTheDocument()
    expect(await screen.findByText('Welcome!')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Write, preview, and manage Markdown documents.' })).toBeInTheDocument()
    expect(document.title).toBe('Dashboard | MD Studio')
  })

  it('shows only the first-landing loader until dashboard auth resolves', async () => {
    let authCallback: Parameters<typeof listenToAuthState>[0] | null = null
    vi.mocked(listenToAuthState).mockImplementationOnce((callback) => {
      authCallback = callback
      return vi.fn()
    })
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(await screen.findByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
    expect(screen.queryByText('MD Studio')).not.toBeInTheDocument()
    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Get started' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try without signing in' })).not.toBeInTheDocument()

    await act(async () => {
      authCallback?.({
        uid: 'user-1',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        photoURL: null,
      } as User)
    })

    expect(await screen.findByRole('heading', { name: 'Hi, Ada' })).toBeInTheDocument()
    expect(screen.queryByText('Welcome!')).not.toBeInTheDocument()
  })

  it('shows signed-out dashboard actions and signs in from get started', async () => {
    window.history.pushState({}, '', '/')
    vi.mocked(signInWithGoogle).mockResolvedValue({
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    } as never)

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(await screen.findByRole('button', { name: 'Try without signing in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New Blank Doc/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Import Markdown/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /View sample document/ })).toBeInTheDocument()
    expect(screen.getByText('Sign in to view your saved documents.')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Get started' })[0])

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    })
  })

  it('uses the shared overflow menu for signed-out dashboard theme and sign in', async () => {
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    const topbar = document.querySelector<HTMLElement>('.dashboard-topbar')!

    expect(within(topbar).queryByRole('combobox', { name: 'Theme' })).not.toBeInTheDocument()
    expect(within(topbar).queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()

    fireEvent.click(within(topbar).getByRole('button', { name: 'Account menu' }))

    expect(screen.getByRole('menuitem', { name: /Theme/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign in' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /Theme/ }))
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Blue Eclipse' }))

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
    })
  })

  it('uses the shared overflow menu for signed-in dashboard profile and sign out', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    const topbar = document.querySelector<HTMLElement>('.dashboard-topbar')!

    expect(within(topbar).queryByRole('combobox', { name: 'Theme' })).not.toBeInTheDocument()

    fireEvent.click(within(topbar).getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Theme/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))
    expect(screen.getByText('Sign out?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel sign out' }))
    expect(screen.queryByText('Sign out?')).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    expect(signOutCurrentUser).not.toHaveBeenCalled()
  })

  it('closes and resets the dashboard overflow menu from escape and outside clicks', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      photoURL: null,
    }
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    const accountButton = document.querySelector<HTMLButtonElement>('.dashboard-topbar .avatar-button')!

    fireEvent.click(accountButton)
    fireEvent.click(screen.getByRole('menuitem', { name: /Theme/ }))
    expect(screen.getByText('Light')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Light')).not.toBeInTheDocument()

    fireEvent.click(accountButton)
    expect(screen.getByRole('menuitem', { name: /Theme/ })).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: /Theme/ })).not.toBeInTheDocument()
  })

  it('opens a local blank draft from the signed-out dashboard', async () => {
    window.history.pushState({}, '', '/')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Try without signing in' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor')
    })
    expect(useAppStore.getState().draftTitle).toBe('Untitled Document')
    expect(useAppStore.getState().draftMarkdown).toContain('Welcome to MD Studio')
    expect(useAppStore.getState().activeDocId).toBeNull()
  })

  it('opens a fresh starter draft on direct editor visits instead of the active document', async () => {
    const active = await createDocument({ title: 'Last Opened Doc', markdown: '# Last Opened Doc' })
    await setActiveDocumentId(active.id)
    window.history.pushState({}, '', '/editor')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(useAppStore.getState().draftTitle).toBe('Untitled Document')
    })
    expect(useAppStore.getState().draftMarkdown).toContain('Welcome to MD Studio')
    expect(useAppStore.getState().draftMarkdown).not.toBe('# Last Opened Doc')
    expect(useAppStore.getState().activeDocId).toBeNull()
  })

  it('loads signed-in dashboard recent documents and opens one in the editor', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const doc = await createDocument({ title: 'Dashboard Notes', markdown: '# Dashboard Notes' })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([
      {
        id: doc.id,
        localDocumentId: doc.id,
        title: doc.title,
        markdown: doc.markdown,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        contentUpdatedAt: doc.contentUpdatedAt,
        source: doc.source,
        syncStatus: 'local-only',
      },
    ])
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Hi, Ada' })).toBeInTheDocument()
    const documentButtons = await screen.findAllByRole('button', { name: /Dashboard Notes/ })
    const documentButton = documentButtons.find((button) => button.classList.contains('dashboard-document-main'))
    expect(documentButton).toBeDefined()
    expect(refreshRecentDocumentsForUser).toHaveBeenCalledWith('user-1')

    fireEvent.click(documentButton as HTMLButtonElement)

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor')
    })
    expect(useAppStore.getState().activeDocId).toBe(doc.id)
    expect(useAppStore.getState().desktopViewMode).toBe('split')
    expect(useAppStore.getState().mobileTab).toBe('write')
  })

  it('shows direct dashboard actions with one relative timestamp on wider layouts', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const doc = await createDocument({ title: 'Action Notes', markdown: '# Action Notes' })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([
      {
        id: doc.id,
        localDocumentId: doc.id,
        title: doc.title,
        markdown: doc.markdown,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        contentUpdatedAt: doc.contentUpdatedAt,
        source: 'firebase',
        syncStatus: 'backed-up',
      },
    ])
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { name: 'Hi, Ada' })
    const rowButton = (await screen.findAllByRole('button', { name: /Action Notes/ }))
      .find((button) => button.classList.contains('dashboard-document-main'))!

    expect(within(rowButton).getByText('just now')).toBeInTheDocument()
    expect(screen.queryByText('Backed up')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Preview Action Notes' })).toHaveAttribute('title', 'Preview Action Notes')
    expect(screen.getByRole('button', { name: 'Share Action Notes' })).toHaveAttribute('title', 'Share Action Notes')
    expect(screen.getByRole('button', { name: 'Delete Action Notes' })).toHaveAttribute('title', 'Delete Action Notes')
    expect(screen.queryByRole('button', { name: 'Action Notes actions' })).not.toBeInTheDocument()
  })

  it('uses a three-dot options menu for document actions on phone layouts', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    mockMobileViewport(true)
    const doc = await createDocument({ title: 'Mobile Notes', markdown: '# Mobile Notes' })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([
      {
        id: doc.id,
        localDocumentId: doc.id,
        title: doc.title,
        markdown: doc.markdown,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        contentUpdatedAt: doc.contentUpdatedAt,
        source: doc.source,
        syncStatus: 'local-only',
      },
    ])
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { name: 'Hi, Ada' })
    expect(screen.queryByRole('button', { name: 'Preview Mobile Notes' })).not.toBeInTheDocument()

    const menuButton = await screen.findByRole('button', { name: 'Mobile Notes actions' }, { timeout: 5000 })
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(menuButton)

    const menu = screen.getByRole('menu', { name: 'Mobile Notes actions' })
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByRole('menuitem', { name: 'Preview' })).toHaveFocus()
    expect(within(menu).getByRole('menuitem', { name: 'Share' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu', { name: 'Mobile Notes actions' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  it('opens dashboard preview in preview mode on desktop and mobile', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const doc = await createDocument({ title: 'Preview Notes', markdown: '# Preview Notes' })
    const recent = {
      id: doc.id,
      localDocumentId: doc.id,
      title: doc.title,
      markdown: doc.markdown,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      contentUpdatedAt: doc.contentUpdatedAt,
      source: doc.source,
      syncStatus: 'local-only' as const,
    }
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([recent])
    window.history.pushState({}, '', '/')

    const firstRender = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    await screen.findByRole('heading', { name: 'Hi, Ada' })
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Preview Notes' }))

    await waitFor(() => expect(window.location.pathname).toBe('/editor'))
    expect(useAppStore.getState().desktopViewMode).toBe('preview')
    expect(useAppStore.getState().mobileTab).toBe('preview')

    firstRender.unmount()
    window.history.pushState({}, '', '/')
    mockMobileViewport(true)
    useAppStore.setState({ isHydrated: false, desktopViewMode: 'split', mobileTab: 'write' })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([recent])

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    await screen.findByRole('heading', { name: 'Hi, Ada' })
    fireEvent.click(await screen.findByRole('button', { name: 'Preview Notes actions' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Preview' }))

    await waitFor(() => expect(window.location.pathname).toBe('/editor'))
    expect(useAppStore.getState().desktopViewMode).toBe('preview')
    expect(useAppStore.getState().mobileTab).toBe('preview')
  })

  it('shares dashboard documents, reuses existing links, and copies title plus URL', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const existing = await createDocument({
      title: 'Already Shared',
      markdown: '# Already Shared',
      source: 'firebase',
      sourceShareId: 'existing-share',
      sourceOwnerUid: 'user-1',
    })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([
      {
        id: existing.id,
        localDocumentId: existing.id,
        title: existing.title,
        markdown: existing.markdown,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        contentUpdatedAt: existing.contentUpdatedAt,
        sourceShareId: 'existing-share',
        sourceOwnerUid: 'user-1',
        source: 'firebase',
        syncStatus: 'backed-up',
      },
    ])
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { name: 'Hi, Ada' })
    const shareButton = await screen.findByRole('button', { name: 'Share Already Shared' })
    shareButton.focus()
    fireEvent.click(shareButton)
    expect(screen.getByLabelText('Read-only share link')).toHaveValue('http://localhost:3000/share/existing-share')
    expect(screen.queryByRole('button', { name: 'Create Link' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close share dialog' })).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('Already Shared\nhttp://localhost:3000/share/existing-share')
    })
    expect(publishSharedDocument).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close share dialog' }))
    await waitFor(() => expect(shareButton).toHaveFocus())
  })

  it('creates a dashboard share link and keeps publish failures in the dialog', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const doc = await createDocument({ title: 'New Share', markdown: '# New Share' })
    const recent = {
      id: doc.id,
      localDocumentId: doc.id,
      title: doc.title,
      markdown: doc.markdown,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      contentUpdatedAt: doc.contentUpdatedAt,
      source: doc.source,
      syncStatus: 'local-only' as const,
    }
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([recent])
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { name: 'Hi, Ada' })
    fireEvent.click(await screen.findByRole('button', { name: 'Share New Share' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Link' }))

    expect(await screen.findByLabelText('Read-only share link')).toHaveValue('http://localhost:3000/share/share-id')
    expect(publishSharedDocument).toHaveBeenCalledTimes(1)
    expect(backUpLocalDocument).toHaveBeenCalled()
    await waitFor(async () => {
      expect(await db.documents.get(doc.id)).toEqual(expect.objectContaining({ sourceShareId: 'share-id' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close share dialog' }))
    vi.mocked(publishSharedDocument).mockRejectedValueOnce(new Error('publish failed'))
    fireEvent.click(await screen.findByRole('button', { name: 'Share New Share' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create Link' }))
    expect(await screen.findByText('Unable to share document. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Share document' })).toBeInTheDocument()
  })

  it('keeps dashboard deletion behind confirmation', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    const doc = await createDocument({ title: 'Delete Notes', markdown: '# Delete Notes' })
    vi.mocked(refreshRecentDocumentsForUser).mockResolvedValue([
      {
        id: doc.id,
        localDocumentId: doc.id,
        title: doc.title,
        markdown: doc.markdown,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        contentUpdatedAt: doc.contentUpdatedAt,
        source: doc.source,
        syncStatus: 'local-only',
      },
    ])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { name: 'Hi, Ada' })
    const deleteButton = await screen.findByRole('button', { name: 'Delete Delete Notes' })
    fireEvent.click(deleteButton)
    expect(deleteRecentDocument).not.toHaveBeenCalled()

    fireEvent.click(deleteButton)
    await waitFor(() => expect(deleteRecentDocument).toHaveBeenCalledWith('user-1', expect.objectContaining({ id: doc.id })))
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('opens local document routes as the selected saved document', async () => {
    const doc = await createDocument({ title: 'Route Doc', markdown: '# Route Doc\n\nSaved content.' })
    window.history.pushState({}, '', `/doc/${doc.id}`)

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor')
    })
    expect(useAppStore.getState().activeDocId).toBe(doc.id)
    expect(useAppStore.getState().draftTitle).toBe('Route Doc')
    expect(useAppStore.getState().draftMarkdown).toBe('# Route Doc\n\nSaved content.')
  })

  it('shows signed-in dashboard empty and error states', async () => {
    authMockState.currentUser = {
      uid: 'user-1',
      displayName: 'Ada',
      email: 'ada@example.com',
      photoURL: null,
    }
    vi.mocked(refreshRecentDocumentsForUser).mockRejectedValue(new Error('offline'))
    window.history.pushState({}, '', '/')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByText('Loading documents...')).toBeInTheDocument()
    await screen.findByText('Unable to load cloud documents. Showing local documents when available.')
    expect(screen.getByText('No documents yet.')).toBeInTheDocument()
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
    mockMobileViewport(true)
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    await act(async () => {})
    useAppStore.setState({ recentDocumentsState: 'ready', recentDocuments })
    fireEvent.click(screen.getByRole('button', { name: 'Files' }))
    useAppStore.setState({ recentDocumentsState: 'ready', recentDocuments })
    const otherDocButtons = await screen.findAllByRole('button', { name: /Other Doc/ })
    const otherDocOpenButton = otherDocButtons.find((button) => button.classList.contains('mobile-document-row-main'))
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

    await waitFor(() => {
      expect(document.title).toBe('Untitled Document | MD Studio')
    })

    fireEvent.change(screen.getByDisplayValue('Untitled Document'), { target: { value: 'Draft Rename' } })

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
    expect(screen.getByRole('heading', { level: 1, name: 'Untitled Document' })).toBeInTheDocument()
  })

  it('only exposes split and preview desktop view modes', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Split' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Preview' })[0]).toBeInTheDocument()
  })

  it('uses the desktop left pane only for outline', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const sidebar = container.querySelector<HTMLElement>('.desktop-sidebar')!
    expect(within(sidebar).getByRole('heading', { name: 'Outline' })).toBeInTheDocument()
    expect(within(sidebar).getByRole('button', { name: /What you can create/ })).toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: 'Documents' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('heading', { name: 'Recent Documents' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: 'New' })).not.toBeInTheDocument()
    expect(within(sidebar).queryByRole('button', { name: 'Import .md' })).not.toBeInTheDocument()
    expect(sidebar.querySelector('.sidebar-tabs')).not.toBeInTheDocument()
  })

  it('loads a launched markdown file into the editor route', async () => {
    let consumer: ((launchParams: LaunchParams) => void) | null = null
    class MockLaunchParams {
      files: FileSystemFileHandle[] = []
    }
    MockLaunchParams.prototype.files = []
    Object.defineProperty(window, 'LaunchParams', {
      configurable: true,
      value: MockLaunchParams,
    })
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: vi.fn((nextConsumer: (launchParams: LaunchParams) => void) => {
          consumer = nextConsumer
        }),
      },
    })
    window.history.pushState({}, '', '/open-md')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(consumer).not.toBeNull()
    })

    const file = {
      name: 'explorer-file.md',
      text: async () => '# Explorer File\n\nOpened from Windows.',
    } as File
    await act(async () => {
      consumer?.({
        files: [
          {
            name: file.name,
            getFile: async () => file,
          } as FileSystemFileHandle,
        ],
      })
    })

    await waitFor(() => {
      expect(window.location.pathname).toBe('/editor')
    })
    expect(useAppStore.getState().draftTitle).toBe('explorer-file')
    expect(useAppStore.getState().draftMarkdown).toBe('# Explorer File\n\nOpened from Windows.')
    expect(screen.getByRole('heading', { level: 1, name: 'Explorer File' })).toBeInTheDocument()
  })

  it('opens the dashboard when the PWA launches without a file', async () => {
    let consumer: ((launchParams: LaunchParams) => void) | null = null
    class MockLaunchParams {
      files: FileSystemFileHandle[] = []
    }
    MockLaunchParams.prototype.files = []
    Object.defineProperty(window, 'LaunchParams', {
      configurable: true,
      value: MockLaunchParams,
    })
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: vi.fn((nextConsumer: (launchParams: LaunchParams) => void) => {
          consumer = nextConsumer
        }),
      },
    })
    window.history.pushState({}, '', '/open-md')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await act(async () => {
      consumer?.({ files: [] })
    })

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })
    expect(screen.getByText('Welcome!')).toBeInTheDocument()
  })

  it('falls back to manual import when File Handling API is unavailable', () => {
    window.history.pushState({}, '', '/open-md')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByText('This browser cannot open files through the PWA File Handling API.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import .md file' })).toBeInTheDocument()
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

  it('keeps preview mode active when selecting an outline item from preview mode', async () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0])
    fireEvent.click(screen.getByRole('button', { name: /What you can create/ }))

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Preview' })[0]).toHaveClass('active')
      expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    })
  })

  it('keeps split mode active when selecting an outline item from split mode', async () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /What you can create/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Split' })).toHaveClass('active')
      expect(HTMLElement.prototype.scrollTo).toHaveBeenCalled()
    })
  })

  it('shows new as the primary topbar action and creates a fresh draft', () => {
    window.history.pushState({}, '', '/editor')
    useAppStore.setState({ saveStatus: 'saved' })
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.studio-topbar')!
    const newButton = within(topbar).getByRole('button', { name: 'New' })
    expect(newButton).toHaveClass('primary-button')

    fireEvent.click(newButton)

    expect(useAppStore.getState().draftTitle).toBe('Untitled Document')
    expect(useAppStore.getState().draftMarkdown).toContain('Welcome to MD Studio')
    expect(useAppStore.getState().isHydrated).toBe(true)
    expect(useAppStore.getState().desktopViewMode).toBe('split')
  })

  it('opens new document options and uploads markdown from the topbar new menu', () => {
    window.history.pushState({}, '', '/editor')
    useAppStore.setState({ isHydrated: true, saveStatus: 'saved' })
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.studio-topbar')!
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]')!
    const clickInput = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined)

    fireEvent.click(within(topbar).getByRole('button', { name: 'New options' }))
    expect(screen.getByRole('menuitem', { name: 'New Document' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Upload .md file' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menuitem', { name: 'New Document' })).not.toBeInTheDocument()

    fireEvent.click(within(topbar).getByRole('button', { name: 'New options' }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Upload .md file' })).not.toBeInTheDocument()

    fireEvent.click(within(topbar).getByRole('button', { name: 'New options' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Upload .md file' }))

    expect(clickInput).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menuitem', { name: 'Upload .md file' })).not.toBeInTheDocument()
    clickInput.mockRestore()
  })

  it('uses a secondary save button with save-as options instead of standalone export', async () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.studio-topbar')!
    const saveButton = within(topbar).getByRole('button', { name: 'Save' })
    expect(saveButton).toHaveClass('secondary-button')
    expect(saveButton).not.toHaveClass('primary-button')
    expect(within(topbar).queryByRole('button', { name: 'Export' })).not.toBeInTheDocument()

    fireEvent.click(saveButton)
    await waitFor(() => {
      expect(useAppStore.getState().activeDocId).not.toBeNull()
    })

    fireEvent.click(within(topbar).getByRole('button', { name: 'Save options' }))
    expect(screen.getByRole('menuitem', { name: 'Save as HTML' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Save as MD' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Save as PDF' })).toBeInTheDocument()
  })

  it('switches theme from the global overflow menu', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.studio-topbar')!
    expect(within(topbar).queryByRole('button', { name: 'Select theme' })).not.toBeInTheDocument()

    fireEvent.click(topbar.querySelector<HTMLButtonElement>('.avatar-button')!)
    expect(screen.getByRole('menuitem', { name: 'Sign in' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitem', { name: /Theme/ }))
    expect(screen.getByText('Light')).toBeInTheDocument()
    expect(screen.getByText('Dark')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Blue Eclipse' }))
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
  })

  it('uses the signed-out account icon as the global overflow menu', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const topbar = container.querySelector<HTMLElement>('.studio-topbar')!
    expect(within(topbar).queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(within(topbar).queryByRole('button', { name: 'Select theme' })).not.toBeInTheDocument()

    fireEvent.click(topbar.querySelector<HTMLButtonElement>('.avatar-button')!)

    expect(screen.getByRole('menuitem', { name: /Theme/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sign in' })).toBeInTheDocument()
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
    expect(screen.getByRole('menuitem', { name: /Theme/ })).toBeInTheDocument()
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

    const outlineRow = screen.getByRole('button', { name: /What you can create/ })

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

  it('exposes dashboard navigation in the editor and guards unsaved changes', async () => {
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Unsaved Dashboard Test',
      draftMarkdown: 'Changed',
      lastLocalSavedTitle: 'Unsaved Dashboard Test',
      lastLocalSavedMarkdown: 'Original',
      saveStatus: 'unsaved',
    })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const desktopDashboardButton = within(container.querySelector<HTMLElement>('.studio-topbar')!).getByRole('button', { name: 'Dashboard' })
    fireEvent.click(desktopDashboardButton)

    expect(screen.getByRole('dialog', { name: 'Unsaved changes' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })
  })

  it('exposes dashboard navigation in the mobile editor topbar', () => {
    mockMobileViewport(true)
    useAppStore.setState({ isHydrated: true, draftTitle: 'Mobile Test', draftMarkdown: 'Body', saveStatus: 'saved' })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(within(container.querySelector<HTMLElement>('.mobile-topbar')!).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('uses the compact editor layout on tablet widths', () => {
    mockMobileViewport(true, false)
    useAppStore.setState({
      isHydrated: true,
      draftTitle: 'Tablet Test',
      draftMarkdown: 'Body',
      saveStatus: 'saved',
      mobileTab: 'write',
    })
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(container.querySelector('.mobile-topbar')).toBeInTheDocument()
    expect(container.querySelector('.mobile-mode-tabs')).toBeInTheDocument()
    expect(container.querySelector('.mobile-bottom-bar')).toBeInTheDocument()
    expect(container.querySelectorAll('.workspace-panel')).toHaveLength(0)
    expect(container.querySelectorAll('.mobile-panel-surface .markdown-editor')).toHaveLength(1)
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

  it('renders local document route loading state', async () => {
    window.history.pushState({}, '', '/doc/test-doc')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(await screen.findByText(/Opening document/)).toBeInTheDocument()
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

  it('shows an expanded floating outline on wide desktop and scrolls to headings', async () => {
    window.history.pushState({}, '', '/share/public-outline')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-outline',
      title: 'Outline Test',
      markdown: '# Introduction\n\nBody\n\n### Deep Section',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo })

    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Introduction' })
    const panel = container.querySelector<HTMLElement>('.shared-desktop-outline-panel')!
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Introduction H1' })).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Deep Section H3' })).toBeInTheDocument()

    const target = screen.getByRole('heading', { level: 3, name: 'Deep Section' })
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 300,
      bottom: 330,
      left: 0,
      right: 0,
      width: 100,
      height: 30,
      x: 0,
      y: 300,
      toJSON: () => ({}),
    })
    fireEvent.click(within(panel).getByRole('button', { name: 'Deep Section H3' }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 216, behavior: 'smooth' })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse document outline' }))
    expect(container.querySelector('.shared-desktop-outline-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open document outline' }))
    expect(container.querySelector('.shared-desktop-outline-panel')).toBeInTheDocument()
  })

  it('starts the floating desktop outline collapsed when the viewport gutter is narrow', async () => {
    mockMobileViewport(true, false)
    window.history.pushState({}, '', '/share/public-compact-desktop-outline')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-compact-desktop-outline',
      title: 'Compact Desktop Outline',
      markdown: '# Start',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Start' })
    expect(screen.queryByRole('button', { name: 'Collapse document outline' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open document outline' }))
    expect(screen.getByRole('button', { name: 'Collapse document outline' })).toBeInTheDocument()
  })

  it('navigates from a shared document back to the dashboard', async () => {
    window.history.pushState({}, '', '/share/public-dashboard')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-dashboard',
      title: 'Shared Dashboard Link Test',
      markdown: '# Shared Dashboard Link Test',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Shared Dashboard Link Test' })
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/')
    })
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

  it('opens and dismisses the mobile shared-document outline with focus restoration', async () => {
    mockMobileViewport(true)
    window.history.pushState({}, '', '/share/public-mobile-outline')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-mobile-outline',
      title: 'Mobile Outline Test',
      markdown: '# Start\n\n## Next',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Start' })
    const trigger = screen.getByRole('button', { name: 'Open document outline' })
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Document Outline' })
    expect(within(dialog).getByRole('button', { name: 'Start H1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close document outline' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Document Outline' })).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.mouseDown(container.querySelector<HTMLElement>('.shared-outline-backdrop')!)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Document Outline' })).not.toBeInTheDocument())
  })

  it('keeps the mobile outline available for shared documents without headings', async () => {
    mockMobileViewport(true)
    window.history.pushState({}, '', '/share/public-empty-outline')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'public-empty-outline',
      title: 'No Outline Test',
      markdown: 'A paragraph without headings.',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByText('A paragraph without headings.')
    fireEvent.click(screen.getByRole('button', { name: 'Open document outline' }))
    expect(screen.getByRole('dialog', { name: 'Document Outline' })).toHaveTextContent('No headings yet.')
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
