import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ThemeName } from '../types'

type CodeBlockProps = {
  language: string
  code: string
  theme: ThemeName
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

type ShikiModule = typeof import('shiki')
type CopyState = 'idle' | 'copied' | 'failed'

const highlightedCache = new Map<string, string>()
let shikiModulePromise: Promise<ShikiModule> | null = null

function shikiThemeForAppTheme(theme: ThemeName): string {
  return theme === 'github-dark'
    ? 'github-dark-default'
    : theme === 'one-dark' || theme === 'blue-eclipse'
      ? 'one-dark-pro'
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

function fallbackTokenClass(token: string, previousToken: string): string | null {
  if (/^\s+$/.test(token)) {
    return null
  }
  if (token.startsWith('//')) {
    return 'comment'
  }
  if (/^["'`]/.test(token)) {
    return 'string'
  }
  if (/^\d/.test(token)) {
    return 'number'
  }
  if (/^(type|interface|const|let|var|function|return|if|else|for|while|class|extends|import|export|from|as|async|await|new|try|catch|throw)$/.test(token)) {
    return 'keyword'
  }
  if (/^(string|number|boolean|void|null|undefined|unknown|never|any|true|false)$/.test(token)) {
    return 'primitive'
  }
  if (/^[A-Za-z_$][\w$]*$/.test(token) && previousToken === 'type') {
    return 'type-name'
  }
  if (/^[A-Za-z_$][\w$]*$/.test(token)) {
    return 'property'
  }
  if (/^[=:{}()[\],.;<>+\-*/|&!?]+$/.test(token)) {
    return 'punctuation'
  }
  return null
}

function fallbackCodeToHtml(code: string): string {
  const tokenPattern =
    /(\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b[A-Za-z_$][\w$]*\b|\d+(?:\.\d+)?|[=:{}()[\],.;<>+\-*/|&!?]+|\s+)/gm

  const lines = code.split('\n').map((line) => {
    let previousToken = ''
    const highlighted = Array.from(line.matchAll(tokenPattern))
      .map((match) => {
        const token = match[0]
        const tokenClass = fallbackTokenClass(token, previousToken)
        if (token.trim()) {
          previousToken = token
        }
        const escapedToken = escapeHtml(token)
        return tokenClass ? `<span class="code-token ${tokenClass}">${escapedToken}</span>` : escapedToken
      })
      .join('')
    return `<span class="line">${highlighted}</span>`
  })

  return `<pre class="code-fallback-highlight"><code>${lines.join('\n')}</code></pre>`
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
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const copyResetTimer = useRef<number | null>(null)
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
        const fallback = fallbackCodeToHtml(code)
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

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current)
      }
    }
  }, [])

  function scheduleCopyStateReset() {
    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
    }
    copyResetTimer.current = window.setTimeout(() => {
      setCopyState('idle')
      copyResetTimer.current = null
    }, 2000)
  }

  const onCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error('Clipboard unavailable')
      }
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    } finally {
      scheduleCopyStateReset()
    }
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-toolbar">
        <span className="code-language">{normalizedLanguage}</span>
        {showCopyButton ? (
          <div className="code-copy-actions">
            {copyState === 'copied' ? (
              <span className="code-copy-status" aria-live="polite">
                Copied!
              </span>
            ) : null}
            <button
              type="button"
              className={copyState === 'copied' ? 'code-copy-button copied' : 'code-copy-button'}
              aria-label={copyState === 'copied' ? 'Code copied' : 'Copy code'}
              title={copyState === 'copied' ? 'Code copied' : 'Copy code'}
              onClick={onCopy}
            >
              {copyState === 'copied' ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            </button>
          </div>
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
