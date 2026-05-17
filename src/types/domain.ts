export type ThemeName =
  | 'github-light'
  | 'github-dark'
  | 'dracula'

export type DocumentSource = 'local' | 'firebase'

export type Document = {
  id: string
  title: string
  markdown: string
  createdAt: number
  updatedAt: number
  source: DocumentSource
  sourceShareId?: string
  sourceOwnerUid?: string
  theme?: ThemeName
}

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

export type DesktopViewMode = 'edit' | 'split' | 'preview'

export type MobileTab = 'write' | 'preview' | 'outline' | 'files'

export type SaveStatus =
  | 'local-only'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'synced'
  | 'error'
