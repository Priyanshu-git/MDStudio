import { describe, expect, it } from 'vitest'
import { formatShareClipboardText } from './clipboard'

describe('formatShareClipboardText', () => {
  it('places the document title before the share URL on a new line', () => {
    expect(formatShareClipboardText('Project Notes', 'https://example.com/share/123'))
      .toBe('Project Notes\nhttps://example.com/share/123')
  })
})
