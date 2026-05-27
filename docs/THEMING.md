# Theming

## Theme Scope

Application-wide theme with coordinated behavior across:

- UI shell
- Markdown preview
- Syntax highlighting blocks
- Mermaid diagrams

## Required Theme Set

- Light:
  - `github-light` (GitHub Light)
  - `pastel-mint` (Lavender Frost)
  - `minimal-ivory` (Minimal Ivory)
- Dark:
  - `github-dark` (GitHub Dark)
  - `one-dark` (One Dark)
  - `blue-eclipse` (Blue Eclipse)

## Rules

- Theme changes must propagate consistently to all surfaces.
- New themes must include explicit mappings for all four theme areas.
- Theme preference is stored locally in IndexedDB app state.
- Shared documents do not persist theme; `/share/:id` renders with the viewer's current local theme preference.
- `/editor` uses a custom grouped theme menu. `/share/:id` uses a native select with disabled group labels.
