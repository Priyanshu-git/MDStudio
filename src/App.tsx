import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { EditorShellPage } from './editor/EditorShellPage'
import { HomePage } from './components/pages/HomePage'
import { LocalDocumentPage } from './components/pages/LocalDocumentPage'
import { SharePlaceholderPage } from './components/pages/SharePlaceholderPage'
import { useAppStore } from './state/useAppStore'

export function App() {
  const theme = useAppStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorShellPage />} />
      <Route path="/doc/:id" element={<LocalDocumentPage />} />
      <Route path="/share/:id" element={<SharePlaceholderPage />} />
      <Route path="*" element={<Navigate to="/editor" replace />} />
    </Routes>
  )
}
