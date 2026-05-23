export type MarkdownInsertAction =
  | 'bold'
  | 'italic'
  | 'h1'
  | 'h2'
  | 'link'
  | 'image'
  | 'table'
  | 'code'
  | 'math'
  | 'mermaid'
  | 'checklist'
  | 'bullet-list'
  | 'numbered-list'
  | 'quote'
  | 'hr'

export type MarkdownTextChange = {
  from: number
  to: number
  insert: string
}

export type MarkdownInsertResult = {
  value: string
  changes: MarkdownTextChange
  selectionStart: number
  selectionEnd: number
}

export type MarkdownLinkInsertOptions = {
  text: string
  url: string
  image?: boolean
}

type LineTransform = 'h1' | 'h2' | 'checklist' | 'bullet-list' | 'numbered-list' | 'quote'

type LineBounds = {
  from: number
  to: number
}

function result(
  value: string,
  from: number,
  to: number,
  insert: string,
  selectionStart: number,
  selectionEnd = selectionStart,
): MarkdownInsertResult {
  return {
    value: `${value.slice(0, from)}${insert}${value.slice(to)}`,
    changes: { from, to, insert },
    selectionStart,
    selectionEnd,
  }
}

function orderedSelection(start: number, end: number) {
  return start <= end ? { start, end } : { start: end, end: start }
}

function toggleWrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): MarkdownInsertResult {
  if (start === end) {
    return result(value, start, end, `${before}${after}`, start + before.length)
  }

  const selected = value.slice(start, end)
  if (selected.startsWith(before) && selected.endsWith(after)) {
    const unwrapped = selected.slice(before.length, selected.length - after.length)
    return result(value, start, end, unwrapped, start, start + unwrapped.length)
  }

  const wrappedStart = start - before.length
  const wrappedEnd = end + after.length
  if (
    wrappedStart >= 0 &&
    value.slice(wrappedStart, start) === before &&
    value.slice(end, wrappedEnd) === after
  ) {
    return result(value, wrappedStart, wrappedEnd, selected, wrappedStart, wrappedStart + selected.length)
  }

  const insert = `${before}${selected}${after}`
  return result(value, start, end, insert, start + before.length, start + before.length + selected.length)
}

function findCurrentLink(value: string, start: number, end: number, image: boolean) {
  const linkPattern = image ? /!\[([^\]]*)\]\(([^)]*)\)/g : /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(value))) {
    const from = match.index
    const to = from + match[0].length
    if (start >= from && end <= to) {
      return {
        from,
        to,
        label: match[1],
      }
    }
  }
  return null
}

function applyLink(value: string, start: number, end: number, image = false): MarkdownInsertResult {
  const current = findCurrentLink(value, start, end, image)
  if (current) {
    return result(value, current.from, current.to, current.label, current.from, current.from + current.label.length)
  }

  const selected = value.slice(start, end)
  const prefix = image ? '![' : '['
  const insert = `${prefix}${selected}]()`
  const labelStart = start + prefix.length
  const urlPosition = start + prefix.length + selected.length + 2

  if (selected) {
    return result(value, start, end, insert, urlPosition)
  }
  return result(value, start, end, insert, labelStart)
}

export function applyMarkdownLinkInsert(
  value: string,
  options: MarkdownLinkInsertOptions,
  selectionStart = value.length,
  selectionEnd = selectionStart,
): MarkdownInsertResult {
  const { start, end } = orderedSelection(selectionStart, selectionEnd)
  const prefix = options.image ? '![' : '['
  const text = options.text
  const url = options.url
  const insert = `${prefix}${text}](${url})`
  return result(value, start, end, insert, start + insert.length)
}

function lineBounds(value: string, start: number, end: number): LineBounds {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end
  const nextBreak = value.indexOf('\n', effectiveEnd)
  return {
    from: lineStart,
    to: nextBreak === -1 ? value.length : nextBreak,
  }
}

function isStyledLine(line: string, transform: LineTransform): boolean {
  switch (transform) {
    case 'h1':
      return /^#\s+/.test(line)
    case 'h2':
      return /^##\s+/.test(line)
    case 'checklist':
      return /^-\s+\[[ xX]\]\s+/.test(line)
    case 'bullet-list':
      return /^[-*+]\s+/.test(line) && !/^-\s+\[[ xX]\]\s+/.test(line)
    case 'numbered-list':
      return /^\d+\.\s+/.test(line)
    case 'quote':
      return /^>\s?/.test(line)
  }
}

function stripLineStyle(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^-\s+\[[ xX]\]\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^>\s?/, '')
}

function linePrefix(transform: LineTransform, lineIndex: number): string {
  switch (transform) {
    case 'h1':
      return '# '
    case 'h2':
      return '## '
    case 'checklist':
      return '- [ ] '
    case 'bullet-list':
      return '- '
    case 'numbered-list':
      return `${lineIndex + 1}. `
    case 'quote':
      return '> '
  }
}

function applyLineTransform(
  value: string,
  start: number,
  end: number,
  transform: LineTransform,
): MarkdownInsertResult {
  const bounds = lineBounds(value, start, end)
  const selected = value.slice(bounds.from, bounds.to)
  const lines = selected.split('\n')
  const styledLines = lines.filter((line) => line.trim().length > 0)
  const shouldRemove =
    styledLines.length > 0 && styledLines.every((line) => isStyledLine(line, transform))

  const transformed = lines
    .map((line, index) => {
      if (!line.trim()) {
        return shouldRemove ? '' : linePrefix(transform, index)
      }
      if (shouldRemove) {
        return stripLineStyle(line)
      }
      return `${linePrefix(transform, index)}${stripLineStyle(line)}`
    })
    .join('\n')

  const isSingleEmptyLine = start === end && selected.trim().length === 0 && lines.length === 1
  const selectionStart = isSingleEmptyLine && !shouldRemove
    ? bounds.from + transformed.length
    : bounds.from

  return result(value, bounds.from, bounds.to, transformed, selectionStart, selectionStart)
}

function blockBreaks(value: string, start: number, end: number) {
  return {
    prefix: start > 0 && value[start - 1] !== '\n' ? '\n\n' : '',
    suffix: end < value.length && value[end] !== '\n' ? '\n\n' : '',
  }
}

function toggleFencedBlock(
  value: string,
  start: number,
  end: number,
  openingFence: string,
  closingFence = '```',
): MarkdownInsertResult {
  const selected = value.slice(start, end)
  const blockPattern = new RegExp(`^${escapeRegExp(openingFence)}\\n([\\s\\S]*)\\n${escapeRegExp(closingFence)}$`)
  const blockMatch = selected.match(blockPattern)
  if (blockMatch) {
    return result(value, start, end, blockMatch[1], start, start + blockMatch[1].length)
  }

  const { prefix, suffix } = blockBreaks(value, start, end)
  const body = selected || ''
  const insert = `${prefix}${openingFence}\n${body}\n${closingFence}${suffix}`
  const bodyStart = start + prefix.length + openingFence.length + 1
  const bodyEnd = bodyStart + body.length
  return result(value, start, end, insert, bodyStart, bodyEnd)
}

function toggleMathBlock(value: string, start: number, end: number): MarkdownInsertResult {
  const selected = value.slice(start, end)
  const mathMatch = selected.match(/^\$\$\n?([\s\S]*?)\n?\$\$$/)
  if (mathMatch) {
    return result(value, start, end, mathMatch[1], start, start + mathMatch[1].length)
  }

  const { prefix, suffix } = blockBreaks(value, start, end)
  const body = selected || ''
  const insert = `${prefix}$$\n${body}\n$$${suffix}`
  const bodyStart = start + prefix.length + 3
  const bodyEnd = bodyStart + body.length
  return result(value, start, end, insert, bodyStart, bodyEnd)
}

function insertTable(value: string, start: number, end: number): MarkdownInsertResult {
  const { prefix, suffix } = blockBreaks(value, start, end)
  const table = '|  |  |\n| --- | --- |\n|  |  |'
  const insert = `${prefix}${table}${suffix}`
  const firstCellPosition = start + prefix.length + 2
  return result(value, start, end, insert, firstCellPosition)
}

function toggleHorizontalRule(value: string, start: number, end: number): MarkdownInsertResult {
  const bounds = lineBounds(value, start, end)
  const currentLine = value.slice(bounds.from, bounds.to)
  if (currentLine.trim() === '---') {
    return result(value, bounds.from, bounds.to, '', bounds.from)
  }

  if (start === end && currentLine.trim().length === 0) {
    return result(value, bounds.from, bounds.to, '---', bounds.from + 3)
  }

  const { prefix, suffix } = blockBreaks(value, start, end)
  const insert = `${prefix}---${suffix}`
  const cursor = start + prefix.length + 3
  return result(value, start, end, insert, cursor)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function applyMarkdownInsert(
  value: string,
  action: MarkdownInsertAction,
  selectionStart = value.length,
  selectionEnd = selectionStart,
): MarkdownInsertResult {
  const { start, end } = orderedSelection(selectionStart, selectionEnd)

  switch (action) {
    case 'bold':
      return toggleWrap(value, start, end, '**', '**')
    case 'italic':
      return toggleWrap(value, start, end, '_', '_')
    case 'h1':
      return applyLineTransform(value, start, end, 'h1')
    case 'h2':
      return applyLineTransform(value, start, end, 'h2')
    case 'link':
      return applyLink(value, start, end)
    case 'image':
      return applyLink(value, start, end, true)
    case 'table':
      return insertTable(value, start, end)
    case 'code':
      return toggleFencedBlock(value, start, end, '```')
    case 'math':
      return toggleMathBlock(value, start, end)
    case 'mermaid':
      return toggleFencedBlock(value, start, end, '```mermaid')
    case 'checklist':
      return applyLineTransform(value, start, end, 'checklist')
    case 'bullet-list':
      return applyLineTransform(value, start, end, 'bullet-list')
    case 'numbered-list':
      return applyLineTransform(value, start, end, 'numbered-list')
    case 'quote':
      return applyLineTransform(value, start, end, 'quote')
    case 'hr':
      return toggleHorizontalRule(value, start, end)
  }
}
