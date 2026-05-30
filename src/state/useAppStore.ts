import { create } from 'zustand'
import type {
  DesktopViewMode,
  Document,
  MobileTab,
  RecentDocumentItem,
  RecentDocumentsState,
  SaveStatus,
  ThemeName,
} from '../types'
import {
  createDocument,
  getDocumentById,
  getOrCreateActiveDocument,
  getThemePreference,
  listDocuments,
  setActiveDocumentId,
  setThemePreference,
  updateDocument,
} from '../storage/documents'
import { refreshLocalRecentDocuments, refreshRecentDocumentsForUser } from '../storage/documentSync'

const DEFAULT_MARKDOWN = `# Markdown Rendering Test File

A comprehensive markdown file to verify rendering support for:

- Core markdown
- Tables
- Task lists
- Code blocks
- Syntax highlighting
- Math equations
- Mermaid diagrams
- Images
- Quotes
- Nested lists
- Horizontal rules
- Links

---

## Core markdown features

Here is a code example with syntax highlighting:

\`\`\`javascript
function greet(name) {
  const message = \`Hello, \${name}!\`;
  return message;
}
console.log(greet('world'));
\`\`\`

The famous equation:

$$E = mc^2$$

A mermaid diagram:

\`\`\`mermaid
graph TD
  A[Start] --> B{Is it working?}
  B -- Yes --> C[Great!]
  B -- No --> D[Debug]
  D --> B
\`\`\`
`

const VALID_THEMES: ThemeName[] = [
  'github-light',
  'github-dark',
  'pastel-mint',
  'minimal-ivory',
  'one-dark',
  'blue-eclipse',
]

type AppState = {
  activeDocId: string | null
  activeShareId: string | null
  documents: Document[]
  recentDocuments: RecentDocumentItem[]
  recentDocumentsState: RecentDocumentsState
  draftTitle: string
  draftMarkdown: string
  lastLocalSavedTitle: string
  lastLocalSavedMarkdown: string
  lastCloudSavedTitle: string | null
  lastCloudSavedMarkdown: string | null
  isHydrated: boolean
  theme: ThemeName
  mobileTab: MobileTab
  desktopViewMode: DesktopViewMode
  saveStatus: SaveStatus
  saveError: string | null
  setActiveDocId: (docId: string | null) => void
  setTheme: (theme: ThemeName) => void
  setMobileTab: (tab: MobileTab) => void
  setDesktopViewMode: (mode: DesktopViewMode) => void
  setDraftTitle: (value: string) => void
  setDraftMarkdown: (value: string) => void
  linkActiveShare: (shareId: string, title: string, markdown: string) => void
  clearShareLink: () => void
  setLastCloudSavedSnapshot: (title: string | null, markdown: string | null) => void
  refreshDocuments: () => Promise<void>
  clearRecentDocumentsForSignedOut: () => void
  refreshRecentDocuments: (uid?: string | null) => Promise<void>
  refreshLocalRecentDocuments: () => Promise<void>
  hydrateTheme: () => Promise<void>
  hydrateDocument: () => Promise<void>
  createNewDraft: () => void
  openDocument: (docId: string) => Promise<void>
  importMarkdownDraft: (title: string, markdown: string) => void
  saveDraft: () => Promise<Document>
}

function normalizeTheme(theme: string | null, fallback: ThemeName): ThemeName {
  return theme && VALID_THEMES.includes(theme as ThemeName) ? (theme as ThemeName) : fallback
}

function isDraftDirty(state: Pick<AppState, 'draftTitle' | 'draftMarkdown' | 'lastLocalSavedTitle' | 'lastLocalSavedMarkdown'>) {
  return state.draftTitle !== state.lastLocalSavedTitle || state.draftMarkdown !== state.lastLocalSavedMarkdown
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.md$/i, '').trim() || 'Imported Document'
}

export const useAppStore = create<AppState>((set, get) => ({
  activeDocId: null,
  activeShareId: null,
  documents: [],
  recentDocuments: [],
  recentDocumentsState: 'signed-out',
  draftTitle: 'Markdown Rendering Test File',
  draftMarkdown: DEFAULT_MARKDOWN,
  lastLocalSavedTitle: '',
  lastLocalSavedMarkdown: '',
  lastCloudSavedTitle: null,
  lastCloudSavedMarkdown: null,
  isHydrated: false,
  theme: 'github-dark',
  mobileTab: 'write',
  desktopViewMode: 'split',
  saveStatus: 'local-only',
  saveError: null,
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
  setDesktopViewMode: (mode) => set({ desktopViewMode: mode }),
  setDraftTitle: (value) => {
    const next = { ...get(), draftTitle: value }
    set({
      draftTitle: value,
      saveStatus: isDraftDirty(next) ? 'unsaved' : get().activeShareId ? 'synced' : 'saved',
      saveError: null,
    })
  },
  setDraftMarkdown: (value) => {
    const next = { ...get(), draftMarkdown: value }
    set({
      draftMarkdown: value,
      saveStatus: isDraftDirty(next) ? 'unsaved' : get().activeShareId ? 'synced' : 'saved',
      saveError: null,
    })
  },
  linkActiveShare: (shareId, title, markdown) =>
    set({
      activeShareId: shareId,
      lastCloudSavedTitle: title,
      lastCloudSavedMarkdown: markdown,
      saveStatus: 'synced',
    }),
  clearShareLink: () =>
    set({
      activeShareId: null,
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
    }),
  setLastCloudSavedSnapshot: (title, markdown) =>
    set({
      lastCloudSavedTitle: title,
      lastCloudSavedMarkdown: markdown,
      saveStatus: title && markdown ? 'synced' : get().saveStatus,
    }),
  refreshDocuments: async () => {
    const documents = await listDocuments()
    set({ documents })
  },
  clearRecentDocumentsForSignedOut: () => {
    set({ recentDocuments: [], recentDocumentsState: 'signed-out' })
  },
  refreshRecentDocuments: async (uid) => {
    if (!uid) {
      set({ recentDocuments: [], recentDocumentsState: 'signed-out' })
      return
    }
    set({ recentDocumentsState: 'loading' })
    try {
      const recentDocuments = await refreshRecentDocumentsForUser(uid)
      const documents = await listDocuments()
      set({ recentDocuments, documents, recentDocumentsState: 'ready' })
    } catch (error) {
      const recentDocuments = await refreshLocalRecentDocuments()
      set({ recentDocuments, recentDocumentsState: 'error' })
      throw error
    }
  },
  refreshLocalRecentDocuments: async () => {
    const [recentDocuments, documents] = await Promise.all([
      refreshLocalRecentDocuments(),
      listDocuments(),
    ])
    set({ recentDocuments, documents, recentDocumentsState: 'ready' })
  },
  hydrateTheme: async () => {
    const persistedTheme = await getThemePreference()
    set({ theme: normalizeTheme(persistedTheme, get().theme) })
  },
  hydrateDocument: async () => {
    if (get().isHydrated) {
      return
    }
    const doc = await getOrCreateActiveDocument(DEFAULT_MARKDOWN)
    const persistedTheme = await getThemePreference()
    const theme = normalizeTheme(persistedTheme, doc.theme ?? get().theme)
    const documents = await listDocuments()
    if (get().isHydrated) {
      return
    }
    set({
      activeDocId: doc.id,
      draftTitle: doc.title,
      draftMarkdown: doc.markdown,
      lastLocalSavedTitle: doc.title,
      lastLocalSavedMarkdown: doc.markdown,
      theme,
      documents,
      saveStatus: 'saved',
      isHydrated: true,
    })
  },
  createNewDraft: () => {
    set({
      activeDocId: null,
      activeShareId: null,
      draftTitle: 'Untitled Document',
      draftMarkdown: '# Untitled Document\n\n',
      lastLocalSavedTitle: '',
      lastLocalSavedMarkdown: '',
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
      saveStatus: 'local-only',
      saveError: null,
      mobileTab: 'write',
      desktopViewMode: 'split',
    })
  },
  openDocument: async (docId) => {
    const doc = await getDocumentById(docId)
    if (!doc) {
      return
    }
    await setActiveDocumentId(doc.id)
    set({
      activeDocId: doc.id,
      activeShareId: null,
      draftTitle: doc.title,
      draftMarkdown: doc.markdown,
      lastLocalSavedTitle: doc.title,
      lastLocalSavedMarkdown: doc.markdown,
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
      saveStatus: 'saved',
      saveError: null,
      mobileTab: 'write',
    })
  },
  importMarkdownDraft: (title, markdown) => {
    set({
      activeDocId: null,
      activeShareId: null,
      draftTitle: titleFromFilename(title),
      draftMarkdown: markdown,
      lastLocalSavedTitle: '',
      lastLocalSavedMarkdown: '',
      lastCloudSavedTitle: null,
      lastCloudSavedMarkdown: null,
      saveStatus: 'local-only',
      saveError: null,
      mobileTab: 'write',
    })
  },
  saveDraft: async () => {
    const { activeDocId, activeShareId, draftTitle, draftMarkdown, theme } = get()
    set({ saveStatus: 'saving', saveError: null })
    try {
      let doc: Document
      if (activeDocId) {
        await updateDocument(activeDocId, {
          title: draftTitle.trim() || 'Untitled Document',
          markdown: draftMarkdown,
          theme,
          ...(activeShareId ? { source: 'firebase' as const, sourceShareId: activeShareId } : {}),
        })
        doc = (await getDocumentById(activeDocId))!
      } else {
        doc = await createDocument({
          title: draftTitle.trim() || 'Untitled Document',
          markdown: draftMarkdown,
          theme,
          ...(activeShareId ? { source: 'firebase' as const, sourceShareId: activeShareId } : {}),
        })
      }
      const documents = await listDocuments()
      set({
        activeDocId: doc.id,
        documents,
        draftTitle: doc.title,
        lastLocalSavedTitle: doc.title,
        lastLocalSavedMarkdown: doc.markdown,
        saveStatus: get().activeShareId ? 'synced' : 'saved',
      })
      return doc
    } catch (error) {
      set({
        saveStatus: 'error',
        saveError: 'Unable to save document. Please try again.',
      })
      throw error
    }
  },
}))

export function hasUnsavedChanges(): boolean {
  const state = useAppStore.getState()
  return state.saveStatus === 'local-only' || state.saveStatus === 'unsaved' || state.saveStatus === 'error'
}
