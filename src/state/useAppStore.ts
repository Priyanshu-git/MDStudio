import { create } from 'zustand'
import type { ThemeName } from '../types'
import {
  getThemePreference,
  getOrCreateActiveDocument,
  setActiveDocumentId,
  setThemePreference,
  updateDocumentMarkdown,
} from '../storage/documents'

export type MobileTab = 'edit' | 'preview'
export type EditorMode = 'edit' | 'docs'

type AppState = {
  activeDocId: string | null
  isHydrated: boolean
  theme: ThemeName
  mobileTab: MobileTab
  editorMode: EditorMode
  draftMarkdown: string
  setActiveDocId: (docId: string | null) => void
  setTheme: (theme: ThemeName) => void
  setMobileTab: (tab: MobileTab) => void
  setEditorMode: (mode: EditorMode) => void
  setDraftMarkdown: (value: string) => void
  hydrateDocument: () => Promise<void>
  persistDraft: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  activeDocId: null,
  isHydrated: false,
  theme: 'github-light',
  mobileTab: 'edit',
  editorMode: 'edit',
  draftMarkdown: `# Welcome to Markdown Studio

Markdown Studio is a local-first editor.

| Feature | Status | Priority |
| :--- | :---: | ---: |
| Markdown Rendering | ✅ | High |
| Mermaid Diagrams | ✅ | High |
| Shiki Highlighting | ✅ | Medium |
| Local Persistence | ✅ | High |
| PWA / Offline | ✅ | High |

Phase 2 shell is ready.`,
  setActiveDocId: (docId) => {
    set({ activeDocId: docId })
    if (docId) {
      void setActiveDocumentId(docId)
    }
  },
  setTheme: (theme) => {
    set({ theme })
    void setThemePreference(theme)
  },
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  setDraftMarkdown: (value) => set({ draftMarkdown: value }),
  hydrateDocument: async () => {
    if (get().isHydrated) {
      return
    }
    const doc = await getOrCreateActiveDocument(get().draftMarkdown)
    const persistedTheme = await getThemePreference()
    const validThemes: ThemeName[] = [
      'github-light',
      'dracula',
      'lavender-fields',
      'blue-eclipse',
      'lush-forest',
      'ink-wash',
      'cherry-blossom',
    ]
    const resolvedTheme =
      persistedTheme && validThemes.includes(persistedTheme as ThemeName)
        ? (persistedTheme as ThemeName)
        : get().theme
    set({
      activeDocId: doc.id,
      draftMarkdown: doc.markdown,
      theme: resolvedTheme,
      isHydrated: true,
    })
  },
  persistDraft: async () => {
    const { activeDocId, draftMarkdown } = get()
    if (!activeDocId) {
      return
    }
    await updateDocumentMarkdown(activeDocId, draftMarkdown)
  },
}))
