# Domain Model

Canonical source: `src/types/domain.ts`.

## Document

```ts
type Document = {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
  source: "local" | "firebase";
  sourceShareId?: string;
  sourceOwnerUid?: string;
  cloudDocumentId?: string;
  cloudOwnerUid?: string;
  cloudUpdatedAt?: number;
  lastSyncedAt?: number;
  theme?: ThemeName;
};
```

## CloudDocument

Private owner-only backup stored at `users/{uid}/documents/{documentId}`.

```ts
type CloudDocument = {
  id: string;
  title: string;
  markdown: string;
  ownerUid: string;
  createdAt: number;
  updatedAt: number;
  localDocumentId?: string;
  deletedAt?: number;
};
```

## RecentDocumentItem

Recent Documents renders from this sync-aware view model instead of raw IndexedDB rows.

```ts
type RecentDocumentItem = {
  id: string;
  title: string;
  markdown: string;
  createdAt: number;
  updatedAt: number;
  localDocumentId?: string;
  cloudDocumentId?: string;
  source: "local" | "firebase";
  syncStatus: "local-only" | "backed-up" | "syncing" | "conflict" | "error";
};
```

## ThemeName

```ts
type ThemeName =
  | "github-light"
  | "github-dark"
  | "pastel-mint"
  | "minimal-ivory"
  | "one-dark"
  | "blue-eclipse";
```

## DocumentSource

```ts
type DocumentSource = "local" | "firebase";
```

## SharedDocument

```ts
type SharedDocument = {
  id: string;
  title: string;
  markdown: string;
  ownerUid: string;
  ownerDisplayName?: string;
  ownerEmail?: string;
  createdAt: number;
  updatedAt: number;
  sourceDocId?: string;
};
```

## OwnerProfile

```ts
type OwnerProfile = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
};
```

## View State Types

```ts
type DesktopViewMode = "edit" | "split" | "preview";
type MobileTab = "write" | "preview" | "outline" | "files";
```

## SaveStatus

```ts
type SaveStatus =
  | "local-only"
  | "unsaved"
  | "saving"
  | "saved"
  | "synced"
  | "error";
```

## Invariants

- `id` is unique across local documents.
- `title` is required; imported files derive it from the filename, and new documents default to `Untitled Document`.
- `updatedAt >= createdAt`.
- `source` defaults to `local`; `firebase` is used after a document is published to Firestore or opened from an owned shared link.
- `sourceShareId` is present when a local document represents a Firebase-backed document.
- `sourceOwnerUid` is present when the owner is known locally.
- `cloudDocumentId` links a local working copy to a private user backup document.
- `cloudOwnerUid` must match the signed-in user that owns the private backup.
- `lastSyncedAt` tracks the latest known clean local/cloud sync point for conflict detection.
- `theme` is optional at document level and may fall back to app-level theme.
- `SharedDocument.ownerUid` is required and must match the authenticated creator in Firestore rules.
- `sourceDocId` links a share to the local document that produced it when available.
- The local `Document` remains the canonical editable working record; `CloudDocument` is a private backup copy; `SharedDocument` is a public published copy.
- `local-only`, `unsaved`, and `error` save states are treated as unsaved-change states for before-unload and guarded document switching.
- `synced` means the active local document is linked to a share snapshot, not that Firestore is the canonical editor store.

## IndexedDB Shape

- Database: `markdownStudioDb`.
- `documents` table stores `Document` records and currently indexes `id`, `updatedAt`, `createdAt`, `title`, `source`, `sourceShareId`, `sourceOwnerUid`, `cloudDocumentId`, and `cloudOwnerUid`.
- `appState` stores `{ key: string, value: string }` entries for `activeDocId` and `theme`.
