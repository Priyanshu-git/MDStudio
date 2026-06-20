import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'
import { codeToHtml } from 'shiki'
import mermaid from 'mermaid'

// Mock shiki
vi.mock('shiki', () => ({
  codeToHtml: vi.fn(async (code) => `<pre class="shiki"><code>${code}</code></pre>`),
}))

// Mock mermaid
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async (id) => ({ svg: `<svg id="${id}" viewBox="0 0 100 50">Diagram</svg>` })),
  },
}))

describe('MarkdownPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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
    const downloadButton = screen.getByRole('button', { name: 'Download diagram' })
    expect(downloadButton).toBeDisabled()

    const diagram = await screen.findByText('Diagram')
    expect(diagram).toBeInTheDocument()
    expect(downloadButton).toBeEnabled()
    expect(mermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
    }))
  })

  it('opens mermaid download menu with SVG and PNG actions', async () => {
    const markdown = '```mermaid\ngraph TD\nA-->B\n```'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    await screen.findByText('Diagram')
    fireEvent.click(screen.getByRole('button', { name: 'Download diagram' }))

    expect(screen.getByRole('menu', { name: 'Diagram download options' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'SVG' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'PNG' })).toBeInTheDocument()
  })

  it('exports mermaid PNG from viewBox dimensions at 3x scale', async () => {
    const originalImage = globalThis.Image
    const originalCreateObjectUrl = URL.createObjectURL
    const originalRevokeObjectUrl = URL.revokeObjectURL
    const originalCreateElement = document.createElement.bind(document)
    const canvas = originalCreateElement('canvas') as HTMLCanvasElement
    const context = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const pngBlob = new Blob(['png'], { type: 'image/png' })
    const anchorClicks: string[] = []

    vi.spyOn(canvas, 'getContext').mockReturnValue(context)
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) => {
      callback(pngBlob)
    })
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (tagName.toLowerCase() === 'canvas') {
        return canvas
      }
      const element = originalCreateElement(tagName, options)
      if (tagName.toLowerCase() === 'a') {
        vi.spyOn(element as HTMLAnchorElement, 'click').mockImplementation(() => {
          anchorClicks.push((element as HTMLAnchorElement).download)
        })
      }
      return element
    })

    URL.createObjectURL = vi
      .fn()
      .mockReturnValueOnce('blob:svg')
      .mockReturnValueOnce('blob:png')
    URL.revokeObjectURL = vi.fn()
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      value: class MockImage {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null

        set src(_value: string) {
          queueMicrotask(() => this.onload?.())
        }
      },
    })

    try {
      const markdown = '```mermaid\ngraph TD\nA-->B\n```'
      render(<MarkdownPreview markdown={markdown} theme="github-light" />)

      await screen.findByText('Diagram')
      fireEvent.click(screen.getByRole('button', { name: 'Download diagram' }))
      fireEvent.click(screen.getByRole('menuitem', { name: 'PNG' }))

      await waitFor(() => {
        expect(canvas.width).toBe(300)
        expect(canvas.height).toBe(150)
        expect(context.drawImage).toHaveBeenCalledWith(expect.any(Object), 0, 0, 300, 150)
        expect(anchorClicks).toContain('diagram.png')
      })
    } finally {
      Object.defineProperty(globalThis, 'Image', {
        configurable: true,
        value: originalImage,
      })
      URL.createObjectURL = originalCreateObjectUrl
      URL.revokeObjectURL = originalRevokeObjectUrl
    }
  })

  it('renders tables correctly', () => {
    const markdown = '| Col 1 | Col 2 |\n| --- | --- |\n| Val 1 | Val 2 |'
    render(<MarkdownPreview markdown={markdown} theme="github-light" />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Col 1' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Val 1' })).toBeInTheDocument()
  })
})
