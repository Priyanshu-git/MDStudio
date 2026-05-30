import Dexie, { type Table } from 'dexie'
import type { Document } from '../types'

export type AppStateEntry = {
  key: string
  value: string
}

class MarkdownStudioDb extends Dexie {
  documents!: Table<Document, string>
  appState!: Table<AppStateEntry, string>

  constructor() {
    super('markdownStudioDb')
    this.version(1).stores({
      documents: 'id,updatedAt,createdAt',
      appState: 'key',
    })
    this.version(2).stores({
      documents: 'id,updatedAt,createdAt,title',
      appState: 'key',
    })
    this.version(3).stores({
      documents: 'id,updatedAt,createdAt,title,source,sourceShareId,sourceOwnerUid',
      appState: 'key',
    })
    this.version(4).stores({
      documents: 'id,updatedAt,createdAt,title,source,sourceShareId,sourceOwnerUid,cloudDocumentId,cloudOwnerUid',
      appState: 'key',
    })
    this.version(5).stores({
      documents: 'id,updatedAt,contentUpdatedAt,createdAt,title,source,sourceShareId,sourceOwnerUid,cloudDocumentId,cloudOwnerUid',
      appState: 'key',
    }).upgrade(async (transaction) => {
      await transaction.table<Document, string>('documents').toCollection().modify((doc) => {
        doc.contentUpdatedAt = doc.contentUpdatedAt ?? doc.updatedAt
      })
    })
  }
}

export const db = new MarkdownStudioDb()
