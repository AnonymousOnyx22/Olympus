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

let pool: typeof import('../electron/spacePool')

beforeEach(async () => {
  vi.resetModules()
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
})
