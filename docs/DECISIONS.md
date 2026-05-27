# Decisions (ADRs)

## ADR-001: CSR-Only Architecture

- **Status:** Accepted
- **Decision:** Build Markdown Studio as a pure CSR React app.
- **Rationale:** MVP requires no SSR/SEO and benefits from simpler local-first runtime.

## ADR-002: Local-First Persistence via IndexedDB

- **Status:** Accepted
- **Decision:** Use IndexedDB through Dexie as canonical local persistence.
- **Rationale:** Offline-first requirements and no backend dependency for MVP.

## ADR-003: Secure Markdown Defaults

- **Status:** Accepted
- **Decision:** Disable raw HTML rendering and block executable/embedded HTML surfaces.
- **Rationale:** User content can be arbitrary markdown; default-safe rendering is mandatory.

## ADR-004: Phased Delivery Model

- **Status:** Accepted
- **Decision:** Deliver in explicit phases (foundation -> shell -> rendering -> persistence -> theming -> PWA -> hardening).
- **Rationale:** Reduces risk and keeps architecture clear for human and AI contributors.

## ADR-005: Read-Only Preview Surfaces

- **Status:** Accepted
- **Decision:** `/editor` provides preview-only surfaces through desktop preview mode and mobile preview tab, while `/share/:id` provides public read-only rendering.
- **Rationale:** Improves reading flow for long-form markdown and separates authoring from consumption without adding a separate documentation mode.

## ADR-006: Performance and Bundle Optimization

- **Status:** Accepted
- **Decision:** Use dynamic imports for heavy libraries (Mermaid, Shiki), memoize core rendering surfaces, and utilize `useDeferredValue` for markdown preview updates.
- **Rationale:** Ensures small initial bundle size, maintains editor responsiveness during heavy rendering tasks, and avoids unnecessary re-renders in complex layouts.

## ADR-007: Authenticated Share Publishing

- **Status:** Accepted
- **Decision:** Keep editor documents local-first while using Firebase Auth and Firestore for explicit public-link publishing.
- **Rationale:** Sharing requires stable ownership and update rules, but normal editing should remain available without a cloud dependency.

## ADR-008: Account Menu Sign-Out Confirmation

- **Status:** Accepted
- **Decision:** Signed-in users open an account menu from the avatar; sign-out requires inline confirmation and resets on Escape, outside click, or auth loss.
- **Rationale:** Prevents accidental sign-out while keeping account controls available on both desktop and mobile.
