import { useEffect, useMemo, useState } from 'react'
import type { ThemeName } from '../types'

type CodeBlockProps = {
  language: string
  code: string
  theme: ThemeName
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

export function CodeBlock({
  language,
  code,
  theme,
  showLineNumbers = true,
  showCopyButton = true,
}: CodeBlockProps) {
  const [highlighted, setHighlighted] = useState<string>('')
  const normalizedLanguage = useMemo(() => language || 'text', [language])

  useEffect(() => {
    let cancelled = false

    async function runHighlight() {
      try {
        const { codeToHtml } = await import('shiki')
        const html = await codeToHtml(code, {
          lang: normalizedLanguage,
          theme:
            theme === 'dracula'
              ? 'dracula'
              : theme === 'nord'
                ? 'nord'
                : 'github-light',
        })
        if (!cancelled) {
          setHighlighted(html)
        }
      } catch {
        if (!cancelled) {
          setHighlighted(`<pre><code>${escapeHtml(code)}</code></pre>`)
        }
      }
    }

    runHighlight()
    return () => {
      cancelled = true
    }
  }, [code, normalizedLanguage, theme])

  const onCopy = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(code)
    }
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-toolbar">
        <span className="code-language">{normalizedLanguage}</span>
        {showCopyButton ? (
          <button type="button" className="tab-button" onClick={onCopy}>
            Copy
          </button>
        ) : null}
      </div>
      <div className="code-content">
        {showLineNumbers ? (
          <pre className="line-number-gutter" aria-hidden="true">
            {code
              .split('\n')
              .map((_, index) => String(index + 1))
              .join('\n')}
          </pre>
        ) : null}
        <div className="code-highlight" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  )
}
