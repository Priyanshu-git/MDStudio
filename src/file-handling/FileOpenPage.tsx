import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../state/useAppStore'

type OpenStatus = 'waiting' | 'loading' | 'unsupported' | 'error'

function isFileHandlingSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.launchQueue &&
      window.LaunchParams &&
      'files' in window.LaunchParams.prototype,
  )
}

function isMarkdownFilename(filename: string): boolean {
  return filename.toLowerCase().endsWith('.md')
}

export function FileOpenPage() {
  const navigate = useNavigate()
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const importMarkdownDraft = useAppStore((state) => state.importMarkdownDraft)
  const [status, setStatus] = useState<OpenStatus>(() => (isFileHandlingSupported() ? 'waiting' : 'unsupported'))
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const importFile = useCallback(async (file: File) => {
    if (!isMarkdownFilename(file.name)) {
      setStatus('error')
      setErrorMessage('Only .md files can be opened in MD Studio.')
      return
    }

    setStatus('loading')
    setErrorMessage(null)
    try {
      const markdown = await file.text()
      importMarkdownDraft(file.name, markdown)
      navigate('/editor', { replace: true })
    } catch {
      setStatus('error')
      setErrorMessage('Unable to read that markdown file.')
    }
  }, [importMarkdownDraft, navigate])

  function handleManualImport(file: File | undefined) {
    if (!file) {
      return
    }
    void importFile(file)
  }

  useEffect(() => {
    if (!isFileHandlingSupported() || !window.launchQueue) {
      return
    }

    window.launchQueue.setConsumer((launchParams) => {
      const [fileHandle] = launchParams.files
      if (!fileHandle) {
        navigate('/editor', { replace: true })
        return
      }

      void fileHandle
        .getFile()
        .then(importFile)
        .catch(() => {
          setStatus('error')
          setErrorMessage('Unable to access that markdown file.')
        })
    })
  }, [importFile, navigate])

  return (
    <main className="file-open-page">
      <input
        ref={importInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,text/markdown"
        onChange={(event) => handleManualImport(event.target.files?.[0])}
      />
      <section className="file-open-panel" aria-live="polite">
        <FileText size={34} aria-hidden="true" />
        <h1>Open Markdown</h1>
        {status === 'waiting' ? <p>Waiting for the markdown file from your browser.</p> : null}
        {status === 'loading' ? <p>Loading markdown into the editor.</p> : null}
        {status === 'unsupported' ? (
          <>
            <p>This browser cannot open files through the PWA File Handling API.</p>
            <button type="button" className="primary-button" onClick={() => importInputRef.current?.click()}>
              <Upload size={18} />
              Import .md file
            </button>
          </>
        ) : null}
        {status === 'error' ? (
          <>
            <p className="error-text">{errorMessage}</p>
            <button type="button" className="primary-button" onClick={() => importInputRef.current?.click()}>
              <Upload size={18} />
              Choose another .md
            </button>
          </>
        ) : null}
      </section>
    </main>
  )
}
