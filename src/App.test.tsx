import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { DocumentList, FilesView } from './editor/EditorShellPage'
import { listenToAuthState, signOutCurrentUser } from './firebase/auth'
import { useAppStore } from './state/useAppStore'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './storage/shareDocuments'

const authMockState = vi.hoisted(() => ({
  currentUser: null as unknown,
}))

vi.mock('./storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
  updateSharedDocument: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks()
    authMockState.currentUser = null
    mockMobileViewport(false)
    useAppStore.setState({
      activeDocId: null,
      activeShareId: null,
      documents: [],
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
    expect(screen.getByText('Markdown Studio')).toBeInTheDocument()
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

  it('switches desktop sidebar between documents and outline', () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Recent Documents' })).toBeInTheDocument()
    const outlineTab = container.querySelector<HTMLButtonElement>('.desktop-sidebar .sidebar-tab:nth-child(2)')
    expect(outlineTab).not.toBeNull()

    fireEvent.click(outlineTab as HTMLButtonElement)

    expect(outlineTab).toHaveClass('active')
    expect(screen.queryByRole('heading', { name: 'Recent Documents' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Core markdown features/ })).toBeInTheDocument()
  })

  it('shows recent document source icons and relative time on desktop', async () => {
    const now = new Date('2026-05-17T10:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    const documents = [
      {
        id: 'firebase-doc',
        title: 'Cloud Notes',
        markdown: '# Cloud Notes',
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        updatedAt: now - 2 * 24 * 60 * 60 * 1000,
        source: 'firebase',
        sourceShareId: 'share-1',
        sourceOwnerUid: 'user-1',
      },
      {
        id: 'local-doc',
        title: 'Local Notes',
        markdown: '# Local Notes',
        createdAt: now - 5 * 60 * 1000,
        updatedAt: now - 5 * 60 * 1000,
        source: 'local',
      },
    ] as ReturnType<typeof useAppStore.getState>['documents']

    render(
      <DocumentList
        documents={documents}
        activeDocId="local-doc"
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('Local Notes')).toBeInTheDocument()
    expect(screen.getByText('5 mins ago')).toBeInTheDocument()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Local document').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('Firebase document').length).toBeGreaterThan(0)
    expect(screen.queryByText(new Date(now - 5 * 60 * 1000).toLocaleDateString())).not.toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it('shows recent document source icons and relative time on mobile files view', () => {
    const now = new Date('2026-05-17T10:00:00.000Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)
    const documents = [
      {
        id: 'firebase-doc',
        title: 'Cloud Notes',
        markdown: '# Cloud Notes',
        createdAt: now - 2 * 24 * 60 * 60 * 1000,
        updatedAt: now - 2 * 24 * 60 * 60 * 1000,
        source: 'firebase',
        sourceShareId: 'share-1',
        sourceOwnerUid: 'user-1',
      },
    ] as ReturnType<typeof useAppStore.getState>['documents']

    render(
      <FilesView
        documents={documents}
        activeDocId="firebase-doc"
        search=""
        onSearch={vi.fn()}
        onNew={vi.fn()}
        onImport={vi.fn()}
        onOpen={vi.fn()}
      />,
    )

    expect(screen.getByText('Cloud Notes')).toBeInTheDocument()
    expect(screen.getByText('2 days ago · 1 KB')).toBeInTheDocument()
    expect(screen.getByLabelText('Firebase document')).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it('scrolls editor and preview when selecting an outline item from preview mode', async () => {
    window.history.pushState({}, '', '/editor')
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Preview' })[0])
    fireEvent.click(container.querySelector<HTMLButtonElement>('.desktop-sidebar .sidebar-tab:nth-child(2)')!)
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

    fireEvent.change(screen.getByDisplayValue('GitHub Light'), { target: { value: 'dracula' } })
    expect(document.documentElement.dataset.theme).toBe('dracula')
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
    const { container } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(container.querySelector<HTMLButtonElement>('.desktop-sidebar .sidebar-tab:nth-child(2)')!)
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
    expect(screen.queryByText(/Share ID:/)).not.toBeInTheDocument()
  })
})
