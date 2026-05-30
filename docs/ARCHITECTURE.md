# Architecture

## Runtime Model

- Pure client-side rendered (CSR) React app.
- No SSR pipeline.
- Route-driven app shell with local-first editor state and Firestore-backed sharing.
- Firebase Auth is used for Google sign-in and share ownership.
- IndexedDB remains the canonical local working document store.
- Signed-in users can back up documents to private Firestore user document collections.
- Vite owns build/test configuration, including PWA setup and workspace-local temp output.

## Route Contract

- `/` redirects to `/editor`
- `/editor` editor and preview shell:
  - desktop view modes:
  - `edit`: editor-only desktop surface
  - `split`: editor and preview desktop surface
  - `preview`: preview-only desktop surface
  - mobile tabs:
  - `write`: editor and insert toolbar
  - `preview`: read-only preview
  - `outline`: heading outline
  - `files`: recent document list, search, new document, and import
- `/doc/:id` opens a local document and redirects to `/editor`
- `/share/:id` loads a public shared document from Firestore in read-only mode
- Unknown routes redirect to `/editor`

## Core Modules

- `src/editor`: editor shell, CodeMirror integration, toolbar actions, link/image insertion dialogs, sharing dialog, account menu
- `src/preview`: markdown preview surface
- `src/renderers` and `src/mermaid`: code and Mermaid block renderers
- `src/storage`: Dexie local persistence, local document source metadata, and Firestore share services
- `src/firebase`: Firebase client and Google auth helpers
- `src/state`: Zustand app-level state contracts
- `src/types`: canonical shared domain types

## Data Flow

CodeMirror input -> app store draft state -> explicit local save -> Dexie -> optional private cloud backup -> markdown pipeline -> preview renderers.

Private backup flow: signed-in user -> save local draft -> write only that document to `users/{uid}/documents/{documentId}` -> store cloud document metadata locally without changing content recency -> refresh Recent Documents from local records.

Recent Documents flow: signed-out users see a sign-in prompt. Signed-in users see a merged view from IndexedDB and private Firestore user documents. The sync adapter matches documents by cloud document id, hydrates cloud-only documents into local working copies, applies genuinely newer cloud content, and marks dual edits as conflicts. No-op sync metadata refreshes do not change content recency.

Recent Documents relative-time labels are UI-only. The editor shell keeps a minute-boundary timer for rendering labels such as `just now` and `1 min ago`; this timer must not refresh documents, reconcile sync state, write IndexedDB, or call Firestore.

Sharing flow: signed-in user -> save local draft -> create Firestore `sharedDocuments` record -> mark the local document with share metadata -> store active share snapshot in app state -> `/share/:id` reads public record.

Owner shared-document flow: owner opens `/share/:id` -> reuse `sourceDocId` when present locally, or create a Firebase-sourced local document -> link active share state -> navigate to `/editor`.

Non-owner shared-document flow: viewer opens `/share/:id` -> signs in if needed -> creates a new local IndexedDB copy titled `Copy of <shared title>` -> navigates to `/editor` without Firebase source metadata.

For end-to-end product behavior, keep `docs/USER_FLOWS.md` aligned with route, persistence, auth, sharing, import/export, and offline changes.

## UI Mode State

- `desktopViewMode: 'edit' | 'split' | 'preview'` is owned by app state.
- `mobileTab: 'write' | 'preview' | 'outline' | 'files'` is owned by app state.
- `desktopSidebarTab: 'documents' | 'outline'` is local editor-shell UI state and defaults to `outline`.
- Recent Documents relative-time rendering uses local editor-shell timer state and is not persisted.
- The desktop editor theme picker is a custom grouped menu with light and dark theme sections; Escape and outside pointer down close it.
- `/share/:id` uses direct topbar actions on desktop and a compact menu on mobile.
- Editor and shared mobile app bars auto-hide on downward scroll and reappear on upward scroll.

## Account Menu

- Auth state is observed through `listenToAuthState`.
- Signed-out users see sign-in actions in the topbar and share dialog.
- Signed-in users see an avatar/account button on desktop and mobile.
- Opening the account menu shows display name/email and a sign-out action.
- Sign-out requires inline confirmation; Escape, outside pointer down, or auth loss closes and resets the menu.
- Confirmed sign-out first saves unsaved work. If saving fails, sign-out is aborted. After successful sign-out, Recent Documents is cleared from view and replaced by the signed-out prompt.

## Persistence Schema

- Dexie database name: `markdownStudioDb`.
- `documents` table version 5 indexes: `id`, `updatedAt`, `contentUpdatedAt`, `createdAt`, `title`, `source`, `sourceShareId`, `sourceOwnerUid`, `cloudDocumentId`, and `cloudOwnerUid`.
- `updatedAt` remains a legacy/content recency field for compatibility. `contentUpdatedAt` is the preferred Recent Documents timestamp, with fallback to `updatedAt` for older records. `syncUpdatedAt` records metadata-only sync touches and is not used for recency.
- `appState` table stores string values by `key`; currently `activeDocId` and `theme`.
- Document theme is saved with local documents, while the app-level theme preference is saved separately.
- Firestore `users/{uid}/documents/{documentId}` stores private owner-only backups.
- Firestore `sharedDocuments` are public published copies and do not persist theme.

## Interaction Effects

- Buttons in the editor shell use a global ripple effect on pointer or keyboard activation.
- Ripples honor `prefers-reduced-motion: reduce`.
- The effect is limited to primary, secondary, icon, toolbar, bottom action, tab, and avatar buttons.
