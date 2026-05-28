import { db } from './db'
import type { Document, DocumentSource, ThemeName } from '../types'

const ACTIVE_DOC_KEY = 'activeDocId'
const THEME_KEY = 'theme'

export type CreateDocumentInput = {
  title?: string
  markdown: string
  theme?: ThemeName
  source?: DocumentSource
  sourceShareId?: string
  sourceOwnerUid?: string
  cloudDocumentId?: string
  cloudOwnerUid?: string
  cloudUpdatedAt?: number
  lastSyncedAt?: number
}

export type UpdateDocumentInput = {
  title?: string
  markdown?: string
  theme?: ThemeName
  source?: DocumentSource
  sourceShareId?: string
  sourceOwnerUid?: string
  cloudDocumentId?: string
  cloudOwnerUid?: string
  cloudUpdatedAt?: number
  lastSyncedAt?: number
}

const DEFAULT_TITLE = 'Untitled Document'

function titleFromMarkdown(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return heading || DEFAULT_TITLE
}

function normalizeDocument(doc: Document): Document {
  const { sourceShareId, sourceOwnerUid, ...rest } = doc
  const source = doc.source === 'firebase' ? 'firebase' : 'local'
  return {
    ...rest,
    title: doc.title || titleFromMarkdown(doc.markdown),
    source,
    ...(source === 'firebase' && sourceShareId ? { sourceShareId } : {}),
    ...(source === 'firebase' && sourceOwnerUid ? { sourceOwnerUid } : {}),
  }
}

export async function createDocument(input: CreateDocumentInput | string): Promise<Document> {
  const payload = typeof input === 'string' ? { markdown: input } : input
  const now = Date.now()
  const doc: Document = {
    id: crypto.randomUUID(),
    title: payload.title?.trim() || titleFromMarkdown(payload.markdown),
    markdown: payload.markdown,
    createdAt: now,
    updatedAt: now,
    source: payload.source ?? 'local',
    ...(payload.sourceShareId ? { sourceShareId: payload.sourceShareId } : {}),
    ...(payload.sourceOwnerUid ? { sourceOwnerUid: payload.sourceOwnerUid } : {}),
    ...(payload.cloudDocumentId ? { cloudDocumentId: payload.cloudDocumentId } : {}),
    ...(payload.cloudOwnerUid ? { cloudOwnerUid: payload.cloudOwnerUid } : {}),
    ...(payload.cloudUpdatedAt ? { cloudUpdatedAt: payload.cloudUpdatedAt } : {}),
    ...(payload.lastSyncedAt ? { lastSyncedAt: payload.lastSyncedAt } : {}),
    ...(payload.theme ? { theme: payload.theme } : {}),
  }
  await db.documents.put(doc)
  await setActiveDocumentId(doc.id)
  return doc
}

export async function getDocumentById(id: string): Promise<Document | undefined> {
  const doc = await db.documents.get(id)
  return doc ? normalizeDocument(doc) : undefined
}

export async function listDocuments(): Promise<Document[]> {
  const docs = await db.documents.orderBy('updatedAt').reverse().toArray()
  return docs.map(normalizeDocument)
}

export async function findDocumentByCloudDocumentId(cloudDocumentId: string): Promise<Document | undefined> {
  const doc = await db.documents.where('cloudDocumentId').equals(cloudDocumentId).first()
  return doc ? normalizeDocument(doc) : undefined
}

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<void> {
  await db.documents.update(id, { ...input, updatedAt: Date.now() })
}

export async function updateDocumentMarkdown(id: string, markdown: string): Promise<void> {
  await updateDocument(id, { markdown })
}

export async function deleteDocument(id: string): Promise<void> {
  await db.documents.delete(id)
  const activeId = await getActiveDocumentId()
  if (activeId === id) {
    await db.appState.delete(ACTIVE_DOC_KEY)
  }
}

export async function setActiveDocumentId(id: string): Promise<void> {
  await db.appState.put({ key: ACTIVE_DOC_KEY, value: id })
}

export async function getActiveDocumentId(): Promise<string | null> {
  const item = await db.appState.get(ACTIVE_DOC_KEY)
  return item?.value ?? null
}

export async function setThemePreference(theme: string): Promise<void> {
  await db.appState.put({ key: THEME_KEY, value: theme })
}

export async function getThemePreference(): Promise<string | null> {
  const item = await db.appState.get(THEME_KEY)
  return item?.value ?? null
}

export async function getOrCreateActiveDocument(seedMarkdown: string): Promise<Document> {
  const activeId = await getActiveDocumentId()
  if (activeId) {
    const existing = await getDocumentById(activeId)
    if (existing) {
      return existing
    }
  }

  const latest = await db.documents.orderBy('updatedAt').last()
  if (latest) {
    await setActiveDocumentId(latest.id)
    return normalizeDocument(latest)
  }

  return createDocument({ markdown: seedMarkdown, title: titleFromMarkdown(seedMarkdown) })
}
