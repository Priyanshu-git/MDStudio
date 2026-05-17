# User Flows

This document describes the current product behavior that should remain stable across implementation changes.

## Local Editing

1. Opening `/` redirects to `/editor`.
2. The editor hydrates the active local document from IndexedDB, or creates the seeded markdown test document if none exists.
3. Editing the title or markdown updates draft state and marks the document dirty.
4. `Save` writes the current title, markdown, and theme to IndexedDB.
5. Recent documents are listed from IndexedDB by `updatedAt` descending.
6. Opening a different document clears any active share link and loads that local document into the editor.
7. If there are unsaved changes, navigating away from the current document asks for confirmation.

## Desktop Authoring

Desktop users work in one of three app-state-owned view modes:

- `edit`: editor only
- `split`: editor and preview
- `preview`: preview only

The toolbar inserts markdown snippets into CodeMirror. Outline selections switch to split mode when needed, then scroll the editor and preview toward the selected heading.

## Mobile Authoring

Mobile users work through four tabs:

- `write`: editor and compact insert toolbar
- `preview`: read-only rendered preview
- `outline`: heading outline
- `files`: document search, new document, import, and recent documents

The mobile bottom bar provides Save, Preview, Insert, and Share actions. Insert actions are queued until the write editor is mounted, so toolbar actions still work after switching tabs.

## Import And Export

Import accepts `.md` files only. Imported files become unsaved local drafts with the title derived from the filename.

Export supports:

- Markdown download from the current draft.
- HTML download containing escaped markdown in a basic HTML document.
- PDF through the browser print flow.

## Account Access

Signed-out users can edit locally. They see sign-in actions in the desktop topbar, mobile topbar, and share dialog.

Signed-in users see an avatar account button on desktop and mobile. Opening it shows identity details and a sign-out action. Choosing sign out shows inline confirmation. Cancel returns to the normal menu; Confirm signs out. Escape, outside pointer down, and auth loss close the menu and reset confirmation state.

## Sharing From The Editor

Sharing requires Google sign-in.

1. The user opens the Share dialog.
2. If signed out, publishing shows a sign-in requirement.
3. When signed in, creating a link first saves the local draft, then creates a Firestore `sharedDocuments` record with title, markdown, owner metadata, timestamps, and source document ID.
4. The returned share ID is stored in app state as the active share link.
5. Updating an active share link saves locally, updates the existing Firestore record, and refreshes the cloud snapshot.
6. Copy Link writes the active share URL to the clipboard when available.

Firestore is a published copy. The local IndexedDB document remains the canonical editable source.

## Shared Link Viewing

`/share/:id` loads a public Firestore document by ID and renders it read-only through the same markdown preview pipeline.

Shared pages show loading, not-found, and load-error states. The viewer can copy the share URL.

If the signed-in viewer owns the shared document, they see `Edit Original`. This loads the shared title and markdown into `/editor`, links the active share ID, and lets the next share action update the same link.

If the viewer is not the owner, they see `Make a Copy`. Signed-out users are prompted to sign in first. A copy creates a new local IndexedDB document titled `Copy of <shared title>` and opens it in `/editor`.

## Theme Behavior

The supported themes are `github-light`, `github-dark`, and `dracula`.

Theme preference is stored locally. Shared documents do not persist theme, so `/share/:id` renders with the viewer's current local theme preference.

## Offline Expectations

Local editing, local document reopening, local import, Markdown/HTML export, and rendering of bundled assets should work after the PWA has been installed and cached.

Google sign-in, Firestore publishing/updating, and loading uncached shared links require network access.
