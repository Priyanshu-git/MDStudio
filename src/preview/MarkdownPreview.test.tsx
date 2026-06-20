import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'
import { codeToHtml } from 'shiki'

// Mock shiki
vi.mock('shiki', () => ({
  codeToHtml: vi.fn(async (code) => `<pre class="shiki"><code>${code}</code></pre>`),
}))

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id) => ({ svg: `<svg id="${id}">Diagram</svg>` })),
  },
}))

describe('MarkdownPreview', () => {
  it('renders standard markdown elements', () => {
    const markdown = '# Heading 1\n\n- List item 1\n- List item 2\n\n**Bold text**'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('Bold text').tagName).toBe('STRONG')
  })

  it('adds source line metadata to headings for outline navigation', () => {
    const markdown = '# Heading 1\n\nBody\n\n## Heading 2'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toHaveAttribute('data-source-line', '1')
    expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toHaveAttribute('data-source-line', '5')
  })

  it('renders math using KaTeX', () => {
    const markdown = 'Inline math: $E=mc^2$\n\nBlock math:\n\n$$\n\\int x dx\n$$'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    // KaTeX renders math with specific classes
    expect(document.querySelector('.katex')).toBeInTheDocument()
    expect(document.querySelector('.katex-display')).toBeInTheDocument()
  })

  it('routes code blocks through CodeBlock renderer', async () => {
    const markdown = '```js\nconsole.log("hello");\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    // Check if CodeBlock toolbar is present
    expect(screen.getByText('js')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument()
    
    // Check if highlighted content eventually appears
    const highlight = await screen.findByText('console.log("hello");')
    expect(highlight).toBeInTheDocument()
  })

  it('shows copied feedback after copying a code block', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const markdown = '```ts\ntype CopyTarget = {}\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('type CopyTarget = {}')
    })
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Code copied' })).toBeInTheDocument()
  })

  it('uses GitHub dark syntax highlighting for GitHub dark theme', async () => {
    const markdown = '```ts\ntype MarkdownDocument = {}\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-dark" />)

    await screen.findByText('type MarkdownDocument = {}')
    expect(codeToHtml).toHaveBeenCalledWith(
      'type MarkdownDocument = {}',
      expect.objectContaining({
        lang: 'ts',
        theme: 'github-dark-default',
      }),
    )
  })

  it('keeps token classes when Shiki highlighting falls back', async () => {
    vi.mocked(codeToHtml).mockRejectedValueOnce(new Error('Highlight failed'))
    const markdown = '```ts\ntype BrowserFallback = { ok: boolean }\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-dark" />)

    await screen.findByText('BrowserFallback')
    expect(document.querySelector('.code-fallback-highlight')).toBeInTheDocument()
    expect(document.querySelector('.code-token.keyword')).toHaveTextContent('type')
    expect(document.querySelector('.code-token.primitive')).toHaveTextContent('boolean')
  })

  it('routes mermaid blocks through MermaidBlock renderer', async () => {
    const markdown = '```mermaid\ngraph TD\nA-->B\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    expect(screen.getByText('mermaid')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SVG' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'PNG' })).toBeInTheDocument()

    const diagram = await screen.findByText('Diagram')
    expect(diagram).toBeInTheDocument()
  })

  it('renders tables correctly', () => {
    const markdown = '| Col 1 | Col 2 |\n| --- | --- |\n| Val 1 | Val 2 |'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Col 1' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Val 1' })).toBeInTheDocument()
  })
})
