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
      theme: 'minimal-ivory',
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
    expect(useAppStore.getState().theme).toBe('minimal-ivory')
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

  it('creates a hydrated local-only starter draft', () => {
    useAppStore.getState().createNewDraft()

    expect(useAppStore.getState().activeDocId).toBeNull()
    expect(useAppStore.getState().activeShareId).toBeNull()
    expect(useAppStore.getState().draftTitle).toBe('Untitled Document')
    expect(useAppStore.getState().draftMarkdown).toContain('Welcome to MD Studio')
    expect(useAppStore.getState().draftMarkdown).toContain('```mermaid')
    expect(useAppStore.getState().isHydrated).toBe(true)
    expect(useAppStore.getState().saveStatus).toBe('local-only')
  })

  it('keeps shared documents marked as firebase backed after local save', async () => {
    await useAppStore.getState().hydrateDocument()
    const docId = useAppStore.getState().activeDocId!

    useAppStore.getState().linkActiveShare('share-1', useAppStore.getState().draftTitle, useAppStore.getState().draftMarkdown)
    useAppStore.getState().setDraftMarkdown('# Locally Edited Shared Doc')
    await useAppStore.getState().saveDraft()

    const doc = await db.documents.get(docId)
    expect(doc).toEqual(
      expect.objectContaining({
        source: 'firebase',
        sourceShareId: 'share-1',
      }),
    )
  })

  it('updates and persists theme', async () => {
    useAppStore.getState().setTheme('blue-eclipse')
    expect(useAppStore.getState().theme).toBe('blue-eclipse')

    const item = await db.appState.get('theme')
    expect(item?.value).toBe('blue-eclipse')
  })
})
