import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { App } from '../App'
import { db } from '../storage/db'

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
      expect(screen.getByRole('heading', { level: 1, name: /Welcome to Markdown Studio/ })).toBeInTheDocument()
    })

    // 2. Edit markdown
    const editor = screen.getByLabelText('Markdown input')
    fireEvent.change(editor, { target: { value: '# My New Document\n\nSome content.' } })

    // 3. Verify preview updates
    expect(screen.getByRole('heading', { level: 1, name: 'My New Document' })).toBeInTheDocument()

    // 4. Toggle Documentation View
    fireEvent.click(screen.getByRole('button', { name: 'Documentation View' }))
    expect(screen.queryByLabelText('Markdown input')).not.toBeInTheDocument()
    expect(screen.getByText('Back to Edit')).toBeInTheDocument()

    // 5. Change theme
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'nord' } })
    expect(document.documentElement.dataset.theme).toBe('nord')

    // 6. Simulate reload by unmounting and remounting
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
    expect(document.documentElement.dataset.theme).toBe('nord')
  })
})
