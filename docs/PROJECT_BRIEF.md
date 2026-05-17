# Project Brief

## Goal
Build a fast local-first markdown editor and preview app with advanced rendering support, offline capability, and authenticated public-link sharing.

## Primary User
Developers, technical writers, and students who need accurate markdown preview and local persistence without cloud dependency.

## MVP Success Criteria
- User can create, edit, save, reopen, import, and export local markdown documents.
- User can switch between desktop edit/split/preview modes and mobile write/preview/outline/files tabs.
- User can preview secure markdown with GFM, math, code highlighting, and Mermaid diagrams.
- User can sign in with Google, publish a share link, update an existing link, and sign out through an account menu with inline confirmation.
- Public `/share/:id` pages load Firestore-backed documents in read-only mode.
- Owners can edit the original shared document; other signed-in users can make an editable local copy.
- Project has canonical domain models and architecture docs.
- Product behavior is captured in `docs/USER_FLOWS.md`.
- AI and human contributors can onboard by reading repository docs.

## Boundaries
Markdown Studio remains CSR and local-first. Firestore is used for explicit share publishing only, not as the canonical editor document store.

Out of scope: SSR/SEO, real-time collaboration, server-side version history, ownership transfer, and native DOCX export.
