import { useEffect, useRef, useState } from 'react'
import TodoPanel, { extractTodos } from './TodoPanel'
import SubagentTree from './SubagentTree'
import type { MessageEntry } from '../services/streamHandler'
import type { ToolPart } from '../types/opencode'

function describe(part: ToolPart): string {
  const input = part.state.input
  const detail = input.url ?? input.filePath ?? input.path ?? input.description ?? input.command ?? input.pattern
  if (typeof detail === 'string' && detail.trim()) return detail.trim()
  if ('title' in part.state && part.state.title) return part.state.title
  return part.tool
}

type Panel = 'activity' | 'plan' | 'images' | 'agents' | null

/**
 * A slim status bar, not a panel: the tool log, plan, and created images used to render inline
 * and in full, permanently pushing the actual conversation down the page - exactly what you'd
 * open this view to read. Each now opens on demand as a popout over the chat instead, so the
 * default view is just a one-line status plus three small toggle buttons.
 */
export default function StationActivity({ spaceId, sessionID, messages, busy, activity, idleLabel }: { spaceId: string; sessionID: string; messages: MessageEntry[]; busy: boolean; activity: string; idleLabel?: string }) {
  const [images, setImages] = useState<{ path: string; src: string }[]>([])
  const [preview, setPreview] = useState<{ path: string; src: string } | null>(null)
  const [openPanel, setOpenPanel] = useState<Panel>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const paths = (await window.electronAPI.listProjectFiles(spaceId)).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file)).slice(-12)
        const loaded = await Promise.all(paths.map(async (file) => ({ path: file, src: await window.electronAPI.readProjectImage(spaceId, file) })))
        if (active) setImages(loaded.filter((item): item is { path: string; src: string } => !!item.src))
      } catch { if (active) setImages([]) }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 4000)
    return () => { active = false; window.clearInterval(interval) }
  }, [spaceId])

  useEffect(() => {
    if (!openPanel) return
    const close = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpenPanel(null) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenPanel(null) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [openPanel])

  const allTools = messages.flatMap((message) => message.parts.filter((part): part is ToolPart => part.type === 'tool'))
  const tools = allTools.slice(-10).reverse()
  const hasDelegated = allTools.some((part) => part.tool === 'task')
  const todos = extractTodos(messages)
  const todoDone = todos?.filter((todo) => todo.status === 'completed').length ?? 0
  const toggle = (panel: Exclude<Panel, null>) => setOpenPanel((current) => (current === panel ? null : panel))
  const tabClass = (panel: Exclude<Panel, null>) => `rounded-lg px-2 py-1 text-[11px] font-medium transition ${openPanel === panel ? 'bg-white text-slate-900 shadow-aegean' : 'text-slate-600 hover:bg-white'}`

  return <div ref={containerRef} className="relative shrink-0 border-b border-slate-200 bg-slate-50">
    <div className="flex items-center gap-2 px-3 py-1.5">
      <span role="status" className={`flex min-w-0 items-center gap-1.5 text-[11px] font-medium ${busy ? 'text-aether-700' : 'text-slate-500'}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${busy ? 'animate-pulse bg-aether-500' : 'bg-slate-400'}`} aria-hidden="true" />
        <span className="truncate">{busy ? activity || 'Working' : idleLabel || 'Waiting for your next request'}</span>
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => toggle('activity')} aria-pressed={openPanel === 'activity'} className={tabClass('activity')}>Activity{tools.length ? ` ${tools.length}` : ''}</button>
        {todos && todos.length > 0 && <button type="button" onClick={() => toggle('plan')} aria-pressed={openPanel === 'plan'} className={tabClass('plan')}>Plan {todoDone}/{todos.length}</button>}
        {images.length > 0 && <button type="button" onClick={() => toggle('images')} aria-pressed={openPanel === 'images'} className={tabClass('images')}>Images {images.length}</button>}
        {hasDelegated && <button type="button" onClick={() => toggle('agents')} aria-pressed={openPanel === 'agents'} className={tabClass('agents')}>Agents</button>}
      </div>
    </div>

    {openPanel && <div className="absolute inset-x-0 top-full z-20 max-h-[55vh] overflow-y-auto rounded-b-xl border-x border-b border-slate-200 bg-white p-3 shadow-aegean-lg">
      {openPanel === 'activity' && (tools.length ? <ol className="grid gap-1 sm:grid-cols-2">
        {tools.map((part) => {
          const running = part.state.status === 'running' || part.state.status === 'pending'
          return <li key={part.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${running ? 'animate-pulse bg-aether-500' : part.state.status === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`} aria-hidden="true" />
            <span className="shrink-0 font-semibold capitalize text-slate-700">{part.tool}</span>
            <span className="min-w-0 flex-1 truncate text-slate-500" title={describe(part)}>{describe(part)}</span>
            <span className="shrink-0 text-slate-400">{running ? 'Now' : part.state.status === 'error' ? 'Failed' : 'Done'}</span>
          </li>
        })}
      </ol> : <p className="text-[11px] text-slate-500">Research, file changes, and setup actions will appear here as the agent works.</p>)}
      {openPanel === 'plan' && todos && <TodoPanel todos={todos} />}
      {openPanel === 'agents' && <SubagentTree spaceId={spaceId} rootSessionId={sessionID} />}
      {openPanel === 'images' && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {images.map((item) => <button key={item.path} type="button" onClick={() => setPreview(item)} className="text-left" title={`View ${item.path}`}>
          <img src={item.src} alt={item.path} className="h-20 w-full rounded-md border border-slate-200 bg-slate-50 object-contain" />
          <span className="mt-1 block truncate text-[9px] text-slate-500">{item.path.split('/').pop()}</span>
        </button>)}
      </div>}
    </div>}

    {preview && <div role="dialog" aria-modal="true" aria-label={`Preview ${preview.path}`} className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 p-6" onClick={() => setPreview(null)}><button type="button" onClick={() => setPreview(null)} className="absolute right-6 top-5 rounded-lg bg-white px-3 py-1.5 text-xs text-slate-900">Close</button><img src={preview.src} alt={preview.path} className="max-h-[80vh] max-w-[90vw] object-contain" onClick={(event) => event.stopPropagation()} /><p className="mt-3 max-w-[90vw] truncate text-xs text-white">{preview.path}</p></div>}
  </div>
}
