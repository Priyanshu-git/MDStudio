# User Flows

This document describes the current product behavior that should remain stable across implementation changes.

## Local Editing

1. Opening `/` redirects to `/editor`.
2. The editor hydrates the active local document from IndexedDB, or creates the seeded markdown test document if none exists.
3. Editing the title or markdown updates draft state and marks the document dirty.
4. `Save` writes the current title, markdown, and theme to IndexedDB.
5. Signed-out users see `Sign in to see your backed up documents` in Recent Documents.
6. Signed-in users see Recent Documents from a merged local/private-cloud view by content recency descending.
7. Dashboard recent-document rows show the relative content-updated time beneath the title and expose Preview, Share, and Delete actions directly on wider layouts. Phone layouts use an accessible three-dot menu for the same actions.
8. Relative updated times refresh in the UI about once per minute, so `just now` advances to `1 min ago`, `2 mins ago`, and later units without requiring a document refresh.
9. Opening a different document restores its existing share link when present, otherwise clears the active share link, and loads the local document into the editor.
10. If there are unsaved changes, opening another document, creating a new document, or importing a document asks whether to save, save locally, discard, or cancel.

## Desktop Authoring

Desktop users work in one of two app-state-owned view modes:

- `split`: editor and preview
- `preview`: preview only

The toolbar inserts markdown snippets into CodeMirror. Outline selections preserve the current view mode and scroll the visible editor or preview surface toward the selected heading.

The desktop sidebar has `Outline` and `Documents` tabs. `Outline` is selected by default. The document list shows up to six recent documents; the outline tab is generated from markdown headings.

The Documents tab exposes a delete action for each recent document. Deleting asks for confirmation, removes the local working copy, and opens a new draft if the deleted item was active.

## Mobile Authoring

Mobile users work through four tabs:

- `write`: editor and compact insert toolbar
- `preview`: read-only rendered preview
- `outline`: heading outline
- `files`: document search, new document, import, and recent documents

The mobile bottom bar provides Save, Preview, Insert, and Share actions. Insert actions are queued until the write editor is mounted, so toolbar actions still work after switching tabs.

The mobile topbar hides on downward panel scroll and reappears on upward scroll. Opening the account menu keeps the topbar visible.

## Markdown Insertion

Toolbar actions support bold, italic, H1, H2, link, image from URL, table, code block, math block, Mermaid block, checklist, bullet list, numbered list, quote, horizontal rule, undo, and redo.

Link and image actions open dialogs instead of immediately mutating markdown. The dialog preserves the selection snapshot, validates the required fields, inserts a complete markdown link or image, and cancels without changing markdown.

## Import And Export

Import accepts `.md` files only. Imported files become unsaved local drafts with the title derived from the filename.

Export supports:

- Markdown download from the current draft.
- HTML download containing escaped markdown in a basic HTML document.
- PDF through the browser print flow.

Rendered Mermaid blocks also expose SVG and PNG download actions from the diagram toolbar.

## Account Access

Signed-out users can edit locally. They see sign-in actions in the desktop topbar, mobile topbar, and share dialog.

Signed-in users see an avatar account button on desktop and mobile. Opening it shows identity details and a sign-out action. Choosing sign out shows inline confirmation. Cancel returns to the normal menu; Confirm saves unsaved work first, then signs out and clears visible Recent Documents. If saving fails, sign-out is aborted. Escape, outside pointer down, and auth loss close the menu and reset confirmation state.

## Backed Up Documents

Signed-in Recent Documents are built from local IndexedDB documents and private Firestore documents at `users/{uid}/documents/{documentId}`.

The sync layer matches local and cloud documents by `cloudDocumentId`. Cloud-only documents are hydrated into local working copies before opening. Saving backs up only the active saved document. Newer cloud-only edits update the local working copy. If both sides changed after the last sync point, the item is marked as a conflict instead of silently overwriting either version. Metadata-only sync updates and relative-time UI refreshes do not make unrelated documents appear recently edited.

Deleting a backed-up document hard-deletes the private cloud document and removes the local working copy. Public share links in `sharedDocuments` are not deleted by this action. Older private records with `deletedAt` are legacy tombstones and remain hidden from the app.

## Sharing From The Editor

Sharing requires Google sign-in.

1. The user opens the Share dialog.
2. If signed out, publishing shows a sign-in requirement.
3. When signed in, creating a link first saves the local draft, then creates a Firestore `sharedDocuments` record with title, markdown, owner metadata, timestamps, and source document ID.
4. The local document is then marked as Firebase-backed with the returned share ID and owner UID.
5. The returned share ID is stored in app state as the active share link.
6. Once a link exists, the share dialog shows the read-only link and copy action, but does not show a create or update action.
7. Copy Link writes the document title, a newline, and the active share URL to the clipboard when available.

Firestore is a published copy. The local IndexedDB document remains the canonical editable source.

## Shared Link Viewing

`/share/:id` loads a public Firestore document by ID and renders it read-only through the same markdown preview pipeline.

Shared pages show loading, not-found, and load-error states. The viewer can copy the share URL.

If the signed-in viewer owns the shared document, they see `Edit Original`. This reuses the shared `sourceDocId` when that local document exists, or creates a Firebase-sourced local document when it does not. It then loads the shared title and markdown into `/editor` and links the active share ID.

If the viewer is not the owner, they see `Make a Copy`. Signed-out users are prompted to sign in first. A copy creates a new local IndexedDB document titled `Copy of <shared title>` and opens it in `/editor`.

On desktop shared pages, theme, copy, edit-original, and make-copy actions are shown directly in the topbar. On mobile shared pages, the actions move into a compact menu. The shared topbar hides on downward window scroll and reappears on upward scroll.

## Theme Behavior

The supported themes are `github-light`, `github-dark`, `pastel-mint`, `minimal-ivory`, `one-dark`, and `blue-eclipse`.

Theme preference is stored locally. Shared documents do not persist theme, so `/share/:id` renders with the viewer's current local theme preference.

The editor uses a grouped theme menu with Light and Dark sections. Shared pages use a native theme select with disabled group labels.

## Offline Expectations

Local editing, local document reopening, local import, Markdown/HTML export, and rendering of bundled assets should work after the PWA has been installed and cached.

Google sign-in, Firestore publishing, private cloud backup/sync, and loading uncached shared links require network access.
