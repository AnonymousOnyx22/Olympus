import type { LocalEndpoint, LocalProvider } from '../src/types/opencode'

/** Default ports of the common local, OpenAI-compatible model servers. */
export const BUILTIN_ENDPOINTS: LocalEndpoint[] = [
  { id: 'ollama', name: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', baseURL: 'http://127.0.0.1:1234/v1' },
  { id: 'vllm', name: 'vLLM', baseURL: 'http://127.0.0.1:8000/v1' },
  { id: 'llamacpp', name: 'llama.cpp', baseURL: 'http://127.0.0.1:8080/v1' },
]

const PROBE_TIMEOUT_MS = 1500

function zeroCost(cost: unknown): boolean {
  const entries = Array.isArray(cost) ? cost : cost ? [cost] : []
  return entries.length > 0 && entries.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const price = entry as { input?: unknown; output?: unknown }
    return typeof price.input === 'number' && typeof price.output === 'number' && price.input === 0 && price.output === 0
  })
}

/** Classifies access without exposing provider credentials or pricing details to the renderer. */
export function modelAccess(metadata: unknown, local: boolean): 'local' | 'free' | 'api' {
  if (local) return 'local'
  if (metadata && typeof metadata === 'object') {
    const model = metadata as { id?: unknown; name?: unknown; cost?: unknown }
    if (zeroCost(model.cost) || /(?:^|[-_.\s])free(?:$|[-_.\s])/i.test(`${String(model.id ?? '')} ${String(model.name ?? '')}`)) return 'free'
  }
  return 'api'
}

// Embedding models can't drive an agent, so keep them out of the picker.
export const isChatModel = (id: string) => !/embed|bge-|nomic-embed|rerank/i.test(id)

async function probe(endpoint: LocalEndpoint): Promise<LocalProvider> {
  const url = endpoint.baseURL.replace(/\/+$/, '') + '/models'
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    if (!res.ok) return { ...endpoint, online: false, models: [], error: `HTTP ${res.status}` }
    const body = (await res.json()) as { data?: unknown }
    const models = (Array.isArray(body.data) ? body.data : [])
      .flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const id = (item as { id?: unknown }).id
        return typeof id === 'string' ? [id] : []
      })
      .filter(isChatModel)
      .sort()
    return { ...endpoint, online: true, models, access: Object.fromEntries(models.map((model) => [model, 'local' as const])) }
  } catch (err) {
    return { ...endpoint, online: false, models: [], error: (err as Error).message }
  }
}

/** Probes every known and user-added endpoint in parallel. */
export function discoverProviders(custom: LocalEndpoint[]): Promise<LocalProvider[]> {
  return Promise.all([...BUILTIN_ENDPOINTS, ...custom].map(probe))
}

interface DaemonProviderResponse {
  providers?: {
    id: string
    name?: string
    source?: string
    options?: { baseURL?: string }
    models?: Record<string, { id?: string; name?: string; cost?: unknown; variants?: Record<string, unknown> }>
  }[]
}

/**
 * Asks the running opencode daemon which providers/models it actually knows about.
 * This is the source that surfaces anything configured through the opencode CLI
 * (e.g. an authenticated OpenCode Zen account), which local port-probing can't see.
 */
export async function fetchDaemonProviders(baseUrl: string): Promise<LocalProvider[]> {
  try {
    const res = await fetch(baseUrl + '/config/providers', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return []
    const body = (await res.json()) as DaemonProviderResponse
    return (body.providers ?? []).map((p) => {
      const baseURL = p.options?.baseURL ?? ''
      const isLocal = /127\.0\.0\.1|localhost|0\.0\.0\.0/.test(baseURL)
      return {
        id: p.id,
        name: p.name || p.id,
        baseURL,
        online: true,
        models: Object.keys(p.models ?? {}).filter(isChatModel).sort(),
        variants: Object.fromEntries(
          Object.entries(p.models ?? {}).flatMap(([modelID, metadata]) => {
            const variants = metadata?.variants
            return variants && typeof variants === 'object' ? [[modelID, Object.keys(variants)]] : []
          }),
        ),
        access: Object.fromEntries(
          Object.entries(p.models ?? {}).map(([modelID, metadata]) => [modelID, modelAccess(metadata, isLocal)]),
        ),
        source: isLocal ? ('local' as const) : ('opencode' as const),
      }
    })
  } catch {
    return []
  }
}

/**
 * The full picker list: providers the daemon knows (authoritative) with local port
 * discoveries layered in. Local endpoints come first so a local model stays the default,
 * and offline local endpoints remain visible as hints to start a server.
 */
export function mergeProviders(daemon: LocalProvider[], local: LocalProvider[]): LocalProvider[] {
  const byId = new Map(daemon.map((p) => [p.id, p]))
  const merged: LocalProvider[] = []
  const seen = new Set<string>()
  for (const p of local) {
    merged.push(byId.get(p.id) ?? p) // daemon data wins when it knows this endpoint
    seen.add(p.id)
  }
  for (const p of daemon) if (!seen.has(p.id)) merged.push(p)
  return merged
}

/** Turns an arbitrary display name into a provider id that is safe for opencode config. */
export function slugifyProviderId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'local'
  let id = base
  for (let i = 2; taken.includes(id); i++) id = `${base}-${i}`
  return id
}
