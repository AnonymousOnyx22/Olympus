import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'framer-motion'
import { brandFor, prettyModelName } from './brands'
import type { LocalProvider, ModelRef } from '../types/opencode'

interface ModelPickerProps {
  providers: LocalProvider[]
  selected: ModelRef | null
  variant: string | null
  onSelect: (model: ModelRef) => void
  onSelectVariant: (variant: string | null) => void
  onRescan: () => void
  rescanning: boolean
  onAddEndpoint: (name: string, baseURL: string) => Promise<void>
  onRemoveEndpoint: (id: string) => Promise<void>
  /** 'up' opens the menu above the button (for a bottom composer). */
  direction?: 'up' | 'down'
  /** Keep the menu in the viewport when this picker sits inside a scrolling card. */
  anchored?: boolean
}

interface Row {
  providerID: string
  providerName: string
  modelID: string
  access: 'local' | 'free' | 'api'
}

interface ModelPresentation {
  family: string
  version: string
  fullName: string
}

interface FamilyGroup {
  name: string
  rows: Row[]
}

interface BrandGroup {
  name: string
  families: FamilyGroup[]
}

const FAMILY_RULES: [RegExp, string][] = [
  [/\bopus\b/i, 'Opus'], [/\bsonnet\b/i, 'Sonnet'], [/\bhaiku\b/i, 'Haiku'],
  [/^gpt\b/i, 'GPT'], [/^gemini\b/i, 'Gemini'], [/^gemma\b/i, 'Gemma'],
  [/^llama\b/i, 'Llama'], [/^qwen/i, 'Qwen'], [/^deepseek\b/i, 'DeepSeek'],
  [/^mistral\b|^mixtral\b|^codestral\b/i, 'Mistral'], [/^grok\b/i, 'Grok'],
  [/^phi\b/i, 'Phi'], [/^command\b/i, 'Command'], [/^granite\b/i, 'Granite'],
]

const FAMILY_ORDER = ['Opus', 'Sonnet', 'Haiku']
const BRAND_ORDER = ['Anthropic', 'OpenAI', 'Google', 'xAI', 'DeepSeek', 'Qwen', 'Mistral AI', 'Meta']

const accessStyle = {
  local: { label: 'Local', className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  free: { label: 'Free', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  api: { label: 'API', className: 'bg-aether-50 text-aether-700 ring-aether-200' },
} as const

const VARIANT_DESCRIPTIONS: Record<string, string> = {
  none: 'No extended reasoning',
  minimal: 'Minimal reasoning',
  low: 'Fast, light reasoning',
  medium: 'Balanced reasoning',
  high: 'Deeper reasoning',
  xhigh: 'Extra-high reasoning',
  max: 'Maximum thinking budget',
}

function variantLabel(variant: string) {
  if (variant === 'xhigh') return 'Extra high'
  return variant.charAt(0).toUpperCase() + variant.slice(1)
}

function presentModel(modelID: string): ModelPresentation {
  const fullName = prettyModelName(modelID)
  const family = FAMILY_RULES.find(([pattern]) => pattern.test(fullName))?.[1]
    ?? fullName.split(/\s+/)[0]
    ?? 'Other'
  const withoutFamily = fullName
    .replace(/^Claude\s+/i, '')
    .replace(new RegExp(`^${family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '')
  const match = withoutFamily.match(/\b(?:v?\d+(?:\.\d+)+|[rvo]\d+|\d+)\b/i)
  return { family, version: (match?.[0]?.replace(/^v/i, '') ?? withoutFamily) || fullName, fullName }
}

const familyRank = (name: string) => {
  const index = FAMILY_ORDER.indexOf(name)
  return index < 0 ? FAMILY_ORDER.length : index
}

// ---- Favorites --------------------------------------------------------------
// A per-viewer preference, not app data, so it lives in localStorage exactly like the
// workspace/context panel toggles elsewhere in this app - every ModelPicker instance
// (the main composer, every agent pane) reads and writes the same key, so favoriting a
// model in one place shows it pinned everywhere else too.
const FAVORITES_KEY = 'olympus.favoriteModels'
const rowKey = (row: Pick<Row, 'providerID' | 'modelID'>) => `${row.providerID}::${row.modelID}`

function loadFavorites(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')
    return Array.isArray(saved) ? [...new Set(saved.filter((item): item is string => typeof item === 'string'))] : []
  } catch { return [] }
}

function saveFavorites(favorites: string[]) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) } catch { /* private mode, etc. - favorites just won't persist */ }
}

/** Filled gold when favorited; a faint outlined "holo" ring otherwise, so the affordance still
 * reads as clickable without competing with the gold state. */
function StarButton({ favorite, onClick, label }: { favorite: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={label}
      aria-pressed={favorite}
      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition ${
        favorite ? 'text-amber-400' : 'text-slate-300 ring-1 ring-inset ring-slate-200 hover:text-aether-400 hover:ring-aether-300'
      }`}
    >
      <motion.svg
        initial={false}
        animate={favorite ? { scale: [0.6, 1.15, 1], rotate: [0, -8, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill={favorite ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      >
        <path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8Z" />
      </motion.svg>
    </button>
  )
}

/**
 * `onEscape` defaults to `onClose` but can be overridden to also return focus to whatever
 * opened the popover - appropriate for a keyboard dismissal, but not for an outside click,
 * which already moves focus to wherever the user clicked.
 */
function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void, open: boolean, onEscape: () => void = onClose) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEscape()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [ref, onClose, onEscape, open])
}

function ModelRow({ row, active, index, onClick, favorite, onToggleFavorite }: {
  row: Row; active: boolean; index: number; onClick: () => void; favorite: boolean; onToggleFavorite: () => void
}) {
  const presentation = presentModel(row.modelID)
  const access = accessStyle[row.access]
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.022, duration: 0.18, ease: 'easeOut' }}
      className={`flex w-full items-center gap-1.5 rounded-lg py-1 pl-6 pr-2 text-left text-slate-900 transition-colors ${
        active ? 'bg-aether-50' : 'hover:bg-slate-50'
      }`}
    >
      <StarButton favorite={favorite} onClick={onToggleFavorite} label={`${favorite ? 'Remove' : 'Add'} ${presentation.fullName} ${favorite ? 'from' : 'to'} favorites`} />
      <button type="button" onClick={onClick} title={`${presentation.fullName} via ${row.providerName}`} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-aether-500' : 'bg-slate-300'}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] text-slate-900">{presentation.version}</span>
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-medium ring-1 ring-inset ${access.className}`}>{access.label}</span>
        {active && (
          <motion.svg initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} className="h-3.5 w-3.5 shrink-0 text-aether-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </motion.svg>
        )}
      </button>
    </motion.div>
  )
}

/** A pinned favorite: draggable, with the same content as a `ModelRow` but reorderable. */
function FavoriteRow({ row, active, onClick, onToggleFavorite }: { row: Row; active: boolean; onClick: () => void; onToggleFavorite: () => void }) {
  const presentation = presentModel(row.modelID)
  const access = accessStyle[row.access]
  return (
    <Reorder.Item
      value={row}
      layout
      whileDrag={{ scale: 1.03, boxShadow: '0 8px 20px -6px rgb(0 0 0 / 0.18)', zIndex: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      className={`flex w-full cursor-grab items-center gap-1.5 rounded-lg py-1 pl-1 pr-2 text-left text-slate-900 transition-colors active:cursor-grabbing ${
        active ? 'bg-aether-50' : 'hover:bg-slate-50'
      }`}
    >
      <svg className="h-3 w-3 shrink-0 text-slate-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>
      <StarButton favorite onClick={onToggleFavorite} label={`Remove ${presentation.fullName} from favorites`} />
      <button type="button" onClick={onClick} title={`${presentation.fullName} via ${row.providerName}`} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-aether-500' : 'bg-slate-300'}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12px] text-slate-900">{presentation.version}</span>
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-medium ring-1 ring-inset ${access.className}`}>{access.label}</span>
      </button>
    </Reorder.Item>
  )
}

function AddEndpoint({ onAddEndpoint, onDone }: { onAddEndpoint: ModelPickerProps['onAddEndpoint']; onDone: () => void }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('http://127.0.0.1:')
  const [error, setError] = useState<string | null>(null)
  const input = 'w-full rounded-xl bg-slate-50 px-2.5 py-1.5 text-[11.5px] text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-aether-400'
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await onAddEndpoint(name, url)
          onDone()
        } catch (err) {
          setError((err as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
        }
      }}
      className="space-y-1.5 p-2"
    >
      <input className={input} placeholder="Name (e.g. Jan, KoboldCpp)" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <input className={`${input} font-mono`} placeholder="http://127.0.0.1:5001/v1" value={url} onChange={(e) => setUrl(e.target.value)} />
      {error && <p className="text-[10.5px] text-rose-600">{error}</p>}
      <div className="flex gap-1.5">
        <button type="submit" className="flex-1 rounded-xl bg-aether-600 py-1.5 text-[11.5px] font-medium text-white transition hover:bg-aether-500">
          Connect
        </button>
        <button type="button" onClick={onDone} className="rounded-xl px-3 py-1.5 text-[11.5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function ModelPicker({ providers, selected, variant, onSelect, onSelectVariant, onRescan, rescanning, onAddEndpoint, onRemoveEndpoint, direction = 'up', anchored = false }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [variantOpen, setVariantOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [openFamilies, setOpenFamilies] = useState<Set<string>>(() => new Set())
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(() => loadFavorites())
  useEffect(() => saveFavorites(favoriteKeys), [favoriteKeys])
  const toggleFavorite = (row: Row) => {
    const key = rowKey(row)
    setFavoriteKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }
  const ref = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [anchor, setAnchor] = useState({ left: 8, bottom: 8 })
  const positionMenu = () => {
    const box = triggerRef.current?.getBoundingClientRect()
    if (box) setAnchor({ left: Math.max(8, Math.min(box.left, window.innerWidth - 328)), bottom: window.innerHeight - box.top + 8 })
  }
  useOutsideClose(ref, () => {
    setOpen(false)
    setVariantOpen(false)
  }, open || variantOpen, () => {
    setOpen(false)
    setVariantOpen(false)
    triggerRef.current?.focus()
  })

  const rows = useMemo<Row[]>(() => {
    const candidates = providers
      .filter((provider) => provider.online)
      .flatMap((provider) => provider.models.map((modelID): Row => ({
        providerID: provider.id,
        providerName: provider.name,
        modelID,
        access: provider.access?.[modelID] ?? (provider.source === 'local' ? 'local' : 'api'),
      })))
    const score = (row: Row) => {
      const brand = brandFor(row.modelID).name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const provider = `${row.providerID} ${row.providerName}`.toLowerCase().replace(/[^a-z0-9]/g, '')
      const isSelected = selected?.providerID === row.providerID && selected.modelID === row.modelID
      return (isSelected ? 100 : 0) + (row.access === 'local' ? 20 : 0) + (provider.includes(brand) ? 10 : 0)
    }
    const canonical = new Map<string, Row>()
    for (const row of candidates) {
      const key = `${brandFor(row.modelID).name}/${prettyModelName(row.modelID)}`.toLowerCase()
      const current = canonical.get(key)
      if (!current || score(row) > score(current)) canonical.set(key, row)
    }
    return [...canonical.values()]
  }, [providers, selected])
  // Favorites are pinned above everything else, in the order they were favorited (then however
  // the user has dragged them since). Only shown while browsing, not mid-search - a query already
  // narrows the list to what's relevant, and duplicating a favorite there would just be noise.
  const favoriteRows = useMemo(
    () => favoriteKeys.map((key) => rows.find((row) => rowKey(row) === key)).filter((row): row is Row => !!row),
    [favoriteKeys, rows],
  )
  const showFavorites = !query.trim() && favoriteRows.length > 0
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q ? rows.filter((row) => `${brandFor(row.modelID).name} ${prettyModelName(row.modelID)}`.toLowerCase().includes(q)) : rows
    return showFavorites ? base.filter((row) => !favoriteKeys.includes(rowKey(row))) : base
  }, [rows, query, showFavorites, favoriteKeys])
  const groups = useMemo<BrandGroup[]>(() => {
    const grouped = new Map<string, Map<string, Row[]>>()
    for (const row of filtered) {
      const brand = brandFor(row.modelID).name
      const family = presentModel(row.modelID).family
      const families = grouped.get(brand) ?? new Map<string, Row[]>()
      const familyRows = families.get(family) ?? []
      familyRows.push(row)
      families.set(family, familyRows)
      grouped.set(brand, families)
    }
    return [...grouped.entries()]
      .map(([name, families]) => ({
        name,
        families: [...families.entries()]
          .map(([family, familyRows]) => ({
            name: family,
            rows: familyRows.sort((a, b) => presentModel(b.modelID).version.localeCompare(presentModel(a.modelID).version, undefined, { numeric: true })),
          }))
          .sort((a, b) => familyRank(a.name) - familyRank(b.name) || a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        const aIndex = BRAND_ORDER.indexOf(a.name)
        const bIndex = BRAND_ORDER.indexOf(b.name)
        return (aIndex < 0 ? BRAND_ORDER.length : aIndex) - (bIndex < 0 ? BRAND_ORDER.length : bIndex) || a.name.localeCompare(b.name)
      })
  }, [filtered])

  useEffect(() => {
    if (!open) return
    const active = selected ? rows.find((row) => row.providerID === selected.providerID && row.modelID === selected.modelID) : null
    const row = active ?? rows[0]
    if (!row) return
    const key = `${brandFor(row.modelID).name}:${presentModel(row.modelID).family}`
    setOpenFamilies((current) => current.has(key) ? current : new Set([...current, key]))
  }, [open, rows, selected])

  const selectedBrand = selected ? brandFor(selected.modelID) : null
  const selectedAccess = selected
    ? providers.find((provider) => provider.id === selected.providerID)?.access?.[selected.modelID]
      ?? (providers.find((provider) => provider.id === selected.providerID)?.source === 'local' ? 'local' : 'api')
    : null
  const variants = selected
    ? providers.find((provider) => provider.id === selected.providerID)?.variants?.[selected.modelID] ?? []
    : []
  const offlineCustom = providers.some((p) => !p.online && p.custom)
  const customEndpoints = providers.filter((p) => p.custom)

  return (
    <div ref={ref} className="relative flex min-w-0 items-center gap-0.5">
      {variants.length > 0 && (
        <button
          type="button"
          onClick={() => {
            if (anchored) positionMenu()
            setOpen(false)
            setVariantOpen((value) => !value)
          }}
          className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11.5px] transition active:scale-[0.98] ${
            variantOpen ? 'bg-aether-50 text-aether-700 ring-1 ring-aether-200' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={`Thinking mode: ${variant ? variantLabel(variant) : 'Auto'}`}
          aria-label={`Thinking mode: ${variant ? variantLabel(variant) : 'Auto'}`}
          aria-expanded={variantOpen}
        >
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9.5 4.8A3.5 3.5 0 0 0 6 8.3v.5a3.1 3.1 0 0 0-1 5.9 3.7 3.7 0 0 0 4.5 4.5M14.5 4.8A3.5 3.5 0 0 1 18 8.3v.5a3.1 3.1 0 0 1 1 5.9 3.7 3.7 0 0 1-4.5 4.5M12 3v18M8 9.5c1.2.1 2.2.8 2.7 1.8M16 9.5c-1.2.1-2.2.8-2.7 1.8M8.8 15.7c.8-.5 1.4-1.2 1.6-2.1M15.2 15.7c-.8-.5-1.4-1.2-1.6-2.1" />
          </svg>
          <span>{variant ? variantLabel(variant) : 'Auto'}</span>
          <svg className={`h-3 w-3 text-slate-400 transition ${variantOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (anchored) positionMenu()
          setVariantOpen(false)
          setOpen((value) => !value)
        }}
        className="flex min-w-0 max-w-[280px] items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]"
        title="Choose a model"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedBrand ? (
          <selectedBrand.Logo className="h-4 w-4 shrink-0 text-slate-700" title={selectedBrand.name} />
        ) : (
          <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
        )}
        <span className="min-w-0 truncate text-[12.5px] font-medium text-slate-900">{selected ? prettyModelName(selected.modelID) : 'No model'}</span>
        {selectedAccess && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset ${accessStyle[selectedAccess].className}`}>{accessStyle[selectedAccess].label}</span>}
        <svg className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <AnimatePresence>
        {variantOpen && variants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: direction === 'up' ? 5 : -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: direction === 'up' ? 4 : -4 }}
            transition={{ type: 'spring', stiffness: 520, damping: 36 }}
            style={{ transformOrigin: direction === 'up' ? 'bottom left' : 'top left', ...(anchored ? { left: anchor.left, bottom: anchor.bottom, maxWidth: 'calc(100vw - 16px)' } : {}) }}
            className={`${anchored ? 'fixed' : 'absolute right-0'} z-40 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-aegean-lg ${
              anchored ? '' : direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <div className="px-2 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
              Thinking mode
            </div>
            {[null, ...variants].map((option) => {
              const active = option === variant
              const label = option ? variantLabel(option) : 'Auto'
              const description = option ? (VARIANT_DESCRIPTIONS[option] ?? `${label} reasoning`) : 'Use this provider\'s default'
              return (
                <button
                  type="button"
                  key={option ?? 'auto'}
                  onClick={() => {
                    onSelectVariant(option)
                    setVariantOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition ${
                    active ? 'bg-aether-50 text-slate-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-aether-500' : 'bg-slate-300'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[11.5px] font-medium ${active ? 'text-slate-900' : 'text-slate-700'}`}>{label}</span>
                    <span className="block truncate text-[10px] text-slate-400">{description}</span>
                  </span>
                  {active && (
                    <svg className="h-3.5 w-3.5 shrink-0 text-aether-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'up' ? 6 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: direction === 'up' ? 6 : -6 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            style={{ transformOrigin: direction === 'up' ? 'bottom left' : 'top left', ...(anchored ? { left: anchor.left, bottom: anchor.bottom, maxWidth: 'calc(100vw - 16px)' } : {}) }}
            className={`${anchored ? 'fixed' : 'absolute'} z-30 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-aegean-lg ${
              anchored ? '' : direction === 'up' ? 'bottom-full right-0 mb-2' : 'top-full right-0 mt-2'
            }`}
          >
            {adding ? (
              <AddEndpoint onAddEndpoint={onAddEndpoint} onDone={() => setAdding(false)} />
            ) : (
              <>
                <div className="border-b border-slate-200 p-2">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-aether-400">
                    <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
                    <input
                      type="search"
                      aria-label="Search models"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search models…"
                      autoFocus
                      className="w-full bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-[320px] space-y-0.5 overflow-y-auto p-2">
                  {showFavorites && (
                    <section className="mb-2 border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
                        <svg className="h-3 w-3 text-amber-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6-4.4-4.2 6-.8Z" /></svg>
                        Favorites
                      </div>
                      <Reorder.Group
                        axis="y"
                        values={favoriteRows}
                        onReorder={(next) => setFavoriteKeys(next.map(rowKey))}
                        className="space-y-0.5"
                      >
                        {favoriteRows.map((row) => (
                          <FavoriteRow
                            key={rowKey(row)}
                            row={row}
                            active={selected?.providerID === row.providerID && selected.modelID === row.modelID}
                            onClick={() => {
                              onSelect({ providerID: row.providerID, modelID: row.modelID })
                              setOpen(false)
                            }}
                            onToggleFavorite={() => toggleFavorite(row)}
                          />
                        ))}
                      </Reorder.Group>
                    </section>
                  )}
                  {filtered.length === 0 && favoriteRows.length === 0 ? (
                    <div className="px-2 py-6 text-center">
                      <p className="text-[12px] text-slate-500">{rows.length === 0 ? 'No local models found' : 'No matches'}</p>
                      {rows.length === 0 && (
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Start Ollama or LM Studio, then rescan below.</p>
                      )}
                    </div>
                  ) : (
                    groups.map((group, groupIndex) => {
                      const sample = group.families[0]?.rows[0]
                      const BrandLogo = sample ? brandFor(sample.modelID).Logo : null
                      return (
                        <section key={group.name} className={groupIndex === 0 ? '' : 'mt-2 border-t border-slate-200 pt-2'}>
                          <div className="flex items-center gap-2 px-2.5 pb-1.5 pt-0.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-slate-500">
                            {BrandLogo && <BrandLogo className="h-3.5 w-3.5 text-slate-400" title={group.name} />}
                            {group.name}
                          </div>
                          <div className="space-y-0.5">
                            {group.families.map((family) => {
                              const key = `${group.name}:${family.name}`
                              const expanded = !!query.trim() || openFamilies.has(key)
                              const activeFamily = family.rows.some((row) => selected?.providerID === row.providerID && selected.modelID === row.modelID)
                              return (
                                <div key={key}>
                                  <button
                                    type="button"
                                    onClick={() => setOpenFamilies((current) => {
                                      const next = new Set(current)
                                      if (next.has(key)) next.delete(key)
                                      else next.add(key)
                                      return next
                                    })}
                                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${activeFamily ? 'text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                                  >
                                    <motion.svg animate={{ rotate: expanded ? 90 : 0 }} className="h-3 w-3 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="currentColor"><path d="M8 4l10 8-10 8z" /></motion.svg>
                                    <span className="text-[12px] font-medium">{family.name}</span>
                                    <span className="ml-auto font-mono text-[9.5px] text-slate-400">{family.rows.length}</span>
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {expanded && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="overflow-hidden">
                                        <div className="space-y-0.5 pb-1">
                                          {family.rows.map((row, index) => (
                                            <ModelRow
                                              key={`${row.providerID}/${row.modelID}`}
                                              row={row}
                                              index={index}
                                              active={selected?.providerID === row.providerID && selected.modelID === row.modelID}
                                              favorite={favoriteKeys.includes(rowKey(row))}
                                              onToggleFavorite={() => toggleFavorite(row)}
                                              onClick={() => {
                                                onSelect({ providerID: row.providerID, modelID: row.modelID })
                                                setOpen(false)
                                              }}
                                            />
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })
                  )}
                </div>

                {customEndpoints.length > 0 && (
                  <div className="border-t border-slate-200 px-2 py-1.5">
                    {customEndpoints.map((endpoint) => (
                      <div key={endpoint.id} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[10.5px] text-slate-500">
                        <span className="min-w-0 flex-1 truncate" title={endpoint.baseURL}>{endpoint.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEndpointError(null)
                            void onRemoveEndpoint(endpoint.id).catch((error) =>
                              setEndpointError(error instanceof Error ? error.message : String(error)),
                            )
                          }}
                          className="rounded-lg px-1.5 py-0.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          title={`Remove ${endpoint.name}`}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {endpointError && <p className="px-1.5 py-1 text-[10.5px] text-rose-600">{endpointError}</p>}
                  </div>
                )}

                <div className="flex items-center gap-1 border-t border-slate-200 p-1.5">
                  <button
                    type="button"
                    onClick={onRescan}
                    disabled={rescanning}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  >
                    <svg className={`h-3.5 w-3.5 ${rescanning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>
                    {rescanning ? 'Scanning…' : 'Rescan'}
                  </button>
                  <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    Add endpoint
                  </button>
                  {offlineCustom && <span className="ml-auto pr-1.5 text-[10px] text-amber-600">some endpoints offline</span>}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
