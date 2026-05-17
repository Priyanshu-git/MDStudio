import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore'
import { firestore } from '../firebase/client'
import type { OwnerProfile, SharedDocument } from '../types'

const SHARED_DOCUMENTS_COLLECTION = 'sharedDocuments'

export type PublishSharedDocumentInput = {
  title: string
  markdown: string
  owner: OwnerProfile
  sourceDocId?: string
}

export type UpdateSharedDocumentInput = {
  title: string
  markdown: string
  sourceDocId?: string
}

export async function publishSharedDocument(
  input: PublishSharedDocumentInput,
): Promise<{ shareId: string }> {
  const now = Date.now()
  const payload = {
    title: input.title,
    markdown: input.markdown,
    ownerUid: input.owner.uid,
    ownerDisplayName: input.owner.displayName ?? '',
    ownerEmail: input.owner.email ?? '',
    createdAt: now,
    updatedAt: now,
    ...(input.sourceDocId ? { sourceDocId: input.sourceDocId } : {}),
  }

  const ref = await addDoc(collection(firestore, SHARED_DOCUMENTS_COLLECTION), payload)
  return { shareId: ref.id }
}

export async function updateSharedDocument(
  shareId: string,
  input: UpdateSharedDocumentInput,
): Promise<void> {
  const payload = {
    title: input.title,
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
    title: typeof data.title === 'string' ? data.title : 'Shared Document',
    markdown: typeof data.markdown === 'string' ? data.markdown : '',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    ownerDisplayName: typeof data.ownerDisplayName === 'string' ? data.ownerDisplayName : undefined,
    ownerEmail: typeof data.ownerEmail === 'string' ? data.ownerEmail : undefined,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    sourceDocId: typeof data.sourceDocId === 'string' ? data.sourceDocId : undefined,
  }
}
