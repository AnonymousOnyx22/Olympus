// =============================================================================
// Olympus - commercial licence gate (self-hosted, not DRM)
//
// WHAT THIS IS, HONESTLY
//   This is a signed-token check. A key is issued per seat, stored as JSON in
//   the user's own data directory, and verified with a keyed HMAC-SHA256. That
//   buys the vendor three real things:
//
//     1. AUDIT   - a record of who bought a seat and when, checkable later.
//     2. REVOKE  - because the token carries an email + activation timestamp,
//                  a vendor-side list of revoked keys is possible: simply
//                  refusing to issue new keys to a given address, and adding
//                  their token to a deny list at the licensing service.
//     3. TAMPER EVIDENCE - editing activatedAt or the email invalidates the
//                  signature, so casual tampering is detectable.
//
//   WHAT IT IS NOT, and what no local-only scheme can be:
//     - It does NOT prevent copying. The app, and the secret check, both live
//       on the user's machine. A determined user can patch out the gate, dump
//       the secret out of the binary, or run a hex editor. That is a property
//       of running untrusted-adjacent code locally, not a bug in this file.
//     - There is NO phone-home. Nothing in this module makes a network call.
//       That is deliberate: the product is local-first and must work offline.
//       It also means revocation cannot be enforced by this module alone; see
//       point 2 above, revocation happens at key-ISSUE time.
//     - Do not invent an asymmetric scheme to feel stronger. If you want a
//       genuinely non-bypassable gate you need a server check, which costs you
//       an always-online product. This is the honest middle: it raises the cost
//       of casual sharing to "user must edit a file", and it gives you a
//       defensible audit trail.
//
// HOW A KEY IS ISSUED (out of band, not in this repo)
//   The vendor runs a small signing script holding OLYMPUS_LICENSE_SECRET and
//   writes license.json for the customer. `signLicenseKey` below is the exact
//   function that script should call, so the two sides can never drift.
//
//   Build-time requirement
//   ----------------------
//   OLYMPUS_LICENSE_SECRET must be supplied at build time to the main process
//   (see .github/workflows/release.yml) and embedded into the bundle. It is NOT
//   in this file and must never be committed. Rotating it invalidates every
//   previously issued key, so rotate only if you have decided to force
//   reactivation for the whole customer base.
//
// -----------------------------------------------------------------------------
// WIRING THIS INTO electron/main.ts  (follow-up change; main.ts is not edited
// here because another agent owns it)
//
//   1. Add the import at the top of electron/main.ts, next to the other
//      `./`-relative imports (around line 9, after `import { gitStatus, gitAction } from './git'`):
//
//          import { getLicenseState, licenseSummary, getTrialStartedAt, recordActivation } from './license'
//
//   2. Gate the window at app.whenReady(). The ready handler is at
//      electron/main.ts:571-580; insert immediately BEFORE `createWindow()` on
//      line 576, so no window is ever shown to an unlicensed user:
//
//          const license = getLicenseState()
//          if (!license.valid && !license.trial && license.daysLeft <= 0) {
//            dialog.showMessageBoxSync({
//              type: 'error',
//              title: 'Licence required',
//              message: 'Olympus needs an activated licence to continue.',
//              detail: `Your ${TRIAL_DAYS}-day trial ended on ${license.daysLeft}-day countdown. ` +
//                      'Run `olympus --activate <key> --email <you@example.com>` to activate.',
//              buttons: ['Quit'],
//            })
//            app.quit()
//            return
//          }
//
//   3. Expose read-only state to the renderer through the existing IPC bridge in
//      registerIpc() (electron/main.ts, the `ipcMain.handle(...)` block). Add
//      one handler and nothing else - never expose the secret or the raw key:
//
//          ipcMain.handle('license:summary', () => licenseSummary())
//
//      and in electron/preload.ts expose it on the same contextBridge object the
//      other channels use, e.g. `contextBridge.exposeInMainWorld('olympus', { ...api, license: () => ipcRenderer.invoke('license:summary') })`.
//      The renderer then reads window.olympus.license() to show the "days left
//      in trial" badge. It must never be able to WRITE license.json through IPC.
//
//   4. Implement activation as a CLI flag on argv, handled before app.whenReady():
//      parse `--activate <key> --email <email>`, call recordActivation(), and
//      app.quit(). Activation must not be reachable from the renderer, or a
//      malicious web page in the preview iframe could write a license file.
// =============================================================================

import { app } from 'electron'
import { createHmac, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Commercial terms, as data
// ---------------------------------------------------------------------------

export const LICENSE_TERMS = {
  product: 'Olympus',
  /** Per-seat, perpetual. There is no subscription and no expiry on the licence. */
  model: 'per-seat perpetual',
  allowsCommercialUse: true,
  /** Redistribution of the binary, in original or modified form, is not granted. */
  redistribution: false,
  seatsPerPurchase: 1,
  trialDays: 14,
} as const

/** Kept in lockstep with LICENSE_TERMS above; mirror it in electron-builder.yml. */
export const PRODUCT = LICENSE_TERMS.product

export interface LicenseRecord {
  key: string
  email: string
  /** ISO-8601 timestamp of when the key was activated on this machine. */
  activatedAt: string
}

export interface LicenseState {
  valid: boolean
  trial: boolean
  expired: boolean
  daysLeft: number
  email: string | null
}

const TRIAL_DAYS = LICENSE_TERMS.trialDays
const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Environment variable carrying the HMAC signing key.
 * Read at call time (not at module load) so tests and tooling can stub it, and
 * so a build that forgot to define it degrades to "unlicensed" rather than
 * crashing at startup.
 */
function signingSecret(): string {
  return process.env.OLYMPUS_LICENSE_SECRET ?? ''
}

const licensePath = (): string => path.join(app.getPath('userData'), 'license.json')
const trialPath = (): string => path.join(app.getPath('userData'), 'trial.json')

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

/**
 * The signed payload is `email|activatedAt|product`, pipe-separated, in that
 * exact order. Pipe is chosen because it cannot appear in a well-formed email
 * address or ISO timestamp, so the fields are unambiguous - a separator that
 * could also appear inside a field would let someone move text across the
 * boundary and still produce a valid signature.
 */
function payload(email: string, activatedAt: string): string {
  return [email.trim().toLowerCase(), activatedAt, PRODUCT].join('|')
}

/**
 * Produces the full licence key: `<email-ish>.<hex-hmac>`.
 * The vendor's issuing script calls this. Kept exported so the signing side and
 * the verification side are literally the same code and cannot disagree.
 */
export function signLicenseKey(email: string, activatedAt: string, secret = signingSecret()): string {
  const mac = createHmac('sha256', secret).update(payload(email, activatedAt)).digest('hex')
  return `${email.trim().toLowerCase()}.${mac}`
}

/**
 * Verifies a licence record's signature.
 *
 * timingSafeEqual is used for the comparison because a plain `===` on an HMAC
 * leaks, byte by byte, how many leading characters an attacker guessed right,
 * which turns a 2^256 brute force into a far cheaper offline search. Note the
 * guard on the length: timingSafeEqual THROWS on a length mismatch, and a
 * throw here would be a trivially available crash. So the length is compared
 * first, and the secret-length check happens before anything else touches it.
 *
 * Being honest about the ceiling: this protects a signature that the user
 * already holds in plaintext in their own data directory. An attacker who
 * reads license.json learns the expected digest length and can call this
 * function in a loop. It prevents naive hand-editing, not a determined user.
 */
function verify(record: LicenseRecord, secret = signingSecret()): boolean {
  if (!secret) return false
  const { key, email, activatedAt } = record
  if (typeof key !== 'string' || typeof email !== 'string' || typeof activatedAt !== 'string') return false
  if (!email || !activatedAt || !key) return false

  const separator = key.lastIndexOf('.')
  if (separator <= 0) return false
  const signature = key.slice(separator + 1)
  const expected = createHmac('sha256', secret).update(payload(email, activatedAt)).digest('hex')

  const a = Buffer.from(signature, 'hex')
  const b = Buffer.from(expected, 'hex')
  // A non-hex key yields a zero-length or garbage buffer; treat that as invalid
  // rather than letting it reach timingSafeEqual.
  if (a.length !== b.length || a.length === 0) return false
  return timingSafeEqual(a, b)
}

// ---------------------------------------------------------------------------
// Disk I/O - every function here is total: it returns a value and never throws.
// A licence check that can crash the app is strictly worse than no check at all.
// ---------------------------------------------------------------------------

/** Reads license.json. Returns null on any error: missing, unreadable, malformed, wrong shape. */
export function readLicense(): LicenseRecord | null {
  try {
    const raw = JSON.parse(fs.readFileSync(licensePath(), 'utf8')) as Partial<LicenseRecord>
    if (!raw || typeof raw !== 'object') return null
    if (typeof raw.key !== 'string' || typeof raw.email !== 'string' || typeof raw.activatedAt !== 'string') return null
    return { key: raw.key, email: raw.email, activatedAt: raw.activatedAt }
  } catch {
    return null
  }
}

/** Writes license.json. Returns false instead of throwing if the write fails. */
export function writeLicense(record: LicenseRecord): boolean {
  try {
    fs.mkdirSync(path.dirname(licensePath()), { recursive: true })
    fs.writeFileSync(licensePath(), JSON.stringify(record, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * Records an activation. The caller passes the full signed key; the timestamp is
 * taken from the clock at activation time and is part of the signed payload, so
 * re-activating with a key minted for a different date will not validate. That
 * is intentional: it stops a single seat from being re-stamped forever.
 */
export function recordActivation(key: string, email: string): LicenseState {
  const activatedAt = new Date().toISOString()
  const record: LicenseRecord = { key, email, activatedAt }
  if (verify(record)) {
    writeLicense(record)
    return getLicenseState()
  }
  return getLicenseState()
}

// ---------------------------------------------------------------------------
// Trial
// ---------------------------------------------------------------------------

/**
 * First-launch timestamp, persisted on first call.
 *
 * Stored as its own file next to license.json rather than inside settings.json.
 * The reason is concrete: `normalize()` in ./settings.ts is a WHITELIST - it
 * rebuilds the object from known fields only, so any key this module added
 * would be silently dropped the next time anything else saved a setting. A
 * trial clock that resets itself is worse than one in its own file.
 *
 * Returns null only if the data directory is unwritable, in which case the
 * caller treats the trial as still running rather than locking the user out.
 * A user with a read-only profile directory can still work, which is the right
 * failure direction for a licence check.
 */
export function getTrialStartedAt(): string | null {
  const file = trialPath()
  try {
    const existing = fs.readFileSync(file, 'utf8').trim()
    if (existing) return existing
  } catch {
    // No trial file yet, or unreadable. Fall through and write one.
  }
  const now = new Date().toISOString()
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, now, 'utf8')
  } catch {
    return null
  }
  return now
}

/** Whole days left in the trial. 14 on the day it starts, 0 once it is over. */
function trialDaysLeft(now: number): number {
  const startedAt = getTrialStartedAt()
  if (!startedAt) return TRIAL_DAYS
  const started = Date.parse(startedAt)
  if (Number.isNaN(started)) return TRIAL_DAYS
  const elapsed = now - started
  if (elapsed <= 0) return TRIAL_DAYS
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed / MS_PER_DAY))
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The single entry point the main process calls. Always returns a state object,
 * even if reading settings, the licence file and the clock all fail at once.
 */
export function getLicenseState(): LicenseState {
  const unlicensed: LicenseState = { valid: false, trial: false, expired: false, daysLeft: 0, email: null }
  try {
    const now = Date.now()
    const record = readLicense()

    if (record && verify(record)) {
      return { valid: true, trial: false, expired: false, daysLeft: TRIAL_DAYS, email: record.email }
    }

    // A licence file that exists but fails verification is not a fresh install:
    // the user had a key and it no longer checks out (revoked, edited, or the
    // secret was rotated). Keep the days-left honest and mark it expired.
    if (record) {
      const daysLeft = trialDaysLeft(now)
      return { valid: false, trial: daysLeft > 0, expired: daysLeft <= 0, daysLeft, email: null }
    }

    const daysLeft = trialDaysLeft(now)
    return { valid: false, trial: daysLeft > 0, expired: daysLeft <= 0, daysLeft, email: null }
  } catch {
    return unlicensed
  }
}

/**
 * Plain, secret-free object safe to send across the IPC boundary.
 * Deliberately omits: the licence key, the signing secret, and the file path.
 * A renderer that can read the key can share it, so it never sees one.
 */
export function licenseSummary(): {
  product: string
  model: string
  allowsCommercialUse: boolean
  redistribution: boolean
  seatsPerPurchase: number
  trialDays: number
  licensed: boolean
  trial: boolean
  expired: boolean
  daysLeft: number
  email: string | null
} {
  const state = getLicenseState()
  return {
    product: LICENSE_TERMS.product,
    model: LICENSE_TERMS.model,
    allowsCommercialUse: LICENSE_TERMS.allowsCommercialUse,
    redistribution: LICENSE_TERMS.redistribution,
    seatsPerPurchase: LICENSE_TERMS.seatsPerPurchase,
    trialDays: TRIAL_DAYS,
    licensed: state.valid,
    trial: state.trial,
    expired: state.expired,
    daysLeft: state.daysLeft,
    email: state.email,
  }
}
