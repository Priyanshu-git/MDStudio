import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { sanitizeUrl } from '../markdown/sanitizeUrl'
import { CodeBlock } from '../renderers/CodeBlock'
import { MermaidBlock } from '../mermaid/MermaidBlock'
import type { ThemeName } from '../types'

type MarkdownPreviewProps = {
  markdown: string
  theme: ThemeName
}

export function MarkdownPreview({ markdown, theme }: MarkdownPreviewProps) {
  return (
    <article className={`markdown-doc markdown-doc-${theme}`}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => sanitizeUrl(url)}
        components={{
          code(props) {
            const { className, children } = props
            const content = String(children ?? '').replace(/\n$/, '')
            const language = className?.replace('language-', '') ?? ''
            const isBlock = Boolean(className)

            if (isBlock && language === 'mermaid') {
              return <MermaidBlock code={content} theme={theme} />
            }

            if (isBlock) {
              return <CodeBlock language={language} code={content} theme={theme} />
            }

            return <code className={className}>{children}</code>
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
}
