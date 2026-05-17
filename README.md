# Markdown Studio

Markdown Studio is a local-first markdown editor and preview web app with authenticated link sharing.

## Quick Start

```bash
npm install
npm run dev
```

Open the app at the local Vite URL (default `http://localhost:5173`).

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run Vitest in CI mode
- `npm run test:watch` - run Vitest watch mode
- `npm run format` - check formatting with Prettier
- `npm run format:write` - apply formatting with Prettier

## What Works Today

- Local document editing with dirty-state tracking, manual save, recent documents, and IndexedDB persistence.
- Desktop edit, split, and preview modes.
- Mobile write, preview, outline, and files tabs.
- Markdown preview with GFM, math, Mermaid, and syntax-highlighted code blocks.
- Theme persistence for `github-light`, `github-dark`, and `dracula`.
- `.md` import plus Markdown, HTML, and browser print/PDF export.
- Google sign-in for sharing, an account menu, and inline sign-out confirmation.
- Public `/share/:id` read-only pages with owner-only `Edit Original` and non-owner `Make a Copy`.

## Offline & PWA

Markdown Studio is a Progressive Web App (PWA) that works offline. It uses a service worker to cache assets and IndexedDB for local document storage.

For more details, see [Offline Support](docs/OFFLINE.md).

## Firestore Sharing

Firestore powers manual sharing via `/share/:id` while the editor remains local-first with IndexedDB. Creating and updating share links requires Google sign-in; reading a shared link is public by ID.

See [Firebase Firestore Setup](docs/FIREBASE.md) for environment setup, collection shape, and security rules.

## Scope Boundaries

In scope:
- CSR React app
- Local markdown editing shell with CodeMirror
- Local persistence with Dexie/IndexedDB
- Theming architecture
- Offline/PWA architecture
- Authenticated sharing workflow
- Read-only shared document view
- Local import/export flows

Out of scope:
- SSR/SEO
- Collaboration
- Real-time multi-user editing
- Server-side ownership transfer
- Native DOCX export

## Architecture Map

- App shell + routing: [/src/App.tsx](D:/Code/MD%20Studio/src/App.tsx)
- Editor route shell: [/src/editor/EditorShellPage.tsx](D:/Code/MD%20Studio/src/editor/EditorShellPage.tsx)
- Shared domain types: [/src/types/domain.ts](D:/Code/MD%20Studio/src/types/domain.ts)
- App state: [/src/state/useAppStore.ts](D:/Code/MD%20Studio/src/state/useAppStore.ts)
- Local storage services: [/src/storage/documents.ts](D:/Code/MD%20Studio/src/storage/documents.ts)
- Share storage services: [/src/storage/shareDocuments.ts](D:/Code/MD%20Studio/src/storage/shareDocuments.ts)
- Firebase auth helpers: [/src/firebase/auth.ts](D:/Code/MD%20Studio/src/firebase/auth.ts)

## Documentation Index

- [Project Brief](D:/Code/MD%20Studio/docs/PROJECT_BRIEF.md)
- [Architecture](D:/Code/MD%20Studio/docs/ARCHITECTURE.md)
- [User Flows](D:/Code/MD%20Studio/docs/USER_FLOWS.md)
- [Domain Model](D:/Code/MD%20Studio/docs/DOMAIN_MODEL.md)
- [Rendering Rules](D:/Code/MD%20Studio/docs/RENDERING_RULES.md)
- [Theming](D:/Code/MD%20Studio/docs/THEMING.md)
- [Test Strategy](D:/Code/MD%20Studio/docs/TEST_STRATEGY.md)
- [AI Contributing](D:/Code/MD%20Studio/docs/AI_CONTRIBUTING.md)
- [Guardrails](D:/Code/MD%20Studio/docs/GUARDRAILS.md)
- [Decisions (ADRs)](D:/Code/MD%20Studio/docs/DECISIONS.md)
- [Roadmap](D:/Code/MD%20Studio/docs/ROADMAP.md)
