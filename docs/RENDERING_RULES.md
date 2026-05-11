# Rendering Rules

## Supported in MVP Roadmap
- Core markdown
- GFM (`remark-gfm`)
- Math (`remark-math` + `rehype-katex`)
- Custom fenced renderer path for `code` and `mermaid`
- Read-only full-page Documentation View on `/editor`

## Forbidden
- Raw HTML rendering
- `script`, `iframe`, inline JavaScript execution
- Arbitrary HTML embedding in markdown

## Security Defaults
- `react-markdown` configured with HTML disabled.
- Links and image URLs must pass scheme validation.
- Mermaid input treated as user content and rendered in constrained component flow.
- Documentation View reuses the same markdown pipeline and stays read-only.
