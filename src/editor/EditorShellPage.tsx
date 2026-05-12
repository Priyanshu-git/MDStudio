import { useEffect, useDeferredValue, useState } from 'react'
import { AppShellLayout } from '../components/layout/AppShellLayout'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { useAppStore } from '../state/useAppStore'
import { publishSharedDocument } from '../storage/shareDocuments'

export function EditorShellPage() {
  const mobileTab = useAppStore((state) => state.mobileTab)
  const editorMode = useAppStore((state) => state.editorMode)
  const setMobileTab = useAppStore((state) => state.setMobileTab)
  const setEditorMode = useAppStore((state) => state.setEditorMode)
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const draftMarkdown = useAppStore((state) => state.draftMarkdown)
  const isHydrated = useAppStore((state) => state.isHydrated)
  const hydrateDocument = useAppStore((state) => state.hydrateDocument)
  const persistDraft = useAppStore((state) => state.persistDraft)
  const setDraftMarkdown = useAppStore((state) => state.setDraftMarkdown)
  const activeDocId = useAppStore((state) => state.activeDocId)
  const [isPublishing, setIsPublishing] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const deferredMarkdown = useDeferredValue(draftMarkdown)

  useEffect(() => {
    void hydrateDocument()
  }, [hydrateDocument])

  useEffect(() => {
    if (!isHydrated) {
      return
    }
    const timeout = window.setTimeout(() => {
      void persistDraft()
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [draftMarkdown, isHydrated, persistDraft])

  async function handlePublish() {
    setPublishError(null)
    setCopyState('idle')
    setIsPublishing(true)

    try {
      const result = await publishSharedDocument({
        markdown: draftMarkdown,
        sourceDocId: activeDocId ?? undefined,
      })
      const path = `/share/${result.shareId}`
      const url = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
      setShareUrl(url)
    } catch {
      setPublishError('Unable to publish right now. Please try again.')
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleCopyShareUrl() {
    if (!shareUrl) {
      return
    }
    if (!navigator.clipboard) {
      setCopyState('failed')
      return
    }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <AppShellLayout
      title="Markdown Studio"
      subtitle={editorMode === 'docs' ? 'Documentation View' : 'Editor'}
      shellClassName={editorMode === 'edit' ? 'shell-edit-mode' : undefined}
      actions={
        <div className="topbar-actions">
          <label className="theme-select-label">
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)}>
              <option value="github-light">GitHub Light</option>
              <option value="dracula">Dracula</option>
              <option value="lavender-fields">Lavender Fields</option>
              <option value="blue-eclipse">Blue Eclipse</option>
              <option value="lush-forest">Lush Forest</option>
              <option value="ink-wash">Ink Wash</option>
              <option value="cherry-blossom">Cherry Blossom</option>
            </select>
          </label>
          <button type="button" className="primary-button" onClick={() => void handlePublish()} disabled={isPublishing}>
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditorMode(editorMode === 'edit' ? 'docs' : 'edit')}
          >
            {editorMode === 'edit' ? 'Documentation View' : 'Back to Edit'}
          </button>
        </div>
      }
    >
      {publishError ? (
        <section className="publish-banner publish-banner-error" role="status">
          {publishError}
        </section>
      ) : null}
      {shareUrl ? (
        <section className="publish-banner" role="status">
          <span>
            Shared link: <a href={shareUrl}>{shareUrl}</a>
          </span>
          <button type="button" className="secondary-button" onClick={() => void handleCopyShareUrl()}>
            Copy Link
          </button>
          {copyState === 'copied' ? <span>Copied</span> : null}
          {copyState === 'failed' ? <span>Copy failed</span> : null}
        </section>
      ) : null}
      {editorMode === 'edit' ? (
        <>
          <div className="mobile-tabs">
            <button
              type="button"
              className={mobileTab === 'edit' ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setMobileTab('edit')}
            >
              Edit
            </button>
            <button
              type="button"
              className={mobileTab === 'preview' ? 'tab-button tab-button-active' : 'tab-button'}
              onClick={() => setMobileTab('preview')}
            >
              Preview
            </button>
          </div>

          <section className="split-layout">
            <article className="panel">
              <div className="placeholder-surface">
                <h2>Editor</h2>
                <textarea
                  value={draftMarkdown}
                  onChange={(event) => setDraftMarkdown(event.target.value)}
                  className="editor-input"
                  aria-label="Markdown input"
                />
              </div>
            </article>
            <article className="panel">
              <div className="placeholder-surface">
                <h2>Preview</h2>
                <MarkdownPreview markdown={deferredMarkdown} theme={theme} />
              </div>
            </article>
          </section>

          <section className="mobile-panel">
            <div className="placeholder-surface">
              <h2>{mobileTab === 'edit' ? 'Editor' : 'Preview'}</h2>
              {mobileTab === 'edit' ? (
                <textarea
                  value={draftMarkdown}
                  onChange={(event) => setDraftMarkdown(event.target.value)}
                  className="editor-input"
                  aria-label="Markdown input mobile"
                />
              ) : (
                <MarkdownPreview markdown={deferredMarkdown} theme={theme} />
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="docs-mode-panel">
          <MarkdownPreview markdown={deferredMarkdown} theme={theme} />
        </section>
      )}
    </AppShellLayout>
  )
}
