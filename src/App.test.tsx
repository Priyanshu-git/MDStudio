import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './storage/shareDocuments'

vi.mock('./storage/shareDocuments', () => ({
  publishSharedDocument: vi.fn(),
  getSharedDocumentById: vi.fn(),
  updateSharedDocument: vi.fn(),
}))

describe('App routing shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('toggles read-only view from editor', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Read only view' }))
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

  it('creates and cleans up ripple on pointerdown and keyboard activation', () => {
    window.history.pushState({}, '', '/editor')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    const saveButton = screen.getByRole('button', { name: 'Save as New' })

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
    expect(screen.queryByText(/Share ID:/)).not.toBeInTheDocument()
  })
})
