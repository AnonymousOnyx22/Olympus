import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const clearedPartitions: string[] = []

vi.mock('electron', () => {
  let userDataDir = ''
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') return userDataDir
        throw new Error(`unexpected getPath(${name})`)
      },
      __setUserData: (dir: string) => {
        userDataDir = dir
      },
    },
    BrowserWindow: class {},
    session: {
      // Real Electron hands back the SAME Session object for a given partition string every
      // call - isSignInSession's identity check depends on that, so the mock must match it.
      _cache: new Map<string, unknown>(),
      fromPartition(name: string) {
        if (!this._cache.has(name)) {
          this._cache.set(name, {
            cookies: { get: async () => [] },
            clearStorageData: async () => {
              clearedPartitions.push(name)
            },
          })
        }
        return this._cache.get(name)
      },
    },
  }
})

let dir: string
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-browsersignin-test-'))
  const electron = await import('electron')
  ;(electron.app as unknown as { __setUserData: (d: string) => void }).__setUserData(dir)
  clearedPartitions.length = 0
  vi.resetModules()
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('browserSignIn', () => {
  it('offers it for ordinary operational accounts', async () => {
    const { supportsSignIn } = await import('../electron/browserSignIn')
    for (const id of ['shopify', 'bigcommerce', 'etsy', 'ebay', 'amazon', 'printify', 'printful', 'shippo', 'pinterest', 'meta', 'tiktok', 'x', 'mailchimp', 'klaviyo', 'discord']) {
      expect(supportsSignIn(id)).toBe(true)
    }
    expect(supportsSignIn('not-a-real-provider')).toBe(false)
  })

  it('withholds it from payment processors and self-hosted platforms', async () => {
    const { supportsSignIn } = await import('../electron/browserSignIn')
    // Payments stay API-key only - a payment processor's fraud/bot defenses and Terms are far
    // less forgiving of a browser session than a retail or marketing account's.
    expect(supportsSignIn('stripe')).toBe(false)
    expect(supportsSignIn('paypal')).toBe(false)
    expect(supportsSignIn('square')).toBe(false)
    // Self-hosted, so there's no single login page to point a sign-in window at.
    expect(supportsSignIn('woocommerce')).toBe(false)
  })

  it('reports no session, and contributes no env vars, until one is saved', async () => {
    const { hasSession, sessionEnv } = await import('../electron/browserSignIn')
    expect(hasSession('pinterest')).toBe(false)
    expect(sessionEnv(['pinterest', 'etsy'])).toEqual({})
  })

  it('exposes a saved session as an env var scoped to that provider only', async () => {
    const { sessionFilePath, sessionEnv } = await import('../electron/browserSignIn')
    fs.mkdirSync(path.dirname(sessionFilePath('pinterest')), { recursive: true })
    fs.writeFileSync(sessionFilePath('pinterest'), JSON.stringify({ cookies: [], origins: [] }))

    expect(sessionEnv(['pinterest'])).toEqual({ PINTEREST_SESSION_FILE: sessionFilePath('pinterest') })
    // A provider that wasn't enabled for this project contributes nothing, even with a saved session.
    expect(sessionEnv([])).toEqual({})
    // A provider with no session contributes nothing even if enabled.
    expect(sessionEnv(['etsy'])).toEqual({})
  })

  it('forgetSession clears the partition and deletes the exported file', async () => {
    const { sessionFilePath, hasSession, forgetSession } = await import('../electron/browserSignIn')
    fs.mkdirSync(path.dirname(sessionFilePath('pinterest')), { recursive: true })
    fs.writeFileSync(sessionFilePath('pinterest'), JSON.stringify({ cookies: [], origins: [] }))
    expect(hasSession('pinterest')).toBe(true)

    forgetSession('pinterest')

    expect(hasSession('pinterest')).toBe(false)
    expect(clearedPartitions).toEqual(['persist:connection-pinterest'])
  })

  it('forgetSession on a provider with nothing saved does not throw', async () => {
    const { forgetSession } = await import('../electron/browserSignIn')
    expect(() => forgetSession('etsy')).not.toThrow()
  })

  it('identifies a sign-in window by its session, not by a registration step that can race the window\'s own construction', async () => {
    const electron = await import('electron')
    const { isSignInSession } = await import('../electron/browserSignIn')
    const etsySession = electron.session.fromPartition('persist:connection-etsy')
    const mainAppSession = electron.session.fromPartition('persist:something-else')

    expect(isSignInSession(etsySession as never)).toBe(true)
    expect(isSignInSession(mainAppSession as never)).toBe(false)
  })
})
