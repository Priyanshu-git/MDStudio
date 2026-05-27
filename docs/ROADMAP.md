# Roadmap

## Phase 0 (Completed)

Foundation scaffold and AI-friendly documentation baseline.

## Phase 1 (Completed)

Route-ready app shell and responsive editor/preview layout.

## Phase 2 (Completed)

Secure markdown pipeline with GFM and math, including read-only preview surfaces.

## Phase 3 (Completed)

Custom code block renderer and Mermaid block renderer.

## Phase 4 (Completed)

IndexedDB persistence, active document hydration, manual save, and dirty-state tracking.

## Phase 5 (Completed)

Theme integration across UI, markdown, code, and Mermaid.

## Phase 6 (Completed)

PWA and offline hardening.

## Phase 7 (Completed)

Quality, performance, and release hardening.

## Phase 8 (Completed)

Authenticated sharing: Google sign-in, Firestore `sharedDocuments`, public `/share/:id`, local Firebase source metadata, owner edit-original flow, and non-owner make-copy flow.

## Phase 9 (Completed)

Account menu polish: desktop/mobile avatar access, identity display, inline sign-out confirmation, Escape/outside-click reset, and regression coverage.

## Phase 10 (Completed)

User-flow documentation covering local editing, desktop/mobile authoring, import/export, account access, sharing, shared-link viewing, theming, and offline expectations.

## Phase 11 (Completed)

Grouped theme selection and local/Firebase document source indicators for recent documents.

## Phase 12 (Completed)

Authoring and shared-page polish: link/image insertion dialogs, undo/redo toolbar actions, desktop documents/outline sidebar switching, mobile insert queueing, mobile/shared appbar auto-hide, shared-page mobile action menu, Mermaid SVG/PNG export, and button ripple feedback.

## Future Extension Points

- Stronger Firestore schema/rate-limit hardening.
- Exposed owner update action for existing share links.
- Share expiry or unpublish controls.
- Version history.
- Collaboration.
- Native DOCX/PDF export beyond browser print.
