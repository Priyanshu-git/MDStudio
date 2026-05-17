import { db } from './db'
import type { Document, ThemeName } from '../types'

const ACTIVE_DOC_KEY = 'activeDocId'
const THEME_KEY = 'theme'

export type CreateDocumentInput = {
  title?: string
  markdown: string
  theme?: ThemeName
}

export type UpdateDocumentInput = {
  title?: string
  markdown?: string
  theme?: ThemeName
}

const DEFAULT_TITLE = 'Untitled Document'

function titleFromMarkdown(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim()
  return heading || DEFAULT_TITLE
}

function normalizeDocument(doc: Document): Document {
  return {
    ...doc,
    title: doc.title || titleFromMarkdown(doc.markdown),
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

export async function updateDocument(id: string, input: UpdateDocumentInput): Promise<void> {
  await db.documents.update(id, { ...input, updatedAt: Date.now() })
}

export async function updateDocumentMarkdown(id: string, markdown: string): Promise<void> {
  await updateDocument(id, { markdown })
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
