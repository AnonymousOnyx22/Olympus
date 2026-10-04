import { useEffect, useMemo, useState } from 'react'
import type { ConnectionStatus } from '../types/opencode'
import { CONNECTION_LOGOS } from './connectionBrands'

const errorText = (error: unknown) => (error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error))

/**
 * Category tints for the monogram fallback. Colour is the fastest way to let a reader scan
 * a list of seventy rows, and it costs nothing where a drawn mark is not available.
 */
const CATEGORY_TINT: Record<string, string> = {
  Payments: 'bg-emerald-100 text-emerald-800',
  'Storefront platforms': 'bg-sky-100 text-sky-800',
  Marketplaces: 'bg-amber-100 text-amber-900',
  'Print on demand': 'bg-violet-100 text-violet-800',
  'Fulfillment & shipping': 'bg-indigo-100 text-indigo-800',
  'Media hosting': 'bg-cyan-100 text-cyan-900',
  'Marketing & social': 'bg-rose-100 text-rose-800',
  Email: 'bg-teal-100 text-teal-900',
  Analytics: 'bg-orange-100 text-orange-900',
  Support: 'bg-lime-100 text-lime-900',
  'Design assets': 'bg-fuchsia-100 text-fuchsia-900',
}

/** Up to two letters from the brand's own name, which is what a real monogram would use. */
function monogram(name: string, id: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? []
  if (words.length > 1) return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return name.slice(0, 2).toUpperCase() || id.slice(0, 2).toUpperCase()
}

function ProviderLogo({ id, className, name, category }: { id: string; className?: string; name?: string; category?: string }) {
  const Logo = CONNECTION_LOGOS[id]
  if (Logo) return <Logo className={className} />
  const label = name ?? id
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-full text-[9px] font-bold tracking-tight ${CATEGORY_TINT[category ?? ''] ?? 'bg-slate-100 text-slate-500'}`}
    >
      {monogram(label, id)}
    </span>
  )
}


/**
 * A continuous, non-interactive strip of every provider's mark - the same seamless-loop trick
 * as the marketing site's "Your tools" strip (two identical halves, translated by exactly -50%
 * so the wrap is invisible). Purely decorative: it conveys how much the library covers at a
 * glance, nothing here is clickable.
 */
function ProviderTicker({ connections }: { connections: ConnectionStatus[] }) {
  if (!connections.length) return null
  const half = (key: string) => (
    <div key={key} aria-hidden={key === 'b'} className="flex shrink-0 items-center gap-6 pr-6">
      {connections.map((provider) => (
        <span key={provider.id} className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-500">
          <ProviderLogo id={provider.id} className="h-4 w-4 shrink-0 text-slate-400" name={provider.name} category={provider.category} />
          {provider.name}
        </span>
      ))}
    </div>
  )
  // A fixed duration reads as "fast" once the library grows: the same seconds now have to
  // cover a longer strip, so pixel speed rises with every provider added. Scaling the
  // duration by how many there are keeps the crawl at a constant, readable pace regardless.
  const seconds = Math.max(24, connections.length * 1.6)
  return (
    <div
      className="mt-4 overflow-hidden rounded-xl bg-slate-50 py-2.5 ring-1 ring-slate-200"
      style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
    >
      <div className="flex w-max animate-marquee motion-reduce:animate-none" style={{ willChange: 'transform', animationDuration: `${seconds}s` }}>
        {half('a')}
        {half('b')}
      </div>
    </div>
  )
}

/**
 * Where real API keys and sign-ins (Stripe, Shopify, ...) live - never in a chat. A library of
 * providers grouped by category; picking one opens its own page of fields and, where it exists,
 * a "sign in directly" option. A key you save here is encrypted by this computer's own secret
 * storage and only ever decrypted to become an environment variable - automatically available
 * to every store's agent, nothing to switch on per store. It is never sent to a model or shown
 * in any chat.
 */
export default function ConnectionsSettings() {
  const [connections, setConnections] = useState<ConnectionStatus[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = () => window.electronAPI.listConnections().then(setConnections).catch((reason) => setError(errorText(reason)))
  useEffect(() => { void refresh() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (connections ?? []).filter((provider) =>
      (!savedOnly || provider.configuredFields.length > 0 || provider.browserSessionConnected) &&
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

  const signIn = async (providerId: string) => {
    setBusyId(providerId)
    setError('')
    try {
      // Resolves once the user closes the real sign-in window they were shown.
      setConnections(await window.electronAPI.openConnectionSignIn(providerId))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusyId(null)
    }
  }

  const forgetSignIn = async (providerId: string) => {
    setBusyId(providerId)
    setError('')
    try {
      setConnections(await window.electronAPI.forgetConnectionSignIn(providerId))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Connections</h1>
        <p className="mt-1 max-w-lg text-[12px] text-slate-500">
          Saved API keys are encrypted by this computer. Browser sessions are stored locally for your agents.
          Saved access is shared with every store; saving it does not verify that a service accepts it.
          Restart running agents after adding, changing or removing access so their connections are up to date.
        </p>

        {connections && <ProviderTicker connections={connections} />}

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} className="rounded text-rose-600 hover:text-rose-700">Dismiss</button>
          </div>
        )}

        {connections === null ? (
          <p className="mt-6 text-[12.5px] text-slate-500">Loading…</p>
        ) : selected ? (
          <div className="mt-6">
            <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-[12px] font-medium text-slate-500 transition hover:text-slate-900">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              All connections
            </button>

            <section className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-aegean">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-200">
                    <ProviderLogo id={selected.id} className="h-5 w-5 text-slate-700" name={selected.name} category={selected.category} />
                  </span>
                  <div>
                    <p className="text-[10.5px] font-medium uppercase tracking-wide text-slate-400">{selected.category}</p>
                    <h2 className="text-[16px] font-semibold text-slate-900">{selected.name}</h2>
                    <p className="mt-0.5 text-[12px] text-slate-500">{selected.description}</p>
                  </div>
                </div>
                {(selected.configuredFields.length > 0 || selected.browserSessionConnected) && (
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">Saved ? unverified</span>
                )}
              </div>

              {selected.supportsBrowserSignIn && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11.5px] font-medium text-slate-700">
                        Or sign in directly{selected.browserSessionConnected && <span className="ml-1.5 font-normal text-emerald-600">session saved ? unverified</span>}
                      </p>
                      <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500">
                        Opens a real {selected.name} login window - Olympus never sees the password, only the session.
                        This grants broader access than an API key, can get an account flagged or locked by {selected.name}'s
                        own bot checks, likely breaks its Terms of Service, and the session can expire and need signing in
                        again.
                      </p>
                    </div>
                    {selected.browserSessionConnected ? (
                      <button
                        type="button"
                        onClick={() => void forgetSignIn(selected.id)}
                        disabled={busyId === selected.id}
                        className="h-8 shrink-0 rounded-xl px-3 text-[11.5px] font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-40"
                      >
                        Forget
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void signIn(selected.id)}
                        disabled={busyId === selected.id}
                        className="h-8 shrink-0 rounded-xl bg-aether-600 px-3 text-[11.5px] font-medium text-white transition hover:bg-aether-500 disabled:opacity-40"
                      >
                        {busyId === selected.id ? 'Waiting…' : 'Sign in'}
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                        className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-aether-400"
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
                  className="h-8 rounded-xl bg-aether-600 px-4 text-[11.5px] font-medium text-white transition hover:bg-aether-500 disabled:opacity-40"
                >
                  {busyId === selected.id ? 'Saving…' : 'Save'}
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
                className="w-full rounded-xl bg-slate-50 py-2 pl-9 pr-3 text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-aether-400"
              />
            </div>

            {grouped.length === 0 ? (
              <p className="mt-6 text-[12.5px] text-slate-500">No provider matches “{search}”.</p>
            ) : (
              <div className="mt-5 space-y-6">
                {grouped.map(([category, providers]) => (
                  <div key={category}>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{category}</h2>
                    <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {providers.map((provider) => {
                        const connected = provider.configuredFields.length > 0 || provider.browserSessionConnected
                        return (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setSelectedId(provider.id)}
                            className="flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-aether-400 hover:shadow-aegean"
                          >
                            <div className="flex w-full items-center gap-2">
                              <ProviderLogo id={provider.id} className="h-4 w-4 shrink-0 text-slate-700" name={provider.name} category={provider.category} />
                              <span className="flex-1 truncate text-[12.5px] font-medium text-slate-900">{provider.name}</span>
                              {connected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Connected" aria-label="Connected" />}
                            </div>
                            <p className="line-clamp-2 text-[10.5px] leading-snug text-slate-500">{provider.description}</p>
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
