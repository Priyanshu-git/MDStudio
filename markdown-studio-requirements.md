# Markdown Studio - Requirements Document

## Overview

Markdown Studio is a local-first markdown editor and viewer web application with advanced markdown rendering support, offline capabilities, and future backend-based sharing support.

The application is designed as a pure CSR (Client Side Rendered) React application with no SSR requirements.

---

# Goals

## Primary Goals

- Rich markdown editing experience
- Accurate markdown rendering
- Support advanced markdown extensions
- Offline-first architecture
- Public shareable links (Phase 2)
- Multiple themes
- High performance
- Simple architecture
- Fully free/open-source technology stack

---

# Non Goals

The following are explicitly out of scope for the MVP:

- SSR
- SEO optimization
- Real-time collaboration
- Authentication/accounts
- Private documents
- HTML embedding/rendering
- MDX support
- Export to PDF/DOCX
- Backend rendering
- Search/indexing
- Version history
- Analytics
- AI features

---

# Technology Stack

## Frontend

- React
- Vite
- TypeScript
- TailwindCSS

## Editor

- CodeMirror 6

## Markdown Rendering

- react-markdown
- remark
- rehype

## Markdown Plugins

- remark-gfm
- remark-math
- rehype-katex

## Code Highlighting

- Shiki

## Math Rendering

- KaTeX

## Diagram Rendering

- Mermaid.js

## State Management

- Zustand

## Local Persistence

- IndexedDB
- Dexie.js

## PWA

- vite-plugin-pwa

---

# Rendering Features

## Core Markdown Support

The application must support:

- Headings
- Paragraphs
- Bold/italic
- Ordered lists
- Unordered lists
- Nested lists
- Task lists
- Tables
- Blockquotes
- Horizontal rules
- Inline code
- Fenced code blocks
- Links
- Images via URL
- Footnotes (optional future enhancement)

## Code Blocks

The application must support:

- Syntax highlighting
- Multiple programming languages
- Line numbers
- Copy button
- Dark/light syntax themes

The application does NOT need:

- Executable code blocks
- Sandboxed runtimes
- Terminal emulation
- Diff views
- File tabs

## Math Rendering

The application must support:

- Inline math
- Block math
- LaTeX syntax

Examples:

Inline:
$E = mc^2$

Block:
$$
\int_0^1 x^2 dx
$$

Math rendering will use KaTeX.

## Mermaid Support

The application must support:

- Flowcharts
- Sequence diagrams
- Gantt charts
- ER diagrams
- State diagrams
- Pie charts
- Mindmaps
- All Mermaid-supported diagrams

Requirements:

- Auto rendering
- Theme synchronization
- SVG export
- PNG export
- Lazy rendering
- Re-render on theme change

---

# Security Requirements

## HTML Rendering

Raw HTML rendering must be disabled.

The application must NOT support:

- iframe
- script
- embedded HTML
- inline JS

## User Content

Users may paste arbitrary markdown content.

The application should sanitize:

- URLs
- Mermaid rendering input

---

# Architecture

## Rendering Architecture

Markdown rendering pipeline:

Markdown
→ remark-parse
→ remark-gfm
→ remark-math
→ custom plugins
→ remark-rehype
→ rehype-katex
→ React components

## Mermaid Architecture

Mermaid must NOT render during markdown parsing.

Instead:

- Detect mermaid fenced code blocks
- Replace with custom React component
- Render Mermaid lazily

Example:

```md
```mermaid
graph TD
A --> B
```
```

Becomes:

```tsx
<MermaidBlock code={code} />
```

## Code Block Architecture

Code blocks must use a custom renderer component.

Example:

```tsx
<CodeBlock
  language=""
  code=""
  showLineNumbers
  showCopyButton
/>
```

Responsibilities:

- Syntax highlighting
- Copy functionality
- Line numbers
- Theme synchronization

---

# Editor Requirements

## Layout

Desktop:
- Split screen editor + preview

Mobile:
- Tabbed edit/preview interface

## Editor Features

Required:

- Markdown editing
- Syntax highlighting
- Autosave
- Theme support

Not required:

- Vim mode
- Collaborative editing
- AI autocomplete
- Multi-cursor editing

---

# Persistence Requirements

## Local Persistence

The application must store data locally using IndexedDB.

Storage should include:

- Documents
- Drafts
- Theme preferences
- Current document state

## Autosave

Requirements:

- Debounced autosave
- Save interval: 500ms–1000ms
- Save cursor position
- Save scroll position

## Document Model

```ts
type Document = {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  theme?: string
}
```

Document IDs should use:

- nanoid
or
- UUID

---

# Theme System

## Theme Scope

Themes are application-wide.

## Theme Areas

Themes must support:

- UI theme
- Markdown theme
- Code syntax theme
- Mermaid theme

## Initial Themes

Required:

- GitHub Light
- Dracula
- Lavender Fields
- Blue Eclipse
- Lush Forest
- Ink Wash
- Cherry Blossom

---

# Offline Support

The application must support offline usage.

Requirements:

- PWA installability
- Service worker caching
- Offline document access
- Offline editing

---

# Routing

## Routes

Home:
`/`

Editor:
`/editor`

Local document:
`/doc/:id`

Future shared document:
`/share/:id`

---

# Sharing System (Phase 2)

## Requirements

- Backend-based sharing
- Public documents only
- Editable clone workflow
- No authentication

## Architecture

Backend stores:
- Raw markdown only

Frontend handles:
- Markdown rendering
- Mermaid rendering
- Syntax highlighting

## Sharing Flow

1. User creates document
2. User clicks Share
3. Frontend uploads raw markdown
4. Backend returns share ID
5. Shareable URL generated

---

# Performance Requirements

## General

The application should prioritize:

- Fast initial load
- Responsive editing
- Smooth scrolling
- Minimal rerenders

## Optimization Targets

Recommended optimizations:

- Lazy Mermaid rendering
- Memoized markdown transforms
- Lazy syntax language loading
- Debounced parsing

---

# Deployment

## Frontend Deployment

Recommended platforms:

- Vercel
- Cloudflare Pages

## Backend Deployment (Future)

Recommended:

- Simple serverless architecture
- Raw markdown storage only

---

# Recommended Folder Structure

```txt
src/
  editor/
  preview/
  renderers/
  markdown/
  mermaid/
  themes/
  storage/
  state/
  hooks/
  components/
```

---

# MVP Scope

## MVP Must Include

### Rendering

- Markdown rendering
- GFM support
- KaTeX support
- Mermaid support
- Syntax highlighting

### Editor

- Markdown editing
- Split preview
- Autosave

### UX

- Dark/light themes
- Copy code button
- Line numbers

### Persistence

- IndexedDB storage
- Offline support

## MVP Excludes

- Backend
- Sharing
- Accounts
- Export
- Collaboration

---

# Recommended Development Order

## Phase 1

- Vite setup
- React setup
- Tailwind setup

## Phase 2

- Markdown rendering pipeline
- GFM support
- KaTeX support

## Phase 3

- Custom code block renderer
- Shiki integration

## Phase 4

- Mermaid renderer

## Phase 5

- CodeMirror editor

## Phase 6

- Local persistence

## Phase 7

- Theme system

## Phase 8

- PWA support

## Phase 9

- Share backend

---

# Risks

## Mermaid Rendering Complexity

Potential issues:

- Large diagrams
- Rerender lifecycle
- Theme synchronization
- SVG cleanup

## Bundle Size

Potential issues:

- Shiki language payloads
- Mermaid bundle size

Mitigation:

- Lazy loading
- Dynamic imports

---

# Final Recommended Stack

- React
- Vite
- TypeScript
- TailwindCSS
- CodeMirror 6
- react-markdown
- remark
- rehype
- KaTeX
- Mermaid.js
- Shiki
- Zustand
- Dexie.js
- vite-plugin-pwa

