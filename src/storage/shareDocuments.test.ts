import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSharedDocumentById, publishSharedDocument, updateSharedDocument } from './shareDocuments'

const addDocMock = vi.fn()
const collectionMock = vi.fn()
const docMock = vi.fn()
const getDocMock = vi.fn()
const updateDocMock = vi.fn()

vi.mock('../firebase/client', () => ({
  firestore: { mocked: true },
}))

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => addDocMock(...args),
  collection: (...args: unknown[]) => collectionMock(...args),
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
}))

describe('shareDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    collectionMock.mockReturnValue({ type: 'collection-ref' })
    docMock.mockReturnValue({ type: 'doc-ref' })
  })

  it('publishes a shared document and returns share id', async () => {
    addDocMock.mockResolvedValue({ id: 'share-123' })

    const result = await publishSharedDocument({
      markdown: '# Shared',
      sourceDocId: 'local-1',
    })

    expect(result).toEqual({ shareId: 'share-123' })
    expect(collectionMock).toHaveBeenCalledWith({ mocked: true }, 'sharedDocuments')
    expect(addDocMock).toHaveBeenCalledTimes(1)
    expect(addDocMock.mock.calls[0][1]).toMatchObject({
      markdown: '# Shared',
      sourceDocId: 'local-1',
    })
  })

  it('loads an existing shared document', async () => {
    getDocMock.mockResolvedValue({
      id: 'share-abc',
      exists: () => true,
      data: () => ({
        markdown: '# Remote',
        createdAt: 100,
        updatedAt: 200,
      }),
    })

    const result = await getSharedDocumentById('share-abc')

    expect(docMock).toHaveBeenCalledWith({ mocked: true }, 'sharedDocuments', 'share-abc')
    expect(result).toEqual({
      id: 'share-abc',
      markdown: '# Remote',
      createdAt: 100,
      updatedAt: 200,
      sourceDocId: undefined,
    })
  })

  it('returns null when shared document does not exist', async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
    })

    const result = await getSharedDocumentById('missing-id')
    expect(result).toBeNull()
  })

  it('updates an existing shared document', async () => {
    await updateSharedDocument('share-777', {
      markdown: '# Updated',
      sourceDocId: 'local-2',
    })

    expect(docMock).toHaveBeenCalledWith({ mocked: true }, 'sharedDocuments', 'share-777')
    expect(updateDocMock).toHaveBeenCalledTimes(1)
    expect(updateDocMock.mock.calls[0][1]).toMatchObject({
      markdown: '# Updated',
      sourceDocId: 'local-2',
    })
    expect(typeof updateDocMock.mock.calls[0][1].updatedAt).toBe('number')
  })
})
