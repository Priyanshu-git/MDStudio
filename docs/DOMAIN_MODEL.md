# Domain Model

Canonical source: `src/types/domain.ts`.

## Document

```ts
type Document = {
  id: string
  title: string
  markdown: string
  createdAt: number
  updatedAt: number
  source: 'local' | 'firebase'
  sourceShareId?: string
  sourceOwnerUid?: string
  theme?: ThemeName
}
```

## ThemeName

```ts
type ThemeName =
  | 'github-light'
  | 'github-dark'
  | 'dracula'
```

## SharedDocument

```ts
type SharedDocument = {
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
```

## OwnerProfile

```ts
type OwnerProfile = {
  uid: string
  displayName?: string | null
  email?: string | null
}
```

## Invariants
- `id` is unique across local documents.
- `title` is required; imported files derive it from the filename, and new documents default to `Untitled Document`.
- `updatedAt >= createdAt`.
- `source` defaults to `local`; `firebase` is used once a document has been backed up to Firestore.
- `sourceShareId` and `sourceOwnerUid` are present when a local document represents a Firebase-backed document.
- `theme` is optional at document level and may fall back to app-level theme.
- `SharedDocument.ownerUid` is required and must match the authenticated creator in Firestore rules.
- `sourceDocId` links a share to the local document that produced it when available.
- The local `Document` remains the canonical editable record; `SharedDocument` is a published copy.
