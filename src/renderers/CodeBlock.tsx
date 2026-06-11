import { useEffect, useMemo, useState } from 'react'
import type { ThemeName } from '../types'

type CodeBlockProps = {
  language: string
  code: string
  theme: ThemeName
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

type ShikiModule = typeof import('shiki')

const highlightedCache = new Map<string, string>()
let shikiModulePromise: Promise<ShikiModule> | null = null

function shikiThemeForAppTheme(theme: ThemeName): string {
  return theme === 'one-dark' || theme === 'blue-eclipse'
    ? 'one-dark-pro'
    : theme === 'github-dark'
      ? 'github-dark'
      : 'github-light'
}

function getShikiModule() {
  shikiModulePromise ??= import('shiki')
  return shikiModulePromise
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
  const normalizedLanguage = useMemo(() => language || 'text', [language])
  const shikiTheme = useMemo(() => shikiThemeForAppTheme(theme), [theme])
  const cacheKey = useMemo(
    () => `${shikiTheme}\u0000${normalizedLanguage}\u0000${code}`,
    [code, normalizedLanguage, shikiTheme],
  )
  const [highlightedResult, setHighlightedResult] = useState<{ key: string; html: string } | null>(null)
  const lineNumbers = useMemo(
    () =>
      code
        .split('\n')
        .map((_, index) => String(index + 1))
        .join('\n'),
    [code],
  )
  const highlighted = highlightedCache.get(cacheKey) ?? (highlightedResult?.key === cacheKey ? highlightedResult.html : '')

  useEffect(() => {
    let cancelled = false
    if (highlightedCache.has(cacheKey)) {
      return () => {
        cancelled = true
      }
    }

    async function runHighlight() {
      try {
        const { codeToHtml } = await getShikiModule()
        const html = await codeToHtml(code, {
          lang: normalizedLanguage,
          theme: shikiTheme,
        })
        if (!cancelled) {
          highlightedCache.set(cacheKey, html)
          setHighlightedResult({ key: cacheKey, html })
        }
      } catch {
        const fallback = `<pre><code>${escapeHtml(code)}</code></pre>`
        if (!cancelled) {
          highlightedCache.set(cacheKey, fallback)
          setHighlightedResult({ key: cacheKey, html: fallback })
        }
      }
    }

    runHighlight()
    return () => {
      cancelled = true
    }
  }, [cacheKey, code, normalizedLanguage, shikiTheme])

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
            {lineNumbers}
          </pre>
        ) : null}
        <div className="code-highlight" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  )
}
