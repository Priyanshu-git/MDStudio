import React from 'react'
import { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { ExtraProps } from 'react-markdown'
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

export const MarkdownPreview = React.memo(function MarkdownPreview({
  markdown,
  theme,
}: MarkdownPreviewProps) {
  const components = useMemo(
    () => ({
      h1: HeadingWithSourceLine('h1'),
      h2: HeadingWithSourceLine('h2'),
      h3: HeadingWithSourceLine('h3'),
      h4: HeadingWithSourceLine('h4'),
      h5: HeadingWithSourceLine('h5'),
      h6: HeadingWithSourceLine('h6'),
      code(props: React.ComponentProps<'code'>) {
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

        return <code className={className ? className : 'code-inline'}>{children}</code>
      },
      img(props: React.ComponentProps<'img'>) {
        return <PreviewImage alt={props.alt ?? ''} src={props.src ?? ''} />
      },
    }),
    [theme],
  )

  return (
    <article className={`markdown-doc markdown-doc-${theme}`}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        urlTransform={(url) => sanitizeUrl(url)}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  )
})

function HeadingWithSourceLine(Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6') {
  return function Heading({ node, children, ...props }: React.ComponentProps<typeof Tag> & ExtraProps) {
    return (
      <Tag {...props} data-source-line={node?.position?.start.line}>
        {children}
      </Tag>
    )
  }
}

function PreviewImage({ alt, src }: { alt: string; src: string }) {
  const [failed, setFailed] = useState(false)

  if (failed || !src) {
    return (
      <span className="image-fallback" role="img" aria-label={alt || 'Image failed to load'}>
        Image could not be loaded from this URL.
      </span>
    )
  }

  return <img alt={alt} src={src} onError={() => setFailed(true)} loading="lazy" />
}
