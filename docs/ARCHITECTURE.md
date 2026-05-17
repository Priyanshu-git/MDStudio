# Architecture

## Runtime Model
- Pure client-side rendered (CSR) React app.
- No SSR pipeline.
- Route-driven app shell with placeholder feature surfaces for phased delivery.

## Route Contract
- `/` redirects to `/editor`
- `/editor` editor and preview shell with desktop mode toggle:
  - `edit`: editor-only desktop surface
  - `split`: editor and preview desktop surface
  - `preview`: preview-only desktop surface
- `/doc/:id` local document route scaffold
- `/share/:id` Phase 2 placeholder

## Core Modules
- `src/editor`: editor shell and future CodeMirror integration
- `src/preview`: markdown preview surface
- `src/renderers`: code and mermaid block renderers
- `src/storage`: Dexie and persistence services
- `src/state`: Zustand stores and app-level state contracts
- `src/types`: canonical shared domain types

## Planned Data Flow
CodeMirror input -> app store -> debounced persistence -> markdown pipeline -> preview renderers.

## UI Mode State
- `desktopViewMode: 'edit' | 'split' | 'preview'` is owned by app state.
- `mobileTab: 'write' | 'preview' | 'outline' | 'files'` is owned by app state.
