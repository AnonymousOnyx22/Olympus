import { useEffect, useRef, useState } from 'react'
import type { GitStatus } from '../types/opencode'

export default function GitMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<'commit' | 'push' | null>(null)
  const [message, setMessage] = useState('')
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const refresh = async () => {
    setLoading(true)
    setError('')
    try { setStatus(await window.electronAPI.gitStatus(projectId)) }
    catch (reason) { setStatus(null); setError(String(reason)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!open) return
    void refresh()
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [open, projectId])

  const act = async (action: 'commit' | 'push') => {
    if (busy || loading) return
    setBusy(action)
    setError('')
    setFeedback('')
    try {
      setFeedback(await window.electronAPI.gitAction(projectId, action, message))
      if (action === 'commit') setMessage('')
      await refresh()
    } catch (reason) { setError(String(reason)) }
    finally { setBusy(null) }
  }
  const disabled = loading || !!busy
  const buttonClass = 'rounded-xl px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div ref={ref} className="relative mr-2">
      <button ref={trigger} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="project-git" className={`flex h-7 items-center gap-1.5 rounded-xl px-2.5 text-[11.5px] font-medium text-slate-900 ring-1 transition ${open ? 'bg-aether-50 ring-aether-200' : 'bg-white ring-slate-200 hover:bg-slate-50'}`}>
        <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M6 7v10M18 7c0 6-12 4-12 10" /></svg>
        {busy ? (busy === 'push' ? 'Pushing…' : 'Committing…') : 'Git'}
      </button>
      {open && <section id="project-git" aria-label="Project version control" className="absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-aegean-lg">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Version control</h2>
          <button disabled={disabled} onClick={() => void refresh()} className="rounded-lg px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40">Refresh</button>
        </div>
        {loading && <p role="status" className="mt-3 text-xs text-aether-600">Reading repository…</p>}
        {status && <>
          <p className="mt-3 truncate font-mono text-xs font-medium text-slate-900" title={status.branch ?? 'Detached HEAD'}>{status.branch ?? 'Detached HEAD'}</p>
          <p className="mt-1 text-xs text-slate-500">{status.upstream ? `${status.ahead} to push · ${status.behind} behind` : 'No upstream branch'}</p>
          <p className="mt-1 truncate text-[11px] text-slate-500" title={status.upstream ?? undefined}>{status.upstream ?? (status.remotes.length ? `Push will publish to ${status.remotes.includes('origin') ? 'origin' : status.remotes.join(', ')}` : 'Add a remote in Terminal to enable push.')}</p>
          <div className="my-3 border-y border-slate-200 py-3">
            <p className="text-xs text-slate-700">{status.files.length ? `${status.files.length} changed files` : 'Working tree clean'}</p>
            {status.files.length > 0 && <ul className="mt-2 max-h-32 overflow-auto font-mono text-[11px] text-slate-700">{status.files.map((file) => <li key={file} className="truncate py-0.5" title={file}>{file}</li>)}</ul>}
          </div>
          <label htmlFor="git-message" className="text-xs text-slate-500">Commit message</label>
          <input id="git-message" value={message} onChange={(event) => setMessage(event.target.value)} disabled={disabled} placeholder="Describe your changes" className="mt-1.5 w-full rounded-xl bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-aether-400" />
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Save editor files first. Committing includes all saved changes in this repository.</p>
          <div className="mt-3 flex gap-2">
            <button disabled={disabled || !status.branch || !status.files.length || !message.trim()} onClick={() => void act('commit')} className={`${buttonClass} flex-1 bg-aether-600 text-white hover:bg-aether-500`}>{busy === 'commit' ? 'Committing…' : 'Commit all changes'}</button>
            <button disabled={disabled || !status.branch || !status.remotes.length} onClick={() => void act('push')} className={`${buttonClass} bg-slate-100 text-slate-700 hover:bg-slate-200`}>{busy === 'push' ? 'Pushing…' : 'Push'}</button>
          </div>
        </>}
        {feedback && <p role="status" className="mt-3 text-xs text-emerald-600">{feedback}</p>}
        {error && <p role="alert" className="mt-3 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-200">{error}</p>}
        {!status && !loading && <p className="mt-2 text-xs text-slate-500">Use Terminal to initialize a repository or check that Git is installed, then refresh.</p>}
      </section>}
    </div>
  )
}
