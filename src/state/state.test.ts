import { describe, expect, it, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import { db } from '../storage/db'

describe('App Store (Zustand)', () => {
  beforeEach(async () => {
    // Reset Zustand state manually if needed, or just rely on clear storage
    await db.documents.clear()
    await db.appState.clear()
    useAppStore.setState({
      activeDocId: null,
      activeShareId: null,
      documents: [],
      isHydrated: false,
      draftTitle: 'Markdown Rendering Test File',
      draftMarkdown: '# Markdown Rendering Test File',
      theme: 'github-light',
      mobileTab: 'write',
      desktopViewMode: 'split',
      saveStatus: 'local-only',
      lastLocalSavedMarkdown: '',
      lastLocalSavedTitle: '',
      lastCloudSavedMarkdown: null,
      lastCloudSavedTitle: null,
    })
  })

  it('hydrates initial document and theme', async () => {
    await useAppStore.getState().hydrateDocument()
    
    expect(useAppStore.getState().isHydrated).toBe(true)
    expect(useAppStore.getState().activeDocId).toBeDefined()
    expect(useAppStore.getState().draftMarkdown).toContain('Markdown Rendering Test File')
  })

  it('updates draft and saves only when requested', async () => {
    await useAppStore.getState().hydrateDocument()
    const docId = useAppStore.getState().activeDocId!

    useAppStore.getState().setDraftMarkdown('# New Content')
    let doc = await db.documents.get(docId)
    expect(doc?.markdown).not.toBe('# New Content')

    await useAppStore.getState().saveDraft()

    doc = await db.documents.get(docId)
    expect(doc?.markdown).toBe('# New Content')
  })

  it('updates and persists theme', async () => {
    useAppStore.getState().setTheme('dracula')
    expect(useAppStore.getState().theme).toBe('dracula')

    const item = await db.appState.get('theme')
    expect(item?.value).toBe('dracula')
  })
})
