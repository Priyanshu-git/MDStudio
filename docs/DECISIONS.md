# Decisions (ADRs)

## ADR-001: CSR-Only Architecture
- **Status:** Accepted
- **Decision:** Build Markdown Studio as a pure CSR React app.
- **Rationale:** MVP requires no SSR/SEO and benefits from simpler local-first runtime.

## ADR-002: Local-First Persistence via IndexedDB
- **Status:** Accepted
- **Decision:** Use IndexedDB (Dexie wrapper planned) as canonical local persistence.
- **Rationale:** Offline-first requirements and no backend dependency for MVP.

## ADR-003: Secure Markdown Defaults
- **Status:** Accepted
- **Decision:** Disable raw HTML rendering and block executable/embedded HTML surfaces.
- **Rationale:** User content can be arbitrary markdown; default-safe rendering is mandatory.

## ADR-004: Phased Delivery Model
- **Status:** Accepted
- **Decision:** Deliver in explicit phases (foundation -> shell -> rendering -> persistence -> theming -> PWA -> hardening).
- **Rationale:** Reduces risk and keeps architecture clear for human and AI contributors.

## ADR-005: Documentation View Mode
- **Status:** Accepted
- **Decision:** `/editor` provides an explicit read-only Documentation View toggle that hides edit controls and shows a full-page rendered markdown document.
- **Rationale:** Improves reading flow for long-form markdown and separates authoring from consumption.
