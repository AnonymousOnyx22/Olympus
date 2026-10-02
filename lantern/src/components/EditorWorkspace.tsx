import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { ensureMonaco } from './monacoSetup'

interface EditorWorkspaceProps {
  spaceId: string
  visible: boolean
  switchGuardRef: React.MutableRefObject<(() => Promise<boolean>) | null>
  projectKey: string
  available: boolean
  onRun: () => void
  runDisabled: boolean
}

const LANGUAGE_BY_EXT: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  json: 'json', md: 'markdown', css: 'css', scss: 'scss', less: 'less', html: 'html',
  py: 'python', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin', cs: 'csharp',
  c: 'c', h: 'c', cpp: 'cpp', hpp: 'cpp', rb: 'ruby', php: 'php', swift: 'swift',
  sh: 'shell', bash: 'shell', ps1: 'powershell', yml: 'yaml', yaml: 'yaml', toml: 'ini',
  sql: 'sql', xml: 'xml', vue: 'html', svelte: 'html', lua: 'lua', dart: 'dart',
}

const languageFor = (file: string) => LANGUAGE_BY_EXT[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext'
const basename = (file: string) => file.split('/').pop() ?? file
const dirname = (file: string) => file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''

/** Must match the `h-8` row height of the explorer rows. */
const FILE_ROW_HEIGHT = 32
/** Rows kept mounted above and below the viewport so scrolling does not flash. */
const FILE_OVERSCAN = 12
/** How many rows to keep mounted around the viewport. */
const FILE_VIEWPORT_ROWS = 30

export default function EditorWorkspace({ spaceId, visible, switchGuardRef, projectKey, available, onRun, runDisabled }: EditorWorkspaceProps) {
  const [explorerOpen, setExplorerOpen] = useState(() => localStorage.getItem('olympus.explorerCollapsed') !== 'true')
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [bufferSpaceId, setBufferSpaceId] = useState(spaceId)
  const readSequence = useRef(0)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [monacoReady, setMonacoReady] = useState(false)
  const dirty = selected !== null && content !== savedContent

  // Pull the editor in only once this view is actually on screen.
  useEffect(() => {
    if (!visible) return
    let cancelled = false
    void ensureMonaco().then(() => {
      if (!cancelled) setMonacoReady(true)
    })
    return () => { cancelled = true }
  }, [visible])

  // The editor's save path is driven from several places at once (Ctrl+S, opening another
  // file, switching project) and all of them must observe the *latest* buffer. Reading state
  // through refs keeps `save` stable while still writing the newest text, and chaining saves
  // on one promise means a second save waits for the first instead of being dropped.
  const latest = useRef({ spaceId: bufferSpaceId, selected, content, savedContent })
  latest.current = { spaceId: bufferSpaceId, selected, content, savedContent }
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true))

  const save = useCallback((): Promise<boolean> => {
    const { spaceId: owner, selected: file, content: text, savedContent: onDisk } = latest.current
    const run = async (): Promise<boolean> => {
      if (file === null || text === onDisk) return true
      setSaving(true)
      setError(null)
      try {
        const ok = await window.electronAPI.writeProjectFile(owner, file, text)
        if (!ok) throw new Error('The file could not be saved.')
        // Only mark clean if nothing was typed while the write was in flight.
        if (latest.current.spaceId === owner && latest.current.selected === file && latest.current.content === text) setSavedContent(text)
        return true
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        return false
      } finally {
        setSaving(false)
      }
    }
    saveChain.current = saveChain.current.then(run, run)
    return saveChain.current
  }, [])

  useEffect(() => {
    switchGuardRef.current = async () => {
      if (!latest.current.selected || latest.current.content === latest.current.savedContent) return true
      const answer = await window.electronAPI.confirmProjectSwitch(latest.current.selected)
      if (answer === 'save') return save()
      return answer === 'discard'
    }
    return () => { switchGuardRef.current = null }
  }, [save, switchGuardRef])

  const openFile = useCallback(
    async (file: string) => {
      if (file === latest.current.selected) return
      const sequence = ++readSequence.current
      if (!(await save()) || sequence !== readSequence.current) return
      setLoading(true)
      setError(null)
      try {
        const text = await window.electronAPI.readProjectFile(spaceId, file)
        if (sequence !== readSequence.current) return
        setBufferSpaceId(spaceId)
        if (text === null) throw new Error('This file cannot be opened as text.')
        setSelected(file)
        setContent(text)
        setSavedContent(text)
      } catch (reason) {
        if (sequence === readSequence.current) setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        if (sequence === readSequence.current) setLoading(false)
      }
    },
    [save, spaceId],
  )

  useEffect(() => {
    ++readSequence.current
    setBufferSpaceId(spaceId)
    setSelected(null)
    setContent('')
    setSavedContent('')
    if (!available) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setFiles([])
    setSelected(null)
    setContent('')
    setSavedContent('')
    window.electronAPI.listProjectFiles(spaceId).then(async (list) => {
      if (cancelled) return
      setFiles(list)
      const first = list.find((file) => /^readme(\.|$)/i.test(basename(file))) ?? list.find((file) => basename(file) === 'package.json') ?? list[0]
      if (!first) {
        setLoading(false)
        return
      }
      const text = await window.electronAPI.readProjectFile(spaceId, first)
      if (cancelled) return
      if (text === null) setError('The first project file could not be opened as text.')
      else {
        setSelected(first)
        setContent(text)
        setSavedContent(text)
      }
      setLoading(false)
    }).catch((reason) => {
      if (!cancelled) {
        setError(reason instanceof Error ? reason.message : String(reason))
        setLoading(false)
      }
    })
    return () => { cancelled = true; ++readSequence.current }
  }, [available, projectKey, spaceId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  // Hold the window open until the buffer has actually reached disk.
  useEffect(() => window.electronAPI.onBeforeClose(save), [save])

  const shownFiles = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? files.filter((file) => file.toLowerCase().includes(needle)) : files
  }, [files, query])

  // Windowed rendering for the explorer: mount only the rows near the viewport, with spacers
  // preserving the scroll height. The main process allows up to 3000 files per project, and
  // one mounted button per file made the explorer take seconds to open on a large project.
  const [listScroll, setListScroll] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const firstVisible = Math.floor(listScroll / FILE_ROW_HEIGHT)
  const windowStart = Math.max(0, firstVisible - FILE_OVERSCAN)
  const windowEnd = Math.min(shownFiles.length, firstVisible + FILE_VIEWPORT_ROWS + FILE_OVERSCAN)

  // A changed filter or project invalidates the previous scroll offset.
  useEffect(() => {
    setListScroll(0)
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query, projectKey])

  if (!available) return <div className="grid h-full place-items-center text-xs text-slate-400">Open a saved project to edit files.</div>

  return (
    <div className="flex h-full min-h-0 bg-white">
      <aside style={{ display: explorerOpen ? 'flex' : 'none' }} className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50">
        <div className="flex h-9 items-center border-b border-slate-200 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Explorer
          <span className="ml-auto font-mono font-normal tracking-normal text-slate-400">{files.length}</span>
        </div>
        <div className="border-b border-aether-100 p-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find file"
            className="h-7 w-full rounded-lg bg-white px-2 text-[11px] text-slate-700 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-aether-400"
          />
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto py-1"
          ref={listRef}
          onScroll={(event) => setListScroll(event.currentTarget.scrollTop)}
        >
          {/*
            The main process caps a project at 3000 files. Rendering one button per file made
            opening the explorer on a large project cost seconds of layout and scroll jank, so
            only the rows near the viewport are mounted, with spacers holding the scroll height.
          */}
          <div style={{ height: windowStart * FILE_ROW_HEIGHT }} aria-hidden="true" />
          {shownFiles.slice(windowStart, windowEnd).map((file) => (
            <button
              key={file}
              type="button"
              onClick={() => void openFile(file)}
              title={file}
              className={`flex h-8 w-full min-w-0 items-center gap-2 px-3 text-left transition ${selected === file ? 'bg-aether-50 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <svg className={`h-3.5 w-3.5 shrink-0 ${selected === file ? 'text-aether-600' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h8l4 4v16H6V2Z" /><path d="M14 2v5h5" /></svg>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px]">{basename(file)}</span>
                {dirname(file) && <span className="block truncate text-[9px] text-slate-400">{dirname(file)}</span>}
              </span>
              {selected === file && dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-aether-400" />}
            </button>
          ))}
          <div style={{ height: Math.max(0, (shownFiles.length - windowEnd) * FILE_ROW_HEIGHT) }} aria-hidden="true" />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
          <button onClick={() => setExplorerOpen((open) => { localStorage.setItem('olympus.explorerCollapsed', String(open)); return !open })} aria-expanded={explorerOpen} aria-label={explorerOpen ? 'Collapse file explorer' : 'Expand file explorer'} title={explorerOpen ? 'Collapse file explorer' : 'Expand file explorer'} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></svg>
          </button>
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-500">{selected ?? 'No file selected'}</span>
          {dirty && <span className="text-[10px] text-aether-600">Modified</span>}
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="rounded-lg px-2 py-1 text-[10.5px] text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            disabled={runDisabled}
            onClick={onRun}
            title="Run project (Ctrl/⌘ J for terminal)"
            className="rounded-lg px-2 py-1 text-[10.5px] text-aether-600 transition hover:bg-aether-50 hover:text-aether-700 disabled:opacity-30"
          >
            <span aria-hidden="true">&#9655;</span> Run
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          {selected ? (
            monacoReady ? (
            <Editor
              path={`olympus://${projectKey}/${selected}`}
              value={content}
              language={languageFor(selected)}
              theme="olympus-light"
              onChange={(value) => setContent(value ?? '')}
              options={{
                automaticLayout: true,
                fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
                fontSize: 12.5,
                lineHeight: 20,
                minimap: { enabled: false },
                padding: { top: 12 },
                overviewRulerLanes: 0,
                hideCursorInOverviewRuler: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: 'off',
              }}
            />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-400">Loading editor…</div>
            )
          ) : (
            <div className="grid h-full place-items-center text-xs text-slate-400">{loading ? 'Reading project…' : 'This project has no files.'}</div>
          )}
          {loading && selected && <div className="absolute right-3 top-3 text-[10px] text-slate-400">Opening…</div>}
        </div>
        <footer className="flex h-6 shrink-0 items-center border-t border-slate-200 bg-slate-50 px-3 font-mono text-[9.5px] text-slate-400">
          {selected ? languageFor(selected) : 'plain text'}
          <span className="ml-auto">Ctrl/⌘ S to save · Ctrl/⌘ J terminal · Ctrl/⌘ B preview</span>
        </footer>
        {error && <div className="border-t border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-600">{error}</div>}
      </section>
    </div>
  )
}
