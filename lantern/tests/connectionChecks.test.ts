import { describe, expect, it } from 'vitest'
import { checkConnection } from '../electron/connectionChecks'

const reply = (status: number, body: unknown = {}) => async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const seen: { url: string; headers: Record<string, string> }[] = []
const spy = (inner: () => Promise<Response>) => async (url: unknown, init?: RequestInit) => {
  seen.push({ url: String(url), headers: (init?.headers ?? {}) as Record<string, string> })
  return inner()
}

describe('checkConnection', () => {
  it('verifies a Stripe test key and says no real money moves', async () => {
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'sk_test_abc' }, reply(200) as never)
    expect(result.status).toBe('verified')
    expect(result.detail).toContain('test mode')
  })

  it('warns loudly when the verified Stripe key is live', async () => {
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'sk_live_abc' }, reply(200) as never)
    expect(result.status).toBe('verified')
    expect(result.detail).toContain('LIVE')
    expect(result.detail).toContain('real money')
  })

  it('fails a Stripe pair whose secret and publishable keys are different modes, without calling Stripe', async () => {
    seen.length = 0
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_PUBLISHABLE_KEY: 'pk_live_abc' }, spy(reply(200)) as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('must match')
    expect(seen).toHaveLength(0)
  })

  it('fails something that is not a Stripe key at all', async () => {
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'hello' }, reply(200) as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('sk_test_')
  })

  it('reports a rejected key as failed, with the service message and never the key', async () => {
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'sk_test_secretvalue' }, reply(401, { error: { message: 'Invalid API Key provided' } }) as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('rejected this key (401)')
    expect(result.detail).toContain('Invalid API Key provided')
    expect(result.detail).not.toContain('secretvalue')
  })

  it('strips a masked copy of the key that the service echoes back', async () => {
    const echo = reply(401, { error: { message: 'Invalid API Key provided: sk_test_ab************cd' } })
    const result = await checkConnection('stripe', { STRIPE_SECRET_KEY: 'sk_test_abxxxxxxxxxxxxcd' }, echo as never)
    expect(result.detail).toContain('(key hidden)')
    expect(result.detail).not.toContain('sk_test_ab')
    expect(result.detail).not.toContain('****')
  })

  it('treats a Cloudflare 400 as a rejected token', async () => {
    const result = await checkConnection('cloudflare-pages', { CLOUDFLARE_API_TOKEN: 'x' }, reply(400, { success: false, errors: [{ message: 'Invalid request headers' }] }) as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('rejected this token')
  })

  it('reports an unreachable service as failed and says nothing was verified', async () => {
    const down = async () => { throw new Error('getaddrinfo ENOTFOUND api.netlify.com') }
    const result = await checkConnection('netlify', { NETLIFY_AUTH_TOKEN: 'abc' }, down as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('Nothing was verified')
  })

  it('sends the token as a bearer header to the right service', async () => {
    seen.length = 0
    await checkConnection('netlify', { NETLIFY_AUTH_TOKEN: 'tok123' }, spy(reply(200, { email: 'a@b.c' })) as never)
    expect(seen[0].url).toBe('https://api.netlify.com/api/v1/user')
    expect(seen[0].headers.authorization).toBe('Bearer tok123')
  })

  it('says a connection is incomplete when a required field is empty, and does not call out', async () => {
    seen.length = 0
    const result = await checkConnection('cloudflare-pages', {}, spy(reply(200)) as never)
    expect(result.status).toBe('incomplete')
    expect(result.detail).toContain('CLOUDFLARE_API_TOKEN')
    expect(seen).toHaveLength(0)
  })

  it('never claims a service with no automatic test is working', async () => {
    const result = await checkConnection('figma', { FIGMA_ACCESS_TOKEN: 'x' }, reply(200) as never)
    expect(result.status).toBe('unchecked')
    expect(result.detail).toContain('not tested')
  })
  it('verifies AI model keys against the right service and never echoes the key', async () => {
    seen.length = 0
    const ok = await checkConnection('mistral', { MISTRAL_API_KEY: 'abc' }, spy(reply(200, { data: [{}, {}] })) as never)
    expect(ok.status).toBe('verified')
    expect(seen[0].url).toBe('https://api.mistral.ai/v1/models')
    const bad = await checkConnection('openrouter', { OPENROUTER_API_KEY: 'sk-or-secretvalue' }, spy(reply(401, { error: { message: 'invalid key' } })) as never)
    expect(bad.status).toBe('failed')
    expect(bad.detail).not.toContain('secretvalue')
    expect(seen.at(-1)?.headers.authorization).toBe('Bearer sk-or-secretvalue')
  })
})
