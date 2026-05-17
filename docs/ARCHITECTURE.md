# Architecture

## Runtime Model
- Pure client-side rendered (CSR) React app.
- No SSR pipeline.
- Route-driven app shell with local-first editor state and Firestore-backed sharing.
- Firebase Auth is used for Google sign-in and share ownership.
- IndexedDB remains the canonical local document store.

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
  - `files`: local document list, search, new document, and import
- `/doc/:id` opens a local document and redirects to `/editor`
- `/share/:id` loads a public shared document from Firestore in read-only mode

## Core Modules
- `src/editor`: editor shell, CodeMirror integration, toolbar actions, sharing dialog, account menu
- `src/preview`: markdown preview surface
- `src/renderers`: code and mermaid block renderers
- `src/storage`: Dexie local persistence and Firestore share services
- `src/firebase`: Firebase client and Google auth helpers
- `src/state`: Zustand app-level state contracts
- `src/types`: canonical shared domain types

## Data Flow
CodeMirror input -> app store draft state -> explicit local save -> Dexie -> markdown pipeline -> preview renderers.

Sharing flow: signed-in user -> save local draft -> create or update Firestore `sharedDocuments` record -> store active share snapshot in app state -> `/share/:id` reads public record.

For end-to-end product behavior, keep `docs/USER_FLOWS.md` aligned with route, persistence, auth, sharing, import/export, and offline changes.

## UI Mode State
- `desktopViewMode: 'edit' | 'split' | 'preview'` is owned by app state.
- `mobileTab: 'write' | 'preview' | 'outline' | 'files'` is owned by app state.

## Account Menu
- Auth state is observed through `listenToAuthState`.
- Signed-out users see sign-in actions in the topbar and share dialog.
- Signed-in users see an avatar/account button on desktop and mobile.
- Opening the account menu shows display name/email and a sign-out action.
- Sign-out requires inline confirmation; Escape, outside pointer down, or auth loss closes and resets the menu.
