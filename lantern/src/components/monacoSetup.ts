import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'

/**
 * Monaco is loaded on demand rather than at startup.
 *
 * It was previously imported eagerly, which pulled the whole editor - every language
 * grammar it ships with - into the initial bundle. That dominated the renderer bundle and
 * was paid on every cold start whether or not the user ever opened the Code view.
 */
let pending: Promise<void> | null = null

export function ensureMonaco(): Promise<void> {
  if (pending) return pending
  pending = (async () => {
    const monaco = await import('monaco-editor')

    // Serve Monaco from the local bundle instead of @monaco-editor/react's default CDN, so
    // the app works fully offline.
    self.MonacoEnvironment = {
      getWorker: (_id: string, label: string) => {
        if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker()
        if (label === 'json') return new JsonWorker()
        if (['css', 'scss', 'less'].includes(label)) return new CssWorker()
        if (['html', 'handlebars', 'razor'].includes(label)) return new HtmlWorker()
        return new EditorWorker()
      },
    }

    loader.config({ monaco })

    // Still registered as 'olympus-light' because editors reference the theme by that name;
    // it is the dark Aegean-night palette now.
    monaco.editor.defineTheme('olympus-light', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        // Literal hexes: Monaco resolves this theme object into canvas colours, so CSS custom
        // properties cannot reach it. Mirrors the palette in tailwind.config.js / index.css.
        'editor.background': '#0f172a',
        'editor.foreground': '#e2e8f0',
        'editor.lineHighlightBackground': '#1e293b',
        'editor.selectionBackground': '#3b82f655',
        'editorCursor.foreground': '#facc15',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#facc15',
        'diffEditor.insertedTextBackground': '#10b98133',
        'diffEditor.removedTextBackground': '#f43f5e33',
        'diffEditor.insertedLineBackground': '#10b9811a',
        'diffEditor.removedLineBackground': '#f43f5e1a',
        'editorGutter.background': '#0f172a',
        'editorWidget.background': '#1e293b',
        'editorWidget.border': '#334155',
        'scrollbarSlider.background': '#94a3b833',
        'scrollbarSlider.hoverBackground': '#94a3b855',
      },
    })
  })()
  return pending
}
