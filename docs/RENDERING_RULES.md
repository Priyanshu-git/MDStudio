# Rendering Rules

## Supported
- Core markdown
- GFM (`remark-gfm`)
- Math (`remark-math` + `rehype-katex`)
- Custom fenced renderer path for `code` and `mermaid`
- Read-only preview surfaces in `/editor` and `/share/:id`
- Source-line metadata for preview scrolling from outline selections

## Forbidden
- Raw HTML rendering
- `script`, `iframe`, inline JavaScript execution
- Arbitrary HTML embedding in markdown

## Security Defaults
- `react-markdown` configured with HTML disabled.
- Links and image URLs must pass scheme validation.
- Mermaid input treated as user content and rendered in constrained component flow.
- Shared documents reuse the same markdown pipeline and stay read-only.
