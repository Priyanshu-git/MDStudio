import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import { createDocument, getDocumentById } from './documents'
import { backUpLocalDocument, deleteRecentDocument, refreshRecentDocumentsForUser } from './documentSync'
import { listCloudDocuments, softDeleteCloudDocument, upsertCloudDocumentFromLocal } from './cloudDocuments'
import type { CloudDocument } from '../types'

vi.mock('./cloudDocuments', () => ({
  listCloudDocuments: vi.fn(),
  upsertCloudDocumentFromLocal: vi.fn(),
  softDeleteCloudDocument: vi.fn(),
}))

describe('document sync', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.documents.clear()
    await db.appState.clear()
    vi.mocked(listCloudDocuments).mockResolvedValue([])
    vi.mocked(upsertCloudDocumentFromLocal).mockImplementation(async (uid, doc) => ({
      id: doc.cloudDocumentId || doc.id,
      title: doc.title,
      markdown: doc.markdown,
      ownerUid: uid,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      localDocumentId: doc.id,
    }))
  })

  it('includes local-only documents for signed-in recent documents', async () => {
    await createDocument({ title: 'Local Draft', markdown: '# Local Draft' })

    const recent = await refreshRecentDocumentsForUser('user-1')

    expect(recent).toHaveLength(1)
    expect(recent[0]).toEqual(expect.objectContaining({
      title: 'Local Draft',
      syncStatus: 'local-only',
    }))
  })

  it('hydrates cloud-only documents into local backed-up working copies', async () => {
    vi.mocked(listCloudDocuments).mockResolvedValue([
      cloudDoc({
        id: 'cloud-1',
        title: 'Cloud Draft',
        markdown: '# Cloud Draft',
        updatedAt: 200,
      }),
    ])

    const recent = await refreshRecentDocumentsForUser('user-1')
    const localDocuments = await db.documents.toArray()

    expect(localDocuments).toHaveLength(1)
    expect(localDocuments[0]).toEqual(expect.objectContaining({
      title: 'Cloud Draft',
      cloudDocumentId: 'cloud-1',
      cloudOwnerUid: 'user-1',
      source: 'firebase',
    }))
    expect(recent[0]).toEqual(expect.objectContaining({
      title: 'Cloud Draft',
      syncStatus: 'backed-up',
    }))
  })

  it('dedupes matched local and cloud documents by cloud document id', async () => {
    await createDocument({
      title: 'Local Cloud Draft',
      markdown: '# Local Cloud Draft',
      source: 'firebase',
      cloudDocumentId: 'cloud-1',
      cloudOwnerUid: 'user-1',
      cloudUpdatedAt: 100,
      lastSyncedAt: 100,
    })
    vi.mocked(listCloudDocuments).mockResolvedValue([
      cloudDoc({
        id: 'cloud-1',
        title: 'Local Cloud Draft',
        markdown: '# Local Cloud Draft',
        updatedAt: 100,
      }),
    ])

    const recent = await refreshRecentDocumentsForUser('user-1')

    expect(recent).toHaveLength(1)
    expect(recent[0].cloudDocumentId).toBe('cloud-1')
  })

  it('uses newer cloud content when only the cloud copy changed', async () => {
    const local = await createDocument({
      title: 'Old',
      markdown: '# Old',
      source: 'firebase',
      cloudDocumentId: 'cloud-1',
      cloudOwnerUid: 'user-1',
      cloudUpdatedAt: 100,
      lastSyncedAt: 100,
    })
    await db.documents.update(local.id, { updatedAt: 100, lastSyncedAt: 100, cloudUpdatedAt: 100 })
    vi.mocked(listCloudDocuments).mockResolvedValue([
      cloudDoc({
        id: 'cloud-1',
        title: 'New Cloud',
        markdown: '# New Cloud',
        updatedAt: Date.now() + 100,
      }),
    ])

    const recent = await refreshRecentDocumentsForUser('user-1')
    const updated = await getDocumentById(local.id)

    expect(updated?.markdown).toBe('# New Cloud')
    expect(recent[0].title).toBe('New Cloud')
  })

  it('marks dual local and cloud edits as conflict', async () => {
    const local = await createDocument({
      title: 'Local',
      markdown: '# Local',
      source: 'firebase',
      cloudDocumentId: 'cloud-1',
      cloudOwnerUid: 'user-1',
      cloudUpdatedAt: 100,
      lastSyncedAt: 100,
    })
    await db.documents.update(local.id, { updatedAt: 200, lastSyncedAt: 100, cloudUpdatedAt: 100, markdown: '# Local Changed' })
    vi.mocked(listCloudDocuments).mockResolvedValue([
      cloudDoc({
        id: 'cloud-1',
        title: 'Cloud Changed',
        markdown: '# Cloud Changed',
        updatedAt: Date.now() + 100,
      }),
    ])

    const recent = await refreshRecentDocumentsForUser('user-1')

    expect(recent[0].syncStatus).toBe('conflict')
  })

  it('backs up a local document and records cloud metadata', async () => {
    const local = await createDocument({ title: 'Backup Me', markdown: '# Backup Me' })

    const backedUp = await backUpLocalDocument('user-1', local)

    expect(upsertCloudDocumentFromLocal).toHaveBeenCalledWith('user-1', local)
    expect(backedUp).toEqual(expect.objectContaining({
      cloudDocumentId: local.id,
      cloudOwnerUid: 'user-1',
      source: 'firebase',
    }))
  })

  it('deletes local recent documents', async () => {
    const local = await createDocument({ title: 'Delete Me', markdown: '# Delete Me' })

    await deleteRecentDocument(null, {
      id: local.id,
      localDocumentId: local.id,
      title: local.title,
      markdown: local.markdown,
      createdAt: local.createdAt,
      updatedAt: local.updatedAt,
      source: 'local',
      syncStatus: 'local-only',
    })

    expect(await getDocumentById(local.id)).toBeUndefined()
    expect(softDeleteCloudDocument).not.toHaveBeenCalled()
  })

  it('soft deletes backed-up cloud documents before removing the local copy', async () => {
    const local = await createDocument({
      title: 'Backed Up',
      markdown: '# Backed Up',
      source: 'firebase',
      cloudDocumentId: 'cloud-1',
    })

    await deleteRecentDocument('user-1', {
      id: local.id,
      localDocumentId: local.id,
      cloudDocumentId: 'cloud-1',
      title: local.title,
      markdown: local.markdown,
      createdAt: local.createdAt,
      updatedAt: local.updatedAt,
      source: 'firebase',
      syncStatus: 'backed-up',
    })

    expect(softDeleteCloudDocument).toHaveBeenCalledWith('user-1', 'cloud-1')
    expect(await getDocumentById(local.id)).toBeUndefined()
  })
})

function cloudDoc(input: Partial<CloudDocument> & Pick<CloudDocument, 'id'>): CloudDocument {
  return {
    title: 'Cloud',
    markdown: '# Cloud',
    ownerUid: 'user-1',
    createdAt: 100,
    updatedAt: 100,
    ...input,
  }
}
