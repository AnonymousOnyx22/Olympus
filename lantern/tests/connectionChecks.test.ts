import { describe, expect, it } from 'vitest'
import { checkConnection, hasAutomaticCheck } from '../electron/connectionChecks'

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
    const result = await checkConnection('shopify', { SHOPIFY_STORE_DOMAIN: 'x.myshopify.com' }, spy(reply(200)) as never)
    expect(result.status).toBe('incomplete')
    expect(result.detail).toContain('SHOPIFY_ADMIN_ACCESS_TOKEN')
    expect(seen).toHaveLength(0)
  })

  it('rejects a Shopify custom domain, which cannot be used for the Admin API', async () => {
    const result = await checkConnection('shopify', { SHOPIFY_STORE_DOMAIN: 'https://mystore.com', SHOPIFY_ADMIN_ACCESS_TOKEN: 't' }, reply(200) as never)
    expect(result.status).toBe('failed')
    expect(result.detail).toContain('your-store.myshopify.com')
  })

  it('verifies Shopify but warns when the plan cannot take real orders', async () => {
    const dev = reply(200, { shop: { name: 'Test Shop', plan_name: 'affiliate', plan_display_name: 'Developer Preview' } })
    const result = await checkConnection('shopify', { SHOPIFY_STORE_DOMAIN: 'test.myshopify.com', SHOPIFY_ADMIN_ACCESS_TOKEN: 't' }, dev as never)
    expect(result.status).toBe('verified')
    expect(result.detail).toContain('cannot take real orders')
  })

  it('does not warn for a normal paid Shopify plan', async () => {
    const paid = reply(200, { shop: { name: 'Real Shop', plan_name: 'basic', plan_display_name: 'Basic' } })
    const result = await checkConnection('shopify', { SHOPIFY_STORE_DOMAIN: 'real.myshopify.com', SHOPIFY_ADMIN_ACCESS_TOKEN: 't' }, paid as never)
    expect(result.detail).not.toContain('cannot take real orders')
  })

  it('accepts a store-level Printful key that the account endpoint refuses', async () => {
    const calls: string[] = []
    const f = async (url: unknown) => { calls.push(String(url)); return String(url).endsWith('/stores') ? new Response('{}', { status: 403 }) : new Response('{}', { status: 200 }) }
    const result = await checkConnection('printful', { PRINTFUL_API_KEY: 'k' }, f as never)
    expect(result.status).toBe('verified')
    expect(calls).toEqual(['https://api.printful.com/stores', 'https://api.printful.com/store'])
  })

  it('never claims a service with no automatic test is working', async () => {
    const result = await checkConnection('canva', { CANVA_ACCESS_TOKEN: 'x' }, reply(200) as never)
    expect(result.status).toBe('unchecked')
    expect(result.detail).toContain('not tested')
    expect(hasAutomaticCheck('canva')).toBe(false)
    expect(hasAutomaticCheck('stripe')).toBe(true)
  })
  it('verifies AI model keys against the right service and never echoes the key', async () => {
    seen.length = 0
    const ok = await checkConnection('openai', { OPENAI_API_KEY: 'sk-abc' }, spy(reply(200, { data: [{}, {}] })) as never)
    expect(ok.status).toBe('verified')
    expect(ok.detail).toContain('2 models')
    expect(seen[0].url).toBe('https://api.openai.com/v1/models')
    const bad = await checkConnection('anthropic', { ANTHROPIC_API_KEY: 'sk-ant-secretvalue' }, spy(reply(401, { error: { message: 'invalid x-api-key' } })) as never)
    expect(bad.status).toBe('failed')
    expect(bad.detail).not.toContain('secretvalue')
    expect(seen.at(-1)?.headers['x-api-key']).toBe('sk-ant-secretvalue')
  })
})
