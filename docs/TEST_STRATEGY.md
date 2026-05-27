# Test Strategy

## Layers

- Unit: rendering helpers, sanitizers, store reducers.
- Integration: editor + preview route behavior, persistence interactions, auth/sharing flows, and account menu behavior.
- E2E: desktop/mobile routing, sharing, and offline behavior.

## Phase 0 Required Checks

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run dev` boots without route errors.

## Environment Notes

- Vitest runs in `jsdom` with `src/test/setup.ts`.
- Vite config redirects temp output to `node_modules/.vite-temp` through `TMPDIR`, `TMP`, and `TEMP`.
- Set `DISABLE_PWA=true` when a test or local build needs to avoid service worker generation.

## Regression Priorities

- Route contract (`/`, `/editor`, `/doc/:id`, `/share/:id`).
- User flows documented in `docs/USER_FLOWS.md`.
- Desktop view modes and mobile tabs.
- Desktop sidebar document/outline switching.
- Grouped theme picker behavior, including Escape/outside-click close and valid `ThemeName` values.
- Account menu open/close behavior, inline sign-out confirmation, and mobile account access.
- Mobile/editor and shared-page appbar hide/show behavior.
- Toolbar insertion behavior, including undo/redo, link/image dialogs, and queued mobile insert actions.
- Google sign-in gating for share publishing and make-copy behavior.
- Existing share links continuing to hide create/update actions in the editor dialog.
- Owner-only edit-original behavior on shared documents.
- Non-owner make-copy documents remaining local sourced.
- Shared-page desktop actions and mobile compact menu behavior.
- Domain type consistency from single canonical module.
- Security defaults for markdown rendering.
- Local persistence, source metadata, share snapshots, and save status transitions.
- Mermaid SVG/PNG actions and Shiki fallback behavior.
