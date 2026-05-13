import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import type { SharedDocument } from '../types'

const SHARED_DOCUMENTS_COLLECTION = 'sharedDocuments'

export type PublishSharedDocumentInput = {
  markdown: string
  sourceDocId?: string
}

export async function publishSharedDocument(
  input: PublishSharedDocumentInput,
): Promise<{ shareId: string }> {
  const now = Date.now()
  const payload = {
    markdown: input.markdown,
    createdAt: now,
    updatedAt: now,
    ...(input.sourceDocId ? { sourceDocId: input.sourceDocId } : {}),
  }

  const ref = await addDoc(collection(firestore, SHARED_DOCUMENTS_COLLECTION), payload)
  return { shareId: ref.id }
}

export async function updateSharedDocument(
  shareId: string,
  input: PublishSharedDocumentInput,
): Promise<void> {
  const payload = {
    markdown: input.markdown,
    updatedAt: Date.now(),
    ...(input.sourceDocId ? { sourceDocId: input.sourceDocId } : {}),
  }

  const ref = doc(firestore, SHARED_DOCUMENTS_COLLECTION, shareId)
  await updateDoc(ref, payload)
}

export async function getSharedDocumentById(shareId: string): Promise<SharedDocument | null> {
  const ref = doc(firestore, SHARED_DOCUMENTS_COLLECTION, shareId)
  const snapshot = await getDoc(ref)

  if (!snapshot.exists()) {
    return null
  }

  const data = snapshot.data()
  return {
    id: snapshot.id,
    markdown: typeof data.markdown === 'string' ? data.markdown : '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    sourceDocId: typeof data.sourceDocId === 'string' ? data.sourceDocId : undefined,
  }
}
