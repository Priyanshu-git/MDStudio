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
  }
}

export const db = new MarkdownStudioDb()
