import { app, BrowserWindow, session } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * An alternative to an API key for ordinary operational accounts - a real Chromium window
 * opens on the provider's own login page, backed by a persistent partition so cookies survive
 * app restarts; the user logs in by hand and closes the window when done. Olympus never sees
 * the password. The resulting cookies are exported to a Playwright-compatible storage-state
 * file a project's agent can load to drive a real, already-signed-in browser session of its own.
 *
 * This is a materially different trust boundary than an API key: it hands over whatever the
 * account can do in a browser, not a scoped token, it can trip the provider's own bot detection
 * and get the account locked or challenged, it likely violates that provider's Terms of
 * Service, and the session is not permanent - it can expire or demand re-verification. None of
 * that is hidden from the user; the Connections UI states it next to the Sign in button.
 *
 * Deliberately not offered for Stripe, PayPal, or Square: those exist specifically so payment
 * processing never has to go through a browser session, and a payment processor's fraud/bot
 * defenses and Terms are far less forgiving of this than a retail or marketing account. Not
 * offered for WooCommerce either, since it's self-hosted with no single login page to point at.
 * Those stay API-key/token only.
 */
export interface SignInProvider {
  id: string
  name: string
  url: string
}

export const SIGN_IN_PROVIDERS: SignInProvider[] = [
  { id: 'shopify', name: 'Shopify', url: 'https://www.shopify.com/login' },
  { id: 'bigcommerce', name: 'BigCommerce', url: 'https://login.bigcommerce.com/login' },
  { id: 'etsy', name: 'Etsy', url: 'https://www.etsy.com/signin' },
  { id: 'ebay', name: 'eBay', url: 'https://signin.ebay.com/' },
  { id: 'amazon', name: 'Amazon Seller', url: 'https://sellercentral.amazon.com/' },
  { id: 'printify', name: 'Printify', url: 'https://printify.com/app/login' },
  { id: 'printful', name: 'Printful', url: 'https://www.printful.com/auth/login' },
  { id: 'shippo', name: 'Shippo', url: 'https://apps.goshippo.com/login' },
  { id: 'pinterest', name: 'Pinterest', url: 'https://www.pinterest.com/login/' },
  { id: 'meta', name: 'Meta (Facebook & Instagram)', url: 'https://www.facebook.com/login' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/login' },
  { id: 'x', name: 'X (Twitter)', url: 'https://x.com/login' },
  { id: 'mailchimp', name: 'Mailchimp', url: 'https://login.mailchimp.com/' },
  { id: 'klaviyo', name: 'Klaviyo', url: 'https://www.klaviyo.com/login' },
  { id: 'discord', name: 'Discord', url: 'https://discord.com/login' },
]

function providerById(id: string): SignInProvider | undefined {
  return SIGN_IN_PROVIDERS.find((p) => p.id === id)
}

export function supportsSignIn(id: string): boolean {
  return !!providerById(id)
}

const partitionName = (id: string) => `persist:connection-${id}`

// Electron hands back the same Session object for a given partition string every time, so this
// identifies a sign-in window's webContents by WHICH session it belongs to - a property fixed
// at construction, from the `partition` passed into `new BrowserWindow(...)` - rather than by a
// registration step after the fact, which would run too late: `web-contents-created` fires
// during the BrowserWindow constructor itself, before any code after `new BrowserWindow(...)`
// can execute. Computed lazily so the app doesn't eagerly spin up all 15 sessions at startup.
let signInSessions: Set<Electron.Session> | null = null
function allSignInSessions(): Set<Electron.Session> {
  if (!signInSessions) signInSessions = new Set(SIGN_IN_PROVIDERS.map((p) => session.fromPartition(partitionName(p.id))))
  return signInSessions
}

/** Whether `target` belongs to one of the sign-in windows - exempt from the app's navigation
 * lockdown, since a real login flow needs to navigate within the provider's own site. */
export function isSignInSession(target: Electron.Session): boolean {
  return allSignInSessions().has(target)
}
const sessionDir = () => path.join(app.getPath('userData'), 'connection-sessions')
export const sessionFilePath = (id: string) => path.join(sessionDir(), `${id}.json`)

export function hasSession(id: string): boolean {
  return fs.existsSync(sessionFilePath(id))
}

/** Env vars for whichever of these connections have a saved browser session, for one
 * project's `opencode serve` process - e.g. `PINTEREST_SESSION_FILE=<path>`. The agent's own
 * Playwright script loads that path as `storageState` to resume the signed-in session. */
export function sessionEnv(connectionIds: string[]): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {}
  for (const id of connectionIds) {
    if (!providerById(id) || !hasSession(id)) continue
    out[`${id.toUpperCase()}_SESSION_FILE`] = sessionFilePath(id)
  }
  return out
}

function toPlaywrightCookie(c: Electron.Cookie) {
  const sameSiteMap: Record<string, 'Strict' | 'Lax' | 'None'> = {
    strict: 'Strict',
    lax: 'Lax',
    no_restriction: 'None',
    unspecified: 'Lax',
  }
  return {
    name: c.name,
    value: c.value,
    domain: c.domain ?? '',
    path: c.path ?? '/',
    expires: c.session || c.expirationDate === undefined ? -1 : c.expirationDate,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    sameSite: sameSiteMap[c.sameSite ?? 'unspecified'] ?? 'Lax',
  }
}

async function exportSession(id: string): Promise<void> {
  const cookies = await session.fromPartition(partitionName(id)).cookies.get({})
  const storageState = {
    cookies: cookies.filter((c) => c.name && c.domain).map(toPlaywrightCookie),
    origins: [] as unknown[],
  }
  fs.mkdirSync(sessionDir(), { recursive: true })
  fs.writeFileSync(sessionFilePath(id), JSON.stringify(storageState, null, 2), { encoding: 'utf8', mode: 0o600 })
}

/** Clears the saved session: the partition's cookies and the exported file both go. */
export function forgetSession(id: string): void {
  void session.fromPartition(partitionName(id)).clearStorageData()
  try {
    fs.unlinkSync(sessionFilePath(id))
  } catch {
    // nothing to remove
  }
}

/** Opens the sign-in window and resolves once the user closes it (cookies exported first). */
export function openSignIn(id: string): Promise<void> {
  const provider = providerById(id)
  if (!provider) return Promise.reject(new Error(`No browser sign-in available for ${id}`))
  const win = new BrowserWindow({
    width: 480,
    height: 760,
    title: `Sign in to ${provider.name} — close this window when you're done`,
    autoHideMenuBar: true,
    webPreferences: {
      partition: partitionName(id),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  void win.loadURL(provider.url)
  return new Promise((resolve) => {
    let exported = false
    win.on('close', (event) => {
      if (exported) return
      event.preventDefault()
      void exportSession(id)
        .catch(() => undefined)
        .then(() => {
          exported = true
          win.destroy()
        })
    })
    win.on('closed', () => resolve())
  })
}
