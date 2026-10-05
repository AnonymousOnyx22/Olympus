import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake daemons: start() marks a space running, stop() marks it stopped. Every space reports
// idle, so the only thing protecting a space from eviction is the pool's own rules.
vi.mock('../electron/daemonManager', () => {
  class DaemonManager {
    private status = 'stopped'
    baseUrl = 'http://127.0.0.1:0'
    on() { return this }
    getCredentials() { return { username: 'u', password: 'p' } }
    getState() { return { status: this.status, port: 1, cwd: '/x' } }
    async start() { this.status = 'running'; return this.getState() }
    async stop() { this.status = 'stopped' }
    killNow() { this.status = 'stopped' }
  }
  return { DaemonManager }
})
vi.mock('../electron/opencodeBridge', () => {
  class OpencodeBridge {
    attach() {}
    detach() {}
    async request() { return { ok: true, status: 200, data: {} } }
  }
  return { OpencodeBridge }
})

// Controllable from each test via __setStoreIds, so eviction-guard behavior can be checked
// against the main process's own store list rather than the renderer-pushed pinned set.
let mockStoreIds: string[] = []
vi.mock('../electron/projects', () => ({
  listStores: () => mockStoreIds.map((id) => ({ id, name: id, path: `/stores/${id}` })),
  __setStoreIds: (ids: string[]) => { mockStoreIds = ids },
}))

let pool: typeof import('../electron/spacePool')

beforeEach(async () => {
  vi.resetModules()
  mockStoreIds = []
  pool = await import('../electron/spacePool')
})

const startAll = async (ids: string[]) => {
  for (const id of ids) await pool.start(id, `/projects/${id}`, {})
  await pool.enforceBudget()
}

describe('daemon pool eviction', () => {
  it('stops the least recently used idle space once more than four are running', async () => {
    pool.setFocused('e')
    await startAll(['a', 'b', 'c', 'd', 'e'])
    expect(pool.state('a').status).toBe('stopped')
    expect(['b', 'c', 'd', 'e'].map((id) => pool.state(id).status)).toEqual(['running', 'running', 'running', 'running'])
  })

  it('never evicts a space that has agent windows open, even past the cap', async () => {
    // The "stuck on Connecting" loop: five projects with open windows used to evict each other.
    pool.setPinned(['a', 'b', 'c', 'd', 'e'])
    pool.setFocused('general')
    await startAll(['a', 'b', 'c', 'd', 'e', 'general'])
    expect(['a', 'b', 'c', 'd', 'e'].map((id) => pool.state(id).status)).toEqual(['running', 'running', 'running', 'running', 'running'])
  })

  it('still evicts unpinned idle spaces to make room', async () => {
    pool.setPinned(['b', 'c', 'd', 'e'])
    pool.setFocused('e')
    await startAll(['a', 'b', 'c', 'd', 'e'])
    expect(pool.state('a').status).toBe('stopped')
  })

  it('never evicts a store even if the renderer never pinned it', async () => {
    // The exact gap that let a 24/7 store go quiet: nothing marks it pinned, so without this
    // guard it is just the oldest unpinned idle space once the cap is crossed.
    const projects = await import('../electron/projects')
    ;(projects as unknown as { __setStoreIds: (ids: string[]) => void }).__setStoreIds(['a'])
    pool.setFocused('e')
    await startAll(['a', 'b', 'c', 'd', 'e'])
    expect(pool.state('a').status).toBe('running')
  })
})
