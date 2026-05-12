import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { getSharedDocumentById, publishSharedDocument } from './storage/shareDocuments'

vi.mock('./storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
}))

describe('App routing shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(publishSharedDocument).mockResolvedValue({ shareId: 'share-id' })
    vi.mocked(getSharedDocumentById).mockResolvedValue(null)
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

  it('toggles read-only documentation view from editor', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Documentation View' }))
    expect(screen.getByRole('button', { name: 'Back to Edit' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Markdown input')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Markdown Studio' })).toBeInTheDocument()
  })

  it('switches theme from editor topbar', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'dracula' } })
    expect(document.documentElement.dataset.theme).toBe('dracula')
  })

  it('renders local document route placeholder', () => {
    window.history.pushState({}, '', '/doc/test-doc')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(screen.getByText('Local Document Route')).toBeInTheDocument()
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
    expect(screen.getByText('Share ID: public-123')).toBeInTheDocument()
  })
})
