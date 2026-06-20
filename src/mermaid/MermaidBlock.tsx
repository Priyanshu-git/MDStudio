import { useEffect, useId, useRef, useState } from 'react'
import { Download, FileCode2, Image as ImageIcon } from 'lucide-react'
import type { ThemeName } from '../types'

type MermaidBlockProps = {
  code: string
  theme: ThemeName
}

type MermaidModule = typeof import('mermaid')

const PNG_EXPORT_SCALE = 3
const MAX_CANVAS_PIXELS = 80_000_000

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
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
      securityLevel: 'strict',
      theme: mermaidTheme,
    })
    initializedTheme = mermaidTheme
  }

  const result = await mermaid.render(`mermaid-${id}`, code)
  renderedSvgCache.set(cacheKey, result.svg)
  return result.svg
}

type SvgExport = {
  svg: string
  width: number
  height: number
}

function parsePositiveNumber(value: string | null): number | null {
  if (!value) {
    return null
  }
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function getSvgDimensions(svgElement: SVGSVGElement): { width: number; height: number } | null {
  const viewBox = svgElement.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (viewBox?.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return { width: viewBox[2], height: viewBox[3] }
  }

  const width = parsePositiveNumber(svgElement.getAttribute('width'))
  const height = parsePositiveNumber(svgElement.getAttribute('height'))
  return width && height ? { width, height } : null
}

function normalizeSvgForPng(svgMarkup: string, scale = PNG_EXPORT_SCALE): SvgExport | null {
  const document = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml')
  const svgElement = document.documentElement
  if (svgElement.nodeName.toLowerCase() !== 'svg') {
    return null
  }

  const dimensions = getSvgDimensions(svgElement as unknown as SVGSVGElement)
  if (!dimensions) {
    return null
  }

  const requestedWidth = Math.ceil(dimensions.width * scale)
  const requestedHeight = Math.ceil(dimensions.height * scale)
  if (requestedWidth <= 0 || requestedHeight <= 0) {
    return null
  }

  const requestedPixels = requestedWidth * requestedHeight
  const pixelRatio = requestedPixels > MAX_CANVAS_PIXELS
    ? Math.sqrt(MAX_CANVAS_PIXELS / requestedPixels)
    : 1
  const width = Math.max(1, Math.floor(requestedWidth * pixelRatio))
  const height = Math.max(1, Math.floor(requestedHeight * pixelRatio))

  svgElement.setAttribute('width', String(width))
  svgElement.setAttribute('height', String(height))

  return {
    svg: new XMLSerializer().serializeToString(svgElement),
    width,
    height,
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

export function MermaidBlock({ code, theme }: MermaidBlockProps) {
  const id = useId().replace(/:/g, '-')
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false)

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

  useEffect(() => {
    if (!isDownloadMenuOpen) {
      return
    }

    function closeDownloadMenu() {
      setIsDownloadMenuOpen(false)
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) {
        return
      }
      closeDownloadMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeDownloadMenu()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDownloadMenuOpen])

  const downloadSvg = () => {
    if (!svg) {
      return
    }
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, 'diagram.svg')
    URL.revokeObjectURL(url)
  }

  const downloadPng = async () => {
    const exportSvg = normalizeSvgForPng(svg)
    if (!exportSvg) {
      return
    }

    const blob = new Blob([exportSvg.svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = exportSvg.width
      canvas.height = exportSvg.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(url)
        return
      }
      ctx.drawImage(img, 0, 0, exportSvg.width, exportSvg.height)
      canvas.toBlob((pngBlob) => {
        if (!pngBlob) {
          URL.revokeObjectURL(url)
          return
        }
        const pngUrl = URL.createObjectURL(pngBlob)
        triggerDownload(pngUrl, 'diagram.png')
        URL.revokeObjectURL(pngUrl)
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const hasRenderableSvg = Boolean(svg)

  const handleDownloadSvg = () => {
    setIsDownloadMenuOpen(false)
    downloadSvg()
  }

  const handleDownloadPng = () => {
    setIsDownloadMenuOpen(false)
    void downloadPng()
  }

  if (error) {
    return <div className="placeholder-surface">{error}</div>
  }

  return (
    <div className="mermaid-block">
      <div className="code-toolbar">
        <span className="code-language">mermaid</span>
        <div className="mermaid-download-menu" ref={menuRef}>
          <button
            type="button"
            className="code-copy-button mermaid-download-trigger"
            onClick={() => setIsDownloadMenuOpen((isOpen) => !isOpen)}
            disabled={!hasRenderableSvg}
            aria-label="Download diagram"
            aria-haspopup="menu"
            aria-expanded={isDownloadMenuOpen}
            title="Download diagram"
          >
            <Download size={16} />
          </button>
          {isDownloadMenuOpen ? (
            <div className="mermaid-download-popover" role="menu" aria-label="Diagram download options">
              <button type="button" role="menuitem" onClick={handleDownloadSvg}>
                <FileCode2 size={18} />
                SVG
              </button>
              <button type="button" role="menuitem" onClick={handleDownloadPng}>
                <ImageIcon size={18} />
                PNG
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
