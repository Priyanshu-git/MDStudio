import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { firestore } from '../firebase/client'
import type { CloudDocument, Document } from '../types'
import { documentContentTimestamp } from './documents'

const USERS_COLLECTION = 'users'
const DOCUMENTS_COLLECTION = 'documents'

type CloudDocumentPayload = Omit<CloudDocument, 'id'>

function userDocumentsCollection(uid: string) {
  return collection(firestore, USERS_COLLECTION, uid, DOCUMENTS_COLLECTION)
}

function userDocumentRef(uid: string, documentId: string) {
  return doc(firestore, USERS_COLLECTION, uid, DOCUMENTS_COLLECTION, documentId)
}

function normalizeCloudDocument(id: string, data: Record<string, unknown>): CloudDocument {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : 'Untitled Document',
    markdown: typeof data.markdown === 'string' ? data.markdown : '',
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : '',
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : 0,
    localDocumentId: typeof data.localDocumentId === 'string' ? data.localDocumentId : undefined,
    deletedAt: typeof data.deletedAt === 'number' ? data.deletedAt : undefined,
  }
}

export async function listCloudDocuments(uid: string): Promise<CloudDocument[]> {
  const snapshot = await getDocs(query(userDocumentsCollection(uid), orderBy('updatedAt', 'desc')))
  return snapshot.docs
    .map((item) => normalizeCloudDocument(item.id, item.data()))
    .filter((item) => !item.deletedAt)
}

export async function upsertCloudDocumentFromLocal(uid: string, localDocument: Document): Promise<CloudDocument> {
  const cloudDocumentId = localDocument.cloudDocumentId || localDocument.id
  const now = Date.now()
  const createdAt = localDocument.createdAt || now
  const contentUpdatedAt = documentContentTimestamp(localDocument) || now
  const payload: CloudDocumentPayload = {
    title: localDocument.title,
    markdown: localDocument.markdown,
    ownerUid: uid,
    createdAt,
    updatedAt: contentUpdatedAt,
    localDocumentId: localDocument.id,
  }

  await setDoc(userDocumentRef(uid, cloudDocumentId), payload, { merge: true })
  return { id: cloudDocumentId, ...payload }
}

export async function deleteCloudDocument(uid: string, cloudDocumentId: string): Promise<void> {
  await deleteDoc(userDocumentRef(uid, cloudDocumentId))
}
