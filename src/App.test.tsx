import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { useAppStore } from './state/useAppStore'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './storage/shareDocuments'

vi.mock('./storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
  updateSharedDocument: vi.fn(),
}))

vi.mock('./firebase/auth', () => ({
  listenToAuthState: vi.fn((callback: (user: unknown) => void) => {
    callback(null)
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
