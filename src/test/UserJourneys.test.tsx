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
    // Reset window location
    window.history.pushState({}, '', '/editor')
  })

  it('completes a full editing and viewing cycle', async () => {
    const { unmount } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    // 1. Initial hydration
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Markdown Rendering Test File/ })).toBeInTheDocument()
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
    fireEvent.change(screen.getByDisplayValue('GitHub Light'), { target: { value: 'dracula' } })
    expect(document.documentElement.dataset.theme).toBe('dracula')

    // 6. Manual save is required before reload persistence
    await act(async () => {
      await useAppStore.getState().saveDraft()
    })

    // 7. Simulate reload by unmounting and remounting
    unmount()
    
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    // Verify state restored from IndexedDB
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'My New Document' })).toBeInTheDocument()
    })
    expect(document.documentElement.dataset.theme).toBe('dracula')
  })
})
