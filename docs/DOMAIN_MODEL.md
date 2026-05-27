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
  theme?: ThemeName;
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
- `theme` is optional at document level and may fall back to app-level theme.
- `SharedDocument.ownerUid` is required and must match the authenticated creator in Firestore rules.
- `sourceDocId` links a share to the local document that produced it when available.
- The local `Document` remains the canonical editable record; `SharedDocument` is a published copy.
- `local-only`, `unsaved`, and `error` save states are treated as unsaved-change states for before-unload and guarded document switching.
- `synced` means the active local document is linked to a share snapshot, not that Firestore is the canonical editor store.

## IndexedDB Shape

- Database: `markdownStudioDb`.
- `documents` table stores `Document` records and currently indexes `id`, `updatedAt`, `createdAt`, `title`, `source`, `sourceShareId`, and `sourceOwnerUid`.
- `appState` stores `{ key: string, value: string }` entries for `activeDocId` and `theme`.
