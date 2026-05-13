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
      isHydrated: false,
      draftMarkdown: '# Welcome to Markdown Studio\n\nPhase 2 shell is ready.',
      theme: 'github-light',
      lastLocalSavedMarkdown: '',
      lastCloudSavedMarkdown: null,
    })
  })

  it('hydrates initial document and theme', async () => {
    await useAppStore.getState().hydrateDocument()
    
    expect(useAppStore.getState().isHydrated).toBe(true)
    expect(useAppStore.getState().activeDocId).toBeDefined()
    expect(useAppStore.getState().draftMarkdown).toContain('Welcome to Markdown Studio')
  })

  it('updates draft and persists it', async () => {
    await useAppStore.getState().hydrateDocument()
    const docId = useAppStore.getState().activeDocId!

    useAppStore.getState().setDraftMarkdown('# New Content')
    await useAppStore.getState().persistDraft()

    const doc = await db.documents.get(docId)
    expect(doc?.markdown).toBe('# New Content')
  })

  it('updates and persists theme', async () => {
    useAppStore.getState().setTheme('dracula')
    expect(useAppStore.getState().theme).toBe('dracula')

    const item = await db.appState.get('theme')
    expect(item?.value).toBe('dracula')
  })
})
