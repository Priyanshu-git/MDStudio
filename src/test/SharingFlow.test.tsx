import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { db } from '../storage/db'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from '../storage/shareDocuments'

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

describe('Sharing flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.documents.clear()
    await db.appState.clear()
  })

  it('saves as new from editor and shows share link', async () => {
    window.history.pushState({}, '', '/editor')
    vi.mocked(publishSharedDocument).mockResolvedValue({ shareId: 'share-1' })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Welcome to Markdown Studio/ })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save as New' }))

    await waitFor(() => {
      expect(screen.getByText(/Shared link:/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /\/share\/share-1/ })).toBeInTheDocument()
  })

  it('edits shared document with cloud-linked actions', async () => {
    window.history.pushState({}, '', '/share/share-xyz')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'share-xyz',
      markdown: '# Shared Title',
      createdAt: 1,
      updatedAt: 2,
    })

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument()
    })
    expect(screen.getByText('Status:')).toBeInTheDocument()
    expect(screen.getByText('Synced to Cloud')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Markdown input'), {
      target: { value: '# Changed' },
    })
    await waitFor(() => {
      expect(screen.getByText('Unsaved Changes')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Update' }))
    await waitFor(() => {
      expect(updateSharedDocument).toHaveBeenCalledWith(
        'share-xyz',
        expect.objectContaining({ markdown: '# Changed' }),
      )
    })
  })

  it('renders shared document from firestore route', async () => {
    window.history.pushState({}, '', '/share/share-xyz')
    vi.mocked(getSharedDocumentById).mockResolvedValue({
      id: 'share-xyz',
      markdown: '# Shared Title',
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
