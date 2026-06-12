import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { db } from '../storage/db'
import { getSharedDocumentById, publishSharedDocument } from '../storage/shareDocuments'
import { useAppStore } from '../state/useAppStore'

const authMock = vi.hoisted(() => ({
  user: null as null | { uid: string; displayName: string; email: string },
}))
const clipboardWriteText = vi.fn()

vi.mock('shiki', () => ({
  codeToHtml: vi.fn(async (code) => `<pre><code>${code}</code></pre>`),
}))

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id) => ({ svg: `<svg id="${id}">Diagram</svg>` })),
  },
}))

vi.mock('../storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
  updateSharedDocument: vi.fn(),
}))

vi.mock('../storage/documentSync', () => ({
  backUpLocalDocument: vi.fn(async (_uid: string, doc: unknown) => doc),
  deleteRecentDocument: vi.fn(),
  refreshLocalRecentDocuments: vi.fn(async () => []),
  refreshRecentDocumentsForUser: vi.fn(async () => []),
}))

vi.mock('../firebase/auth', () => ({
  listenToAuthState: vi.fn((callback: (user: unknown) => void) => {
    callback(authMock.user)
    return vi.fn()
  }),
  signInWithGoogle: vi.fn(async () => {
    authMock.user = { uid: 'user-1', displayName: 'Ada', email: 'ada@example.com' }
    return authMock.user
  }),
  signOutCurrentUser: vi.fn(),
  getOwnerProfile: vi.fn((user: { uid: string; displayName: string; email: string }) => ({
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
  })),
}))

describe('Sharing flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    authMock.user = { uid: 'user-1', displayName: 'Ada', email: 'ada@example.com' }
    await db.documents.clear()
    await db.appState.clear()
    useAppStore.setState({ isHydrated: false, activeShareId: null })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    })
  })

  it('creates a read-only share link from editor', async () => {
    await import('../editor/EditorShellPage')

    window.history.pushState({}, '', '/editor')
    vi.mocked(publishSharedDocument).mockResolvedValue({ shareId: 'share-1' })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Untitled Document')).toBeInTheDocument()
    }, { timeout: 5000 })

    fireEvent.click(screen.getAllByRole('button', { name: /Share/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: 'Create Link' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Read-only share link')).toHaveValue('http://localhost:3000/share/share-1')
    }, { timeout: 5000 })
    expect(publishSharedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: expect.objectContaining({ uid: 'user-1' }),
      }),
    )
    await waitFor(() => {
      expect(useAppStore.getState().documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'firebase',
            sourceShareId: 'share-1',
            sourceOwnerUid: 'user-1',
          }),
        ]),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('Untitled Document\nhttp://localhost:3000/share/share-1')
    })
  }, 20000)

  it('does not show update action for an existing shared link in the editor', async () => {
    window.history.pushState({}, '', '/editor')

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Untitled Document')).toBeInTheDocument()
    })

    act(() => {
      useAppStore.getState().linkActiveShare('share-xyz', 'Untitled Document', useAppStore.getState().draftMarkdown)
    })

    act(() => {
      useAppStore.getState().setDraftMarkdown('# Changed')
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Share/ })[0])
    expect(await screen.findByLabelText('Read-only share link')).toHaveValue('http://localhost:3000/share/share-xyz')
    expect(screen.queryByRole('button', { name: 'Update Link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create Link' })).not.toBeInTheDocument()
  })

  it('renders shared document from firestore route with make-copy action for non-owners', async () => {
    authMock.user = { uid: 'viewer', displayName: 'Viewer', email: 'viewer@example.com' }
    window.history.pushState({}, '', '/share/share-xyz')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'share-xyz',
      title: 'Shared Title',
      markdown: '# Shared Title',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Shared Title' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Shared document menu' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Theme')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make a Copy' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Original' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }))
    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledWith('Shared Title\nhttp://localhost:3000/share/share-xyz')
    })
  })

  it('keeps non-owner shared document copies as local documents', async () => {
    authMock.user = { uid: 'viewer', displayName: 'Viewer', email: 'viewer@example.com' }
    window.history.pushState({}, '', '/share/share-copy')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'share-copy',
      title: 'Shared Copy Source',
      markdown: '# Shared Copy Source',
      ownerUid: 'owner-1',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Shared Copy Source' })
    fireEvent.click(await screen.findByRole('button', { name: 'Make a Copy' }))

    await waitFor(async () => {
      const documents = await db.documents.toArray()
      expect(documents[0]).toEqual(
        expect.objectContaining({
          title: 'Copy of Shared Copy Source',
          source: 'local',
        }),
      )
    })
  })

  it('persists owner-opened shared documents as firebase sourced recent documents', async () => {
    window.history.pushState({}, '', '/share/share-owned')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'share-owned',
      title: 'Owner Cloud Title',
      markdown: '# Owner Cloud Title',
      ownerUid: 'user-1',
      createdAt: 1,
      updatedAt: 2,
      sourceDocId: 'missing-local-source',
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await screen.findByRole('heading', { level: 1, name: 'Owner Cloud Title' })
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))

    await waitFor(async () => {
      const documents = await db.documents.toArray()
      expect(documents).toHaveLength(1)
      expect(documents[0]).toEqual(
        expect.objectContaining({
          title: 'Owner Cloud Title',
          source: 'firebase',
          sourceShareId: 'share-owned',
          sourceOwnerUid: 'user-1',
        }),
      )
    })
  })

  it('shows not found state for missing shared document', async () => {
    window.history.pushState({}, '', '/share/missing')
    vi.mocked(getSharedDocumentById).mockResolvedValue(null)

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Shared document not found.')).toBeInTheDocument()
    })
  })
})
