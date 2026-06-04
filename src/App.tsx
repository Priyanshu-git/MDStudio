import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { EditorShellPage } from './editor/EditorShellPage'
import { FileOpenPage } from './file-handling/FileOpenPage'
import { HomePage } from './components/pages/HomePage'
import { LocalDocumentPage } from './components/pages/LocalDocumentPage'
import { SharePlaceholderPage } from './components/pages/SharePlaceholderPage'
import { useAppStore } from './state/useAppStore'

export function App() {
  const theme = useAppStore((state) => state.theme)
  const hydrateTheme = useAppStore((state) => state.hydrateTheme)

  useEffect(() => {
    void hydrateTheme()
  }, [hydrateTheme])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    function createRipple(button: HTMLButtonElement, originX: number, originY: number) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) {
        return
      }

      const rect = button.getBoundingClientRect()
      const distances = [
        Math.hypot(originX - 0, originY - 0),
        Math.hypot(originX - rect.width, originY - 0),
        Math.hypot(originX - 0, originY - rect.height),
        Math.hypot(originX - rect.width, originY - rect.height),
      ]
      const radius = Math.max(...distances)
      const size = radius * 2
      const x = originX - radius
      const y = originY - radius

      const ripple = document.createElement('span')
      ripple.className = 'button-ripple'
      ripple.style.width = `${size}px`
      ripple.style.height = `${size}px`
      ripple.style.left = `${x}px`
      ripple.style.top = `${y}px`
      button.appendChild(ripple)

      const cleanup = () => {
        ripple.remove()
      }
      ripple.addEventListener(
        'animationend',
        cleanup,
        { once: true },
      )
      ripple.addEventListener(
        'animationcancel',
        cleanup,
        { once: true },
      )
      window.setTimeout(cleanup, 550)
    }

    function resolveButton(target: EventTarget | null): HTMLButtonElement | null {
      const element = target as HTMLElement | null
      const button = element?.closest('button')
      if (!button || button.disabled) {
        return null
      }
      const supportsRipple = button.matches(
        '.primary-button, .secondary-button, .icon-button, .toolbar-button, .bottom-action, .tab-button, .avatar-button',
      )
      if (!supportsRipple) {
        return null
      }
      return button
    }

    function handleButtonPointerDown(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return
      }
      const button = resolveButton(event.target)
      if (!button) {
        return
      }
      const rect = button.getBoundingClientRect()
      const originX = event.clientX - rect.left
      const originY = event.clientY - rect.top
      createRipple(button, originX, originY)
    }

    function handleButtonKeyDown(event: KeyboardEvent) {
      if (event.repeat) {
        return
      }
      const isActivationKey = event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar'
      if (!isActivationKey) {
        return
      }
      const button = resolveButton(event.target)
      if (!button) {
        return
      }
      const rect = button.getBoundingClientRect()
      createRipple(button, rect.width / 2, rect.height / 2)
    }

    document.addEventListener('pointerdown', handleButtonPointerDown)
    document.addEventListener('keydown', handleButtonKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleButtonPointerDown)
      document.removeEventListener('keydown', handleButtonKeyDown)
    }
  }, [])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorShellPage />} />
      <Route path="/open-md" element={<FileOpenPage />} />
      <Route path="/doc/:id" element={<LocalDocumentPage />} />
      <Route path="/share/:id" element={<SharePlaceholderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
