export type ThemeName =
  | 'github-light'
  | 'github-dark'
  | 'pastel-mint'
  | 'minimal-ivory'
  | 'one-dark'
  | 'blue-eclipse'

export type DocumentSource = 'local' | 'firebase'

export type Document = {
  id: string
  title: string
  markdown: string
  createdAt: number
  updatedAt: number
  contentUpdatedAt?: number
  syncUpdatedAt?: number
  source: DocumentSource
  sourceShareId?: string
  sourceOwnerUid?: string
  cloudDocumentId?: string
  cloudOwnerUid?: string
  cloudUpdatedAt?: number
  lastSyncedAt?: number
  theme?: ThemeName
}

export type CloudDocument = {
  id: string
  title: string
  markdown: string
  ownerUid: string
  createdAt: number
  updatedAt: number
  localDocumentId?: string
  deletedAt?: number
}

export type RecentDocumentSyncStatus =
  | 'local-only'
  | 'backed-up'
  | 'syncing'
  | 'conflict'
  | 'error'

export type RecentDocumentItem = {
  id: string
  title: string
  markdown: string
  createdAt: number
  updatedAt: number
  contentUpdatedAt?: number
  localDocumentId?: string
  cloudDocumentId?: string
  sourceShareId?: string
  sourceOwnerUid?: string
  source: DocumentSource
  syncStatus: RecentDocumentSyncStatus
}

export type RecentDocumentsState = 'signed-out' | 'loading' | 'ready' | 'error'

export type SharedDocument = {
  id: string
  title: string
  markdown: string
  ownerUid: string
  ownerDisplayName?: string
  ownerEmail?: string
  createdAt: number
  updatedAt: number
  sourceDocId?: string
}

export type OwnerProfile = {
  uid: string
  displayName?: string | null
  email?: string | null
}

export type DesktopViewMode = 'split' | 'preview'

export type MobileTab = 'write' | 'preview' | 'outline' | 'files'

export type SaveStatus =
  | 'local-only'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'synced'
  | 'error'
