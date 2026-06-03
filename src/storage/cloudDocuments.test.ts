import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteCloudDocument, listCloudDocuments, upsertCloudDocumentFromLocal } from './cloudDocuments'
import type { Document } from '../types'

const collectionMock = vi.fn()
const deleteDocMock = vi.fn()
const docMock = vi.fn()
const getDocsMock = vi.fn()
const orderByMock = vi.fn()
const queryMock = vi.fn()
const setDocMock = vi.fn()

vi.mock('../firebase/client', () => ({
  firestore: { mocked: true },
}))

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  deleteDoc: (...args: unknown[]) => deleteDocMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  orderBy: (...args: unknown[]) => orderByMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}))

describe('cloudDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    collectionMock.mockReturnValue({ type: 'collection-ref' })
    docMock.mockReturnValue({ type: 'doc-ref' })
    orderByMock.mockReturnValue({ type: 'order-by' })
    queryMock.mockReturnValue({ type: 'query-ref' })
  })

  it('backs up a local document to the user private documents subcollection', async () => {
    const localDocument = localDoc({
      id: 'local-1',
      title: 'Draft',
      markdown: '# Draft',
      createdAt: 100,
      updatedAt: 200,
      contentUpdatedAt: 200,
    })

    const result = await upsertCloudDocumentFromLocal('user-1', localDocument)

    expect(docMock).toHaveBeenCalledWith({ mocked: true }, 'users', 'user-1', 'documents', 'local-1')
    expect(setDocMock).toHaveBeenCalledWith(
      { type: 'doc-ref' },
      expect.objectContaining({
        title: 'Draft',
        markdown: '# Draft',
        ownerUid: 'user-1',
        createdAt: 100,
        updatedAt: 200,
        localDocumentId: 'local-1',
      }),
      { merge: true },
    )
    expect(result).toEqual(expect.objectContaining({ id: 'local-1', ownerUid: 'user-1' }))
  })

  it('hard deletes a cloud document from the user private documents subcollection', async () => {
    await deleteCloudDocument('user-1', 'cloud-1')

    expect(docMock).toHaveBeenCalledWith({ mocked: true }, 'users', 'user-1', 'documents', 'cloud-1')
    expect(deleteDocMock).toHaveBeenCalledWith({ type: 'doc-ref' })
  })

  it('keeps legacy deletedAt tombstones hidden from cloud document listings', async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        cloudSnapshotDoc('active-1', { title: 'Active', markdown: '# Active', ownerUid: 'user-1' }),
        cloudSnapshotDoc('deleted-1', { title: 'Deleted', ownerUid: 'user-1', deletedAt: 300 }),
      ],
    })

    const result = await listCloudDocuments('user-1')

    expect(collectionMock).toHaveBeenCalledWith({ mocked: true }, 'users', 'user-1', 'documents')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('active-1')
  })
})

function localDoc(input: Partial<Document> & Pick<Document, 'id' | 'title' | 'markdown'>): Document {
  return {
    createdAt: 100,
    updatedAt: 100,
    source: 'local',
    ...input,
  }
}

function cloudSnapshotDoc(id: string, data: Record<string, unknown>) {
  return {
    id,
    data: () => ({
      createdAt: 100,
      updatedAt: 200,
      ...data,
    }),
  }
}
