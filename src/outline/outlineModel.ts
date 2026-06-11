export type OutlineItem = {
  id: string
  text: string
  level: number
  line: number
}

export function buildOutline(markdown: string): OutlineItem[] {
  return markdown
    .split('\n')
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/)
      if (!match) {
        return null
      }
      const text = match[2].replace(/[#*_`]/g, '').trim()
      return {
        id: `${index}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        text,
        level: match[1].length,
        line: index + 1,
      }
    })
    .filter(Boolean) as OutlineItem[]
}
