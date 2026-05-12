# Domain Model

Canonical source: `src/types/domain.ts`.

## Document

```ts
type Document = {
  id: string
  markdown: string
  createdAt: number
  updatedAt: number
  theme?: ThemeName
}
```

## ThemeName

```ts
type ThemeName =
  | 'github-light'
  | 'dracula'
  | 'lavender-fields'
  | 'blue-eclipse'
  | 'lush-forest'
  | 'ink-wash'
  | 'cherry-blossom'
```

## Invariants
- `id` is unique across local documents.
- `updatedAt >= createdAt`.
- `theme` is optional at document level and may fall back to app-level theme.
