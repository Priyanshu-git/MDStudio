import { db } from './db'
import type { Document } from '../types'

const ACTIVE_DOC_KEY = 'activeDocId'
const THEME_KEY = 'theme'

export async function createDocument(markdown: string): Promise<Document> {
  const now = Date.now()
  const doc: Document = {
    id: crypto.randomUUID(),
    markdown,
    createdAt: now,
    updatedAt: now,
  }
  await db.documents.put(doc)
  await setActiveDocumentId(doc.id)
  return doc
}

export async function getDocumentById(id: string): Promise<Document | undefined> {
  return db.documents.get(id)
}

export async function updateDocumentMarkdown(id: string, markdown: string): Promise<void> {
  await db.documents.update(id, { markdown, updatedAt: Date.now() })
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
    return latest
  }

  return createDocument(seedMarkdown)
}
