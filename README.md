# Markdown Studio

Markdown Studio is a local-first markdown editor and preview web app.

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

## Scope Boundaries (MVP)

In scope:
- CSR React app
- Local markdown editing shell
- Local persistence architecture
- Theming architecture
- Offline/PWA architecture
- Read-only Documentation View mode from editor

Out of scope for MVP:
- SSR/SEO
- Auth/accounts
- Collaboration
- Backend sharing implementation
- Export flows (PDF/DOCX)

## Architecture Map

- App shell + routing: [/src/App.tsx](D:/Code/MD%20Studio/src/App.tsx)
- Editor route shell: [/src/editor/EditorShellPage.tsx](D:/Code/MD%20Studio/src/editor/EditorShellPage.tsx)
- Shared domain types: [/src/types/domain.ts](D:/Code/MD%20Studio/src/types/domain.ts)
- App store skeleton: [/src/state/useAppStore.ts](D:/Code/MD%20Studio/src/state/useAppStore.ts)

## Documentation Index

- [Project Brief](D:/Code/MD%20Studio/docs/PROJECT_BRIEF.md)
- [Architecture](D:/Code/MD%20Studio/docs/ARCHITECTURE.md)
- [Domain Model](D:/Code/MD%20Studio/docs/DOMAIN_MODEL.md)
- [Rendering Rules](D:/Code/MD%20Studio/docs/RENDERING_RULES.md)
- [Theming](D:/Code/MD%20Studio/docs/THEMING.md)
- [Test Strategy](D:/Code/MD%20Studio/docs/TEST_STRATEGY.md)
- [AI Contributing](D:/Code/MD%20Studio/docs/AI_CONTRIBUTING.md)
- [Guardrails](D:/Code/MD%20Studio/docs/GUARDRAILS.md)
- [Decisions (ADRs)](D:/Code/MD%20Studio/docs/DECISIONS.md)
- [Roadmap](D:/Code/MD%20Studio/docs/ROADMAP.md)
