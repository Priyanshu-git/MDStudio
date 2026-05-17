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
- Grouped theme picker behavior, including Escape/outside-click close and valid `ThemeName` values.
- Account menu open/close behavior, inline sign-out confirmation, and mobile account access.
- Google sign-in gating for share publishing and make-copy behavior.
- Owner-only edit-original behavior on shared documents.
- Domain type consistency from single canonical module.
- Security defaults for markdown rendering.
- Local persistence, source metadata, share snapshots, and save status transitions.
