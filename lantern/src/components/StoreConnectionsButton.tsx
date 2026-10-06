import { useEffect, useRef, useState } from 'react'
import type { ConnectionStatus } from '../types/opencode'

const errorText = (error: unknown) => (error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error))

/**
 * What real access (Stripe, Shopify, ...) this store's agent has. Every connection saved in
 * Connections is available to every store automatically - there is nothing to turn on here,
 * only to check. A connection added or changed while this store's agent is already running
 * needs a restart to actually reach it (it becomes an environment variable at daemon start),
 * which is what the button below is for.
 */
export default function StoreConnectionsButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null)
  const [error, setError] = useState('')
  const [restarting, setRestarting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    window.electronAPI.listConnections()
      .then((list) => { if (active) setConnections(list) })
      .catch((reason) => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [open])

  const restart = async () => {
    setError('')
    setRestarting(true)
    try {
      await window.electronAPI.startSpace(projectId, true)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setRestarting(false)
    }
  }

  const configured = connections?.filter((provider) => provider.configuredFields.length > 0 || provider.browserSessionConnected) ?? []

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
        Connections{configured.length > 0 ? ` ${configured.length}` : ''}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-aegean-lg">
          <p className="text-[12px] font-medium text-slate-700">Saved access for this store</p>
          <p className="mt-1 text-[11px] text-slate-500">Each service was tested when it was saved. Restart after adding, changing or removing access.</p>
          {error && <p role="alert" className="mt-1 text-[10.5px] text-rose-600">{error}</p>}
          {connections === null ? (
            <p className="mt-2 text-[11px] text-slate-500">Loading…</p>
          ) : configured.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-500">Nothing saved yet. Add a key or sign in from the "Connections" item in the sidebar - every connection you save there is available here automatically.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {configured.map((provider) => (
                <li key={provider.id} className="flex items-center gap-1.5 text-[12px] text-slate-700">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${provider.configuredFields.length === 0 || !provider.verification ? 'bg-amber-400' : provider.verification.status === 'verified' ? 'bg-emerald-500' : provider.verification.status === 'failed' ? 'bg-rose-500' : provider.verification.status === 'incomplete' ? 'bg-amber-400' : 'bg-slate-400'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate" title={provider.verification?.detail}>{provider.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500">{provider.configuredFields.length === 0 ? 'session, not verified' : !provider.verification ? 'not checked' : provider.verification.status === 'verified' ? 'verified' : provider.verification.status === 'failed' ? 'failed' : provider.verification.status === 'incomplete' ? 'incomplete' : 'no test'}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => void restart()}
            disabled={restarting}
            title="Pick up anything saved or changed in Connections since this store's agent last started"
            className="mt-3 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {restarting ? 'Restarting…' : 'Restart to pick up new connections'}
          </button>
        </div>
      )}
    </div>
  )
}
