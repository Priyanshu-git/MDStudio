# Guardrails

## Hard Guardrails (Must Never Be Violated)

1. **MVP Scope Lock**
   - Do not implement auth, collaboration, SSR, export, or backend sharing in MVP.

2. **Rendering Security**
   - Raw HTML rendering stays disabled.
   - No support for `script`, `iframe`, inline JS, or arbitrary embedded HTML.

3. **Architecture Boundary**
   - Mermaid rendering must happen in a dedicated React renderer path, not inside markdown parse transforms.
   - Fenced code blocks must route through custom code renderer components.

4. **Data Source of Truth**
   - IndexedDB is the canonical document store for MVP.
   - No alternate persistent source may become authoritative without ADR + docs update.

5. **Change Protocol**
   - Behavior-changing code requires tests and relevant docs updates in the same change set.

## Soft Guardrails (Preferred Defaults)

1. **Performance Defaults**
   - Prefer lazy loading for heavy dependencies (Mermaid, Shiki).
   - Avoid unnecessary full preview rerenders.

2. **State Discipline**
   - Keep cross-feature state in stores; keep local UI-only state near components.

3. **Type Discipline**
   - Reuse canonical domain types from `src/types/domain.ts`.

## Override Process

If a soft guardrail must be overridden:
1. Document rationale in PR.
2. Add follow-up ADR note in `docs/DECISIONS.md`.
3. Include targeted test coverage to protect against regression.
