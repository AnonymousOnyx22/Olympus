import { DaemonManager } from './daemonManager'
import { OpencodeBridge } from './opencodeBridge'
import type { DaemonState } from '../src/types/opencode'

/**
 * One `opencode serve` process + bridge per open space (project or General chats),
 * so several projects can run their own agent concurrently instead of sharing one
 * daemon that gets torn down and restarted on every switch.
 */
interface SpaceEntry {
  daemon: DaemonManager
  bridge: OpencodeBridge
  /** When this space was last started or focused, for idle eviction. */
  lastUsed: number
}

const pool = new Map<string, SpaceEntry>()

/**
 * How many daemons may run at once.
 *
 * Every visited project keeps its own `opencode serve` process alive, so without a ceiling a
 * long session accumulates one process (and one agent) per project the user has ever opened.
 * The cap is generous because each daemon is genuinely useful, but bounded because it is a
 * process per project.
 */
const MAX_RUNNING_DAEMONS = 4

let focusedSpaceId: string | null = null
/** Stops asking a daemon about its sessions until this timestamp. */
let busyCheckThrottledUntil = 0
const busyCache = new Map<string, { at: number; busy: boolean }>()

type Send = (channel: string, ...args: unknown[]) => void

let send: Send = () => {}
export function initSpacePool(sender: Send) {
  send = sender
}

/** Records which space is on screen, so eviction never takes away what the user is looking at. */
export function setFocused(spaceId: string) {
  focusedSpaceId = spaceId
  const entry = pool.get(spaceId)
  if (entry) entry.lastUsed = Date.now()
}

function ensure(spaceId: string): SpaceEntry {
  let entry = pool.get(spaceId)
  if (entry) {
    entry.lastUsed = Date.now()
    return entry
  }

  const daemon = new DaemonManager()
  const bridge = new OpencodeBridge(
    (event) => send('oc:event', spaceId, event),
    (ptyID, data) => send('pty:data', ptyID, data),
    (line) => send('daemon:log', spaceId, line),
    () => send('oc:resync', spaceId),
  )
  daemon.on('log', (line: string) => send('daemon:log', spaceId, line))
  daemon.on('state', () => {
    bridge.attach(daemon.baseUrl, daemon.getCredentials())
    send('daemon:state', spaceId, daemon.getState())
  })
  entry = { daemon, bridge, lastUsed: Date.now() }
  pool.set(spaceId, entry)
  return entry
}

/**
 * Asks a daemon whether any of its sessions are still working.
 *
 * Fails safe: anything other than a confident "nothing is running" counts as busy. Killing a
 * daemon mid-run would destroy work the user cannot get back, so an unreadable answer must
 * never be treated as permission to evict.
 */
async function isSpaceBusy(spaceId: string): Promise<boolean> {
  const entry = pool.get(spaceId)
  if (!entry) return false
  const cached = busyCache.get(spaceId)
  if (cached && Date.now() < busyCheckThrottledUntil) return cached.busy
  try {
    const res = await entry.bridge.request('GET', '/session/status')
    if (!res.ok || !res.data || typeof res.data !== 'object') return true
    const busy = Object.values(res.data as Record<string, { type?: string } | null>).some(
      (status) => !!status?.type && status.type !== 'idle',
    )
    busyCache.set(spaceId, { at: Date.now(), busy })
    return busy
  } catch {
    return true
  }
}

function runningCount(): number {
  let count = 0
  for (const entry of pool.values()) {
    const status = entry.daemon.getState().status
    if (status === 'running' || status === 'starting') count += 1
  }
  return count
}

/**
 * Stops the least-recently-used idle daemons once more than the cap are running.
 *
 * Only genuinely idle, unfocused daemons are candidates, and a daemon whose busy state cannot
 * be confirmed is left alone. Everything evicted can be restarted transparently; the cost of
 * evicting is a few seconds, the cost of not evicting is unbounded process growth.
 */
export async function enforceBudget(): Promise<void> {
  if (runningCount() <= MAX_RUNNING_DAEMONS) return
  busyCheckThrottledUntil = Date.now() + 5_000

  const candidates = [...pool.entries()]
    .filter(([id, entry]) => {
      const status = entry.daemon.getState().status
      return id !== focusedSpaceId && (status === 'running' || status === 'starting')
    })
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed)

  for (const [id] of candidates) {
    if (runningCount() <= MAX_RUNNING_DAEMONS) break
    if (await isSpaceBusy(id)) continue
    await stop(id)
  }
}

export async function start(spaceId: string, dir: string, config: object): Promise<DaemonState> {
  const state = await ensure(spaceId).daemon.start(dir, config)
  // Opening one more project is when the ceiling can be crossed.
  void enforceBudget()
  return state
}

/** Stops and forgets a space's daemon, e.g. when its multi-project tab is closed. */
export async function stop(spaceId: string): Promise<void> {
  const entry = pool.get(spaceId)
  if (!entry) return
  pool.delete(spaceId)
  busyCache.delete(spaceId)
  entry.bridge.detach()
  await entry.daemon.stop().catch(() => entry.daemon.killNow())
}

export function state(spaceId: string): DaemonState {
  return pool.get(spaceId)?.daemon.getState() ?? { status: 'stopped', port: null, cwd: null }
}

export function baseUrl(spaceId: string): string | null {
  return pool.get(spaceId)?.daemon.baseUrl ?? null
}

export function credentials(spaceId: string) {
  return pool.get(spaceId)?.daemon.getCredentials() ?? null
}

export function bridge(spaceId: string): OpencodeBridge | null {
  return pool.get(spaceId)?.bridge ?? null
}

export function request(spaceId: string, method: string, path: string, body?: unknown) {
  const entry = pool.get(spaceId)
  if (!entry) return Promise.resolve({ ok: false, status: 0, data: null, error: 'opencode daemon is not running' })
  return entry.bridge.request(method, path, body)
}

export function isOpen(spaceId: string): boolean {
  return pool.has(spaceId)
}

export function openSpaceIds(): string[] {
  return [...pool.keys()]
}

/** Best-effort synchronous kill for process-exit paths where awaiting is impossible. */
export function killAllNow() {
  for (const entry of pool.values()) entry.daemon.killNow()
}

export async function stopAll(): Promise<void> {
  const ids = [...pool.keys()]
  await Promise.all(ids.map((id) => stop(id)))
}
