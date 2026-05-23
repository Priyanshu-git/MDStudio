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
import {
  applyMarkdownInsert,
  applyMarkdownLinkInsert,
  type MarkdownInsertAction,
  type MarkdownLinkInsertOptions,
} from './markdownInsert'

type MarkdownEditorProps = {
  value: string
  onChange: (value: string) => void
}

export type MarkdownEditorHandle = {
  applyAction: (action: MarkdownInsertAction) => void
  applyLink: (options: MarkdownLinkInsertOptions, selection?: EditorSelectionSnapshot) => void
  focus: () => void
  getSelectionSnapshot: () => EditorSelectionSnapshot | null
  redo: () => void
  scrollToLine: (lineNumber: number) => void
  undo: () => void
}

export type EditorSelectionSnapshot = {
  from: number
  to: number
  text: string
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
      applyLink(options, selection) {
        const view = viewRef.current
        if (!view) {
          return
        }
        const currentSelection = view.state.selection.main
        const from = selection?.from ?? currentSelection.from
        const to = selection?.to ?? currentSelection.to
        const result = applyMarkdownLinkInsert(
          view.state.doc.toString(),
          options,
          from,
          to,
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
      getSelectionSnapshot() {
        const view = viewRef.current
        if (!view) {
          return null
        }
        const selection = view.state.selection.main
        return {
          from: selection.from,
          to: selection.to,
          text: view.state.doc.sliceString(selection.from, selection.to),
        }
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
