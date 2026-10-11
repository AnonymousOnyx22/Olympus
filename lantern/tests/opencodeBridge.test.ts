// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OpencodeBridge } from '../electron/opencodeBridge'

let server: http.Server
let base: string
let seen: { method?: string; url?: string; auth?: string; body: string }[]
const credentials = { username: 'kern', password: 'secret' }

beforeEach(async () => {
  seen = []
  server = http.createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, body })
      if (req.url === '/session') { res.setHeader('content-type', 'application/json'); res.end('[{"id":"s1"}]'); return }
      if (req.url === '/session/status') { res.statusCode = 500; res.end('{"message":"boom"}'); return }
      if (req.url === '/event') { res.setHeader('content-type', 'text/event-stream'); res.write('data: {"type":"server.connected"}\n\n'); return }
      res.statusCode = 404; res.end('')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(() => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }))

const bridge = () => new OpencodeBridge(() => undefined, () => undefined, () => undefined)

describe('OpencodeBridge.request', () => {
  it('refuses while no daemon is attached', async () => {
    expect(await bridge().request('GET', '/session')).toMatchObject({ ok: false, error: 'opencode daemon is not running' })
  })

  it('sends the per-launch basic-auth credential and returns parsed JSON', async () => {
    const b = bridge(); b.attach(base, credentials)
    const result = await b.request('GET', '/session')
    expect(result).toMatchObject({ ok: true, status: 200, data: [{ id: 's1' }] })
    expect(seen.find((entry) => entry.url === '/session')?.auth).toBe(`Basic ${Buffer.from('kern:secret').toString('base64')}`)
    b.detach()
  })

  it('reports an HTTP error with the daemon message', async () => {
    const b = bridge(); b.attach(base, credentials)
    const result = await b.request('GET', '/session/status')
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.error).toContain('boom')
    b.detach()
  })

  it('does not forward routes outside the allow-list, nor paths that are not absolute', async () => {
    const b = bridge(); b.attach(base, credentials)
    expect((await b.request('GET', '/global/dispose')).error).toContain('route not allowed')
    expect((await b.request('GET', 'session')).error).toBe('path must start with /')
    expect(seen.filter((entry) => entry.url !== '/event')).toHaveLength(0)
    b.detach()
  })
})
