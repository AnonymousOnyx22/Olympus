import { useEffect, useState } from 'react'
import { AgentPane } from './AgentWorkspace'
import ModelPicker from './ModelPicker'
import StoreCard from './StoreCard'
import StoreConnectionsButton from './StoreConnectionsButton'
import { buildStationBrief } from '../services/stationBrief'
import type { AgentGridEntry } from './AllAgentsGrid'
import type { LocalProvider, ModelRef, ProjectInfo } from '../types/opencode'

export type StationTarget = { root: string; name: string } | { projectId: string }

interface Props {
  visible: boolean
  overviewSignal: number
  agents: AgentGridEntry[]
  busy: Record<string, Record<string, boolean>>
  pausedStoreIds: string[]
  onSetPaused: (spaceId: string, paused: boolean) => Promise<void>
  /** Stops the store's agent, unlists it, and - if deleteFiles is true - deletes its folder. */
  onDeleteStore: (spaceId: string, deleteFiles: boolean) => Promise<void>
  managedStoreChecks: Record<string, number>
  onSetManaged: (spaceId: string, enabled: boolean) => void
  model: ModelRef | null
  variant: string | null
  stationModels: Record<string, { model: ModelRef; variant: string | null }>
  stores: ProjectInfo[]
  providers: LocalProvider[]
  rescanning: boolean
  onRescan: () => void
  onAddEndpoint: (name: string, baseURL: string) => Promise<void>
  onRemoveEndpoint: (id: string) => Promise<void>
  onLaunch: (target: StationTarget, title: string, brief: string, model: ModelRef, variant: string | null) => Promise<string>
  onModelChange: (key: string, model: ModelRef, variant: string | null) => void
  /** Store id to select, with a counter that changes on every request. */
  focusStoreId?: string | null
  focusSignal?: number
}

const keyOf = (agent: AgentGridEntry) => JSON.stringify([agent.spaceId, agent.sessionId])
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-aether-500 focus:ring-2 focus:ring-aether-100'

export default function StationView(props: Props) {
  const [selected, setSelected] = useState<string>('overview')
  const [showNew, setShowNew] = useState(false)
  const [targetStoreId, setTargetStoreId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [request, setRequest] = useState('')
  const [root, setRoot] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [chosenModel, setChosenModel] = useState<ModelRef | null>(props.model)
  const [chosenVariant, setChosenVariant] = useState<string | null>(props.variant)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { if (!chosenModel && props.model) setChosenModel(props.model) }, [chosenModel, props.model])
  // Bumped from outside (the Station nav icon, or the sidebar's Stores label) to jump to the
  // overview grid regardless of whatever this view was last showing.
  useEffect(() => { if (props.overviewSignal) { setSelected('overview'); setShowNew(false); setTargetStoreId(null) } }, [props.overviewSignal])

  useEffect(() => {
    if (!props.visible) return
    let active = true
    void window.electronAPI.listProjectRoots().then((list) => {
      if (!active) return
      setRoot(list[0] ?? '')
    }).catch(() => { if (active) setRoot('') })
    return () => { active = false }
  }, [props.visible])

  // A store opened from outside -- the sidebar's store list -- selects that store's manager
  // rather than the overview. The counter makes clicking the same store twice re-trigger it.
  useEffect(() => {
    if (!props.focusSignal || !props.focusStoreId) return
    setSelected(props.focusStoreId)
    setShowNew(false)
    setTargetStoreId(null)
  }, [props.focusSignal, props.focusStoreId])

  const selectedAgent = props.agents.find((agent) => keyOf(agent) === selected || agent.spaceId === selected) ?? null
  const creating = showNew || (props.agents.length === 0 && props.stores.length === 0 && selected === 'overview')
  const title = name.trim() || request.trim().replace(/\s+/g, ' ').slice(0, 72)
  // The name the user gave is the best folder name. Only fall back to their prompt when
  // they left it blank, and take three words so it never ends mid-sentence: "Build a small
  // online store called..." used to become build-a-small-online-murqxud7.
  const folderBase = (name.trim() || title).replace(/[^\w\s-]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  const folder = `${folderBase || 'store'}-${Date.now().toString(36)}`
  const canStart = !!chosenModel && !!request.trim() && (!!targetStoreId || !!root)
  const storeCount = new Set([...props.stores.map((store) => store.id), ...props.agents.map((agent) => agent.spaceId)]).size
  const workingStoreCount = new Set(props.agents.filter((agent) => props.busy[agent.spaceId]?.[agent.sessionId]).map((agent) => agent.spaceId)).size

  const start = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canStart || starting || !chosenModel) return
    setStarting(true)
    setError('')
    const brief = buildStationBrief({ name: name.trim(), request })
    try {
      const key = await props.onLaunch(targetStoreId ? { projectId: targetStoreId } : { root, name: folder }, title, brief, chosenModel, chosenVariant)
      setSelected(key)
      setShowNew(false)
      setTargetStoreId(null)
      setName('')
      setRequest('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(reason))
    } finally { setStarting(false) }
  }

  if (!props.visible) return null

  const goOverview = () => { setSelected('overview'); setShowNew(false); setTargetStoreId(null) }
  const goNew = () => { setTargetStoreId(null); setShowNew(true); setError('') }

  const runDelete = async (deleteFiles: boolean) => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await props.onDeleteStore(deleteTarget.id, deleteFiles)
      setDeleteTarget(null)
      goOverview()
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setDeleting(false)
    }
  }

  return <section aria-label="Station" className="flex h-full min-h-0 flex-col bg-midnight text-slate-900">
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
      <div className="min-w-0 flex-1"><h1 className="font-serif text-[22px] leading-tight text-slate-900">Station</h1><p className="text-[11.5px] text-slate-500">Describe a store. Your Station agent builds it in its own project and chat.</p></div>
      {(props.agents.length > 0 || props.stores.length > 0) && <button type="button" onClick={goOverview} className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50">All stores</button>}
      <button type="button" onClick={goNew} className="rounded-xl bg-aether-600 px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-aether-500">New store</button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
        {creating ? <div className="mx-auto flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-aegean">
          <div className="border-b border-slate-100 px-5 py-3.5 md:px-7"><h2 className="font-serif text-[18px] text-slate-900">{targetStoreId ? 'Continue this store' : 'What should we build?'}</h2><p className="mt-0.5 text-[11.5px] text-slate-500">Describe the store and where you want it to sell. Station will handle the build and ask when account access is needed.</p></div>
          <form onSubmit={start} className="flex min-h-0 flex-1 flex-col gap-2.5 px-5 py-4 md:px-7">
            <div><label htmlFor="station-request" className="mb-1.5 block text-[12px] font-medium">Tell the agent what you want</label><textarea id="station-request" value={request} onChange={(event) => setRequest(event.target.value)} rows={3} placeholder="A sticker shop for book lovers, ten designs, warm colours, sold as singles and gift bundles…" className={`${field} resize-y leading-relaxed`} /><p className="mt-1 text-[11px] text-slate-500">Name a platform or service if you have one in mind, or leave it to the agent to choose.</p></div>
            <div><label htmlFor="station-name" className="mb-1.5 block text-[12px] font-medium">Store name <span className="font-normal text-slate-400">(optional)</span></label><input id="station-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Let the agent name it" className={field} maxLength={120} /></div>
            
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3"><span className="text-[12px] font-medium">Managing model</span><ModelPicker providers={props.providers} selected={chosenModel} variant={chosenVariant} onSelect={(next) => { setChosenModel(next); setChosenVariant(null) }} onSelectVariant={setChosenVariant} onRescan={props.onRescan} rescanning={props.rescanning} onAddEndpoint={props.onAddEndpoint} onRemoveEndpoint={props.onRemoveEndpoint} direction="up" anchored /></div>
            {!chosenModel && <p className="text-[12px] text-amber-700">Select a model to start your Station agent.</p>}
            {error && <p role="alert" className="text-[12px] text-rose-700">{error}</p>}
            <div className="sticky bottom-0 z-10 -mx-5 mt-auto flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-5 py-2.5 shadow-[0_-8px_20px_rgba(2,6,23,0.45)] md:-mx-7 md:px-7">{(props.agents.length > 0 || props.stores.length > 0) && <button type="button" onClick={() => { setShowNew(false); setTargetStoreId(null) }} className="rounded-xl px-4 py-2 text-[12px] text-slate-600 hover:bg-slate-100">Cancel</button>}<button type="submit" disabled={!canStart || starting} className="rounded-xl bg-aether-600 px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-aether-500 disabled:opacity-40">{starting ? 'Starting…' : 'Build my store'}</button></div>
          </form>
        </div> : selectedAgent ? <div className="mx-auto flex h-full min-h-0 max-w-5xl flex-col gap-2">
          <div className="flex shrink-0 items-center justify-end gap-2 px-1"><StoreConnectionsButton projectId={selectedAgent.spaceId} /><button type="button" onClick={() => void window.electronAPI.revealProject(selectedAgent.spaceId).catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)))} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">Open store folder</button><button type="button" onClick={() => setDeleteTarget({ id: selectedAgent.spaceId, name: selectedAgent.projectName || selectedAgent.title })} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50">Delete store</button></div>
          {error && <p role="alert" className="px-1 text-[11px] text-rose-700">{error}</p>}
          <AgentPane key={keyOf(selectedAgent)} stationMode mode="agent" spaceId={selectedAgent.spaceId} sessionID={selectedAgent.sessionId} title={selectedAgent.title} projectName={selectedAgent.projectName} projectPath={selectedAgent.projectPath} ready={selectedAgent.ready} deleting={false}
          startError={selectedAgent.startError} onRetryStart={selectedAgent.onRetryStart} paused={selectedAgent.paused} onResume={selectedAgent.onResume}
          defaultModel={props.stationModels[keyOf(selectedAgent)]?.model ?? props.model} defaultVariant={props.stationModels[keyOf(selectedAgent)] ? props.stationModels[keyOf(selectedAgent)].variant : props.variant} providers={props.providers} rescanning={props.rescanning} onRescan={props.onRescan} onAddEndpoint={props.onAddEndpoint} onRemoveEndpoint={props.onRemoveEndpoint} onStationModelChange={(next, variant) => props.onModelChange(keyOf(selectedAgent), next, variant)}
          onReviewEdits={() => {}} onOpenProjects={() => {}} goToProject={() => {}} onClose={() => {}} onDelete={() => {}} /></div> : <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-aether-700">Store operations</p><h2 className="mt-1 font-serif text-[27px] text-slate-900">Your stores at a glance</h2><p className="mt-1 text-[12px] text-slate-500">Open a store to watch its agents. Put a store under 24/7 management and its agents keep watching, checking, and working on it the whole time Olympus is open.</p></div><div className="flex gap-2 text-[11px]"><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-700">{storeCount} stores</span><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-emerald-600">{workingStoreCount} working</span><span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-500">{props.pausedStoreIds.length} stopped</span></div></div>
          <div role="region" aria-label="Store overview" className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">{props.agents.map((agent) => <StoreCard key={keyOf(agent)} agent={agent} model={props.stationModels[keyOf(agent)]?.model ?? props.model} busy={!!props.busy[agent.spaceId]?.[agent.sessionId]} paused={props.pausedStoreIds.includes(agent.spaceId)} dailyCheck={Object.hasOwn(props.managedStoreChecks, agent.spaceId)} onSetDailyCheck={(enabled) => props.onSetManaged(agent.spaceId, enabled)} onOpen={() => setSelected(keyOf(agent))} onSetPaused={(paused) => props.onSetPaused(agent.spaceId, paused)} onDelete={() => setDeleteTarget({ id: agent.spaceId, name: agent.projectName || agent.title })} />)}{props.stores.filter((store) => !props.agents.some((agent) => agent.spaceId === store.id)).map((store) => <article key={store.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-aegean"><div className="flex h-40 items-center justify-center bg-gradient-to-br from-slate-100 to-aether-50"><span className="font-serif text-4xl text-aether-300">◇</span></div><div className="p-4"><h3 className="font-serif text-[19px] text-slate-900">{store.name}</h3><p className="mt-1 text-[11px] text-amber-600">Manager setup unfinished</p><div className="mt-5 flex gap-2"><button type="button" onClick={() => { setTargetStoreId(store.id); setShowNew(true) }} className="rounded-lg bg-aether-600 px-3 py-2 text-[11px] font-semibold text-white">Continue setup</button><button type="button" onClick={() => setDeleteTarget({ id: store.id, name: store.name })} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-medium text-rose-600 hover:bg-rose-50">Delete</button></div></div></article>)}</div>
        </div>}
    </div>
    {deleteTarget && (
      <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/70 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
        <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-aegean-lg">
          <h3 className="text-[15px] font-semibold text-slate-900">Delete “{deleteTarget.name}”?</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">This stops its agent and removes it from Olympus either way. You can also delete its folder and everything in it - that part can't be undone.</p>
          {deleteError && <p role="alert" className="mt-2 text-[11.5px] text-rose-700">{deleteError}</p>}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" disabled={deleting} onClick={() => void runDelete(true)} className="rounded-xl bg-rose-600 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete everything, including the folder'}</button>
            <button type="button" disabled={deleting} onClick={() => void runDelete(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Remove from Olympus, keep the folder</button>
            <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-xl px-3 py-2 text-[12px] text-slate-500 transition hover:bg-slate-100 disabled:opacity-50">Cancel</button>
          </div>
        </div>
      </div>
    )}
  </section>
}
