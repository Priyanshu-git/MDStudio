import { describe, expect, it } from 'vitest'
import { applyMarkdownInsert } from './markdownInsert'

describe('applyMarkdownInsert', () => {
  it('inserts empty inline markers at the cursor', () => {
    const bold = applyMarkdownInsert('abc', 'bold', 1, 1)
    expect(bold.value).toBe('a****bc')
    expect(bold.selectionStart).toBe(3)
    expect(bold.selectionEnd).toBe(3)

    const italic = applyMarkdownInsert('abc', 'italic', 1, 1)
    expect(italic.value).toBe('a__bc')
    expect(italic.selectionStart).toBe(2)
  })

  it('wraps and unwraps inline selections', () => {
    const wrapped = applyMarkdownInsert('hello', 'bold', 0, 5)
    expect(wrapped.value).toBe('**hello**')
    expect(wrapped.selectionStart).toBe(2)
    expect(wrapped.selectionEnd).toBe(7)

    const unwrapped = applyMarkdownInsert(wrapped.value, 'bold', wrapped.selectionStart, wrapped.selectionEnd)
    expect(unwrapped.value).toBe('hello')
    expect(unwrapped.selectionStart).toBe(0)
    expect(unwrapped.selectionEnd).toBe(5)
  })

  it('converts and toggles heading lines', () => {
    expect(applyMarkdownInsert('# Title', 'h2', 0, 0).value).toBe('## Title')
    expect(applyMarkdownInsert('## Title', 'h2', 0, 0).value).toBe('Title')
  })

  it('applies and removes list and quote line transforms', () => {
    const bullets = applyMarkdownInsert('one\ntwo', 'bullet-list', 0, 7)
    expect(bullets.value).toBe('- one\n- two')

    const numbered = applyMarkdownInsert('one\ntwo', 'numbered-list', 0, 7)
    expect(numbered.value).toBe('1. one\n2. two')

    const quote = applyMarkdownInsert('> one\n> two', 'quote', 0, 11)
    expect(quote.value).toBe('one\ntwo')

    const checklist = applyMarkdownInsert('one\ntwo', 'checklist', 0, 7)
    expect(checklist.value).toBe('- [ ] one\n- [ ] two')
  })

  it('places link and image cursors in the intended slots', () => {
    const emptyLink = applyMarkdownInsert('abc', 'link', 1, 1)
    expect(emptyLink.value).toBe('a[]()bc')
    expect(emptyLink.selectionStart).toBe(2)

    const selectedLink = applyMarkdownInsert('Read', 'link', 0, 4)
    expect(selectedLink.value).toBe('[Read]()')
    expect(selectedLink.selectionStart).toBe(7)

    const image = applyMarkdownInsert('', 'image', 0, 0)
    expect(image.value).toBe('![]()')
    expect(image.selectionStart).toBe(2)
  })

  it('wraps and unwraps fenced and math blocks', () => {
    const code = applyMarkdownInsert('const x = 1', 'code', 0, 11)
    expect(code.value).toBe('```\nconst x = 1\n```')
    expect(code.selectionStart).toBe(4)
    expect(code.selectionEnd).toBe(15)

    expect(applyMarkdownInsert(code.value, 'code', 0, code.value.length).value).toBe('const x = 1')

    const math = applyMarkdownInsert('', 'math', 0, 0)
    expect(math.value).toBe('$$\n\n$$')
    expect(math.selectionStart).toBe(3)

    const mermaid = applyMarkdownInsert('graph TD', 'mermaid', 0, 8)
    expect(mermaid.value).toBe('```mermaid\ngraph TD\n```')
  })

  it('inserts tables and toggles horizontal rules', () => {
    const table = applyMarkdownInsert('', 'table', 0, 0)
    expect(table.value).toBe('|  |  |\n| --- | --- |\n|  |  |')
    expect(table.selectionStart).toBe(2)

    const hr = applyMarkdownInsert('', 'hr', 0, 0)
    expect(hr.value).toBe('---')
    expect(applyMarkdownInsert(hr.value, 'hr', 0, 0).value).toBe('')
  })
})
