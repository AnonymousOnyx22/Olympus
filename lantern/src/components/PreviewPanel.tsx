import { useCallback, useEffect, useState } from 'react'

interface PreviewPanelProps {
  projectKey: string
  available: boolean
  visible: boolean
}

function normalizeLocalUrl(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `http://${value}`)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return null
    return url.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export default function PreviewPanel({ projectKey, available, visible }: PreviewPanelProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [checking, setChecking] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const discover = useCallback(async () => {
    setChecking(true)
    setError(null)
    try {
      const found = await window.electronAPI.discoverPreview()
      if (found) {
        setUrl(found)
        setDraft(found)
      }
      return found
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return null
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    setUrl(null)
    setDraft('')
  }, [projectKey])

  useEffect(() => {
    if (!visible || !available || url) return
    let cancelled = false
    let tries = 0
    const look = async () => {
      if (cancelled) return
      const found = await discover()
      tries += 1
      if (!cancelled && !found && tries < 10) window.setTimeout(() => void look(), 1200)
    }
    void look()
    return () => { cancelled = true }
  }, [available, discover, projectKey, url, visible])

  const openDraft = () => {
    const normalized = normalizeLocalUrl(draft.trim())
    if (!normalized) {
      setError('Preview only opens localhost addresses.')
      return
    }
    setError(null)
    setUrl(normalized)
    setDraft(normalized)
  }

  if (!available) return <div className="grid h-full place-items-center text-xs text-slate-500">Open a saved project to start Live Preview.</div>

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2">
        <button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={!url} title="Refresh preview" className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m2 6a7 7 0 0 0 12 2.5L20 15" /></svg>
        </button>
        <form className="flex min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); openDraft() }}>
          <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="localhost:5173" className="h-7 w-full rounded-xl bg-slate-50 px-3 font-mono text-[10.5px] text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-aether-400" />
        </form>
        <button type="button" onClick={() => void discover()} disabled={checking} className="h-7 rounded-lg px-2.5 text-[10.5px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40">
          {checking ? 'Finding…' : 'Auto-find'}
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        {url ? (
          <iframe key={`${url}:${refresh}`} src={url} title="Local project preview" sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts" className="h-full w-full border-0 bg-white" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-aether-50 text-aether-500 ring-1 ring-aether-100">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 5h18v14H3V5Z" /><path d="M3 9h18M7 7h.01M10 7h.01" /></svg>
            </div>
            <div>
              <p className="text-[13px] text-slate-500">Waiting for a local preview</p>
              <p className="mt-1 text-[11px] text-slate-400">Run the project and Olympus will connect automatically.</p>
            </div>
          </div>
        )}
        {error && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-700 ring-1 ring-rose-200">{error}</div>}
      </div>
    </div>
  )
}
