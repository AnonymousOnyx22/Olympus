import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A fake OS secret store, not real DPAPI: prefixed so a test can tell a field was actually
// run through "encryption" (not just stored as the plain string) before hitting disk.
vi.mock('electron', () => {
  let userDataDir = ''
  return {
    app: { getPath: (name: string) => { if (name === 'userData') return userDataDir; throw new Error(`unexpected getPath(${name})`) }, __setUserData: (dir: string) => { userDataDir = dir } },
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (buf: Buffer) => buf.toString('utf8').replace(/^enc:/, ''),
    },
  }
})

let dir: string
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-connections-test-'))
  const electron = await import('electron')
  ;(electron.app as unknown as { __setUserData: (d: string) => void }).__setUserData(dir)
  vi.resetModules()
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('connections', () => {
  it('starts with every provider listed and nothing configured', async () => {
    const { listConnectionStatus } = await import('../electron/connections')
    const list = listConnectionStatus()
    // The library has grown well past these four - just confirm the originals are still in it,
    // rather than pinning the exact list (and its order) as new providers get added over time.
    expect(list.map((p) => p.id)).toEqual(expect.arrayContaining(['stripe', 'shopify', 'etsy', 'pinterest', 'printful', 'netlify', 'vercel']))
    expect(list.every((p) => p.configuredFields.length === 0)).toBe(true)
  })

  it('saves a field, encrypted at rest, and reports it configured', async () => {
    const { setConnectionValues } = await import('../electron/connections')
    const after = setConnectionValues('stripe', { STRIPE_SECRET_KEY: 'sk_test_12345' })
    const stripe = after.find((p) => p.id === 'stripe')!
    expect(stripe.configuredFields).toEqual(['STRIPE_SECRET_KEY'])

    // The raw file on disk must not contain the plaintext secret, only the encrypted blob.
    const raw = fs.readFileSync(path.join(dir, 'connections.json'), 'utf8')
    expect(raw).not.toContain('sk_test_12345')
    expect(raw).toContain(Buffer.from('enc:sk_test_12345', 'utf8').toString('base64'))
  })

  it('decrypts back to the original value for the daemon env, and only for enabled connections', async () => {
    const { setConnectionValues, envForConnections } = await import('../electron/connections')
    setConnectionValues('stripe', { STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_PUBLISHABLE_KEY: 'pk_test_abc' })
    setConnectionValues('etsy', { ETSY_API_KEY: 'etsy-key' })

    expect(envForConnections(['stripe'])).toEqual({ STRIPE_SECRET_KEY: 'sk_test_abc', STRIPE_PUBLISHABLE_KEY: 'pk_test_abc' })
    // A connection that exists but was never enabled for this project contributes nothing.
    expect(envForConnections([])).toEqual({})
    // Enabling both merges their env vars.
    expect(envForConnections(['stripe', 'etsy'])).toEqual({
      STRIPE_SECRET_KEY: 'sk_test_abc',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_abc',
      ETSY_API_KEY: 'etsy-key',
    })
  })

  it('an empty string for a field clears just that field, leaving the rest alone', async () => {
    const { setConnectionValues } = await import('../electron/connections')
    setConnectionValues('stripe', { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_PUBLISHABLE_KEY: 'pk_test_x' })
    const after = setConnectionValues('stripe', { STRIPE_SECRET_KEY: '' })
    const stripe = after.find((p) => p.id === 'stripe')!
    expect(stripe.configuredFields).toEqual(['STRIPE_PUBLISHABLE_KEY'])
  })

  it('clearConnection removes every field for that provider only', async () => {
    const { setConnectionValues, clearConnection } = await import('../electron/connections')
    setConnectionValues('stripe', { STRIPE_SECRET_KEY: 'sk_test_y' })
    setConnectionValues('etsy', { ETSY_API_KEY: 'etsy-key' })
    const after = clearConnection('stripe')
    expect(after.find((p) => p.id === 'stripe')!.configuredFields).toEqual([])
    expect(after.find((p) => p.id === 'etsy')!.configuredFields).toEqual(['ETSY_API_KEY'])
  })

  it('rejects an unknown provider id rather than silently writing it', async () => {
    const { setConnectionValues } = await import('../electron/connections')
    expect(() => setConnectionValues('not-a-real-provider', { KEY: 'x' })).toThrow()
  })
})
