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

## Regression Priorities
- Route contract (`/`, `/editor`, `/doc/:id`, `/share/:id`).
- User flows documented in `docs/USER_FLOWS.md`.
- Desktop view modes and mobile tabs.
- Account menu open/close behavior, inline sign-out confirmation, and mobile account access.
- Google sign-in gating for share publishing and make-copy behavior.
- Owner-only edit-original behavior on shared documents.
- Domain type consistency from single canonical module.
- Security defaults for markdown rendering.
- Local persistence, share snapshots, and save status transitions.
