import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'

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
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    
    // Check if highlighted content eventually appears
    const highlight = await screen.findByText('console.log("hello");')
    expect(highlight).toBeInTheDocument()
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
})
