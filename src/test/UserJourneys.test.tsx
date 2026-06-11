import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { App } from '../App'
import { db } from '../storage/db'
import { useAppStore } from '../state/useAppStore'

// Mock shiki and mermaid to avoid heavy lifting in integration tests
vi.mock('shiki', () => ({
  codeToHtml: vi.fn(async (code) => `<pre><code>${code}</code></pre>`),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id) => ({ svg: `<svg id="${id}">Diagram</svg>` })),
  },
}))

vi.mock('../firebase/auth', () => ({
  listenToAuthState: vi.fn((callback: (user: unknown) => void) => {
    callback(null)
    return vi.fn()
  }),
  signInWithGoogle: vi.fn(),
  signOutCurrentUser: vi.fn(),
  getOwnerProfile: vi.fn(() => ({ uid: 'user-1', displayName: 'Ada', email: 'ada@example.com' })),
}))

describe('User Journeys', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.appState.clear()
    useAppStore.setState({
      activeDocId: null,
      activeShareId: null,
      documents: [],
      draftTitle: 'Markdown Rendering Test File',
      draftMarkdown: '# Markdown Rendering Test File',
      lastLocalSavedTitle: '',
      lastLocalSavedMarkdown: '',
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
      isHydrated: false,
      theme: 'minimal-ivory',
      mobileTab: 'write',
      desktopViewMode: 'split',
      saveStatus: 'local-only',
      saveError: null,
    })
    // Reset window location
    window.history.pushState({}, '', '/editor')
  })

  it('completes a full editing and viewing cycle', async () => {
    await import('../editor/EditorShellPage')

    const { unmount } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    // 1. Direct editor visits start a fresh starter draft.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Untitled Document' })).toBeInTheDocument()
    })

    // 2. Edit markdown through the V2 store-backed CodeMirror flow
    act(() => {
      useAppStore.getState().setDraftMarkdown('# My New Document\n\nSome content.')
    })

    // 3. Verify preview updates
    expect(screen.getByRole('heading', { level: 1, name: 'My New Document' })).toBeInTheDocument()

    // 4. Toggle Preview view
    const previewButton = screen.getAllByRole('button', { name: 'Preview' })[0]
    fireEvent.click(previewButton)
    expect(previewButton).toHaveClass('active')

    // 5. Change theme
    fireEvent.click(screen.getAllByRole('button', { name: 'Account menu' })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: /Theme/ }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Blue Eclipse' }))
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')

    // 6. Manual save is required before reload persistence
    await act(async () => {
      await useAppStore.getState().saveDraft()
    })
    const savedDocId = useAppStore.getState().activeDocId!

    // 7. Simulate reopening the saved document through its explicit route.
    unmount()
    useAppStore.setState({
      activeDocId: null,
      activeShareId: null,
      documents: [],
      draftTitle: 'Markdown Rendering Test File',
      draftMarkdown: '# Markdown Rendering Test File',
      lastLocalSavedTitle: '',
      lastLocalSavedMarkdown: '',
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
      isHydrated: false,
      saveStatus: 'local-only',
      saveError: null,
    })
    window.history.pushState({}, '', `/doc/${savedDocId}`)
    
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    // Verify state restored from IndexedDB through the explicit document route.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'My New Document' })).toBeInTheDocument()
    })
    expect(document.documentElement.dataset.theme).toBe('blue-eclipse')
  })
})
