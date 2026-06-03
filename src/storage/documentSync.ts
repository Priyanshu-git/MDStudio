import type { CloudDocument, Document, RecentDocumentItem } from '../types'
import {
  createDocument,
  deleteDocument,
  documentContentTimestamp,
  findDocumentByCloudDocumentId,
  getDocumentById,
  listDocuments,
  updateDocumentContent,
  updateDocumentSyncMetadata,
} from './documents'
import { deleteCloudDocument, listCloudDocuments, upsertCloudDocumentFromLocal } from './cloudDocuments'

function toRecentItem(doc: Document, syncStatus: RecentDocumentItem['syncStatus']): RecentDocumentItem {
  return {
    id: doc.id,
    localDocumentId: doc.id,
    cloudDocumentId: doc.cloudDocumentId,
    title: doc.title,
    markdown: doc.markdown,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    contentUpdatedAt: documentContentTimestamp(doc),
    source: doc.cloudDocumentId ? 'firebase' : doc.source,
    syncStatus,
  }
}

function findLocalMatch(cloudDocument: CloudDocument, localDocuments: Document[]): Document | undefined {
  return localDocuments.find((doc) => doc.cloudDocumentId === cloudDocument.id)
    ?? (cloudDocument.localDocumentId
      ? localDocuments.find((doc) => doc.id === cloudDocument.localDocumentId)
      : undefined)
}

async function hydrateCloudDocument(uid: string, cloudDocument: CloudDocument): Promise<Document> {
  const existing = await findDocumentByCloudDocumentId(cloudDocument.id)
  if (existing) {
    return existing
  }

  return createDocument({
    title: cloudDocument.title,
    markdown: cloudDocument.markdown,
    source: 'firebase',
    cloudDocumentId: cloudDocument.id,
    cloudOwnerUid: uid,
    cloudUpdatedAt: cloudDocument.updatedAt,
    lastSyncedAt: cloudDocument.updatedAt,
    contentUpdatedAt: cloudDocument.updatedAt || undefined,
    syncUpdatedAt: Date.now(),
  })
}

async function reconcileMatchedDocument(
  uid: string,
  localDocument: Document,
  cloudDocument: CloudDocument,
): Promise<{ document: Document; syncStatus: RecentDocumentItem['syncStatus'] }> {
  const lastSyncedAt = localDocument.lastSyncedAt ?? 0
  const localContentUpdatedAt = documentContentTimestamp(localDocument)
  const localChanged = localContentUpdatedAt > lastSyncedAt
  const cloudChanged = cloudDocument.updatedAt > lastSyncedAt

  if (localChanged && cloudChanged && localDocument.markdown !== cloudDocument.markdown) {
    await updateDocumentSyncMetadata(localDocument.id, {
      cloudDocumentId: cloudDocument.id,
      cloudOwnerUid: uid,
      cloudUpdatedAt: cloudDocument.updatedAt,
      source: 'firebase',
    })
    return { document: (await getDocumentById(localDocument.id))!, syncStatus: 'conflict' }
  }

  if (cloudChanged && cloudDocument.updatedAt > localContentUpdatedAt) {
    await updateDocumentContent(localDocument.id, {
      title: cloudDocument.title,
      markdown: cloudDocument.markdown,
      contentUpdatedAt: cloudDocument.updatedAt,
    })
    await updateDocumentSyncMetadata(localDocument.id, {
      source: 'firebase',
      cloudDocumentId: cloudDocument.id,
      cloudOwnerUid: uid,
      cloudUpdatedAt: cloudDocument.updatedAt,
      lastSyncedAt: cloudDocument.updatedAt,
    })
    return { document: (await getDocumentById(localDocument.id))!, syncStatus: 'backed-up' }
  }

  if (localChanged && localContentUpdatedAt > cloudDocument.updatedAt) {
    const synced = await upsertCloudDocumentFromLocal(uid, {
      ...localDocument,
      cloudDocumentId: cloudDocument.id,
    })
    await updateDocumentSyncMetadata(localDocument.id, {
      source: 'firebase',
      cloudDocumentId: synced.id,
      cloudOwnerUid: uid,
      cloudUpdatedAt: synced.updatedAt,
      lastSyncedAt: synced.updatedAt,
    })
    return { document: (await getDocumentById(localDocument.id))!, syncStatus: 'backed-up' }
  }

  const hasMissingMetadata = localDocument.source !== 'firebase'
    || localDocument.cloudDocumentId !== cloudDocument.id
    || localDocument.cloudOwnerUid !== uid
    || localDocument.cloudUpdatedAt !== cloudDocument.updatedAt
    || !localDocument.lastSyncedAt

  if (!hasMissingMetadata) {
    return { document: localDocument, syncStatus: 'backed-up' }
  }

  await updateDocumentSyncMetadata(localDocument.id, {
    source: 'firebase',
    cloudDocumentId: cloudDocument.id,
    cloudOwnerUid: uid,
    cloudUpdatedAt: cloudDocument.updatedAt,
    lastSyncedAt: localDocument.lastSyncedAt ?? Math.max(localContentUpdatedAt, cloudDocument.updatedAt),
  })
  return { document: (await getDocumentById(localDocument.id))!, syncStatus: 'backed-up' }
}

export async function backUpLocalDocument(uid: string, localDocument: Document): Promise<Document> {
  const cloudDocument = await upsertCloudDocumentFromLocal(uid, localDocument)
  await updateDocumentSyncMetadata(localDocument.id, {
    source: 'firebase',
    cloudDocumentId: cloudDocument.id,
    cloudOwnerUid: uid,
    cloudUpdatedAt: cloudDocument.updatedAt,
    lastSyncedAt: cloudDocument.updatedAt,
  })
  return (await getDocumentById(localDocument.id))!
}

export async function refreshRecentDocumentsForUser(uid: string): Promise<RecentDocumentItem[]> {
  const [localDocuments, cloudDocuments] = await Promise.all([
    listDocuments(),
    listCloudDocuments(uid),
  ])
  const matchedLocalIds = new Set<string>()
  const recentItems: RecentDocumentItem[] = []

  for (const cloudDocument of cloudDocuments) {
    const localMatch = findLocalMatch(cloudDocument, localDocuments)
    const reconciliation = localMatch
      ? await reconcileMatchedDocument(uid, localMatch, cloudDocument)
      : { document: await hydrateCloudDocument(uid, cloudDocument), syncStatus: 'backed-up' as const }
    const localDocument = reconciliation.document
    matchedLocalIds.add(localDocument.id)

    recentItems.push(toRecentItem(localDocument, reconciliation.syncStatus))
  }

  for (const localDocument of localDocuments) {
    if (!matchedLocalIds.has(localDocument.id)) {
      recentItems.push(toRecentItem(localDocument, localDocument.cloudDocumentId ? 'backed-up' : 'local-only'))
    }
  }

  return recentItems.sort((left, right) => (right.contentUpdatedAt ?? right.updatedAt) - (left.contentUpdatedAt ?? left.updatedAt))
}

export async function refreshLocalRecentDocuments(): Promise<RecentDocumentItem[]> {
  const documents = await listDocuments()
  return documents.map((doc) => toRecentItem(doc, doc.cloudDocumentId ? 'backed-up' : 'local-only'))
}

export async function deleteRecentDocument(uid: string | null, item: RecentDocumentItem): Promise<void> {
  if (uid && item.cloudDocumentId) {
    await deleteCloudDocument(uid, item.cloudDocumentId)
  }

  if (item.localDocumentId) {
    await deleteDocument(item.localDocumentId)
  }
}
