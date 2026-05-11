import { useEffect } from 'react'
import { AppShellLayout } from '../components/layout/AppShellLayout'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { useAppStore } from '../state/useAppStore'

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
              <option value="nord">Nord</option>
            </select>
          </label>
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
                <MarkdownPreview markdown={draftMarkdown} theme={theme} />
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
                <MarkdownPreview markdown={draftMarkdown} theme={theme} />
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="docs-mode-panel">
          <MarkdownPreview markdown={draftMarkdown} theme={theme} />
        </section>
      )}
    </AppShellLayout>
  )
}
