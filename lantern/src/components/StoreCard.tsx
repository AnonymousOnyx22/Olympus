import { useEffect, useState } from 'react'
import { useSessionStream } from '../services/streamHandler'
import type { AgentGridEntry } from './AllAgentsGrid'
import type { ModelRef, TextPart, ToolPart } from '../types/opencode'

interface Props {
  agent: AgentGridEntry
  model: ModelRef | null
  busy: boolean
  paused: boolean
  dailyCheck: boolean
  onSetDailyCheck: (enabled: boolean) => void
  onOpen: () => void
  onSetPaused: (paused: boolean) => Promise<void>
  onDelete: () => void
}

export default function StoreCard({ agent, model, busy, paused, dailyCheck, onSetDailyCheck, onOpen, onSetPaused, onDelete }: Props) {
  const stream = useSessionStream(agent.spaceId, agent.sessionId, agent.ready && !paused)
  const [cover, setCover] = useState<string | null>(null)
  const [coverIsLogo, setCoverIsLogo] = useState(false)
  const [controlBusy, setControlBusy] = useState(false)
  const [controlError, setControlError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const files = await window.electronAPI.listProjectFiles(agent.spaceId)
        const images = files.filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file))
        // The store's own logo belongs here once it exists; anything else is a stand-in until then.
        const logo = images.find((file) => /logo/i.test(file))
        const image = logo ?? images.at(-1)
        const source = image ? await window.electronAPI.readProjectImage(agent.spaceId, image) : null
        if (active) { setCover(source); setCoverIsLogo(!!logo) }
      } catch { if (active) { setCover(null); setCoverIsLogo(false) } }
    }
    if (agent.ready && !paused) void refresh()
    const interval = window.setInterval(() => { if (agent.ready && !paused) void refresh() }, 10000)
    return () => { active = false; window.clearInterval(interval) }
  }, [agent.spaceId, agent.ready, paused])

  const tools = stream.messages.flatMap((message) => message.parts.filter((part): part is ToolPart => part.type === 'tool'))
  const tasks = tools.filter((part) => part.tool === 'task').slice(-3)
  const completedCount = tools.filter((part) => part.state.status === 'completed').length
  const failedCount = tools.filter((part) => part.state.status === 'error').length
  const latest = tools.at(-1)
  const working = busy || stream.status.type !== 'idle'
  // Just what the agent is saying, in plain words - a glance to confirm it isn't stuck while
  // scrolling past a dozen stores, not the full tool log (that's one click away, in the store).
  const saidLines = stream.messages
    .filter((message) => message.info.role === 'assistant')
    .flatMap((message) => message.parts.filter((part): part is TextPart => part.type === 'text' && part.text.trim().length > 0))
    .slice(-3)
    .map((part) => part.text.trim().replace(/\s+/g, ' '))
  const issue = agent.startError || stream.error || (stream.permissions.some((request) => request.sessionID === agent.sessionId) ? 'Needs your approval' : '')
  const state = paused ? 'Paused' : issue ? 'Needs attention' : working ? 'Working' : agent.ready ? (dailyCheck ? 'Watching' : 'Standing by') : 'Starting'
  const dot = paused ? 'bg-slate-400' : issue ? 'bg-rose-500' : working ? 'animate-pulse bg-emerald-500' : agent.ready ? 'bg-aether-500' : 'bg-amber-400'
  return <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-aegean transition hover:border-aether-300">
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-aether-50 via-slate-100 to-slate-50">
        {cover ? <img src={cover} alt={coverIsLogo ? `${agent.title} logo` : `Latest artwork for ${agent.title}`} className="h-full w-full object-contain p-2" /> : <div className="flex h-full flex-col items-center justify-center gap-1" title="The store's logo will appear here once the agent creates one"><svg className="h-20 w-20 text-aether-300" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 81h74M19 81V37L50 18l31 19v44M18 39h64M30 81V54h40v27" /><path d="M40 54v27M60 54v27" /></svg></div>}
        <span className="absolute left-3 top-3 rounded-full border border-slate-200 bg-white/90 px-2.5 py-1 text-[10px] font-medium text-slate-700">{agent.projectPath?.split(/[\\/]/).slice(-2, -1)[0] || 'Stores'}</span>
      </div>
      <div className="p-4">
        {/* No store title here. It was the session's own title, which is whatever the
            prompt happened to be, so the card led with a wall of the user's own sentence.
            The status and the artwork below it identify the store without that. */}
        <div className="flex items-start justify-end gap-2"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dot}`} /></div>
        <p className="mt-0.5 text-[11px] text-slate-500">{state}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-[11px]"><div><span className="block text-slate-400">Managing model</span><strong className="mt-0.5 block truncate font-medium text-slate-700">{model?.modelID ?? 'Choose model'}</strong></div><div><span className="block text-slate-400">Specialist tasks</span><strong className="mt-0.5 block font-medium text-slate-700">{tasks.length ? `${tasks.length} recent` : 'None yet'}</strong></div></div>
        <div className="mt-3 flex h-[92px] flex-col rounded-lg bg-midnight px-2.5 py-2 font-mono">
          <div className="flex h-4 shrink-0 items-center gap-1.5 text-[9px] uppercase tracking-wide text-slate-500">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${working ? 'animate-pulse bg-emerald-400' : 'bg-slate-500'}`} aria-hidden="true" />
            {working ? 'Working' : 'Idle'}
          </div>
          {/* Exactly 3 fixed-height, single-line rows, always - otherwise the box grows and
              shrinks as lines arrive, wrap, or disappear, which reads as the UI stuttering. */}
          <div className="mt-1 space-y-0.5">
            {Array.from({ length: 3 }, (_, index) => {
              const placeholder = !issue && !saidLines.length
              const text = issue ? (index === 0 ? issue : '')
                : saidLines.length ? (saidLines[index] ?? '')
                : index === 0 ? (latest ? ('title' in latest.state && latest.state.title) || latest.tool : 'Waiting for the first message…') : ''
              const color = issue ? 'text-rose-400' : placeholder ? 'text-slate-500' : 'text-slate-800'
              return <p key={index} className={`h-[17px] truncate text-[10.5px] leading-[17px] ${color}`}>{text}</p>
            })}
          </div>
        </div>
        <div className="mt-2 flex gap-2 text-[10px]"><span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">{completedCount} steps done</span><span className={`rounded-md px-2 py-1 ${failedCount ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-500'}`}>{failedCount} failed</span></div>
        {tasks.length > 0 && <div className="mt-3 space-y-1"><span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Specialist agents</span>{tasks.map((task) => <div key={task.id} className="flex items-center gap-1.5 text-[10px] text-slate-600"><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${task.state.status === 'error' ? 'bg-rose-500' : task.state.status === 'completed' ? 'bg-emerald-500' : 'animate-pulse bg-aether-500'}`} /><span className="min-w-0 flex-1 truncate">{typeof task.state.input.description === 'string' ? task.state.input.description : 'Assigned task'}</span></div>)}</div>}
      </div>
    </button>
    <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-4 py-2.5">
      <button type="button" onClick={() => onSetDailyCheck(!dailyCheck)} aria-pressed={dailyCheck} title="Keep this store under watch: agents check in and act on it regularly while Olympus is open" className={`rounded-lg px-2.5 py-1 text-[11px] font-medium ${dailyCheck ? 'bg-aether-50 text-aether-700' : 'text-slate-500 hover:bg-slate-50'}`}>{dailyCheck ? 'Managing 24/7' : 'Manage 24/7'}</button>
      <div className="flex items-center gap-1">
        <button type="button" disabled={controlBusy} onClick={async () => { setControlBusy(true); setControlError(''); try { await onSetPaused(!paused) } catch (error) { setControlError(error instanceof Error ? error.message : String(error)) } finally { setControlBusy(false) } }} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{paused ? 'Start' : 'Stop'}</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onDelete() }} title="Delete this store" aria-label="Delete this store" className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m3 0-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" /></svg>
        </button>
      </div>
    </div>
    {controlError && <p role="alert" className="px-4 pb-2 text-[10px] text-rose-700">{controlError}</p>}
  </article>
}
