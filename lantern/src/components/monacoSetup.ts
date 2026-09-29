import { loader } from '@monaco-editor/react'
import EditorWorker from 'monaco-editor/editor/editor.worker?worker'
import TypeScriptWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import JsonWorker from 'monaco-editor/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/language/html/html.worker?worker'

/**
 * Monaco is loaded on demand rather than at startup.
 *
 * It was previously imported eagerly, which pulled the whole editor — every language
 * grammar it ships with — into the initial bundle. That dominated the renderer bundle and
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

    monaco.editor.defineTheme('olympus-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#0ea5e908',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#0284c7',
        'diffEditor.insertedTextBackground': '#10b98126',
        'diffEditor.removedTextBackground': '#f43f5e26',
        'diffEditor.insertedLineBackground': '#10b98114',
        'diffEditor.removedLineBackground': '#f43f5e14',
        'editorGutter.background': '#ffffff',
        'scrollbarSlider.background': '#0f172a14',
        'scrollbarSlider.hoverBackground': '#0f172a22',
      },
    })
  })()
  return pending
}
