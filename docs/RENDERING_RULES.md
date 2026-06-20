# Rendering Rules

## Supported

- Core markdown
- GFM (`remark-gfm`)
- Math (`remark-math` + `rehype-katex`)
- Custom fenced renderer path for `code` and `mermaid`
- Read-only preview surfaces in `/editor` and `/share/:id`
- Source-line metadata for preview scrolling from outline selections
- Code block language labels, line-number gutter, and copy action
- Mermaid SVG and PNG downloads
- Lazy loading for Shiki and Mermaid

## Forbidden

- Raw HTML rendering
- `script`, `iframe`, inline JavaScript execution
- Arbitrary HTML embedding in markdown
- Unsafe link or image URL schemes

## Security Defaults

- `react-markdown` configured with HTML disabled.
- Links and image URLs must pass scheme validation. Allowed schemes are `http:`, `https:`, `mailto:`, root-relative paths, and hash anchors.
- Mermaid input is treated as user content, rendered in a dedicated component, and initialized with `securityLevel: 'strict'`.
- Shared documents reuse the same markdown pipeline and stay read-only.
- Shiki output is injected only from the highlighter result; fallback code markup is escaped before insertion.

## Theme Mapping

- `github-dark` maps Shiki to `github-dark-default`.
- `one-dark` and `blue-eclipse` map Shiki to `one-dark-pro`.
- Light themes map Shiki to `github-light`.
- Mermaid uses `dark` for `github-dark`, `one-dark`, and `blue-eclipse`; other themes use `default`.
