import { useEffect, useId, useState } from 'react'
import type { ThemeName } from '../types'

type MermaidBlockProps = {
  code: string
  theme: ThemeName
}

type MermaidModule = typeof import('mermaid')

const renderedSvgCache = new Map<string, string>()
let mermaidModulePromise: Promise<MermaidModule> | null = null
let initializedTheme: string | null = null

function mermaidThemeForAppTheme(theme: ThemeName): 'dark' | 'default' {
  return theme === 'github-dark' || theme === 'one-dark' || theme === 'blue-eclipse' ? 'dark' : 'default'
}

function getMermaidModule() {
  mermaidModulePromise ??= import('mermaid')
  return mermaidModulePromise
}

async function renderMermaid(id: string, code: string, theme: ThemeName): Promise<string> {
  const mermaidTheme = mermaidThemeForAppTheme(theme)
  const cacheKey = `${mermaidTheme}\u0000${id}\u0000${code}`
  const cached = renderedSvgCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const mermaid = (await getMermaidModule()).default
  if (initializedTheme !== mermaidTheme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: mermaidTheme,
    })
    initializedTheme = mermaidTheme
  }

  const result = await mermaid.render(`mermaid-${id}`, code)
  renderedSvgCache.set(cacheKey, result.svg)
  return result.svg
}

export function MermaidBlock({ code, theme }: MermaidBlockProps) {
  const id = useId().replace(/:/g, '-')
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    renderMermaid(id, code, theme)
      .then((markup) => {
        if (mounted) {
          setError(null)
          setSvg(markup)
        }
      })
      .catch(() => {
        if (mounted) {
          setSvg('')
          setError('Unable to render Mermaid diagram.')
        }
      })

    return () => {
      mounted = false
    }
  }, [code, id, theme])

  const downloadSvg = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadPng = async () => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          URL.revokeObjectURL(url)
          return
        }
        const pngUrl = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = 'diagram.png'
        a.click()
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
      })
    }
    img.src = url
  }

  if (error) {
    return <div className="placeholder-surface">{error}</div>
  }

  return (
    <div className="mermaid-block">
      <div className="code-toolbar">
        <span className="code-language">mermaid</span>
        <div className="toolbar-actions">
          <button type="button" className="tab-button" onClick={downloadSvg}>
            SVG
          </button>
          <button type="button" className="tab-button" onClick={downloadPng}>
            PNG
          </button>
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
