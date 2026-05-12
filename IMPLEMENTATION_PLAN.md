# Markdown Studio: Complete Implementation Plan

## 1. Summary

Markdown Studio is a local-first, CSR-only markdown editor focused on accurate rendering, offline resilience, and a phased architecture that keeps implementation safe and predictable for both human and AI contributors.

This plan is decision-complete and includes:
- implemented foundation and core product work (Phases 0-5),
- completed implementation phases (6-7),
- interfaces/contracts,
- test strategy,
- guardrail-driven execution rules.

---

## 2. Product Goals and Boundaries

### Goals
- Rich markdown editing workflow
- Accurate and secure markdown rendering
- Advanced markdown support (GFM, math, mermaid, syntax highlighting)
- Local-first persistence
- Offline-first behavior
- Clear, AI-friendly codebase and documentation

### Non-goals (MVP)
- SSR/SEO
- Auth/accounts
- Real-time collaboration
- Export flows (PDF/DOCX)
- Private documents
- Backend sharing implementation (reserved for later phase)

---

## 3. Current Delivery Status

### Phase 0 (Completed)
- Project scaffold (`Vite + React + TypeScript`)
- Baseline tooling (`ESLint`, `Prettier`, `Vitest`, RTL)
- Route skeleton established
- Core folder structure created
- Canonical domain types module established
- Full AI-friendly docs baseline added (including `GUARDRAILS.md`)

### Phase 1 (Completed)
- Reusable app shell layout component
- Responsive editor shell:
  - desktop split view,
  - mobile tabbed edit/preview flow
- Route-aware app state wiring (`activeDocId`, tab state, draft state)

### Phase 2 (Completed)
- Secure markdown rendering pipeline:
  - `react-markdown`
  - `remark-gfm`
  - `remark-math`
  - `rehype-katex`
- URL sanitation for rendered markdown links/images
- New **Documentation View** mode:
  - top-bar toggle button
  - hides editing surfaces
  - full-page read-only rendered markdown page
- Docs and roadmap updated to include this behavior

### Phase 3 (Completed)
- Custom fenced renderer integration in markdown preview:
  - `CodeBlock` for syntax-highlighted code using Shiki
  - `MermaidBlock` for Mermaid fenced diagrams
- Mermaid diagram export actions added:
  - SVG export
  - PNG export
- Rendering fallback behavior added for malformed diagram/code cases

### Phase 4 (Completed)
- Dexie persistence layer added:
  - `documents` table
  - `appState` table
- Document storage services implemented for create/read/update and active document tracking
- Editor hydration flow implemented:
  - load existing active/local recent doc
  - create initial doc when none exists
- Debounced autosave implemented at 700ms
- Route-level document loading wired for `/doc/:id`
- Note: cursor and scroll persistence are deferred to a follow-up in Phase 5 hardening.

### Phase 5 (Completed)
- Theme system implemented with seven themes:
  - `github-light`
  - `dracula`
  - `lavender-fields`
  - `blue-eclipse`
  - `lush-forest`
  - `ink-wash`
  - `cherry-blossom`
- Theme selection control added to editor topbar.
- Theme preference persistence added via app state storage.
- Theme application now affects:
  - app shell
  - markdown documentation surface
  - Shiki code highlighting theme
  - Mermaid diagram theme

---

## 4. Phase-by-Phase Implementation Plan

## Phase 3: Advanced Renderers (Code + Mermaid) - Completed

### Objectives
- Replace generic fenced block rendering with dedicated renderers.
- Add robust code presentation and isolated Mermaid rendering path.

### Tasks
1. Implement `CodeBlock` renderer in `src/renderers/CodeBlock.tsx`:
   - language extraction from fenced block
   - Shiki highlighting
   - copy button
   - optional line numbers
2. Implement `MermaidBlock` renderer in `src/mermaid/MermaidBlock.tsx`:
   - detect mermaid fenced blocks via markdown component override
   - lazy initialize Mermaid
   - render failure fallback UI
   - rerender on theme changes
3. Integrate both via `ReactMarkdown` component mapping in preview layer.
4. Add lightweight export actions for Mermaid output (SVG/PNG) from rendered block.

### Acceptance Criteria Status
- Fenced non-mermaid code blocks render through `CodeBlock`.
- Mermaid fences render through `MermaidBlock` only.
- Rendering failures do not crash preview.
- Mermaid export actions (SVG/PNG) are available from rendered diagrams.

---

## Phase 4: Persistence and Autosave - Completed

### Objectives
- Persist documents and app state locally with deterministic restore behavior.

### Tasks
1. Add Dexie schema in `src/storage`:
   - `documents`
   - `appState`
2. Define storage services:
   - create/load/update document
   - persist active document/session metadata
3. Add debounced autosave (700ms default; within required 500-1000ms).
4. Persist and restore:
   - markdown content
   - active doc id
   - cursor and scroll metadata

### Acceptance Criteria Status
- Reload restores latest draft.
- Active doc context survives refresh.
- Autosave is debounced and stable.
- Cursor/scroll state persistence pending follow-up.

---

## Phase 5: Theme System - Completed

### Objectives
- End-to-end theme consistency across all rendering surfaces.

### Tasks
1. Implement theme model:
   - `github-light`
   - `dracula`
   - `nord`
2. Add global theme switch mechanism.
3. Apply theme mapping to:
   - app shell
   - markdown surface
   - code highlighting
   - mermaid diagrams
4. Persist app theme preference in local state store (and Dexie once persistence layer is active).

### Acceptance Criteria Status
- Theme switch updates all surfaces without stale segments.
- Theme choice persists across reload.

---

## Phase 6: PWA and Offline Hardening - Completed

### Objectives
- Deliver installable offline-capable MVP.

### Tasks
1. Enable and configure `vite-plugin-pwa` in production config.
2. Add app manifest and caching strategy.
3. Validate runtime behavior:
   - app shell available offline
   - local docs still editable offline
4. Document known offline limitations.

### Acceptance Criteria Status
- App is installable as PWA.
- Offline open/edit/save flow works with IndexedDB data.
- Offline documentation added (`docs/OFFLINE.md`).

---

## Phase 7: Quality, Performance, and Release Hardening - Completed

### Objectives
- Ship release-ready MVP with measurable confidence.

### Tasks
1. Expand tests:
   - renderer behavior
   - persistence flows
   - docs mode regressions
2. Add E2E coverage for key journeys.
3. Performance pass:
   - lazy load heavy modules (Shiki, Mermaid)
   - reduce unnecessary rerenders (memoization, `useDeferredValue`)
   - monitor bundle size thresholds
4. Final docs sync:
   - architecture
   - decisions
   - roadmap
   - known constraints

### Acceptance Criteria Status
- CI checks green (lint/typecheck/test/build).
- Critical user journeys verified (see `src/test/UserJourneys.test.tsx`).
- Performance optimizations applied (ADR-006).
- Docs and behavior fully aligned.

---

## 5. Interfaces and Contracts

## Domain Types

```ts
type ThemeName =
  | 'github-light'
  | 'dracula'
  | 'lavender-fields'
  | 'blue-eclipse'
  | 'lush-forest'
  | 'ink-wash'
  | 'cherry-blossom'

type Document = {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  theme?: ThemeName
}
```

## Editor State Contracts
- `mobileTab: 'edit' | 'preview'`
- `editorMode: 'edit' | 'docs'`
- `activeDocId: string | null`
- `draftMarkdown: string`

## Routing Contract
- `/` -> redirects to `/editor`
- `/editor` -> editor shell + documentation view toggle
- `/doc/:id` -> local document context route
- `/share/:id` -> reserved placeholder for future backend sharing

---

## 6. Testing Plan

## Baseline Checks (every phase)
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

## Coverage Focus by Phase
- Phase 3: code/mermaid renderer correctness and failure handling
- Phase 4: autosave debounce and persistence restore integrity
- Phase 5: theme propagation across all render surfaces
- Phase 6: offline/PWA behavior
- Phase 7: full regression and performance-focused checks

## High-Risk Regression Areas
- Documentation View must remain read-only and hide edit surfaces.
- HTML execution must remain blocked.
- Route behavior must remain deterministic.

---

## 7. AI-Friendly Delivery Rules

1. Read order before code changes:
   - `README.md`
   - `docs/GUARDRAILS.md`
   - `docs/DOMAIN_MODEL.md`
   - `docs/ARCHITECTURE.md`
2. Any behavior change must update corresponding docs in same change.
3. No scope expansion into non-goals without ADR + roadmap update.
4. Canonical types in `src/types/domain.ts` must remain single source of truth.

---

## 8. Assumptions and Defaults

- Package manager: `npm`
- CSR architecture remains fixed for MVP
- IndexedDB remains persistence source of truth
- Sharing route remains placeholder in MVP
- Documentation View is part of core editor experience (Phase 2 onward)
