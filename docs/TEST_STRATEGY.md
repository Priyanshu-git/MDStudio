# Test Strategy

## Layers
- Unit: rendering helpers, sanitizers, store reducers.
- Integration: editor + preview route behavior and persistence interactions.
- E2E: desktop/mobile routing and offline behavior.

## Phase 0 Required Checks
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run dev` boots without route errors.

## Regression Priorities
- Route contract (`/`, `/editor`, `/doc/:id`, `/share/:id`).
- Documentation View mode toggle and read-only behavior.
- Domain type consistency from single canonical module.
- Security defaults for markdown rendering.
