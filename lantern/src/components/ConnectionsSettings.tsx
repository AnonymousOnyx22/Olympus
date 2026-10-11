import { useEffect, useMemo, useState } from 'react'
import type { ConnectionCheck, ConnectionStatus, ProjectInfo } from '../types/opencode'
import InterfaceState from './InterfaceState'
import { CONNECTION_LOGOS } from './connectionBrands'
import { errorText } from '../errorText'



const CHECK_LOOK: Record<ConnectionCheck['status'], { label: string; badge: string; text: string; dot: string }> = {
  verified: { label: 'Verified', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  failed: { label: 'Failed', badge: 'bg-rose-50 text-rose-700 ring-rose-200', text: 'text-rose-600', dot: 'bg-rose-500' },
  incomplete: { label: 'Incomplete', badge: 'bg-amber-50 text-amber-700 ring-amber-200', text: 'text-amber-600', dot: 'bg-amber-400' },
  unchecked: { label: 'Saved, no test', badge: 'bg-slate-100 text-slate-500 ring-slate-200', text: 'text-slate-500', dot: 'bg-slate-400' },
}
const NOT_CHECKED = { label: 'Not checked yet', badge: 'bg-amber-50 text-amber-700 ring-amber-200', text: 'text-amber-600', dot: 'bg-amber-400' }

function monogram(name: string, id: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? []
  return words.length > 1 ? words.slice(0, 2).map(word => word[0]).join('').toUpperCase() : name.slice(0, 2).toUpperCase() || id.slice(0, 2).toUpperCase()
}

function ProviderLogo({ id, className, name }: { id: string; className?: string; name?: string; category?: string }) {
  const Logo = CONNECTION_LOGOS[id]
  if (Logo) return <Logo className={className} />
  return <span aria-hidden="true" className={`${className} grid shrink-0 place-items-center rounded-md bg-slate-100 text-[9px] font-medium text-slate-500`}>{monogram(name ?? id, id)}</span>
}

export default function ConnectionsSettings({ projects }: { projects: ProjectInfo[] }) {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Connection ids withheld from each project's agent; a project not listed gets everything.
  const [optOut, setOptOut] = useState<Record<string, string[]>>({})
  useEffect(() => { void window.electronAPI.getSettings().then((settings) => setOptOut(settings.connectionOptOut ?? {})).catch(() => undefined) }, [])
  const setProjectAccess = async (projectId: string, connectionId: string, allowed: boolean) => {
    const withheld = new Set(optOut[projectId] ?? [])
    if (allowed) withheld.delete(connectionId); else withheld.add(connectionId)
    const next = { ...optOut, [projectId]: [...withheld] }
    if (!withheld.size) delete next[projectId]
    setOptOut(next)
    try { await window.electronAPI.setSettings({ connectionOptOut: next }) } catch (reason) { setError(errorText(reason)) }
  }

  const refresh = () => { setError(''); return window.electronAPI.listConnections().then(setConnections).catch((reason) => setError(errorText(reason))) }
  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (connections ?? []).filter((provider) =>
      (!savedOnly || provider.configuredFields.length > 0) &&
      (!q || `${provider.name} ${provider.description} ${provider.category}`.toLowerCase().includes(q)))
  }, [connections, search, savedOnly])

  const grouped = useMemo(() => {
    const groups = new Map<string, ConnectionStatus[]>()
    for (const provider of filtered) {
      const list = groups.get(provider.category) ?? []
      list.push(provider)
      groups.set(provider.category, list)
    }
    return [...groups.entries()]
  }, [filtered])

  const selected = connections?.find((provider) => provider.id === selectedId) ?? null

  const setDraft = (providerId: string, fieldKey: string, value: string) =>
    setDrafts((prev) => ({ ...prev, [providerId]: { ...prev[providerId], [fieldKey]: value } }))

  const save = async (providerId: string) => {
    const values = drafts[providerId]
    if (!values || !Object.values(values).some((v) => v.trim())) return
    setBusyId(providerId)
    setError('')
    try {
      const next = await window.electronAPI.setConnection(providerId, values)
      setConnections(next)
      setDrafts((prev) => ({ ...prev, [providerId]: {} }))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (providerId: string) => {
    setBusyId(providerId)
    setError('')
    try {
      setConnections(await window.electronAPI.clearConnection(providerId))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusyId(null)
    }
  }

  const verify = async (providerId: string) => {
    setBusyId(providerId)
    setError('')
    try {
      setConnections(await window.electronAPI.verifyConnection(providerId))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusyId(null)
    }
  }

  // Keys saved before checking existed have no result yet: test them as soon as they are opened.
  useEffect(() => {
    if (selected && selected.configuredFields.length > 0 && !selected.verification) void verify(selected.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <main className="connections-page h-full overflow-y-auto bg-white">
      <div className="connections-content mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Connections</h1>
        <p className="mt-1 max-w-lg text-[12px] text-slate-500">
          Saved API keys are encrypted by this computer. Every project's agent gets each saved connection
          unless you uncheck that project on the connection's page. Saving tests the key where the service has a test.
          A running agent picks up changes the next time it starts.
        </p>



        {error && <InterfaceState compact tone="error" title={connections === null ? 'Connections could not load' : 'Connection needs attention'} description={error} action={<button type="button" onClick={() => connections === null ? void refresh() : setError('')}>{connections === null ? 'Retry' : 'Dismiss'}</button>} />}

        {connections === null ? (
          !error && <InterfaceState tone="loading" title="Loading connections" description="Checking saved access on this computer." />
        ) : selected ? (
          <div className="mt-6">
            <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-slate-900">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              All connections
            </button>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-float">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                    <ProviderLogo id={selected.id} className="h-5 w-5 text-slate-700" name={selected.name} category={selected.category} />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-slate-500">{selected.category}</p>
                    <h2 className="text-[16px] font-semibold text-slate-900">{selected.name}</h2>
                    <p className="mt-0.5 text-[12px] text-slate-500">{selected.description}</p>
                  </div>
                </div>
                {selected.configuredFields.length > 0 && (() => {
                  const look = selected.verification ? CHECK_LOOK[selected.verification.status] : NOT_CHECKED
                  const label = look.label
                  return <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${look.badge}`}>{busyId === selected.id ? 'Checking…' : label}</span>
                })()}
              </div>

              {selected.configuredFields.length > 0 && selected.verification && (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <p className={`text-[11.5px] leading-snug ${CHECK_LOOK[selected.verification.status].text}`}>{selected.verification.detail}</p>
                  <button type="button" onClick={() => void verify(selected.id)} disabled={busyId === selected.id} className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-40">
                    {busyId === selected.id ? 'Checking…' : 'Check again'}
                  </button>
                </div>
              )}

              <fieldset className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <legend className="px-1 text-[11.5px] font-medium text-slate-700">Available to projects</legend>
                {projects.length === 0 ? <p className="text-[11px] text-slate-500">Add a project to choose where this connection is used.</p> : <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                  {projects.map((item) => <li key={item.id}><label className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-[12px] text-slate-700 hover:bg-white">
                    <input type="checkbox" checked={!(optOut[item.id] ?? []).includes(selected.id)} onChange={(event) => void setProjectAccess(item.id, selected.id, event.target.checked)} />
                    <span className="min-w-0 flex-1 truncate" title={item.path}>{item.name}</span>
                  </label></li>)}
                </ul>}
                <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">Unchecked projects do not receive this connection. A project's agent picks up the change the next time it starts.</p>
              </fieldset>

              <div className="mt-4 space-y-2.5">
                {selected.fields.map((field) => {
                  const saved = selected.configuredFields.includes(field.key)
                  const draft = drafts[selected.id] ?? {}
                  return (
                    <div key={field.key}>
                      <label className="block text-[11px] font-medium text-slate-500" htmlFor={`${selected.id}-${field.key}`}>
                        {field.label}{saved && <span className="ml-1.5 font-normal text-emerald-600">saved</span>}
                      </label>
                      <input
                        id={`${selected.id}-${field.key}`}
                        type={field.secret ? 'password' : 'text'}
                        value={draft[field.key] ?? ''}
                        onChange={(event) => setDraft(selected.id, field.key, event.target.value)}
                        placeholder={saved ? 'Saved - type a new value to replace it' : field.placeholder}
                        autoComplete="off"
                        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-accent-400"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                {selected.configuredFields.length > 0 && (
                  <button type="button" onClick={() => void remove(selected.id)} disabled={busyId === selected.id} className="h-8 rounded-xl px-3 text-[11.5px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40">
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void save(selected.id)}
                  disabled={!Object.values(drafts[selected.id] ?? {}).some((v) => v.trim()) || busyId === selected.id}
                  className="h-8 rounded-xl bg-accent-600 px-4 text-[11.5px] font-medium text-white transition hover:bg-accent-500 disabled:opacity-40"
                >
                  {busyId === selected.id ? 'Saving and checking…' : 'Save'}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-3 flex gap-2" aria-label="Connection filters">
              <button type="button" aria-pressed={!savedOnly} onClick={() => setSavedOnly(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-700">All providers</button>
              <button type="button" aria-pressed={savedOnly} onClick={() => setSavedOnly(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-700">Saved connections</button>
            </div>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search the library…"
                aria-label="Search connection providers"
                className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-accent-400"
              />
            </div>

            {grouped.length === 0 ? (
              <InterfaceState title="No matching connections" description="Try another name or show all providers." action={<button type="button" onClick={() => { setSearch(''); setSavedOnly(false) }}>Clear filters</button>} />
            ) : (
              <div className="mt-5 space-y-6">
                {grouped.map(([category, providers]) => (
                  <div key={category}>
                    <h2 className="text-[14px] font-medium text-slate-500">{category}</h2>
                    <div className="connection-list mt-2 flex flex-col">
                      {providers.map((provider) => {
                        const connected = provider.configuredFields.length > 0
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setSelectedId(provider.id)}
                            className="flex flex-col items-start gap-2 border-b border-slate-200 bg-transparent px-0 py-4 text-left transition hover:bg-slate-50"
                          >
                            <div className="flex w-full items-center gap-2">
                              <ProviderLogo id={provider.id} className="h-5 w-5 shrink-0 text-slate-700" name={provider.name} category={provider.category} />
                              <span className="flex-1 truncate text-[14px] font-medium text-slate-900">{provider.name}</span>
                              <span className="shrink-0 text-[12px] text-slate-500">{!connected ? 'Not connected' : provider.configuredFields.length > 0 && provider.verification ? CHECK_LOOK[provider.verification.status].label : 'Saved, untested'}</span>
                            </div>
                            <p className="line-clamp-2 text-[14px] leading-5 text-slate-500">{provider.description}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
