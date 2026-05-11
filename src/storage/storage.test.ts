import { describe, expect, it, beforeEach } from 'vitest'
import { db } from './db'
import {
  createDocument,
  getDocumentById,
  updateDocumentMarkdown,
  getActiveDocumentId,
  setActiveDocumentId,
} from './documents'

describe('Storage Layer', () => {
  beforeEach(async () => {
    await db.documents.clear()
    await db.appState.clear()
  })

  it('creates and retrieves a document', async () => {
    const doc = await createDocument('# Test Doc')
    expect(doc.id).toBeDefined()
    expect(doc.markdown).toBe('# Test Doc')

    const retrieved = await getDocumentById(doc.id)
    expect(retrieved).toEqual(doc)
  })

  it('updates document markdown', async () => {
    const doc = await createDocument('# Original')
    await updateDocumentMarkdown(doc.id, '# Updated')

    const retrieved = await getDocumentById(doc.id)
    expect(retrieved?.markdown).toBe('# Updated')
    expect(retrieved?.updatedAt).toBeGreaterThan(doc.updatedAt)
  })

  it('manages active document ID', async () => {
    await setActiveDocumentId('test-id')
    const activeId = await getActiveDocumentId()
    expect(activeId).toBe('test-id')
  })
})
