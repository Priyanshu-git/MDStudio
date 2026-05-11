import { fireEvent, render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App routing shell', () => {
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

  it('renders share route placeholder', () => {
    window.history.pushState({}, '', '/share/public-123')
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )
    expect(screen.getByText('Share Route')).toBeInTheDocument()
    expect(screen.getByText('public-123')).toBeInTheDocument()
  })
})
