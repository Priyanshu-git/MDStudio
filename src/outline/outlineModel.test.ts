import { describe, expect, it } from 'vitest'
import { buildOutline } from './outlineModel'

describe('buildOutline', () => {
  it('extracts nested markdown headings with source lines', () => {
    expect(buildOutline('# Intro\n\nBody\n\n### Details\n\n###### End')).toEqual([
      { id: '0-intro', text: 'Intro', level: 1, line: 1 },
      { id: '4-details', text: 'Details', level: 3, line: 5 },
      { id: '6-end', text: 'End', level: 6, line: 7 },
    ])
  })

  it('returns an empty outline when there are no headings', () => {
    expect(buildOutline('Paragraph\n\n- List item')).toEqual([])
  })
})
