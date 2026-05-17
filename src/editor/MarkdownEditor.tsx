import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { markdown } from '@codemirror/lang-markdown'
import { history, historyKeymap, redo, undo } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { applyMarkdownInsert, type MarkdownInsertAction } from './markdownInsert'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
}

export type MarkdownEditorHandle = {
  applyAction: (action: MarkdownInsertAction) => void
  focus: () => void
  redo: () => void
  scrollToLine: (lineNumber: number) => void
  undo: () => void
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange }, ref) {
    const hostRef = useRef<HTMLDivElement | null>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const initialValueRef = useRef(value)

    useEffect(() => {
      onChangeRef.current = onChange
    }, [onChange])

    useEffect(() => {
      if (!hostRef.current) {
        return
      }

      const view = new EditorView({
        parent: hostRef.current,
        state: EditorState.create({
          doc: initialValueRef.current,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            drawSelection(),
            dropCursor(),
            highlightActiveLine(),
            history(),
            keymap.of(historyKeymap),
            markdown(),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString())
              }
            }),
          ],
        }),
      })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
    }, [])

    useEffect(() => {
      const view = viewRef.current
      if (!view) {
        return
      }
      const current = view.state.doc.toString()
      if (current === value) {
        return
      }
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }, [value])

    useImperativeHandle(ref, () => ({
      applyAction(action) {
        const view = viewRef.current
        if (!view) {
          return
        }
        const selection = view.state.selection.main
        const result = applyMarkdownInsert(
          view.state.doc.toString(),
          action,
          selection.from,
          selection.to,
        )
        view.dispatch({
          changes: result.changes,
          selection: {
            anchor: result.selectionStart,
            head: result.selectionEnd,
          },
        })
        view.focus()
      },
      focus() {
        viewRef.current?.focus()
      },
      redo() {
        const view = viewRef.current
        if (!view) {
          return
        }
        redo(view)
        view.focus()
      },
      scrollToLine(lineNumber) {
        const view = viewRef.current
        if (!view) {
          return
        }
        const safeLine = Math.min(Math.max(1, lineNumber), view.state.doc.lines)
        const line = view.state.doc.line(safeLine)
        view.dispatch({
          selection: { anchor: line.from },
          effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
        })
        view.focus()
      },
      undo() {
        const view = viewRef.current
        if (!view) {
          return
        }
        undo(view)
        view.focus()
      },
    }))

    return <div ref={hostRef} className="markdown-editor" aria-label="Markdown input" />
  },
)
