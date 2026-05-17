# Theming

## Theme Scope
Application-wide theme with coordinated behavior across:
- UI shell
- Markdown preview
- Syntax highlighting blocks
- Mermaid diagrams

## Required Theme Set
- `github-light`
- `github-dark`
- `dracula`

## Rules
- Theme changes must propagate consistently to all surfaces.
- New themes must include explicit mappings for all four theme areas.
- Theme preference is stored locally in IndexedDB app state.
- Shared documents do not persist theme; `/share/:id` renders with the viewer's current local theme preference.
