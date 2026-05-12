import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { db } from '../storage/db'
import { getSharedDocumentById, publishSharedDocument } from '../storage/shareDocuments'

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
}))

describe('Sharing flow', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.documents.clear()
    await db.appState.clear()
  })

  it('publishes from editor and shows share link', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))

    await waitFor(() => {
      expect(screen.getByText(/Shared link:/)).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /\/share\/share-1/ })).toBeInTheDocument()
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
