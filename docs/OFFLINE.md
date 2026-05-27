# Offline Support

Markdown Studio is designed to be fully functional offline.

## How it works

- **PWA (Progressive Web App):** The application uses a service worker to cache all necessary assets (HTML, JS, CSS, fonts, and renderers) for offline use.
- **Local Persistence:** All documents and application settings are stored in **IndexedDB** using Dexie.js. This data never leaves your browser and is available even without an internet connection.
- **Build config:** `vite-plugin-pwa` is enabled by default and can be disabled with `DISABLE_PWA=true`.

## Offline Features

- **Editing:** Create, edit, save, and reopen documents.
- **Local documents:** Reopen recent documents from IndexedDB.
- **Import:** Import `.md` files into a local draft.
- **Export:** Export Markdown and HTML locally; PDF uses the browser print flow.
- **Diagram export:** Mermaid SVG/PNG export works for diagrams that render from local markdown.
- **Rendering:** Full markdown rendering including:
  - GFM (GitHub Flavored Markdown)
  - Math (KaTeX)
  - Diagrams (Mermaid)
  - Syntax Highlighting (Shiki)
- **Save state:** Unsaved changes are tracked locally and protected by a browser-leave warning.

## Limitations

- **Sign-in and sharing:** Google sign-in, Firestore publishing, the underlying owner update service, and loading uncached shared links require a network connection.
- **Share update UI:** The Firestore service and rules support owner updates, but the current share dialog does not expose an update action after a link exists.
- **Shared documents:** `/share/:id` reads Firestore and is not the canonical editable source.
- **Remote Images:** Markdown images pointing to external URLs will not be available offline unless they have been previously cached by your browser's standard cache.
- **Initial Installation:** You must visit the application once while online to allow the service worker to install and cache the assets.
- **Updates:** Application updates will be downloaded in the background when you are online and applied automatically on the next reload.

## Local Build Notes

Vite config redirects `TMPDIR`, `TMP`, and `TEMP` to `node_modules/.vite-temp` before plugin setup. This keeps build and test temp output inside the workspace dependency tree.

## Installation

You can "install" Markdown Studio to your desktop or mobile device:

1. Open Markdown Studio in your browser.
2. Look for the "Install" icon in the address bar (Chrome/Edge) or use "Add to Home Screen" (iOS/Android).
3. The app will then appear in your app drawer or desktop and open in its own window.
