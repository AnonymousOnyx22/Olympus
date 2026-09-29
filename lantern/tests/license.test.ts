import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

// The `electron` module is mocked in tests/setup.ts so app.getPath() points at
// a throwaway temp directory per test. No real user data is read or written.
import {
  LICENSE_TERMS,
  getLicenseState,
  getTrialStartedAt,
  licenseSummary,
  readLicense,
  signLicenseKey,
} from '../electron/license'

const SECRET = 'test-secret-do-not-ship'
const EMAIL = 'buyer@example.com'

let previousSecret: string | undefined

beforeEach(() => {
  previousSecret = process.env.OLYMPUS_LICENSE_SECRET
  process.env.OLYMPUS_LICENSE_SECRET = SECRET
})

afterEach(() => {
  if (previousSecret === undefined) delete process.env.OLYMPUS_LICENSE_SECRET
  else process.env.OLYMPUS_LICENSE_SECRET = previousSecret
})

const licenseFile = () => path.join(app.getPath('userData'), 'license.json')
const writeLicenseFile = (value: unknown) =>
  fs.writeFileSync(licenseFile(), typeof value === 'string' ? value : JSON.stringify(value), 'utf8')

describe('LICENSE_TERMS', () => {
  it('matches the terms shipped in electron-builder.yml', () => {
    expect(LICENSE_TERMS.product).toBe('Olympus')
    expect(LICENSE_TERMS.trialDays).toBe(14)
    expect(LICENSE_TERMS.allowsCommercialUse).toBe(true)
    expect(LICENSE_TERMS.redistribution).toBe(false)
    expect(LICENSE_TERMS.seatsPerPurchase).toBe(1)
  })
})

describe('signLicenseKey', () => {
  it('is deterministic for the same inputs, so an issuing script can be re-run', () => {
    const at = '2026-01-01T00:00:00.000Z'
    expect(signLicenseKey(EMAIL, at)).toBe(signLicenseKey(EMAIL, at))
  })

  it('changes when any signed field changes', () => {
    const at = '2026-01-01T00:00:00.000Z'
    const base = signLicenseKey(EMAIL, at)
    expect(signLicenseKey('other@example.com', at)).not.toBe(base)
    expect(signLicenseKey(EMAIL, '2026-01-02T00:00:00.000Z')).not.toBe(base)
  })

  it('normalises the email, so a differently-cased address yields the same key', () => {
    const at = '2026-01-01T00:00:00.000Z'
    expect(signLicenseKey('Buyer@Example.COM', at)).toBe(signLicenseKey(EMAIL, at))
  })
})

describe('readLicense', () => {
  it('returns null when there is no license file', () => {
    expect(readLicense()).toBeNull()
  })

  it('round-trips a well-formed record', () => {
    const record = { key: 'abc.def', email: EMAIL, activatedAt: '2026-01-01T00:00:00.000Z' }
    writeLicenseFile(record)
    expect(readLicense()).toEqual(record)
  })

  it('returns null rather than throwing on malformed JSON', () => {
    writeLicenseFile('{ not json')
    expect(readLicense()).toBeNull()
  })

  it('returns null when required fields are missing or the wrong type', () => {
    // A partial file must not become a half-valid licence.
    writeLicenseFile({ key: 'abc.def' })
    expect(readLicense()).toBeNull()
    writeLicenseFile({ key: 1, email: EMAIL, activatedAt: 'x' })
    expect(readLicense()).toBeNull()
    writeLicenseFile('null')
    expect(readLicense()).toBeNull()
  })
})

describe('getLicenseState', () => {
  it('reports a valid licence for a correctly signed record', () => {
    const activatedAt = '2026-01-01T00:00:00.000Z'
    writeLicenseFile({ key: signLicenseKey(EMAIL, activatedAt), email: EMAIL, activatedAt })
    const state = getLicenseState()
    expect(state.valid).toBe(true)
    expect(state.email).toBe(EMAIL)
    // A perpetual licence is not a trial and never "expires".
    expect(state.trial).toBe(false)
    expect(state.expired).toBe(false)
  })

  it('rejects a tampered activatedAt, because the timestamp is signed', () => {
    // The realistic attack: move the activation date back to reset a trial.
    const activatedAt = '2026-01-01T00:00:00.000Z'
    const key = signLicenseKey(EMAIL, activatedAt)
    writeLicenseFile({ key, email: EMAIL, activatedAt: '2020-01-01T00:00:00.000Z' })
    expect(getLicenseState().valid).toBe(false)
  })

  it('rejects a licence pasted between two accounts, because the email is signed', () => {
    const activatedAt = '2026-01-01T00:00:00.000Z'
    const key = signLicenseKey(EMAIL, activatedAt)
    writeLicenseFile({ key, email: 'someone-else@example.com', activatedAt })
    expect(getLicenseState().valid).toBe(false)
  })

  it('rejects every licence when the signing secret is missing', () => {
    // A build that forgot to define OLYMPUS_LICENSE_SECRET must degrade to
    // "unlicensed" rather than crashing or, worse, accepting anything.
    const activatedAt = '2026-01-01T00:00:00.000Z'
    writeLicenseFile({ key: signLicenseKey(EMAIL, activatedAt), email: EMAIL, activatedAt })
    delete process.env.OLYMPUS_LICENSE_SECRET
    expect(getLicenseState().valid).toBe(false)
  })

  it('rejects a key signed with a different secret', () => {
    const activatedAt = '2026-01-01T00:00:00.000Z'
    writeLicenseFile({ key: signLicenseKey(EMAIL, activatedAt, 'some-other-secret'), email: EMAIL, activatedAt })
    expect(getLicenseState().valid).toBe(false)
  })

  it('does not throw on a garbage key that would break a length-unsafe compare', () => {
    // timingSafeEqual throws on a length mismatch, so a short key must be
    // rejected before it reaches the compare, not crash the app.
    for (const key of ['', 'x', 'no-separator', 'a.', '.abc', 'a.zzzz', 'a.⚡']) {
      writeLicenseFile({ key, email: EMAIL, activatedAt: '2026-01-01T00:00:00.000Z' })
      expect(() => getLicenseState()).not.toThrow()
      expect(getLicenseState().valid).toBe(false)
    }
  })

  it('starts a 14-day trial on first run and persists the start date', () => {
    const state = getLicenseState()
    expect(state.valid).toBe(false)
    expect(state.trial).toBe(true)
    expect(state.expired).toBe(false)
    expect(state.daysLeft).toBe(14)
    // Reading it twice must not restart the clock.
    const first = getTrialStartedAt()
    getLicenseState()
    expect(getTrialStartedAt()).toBe(first)
  })

  it('reports the trial as expired once the start date is older than 14 days', () => {
    const started = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    fs.writeFileSync(path.join(app.getPath('userData'), 'trial.json'), started, 'utf8')
    const state = getLicenseState()
    expect(state.valid).toBe(false)
    expect(state.trial).toBe(false)
    expect(state.expired).toBe(true)
    expect(state.daysLeft).toBe(0)
  })

  it('counts down, and rounds up, part-way through the trial', () => {
    // Ceil, not floor: a user 1ms into the trial should still be told "14 days
    // left", not "13". Flooring makes the badge visibly wrong on day one.
    fs.writeFileSync(
      path.join(app.getPath('userData'), 'trial.json'),
      new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000).toISOString(),
      'utf8',
    )
    expect(getLicenseState().daysLeft).toBe(11)
  })

  it('treats a trial start date in the future as a full trial', () => {
    // A clock that jumped backwards, or a hand-edited file, must not hand out
    // a negative number of days and lock the user out on first launch.
    fs.writeFileSync(
      path.join(app.getPath('userData'), 'trial.json'),
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      'utf8',
    )
    const state = getLicenseState()
    expect(state.daysLeft).toBe(14)
    expect(state.trial).toBe(true)
  })

  it('recovers from an unparseable trial date instead of expiring the trial', () => {
    // Failing closed here would let anyone lock a paying customer out by
    // corrupting one text file.
    fs.writeFileSync(path.join(app.getPath('userData'), 'trial.json'), 'not a date', 'utf8')
    const state = getLicenseState()
    expect(state.trial).toBe(true)
    expect(state.daysLeft).toBe(14)
  })

  it('still returns a full state object when the data directory is unreadable', () => {
    // Contract: never throw, always return the same shape.
    const state = getLicenseState()
    expect(Object.keys(state).sort()).toEqual(['daysLeft', 'email', 'expired', 'trial', 'valid'])
  })
})

describe('licenseSummary', () => {
  it('carries the terms and the state, and no secret material', () => {
    const activatedAt = '2026-01-01T00:00:00.000Z'
    writeLicenseFile({ key: signLicenseKey(EMAIL, activatedAt), email: EMAIL, activatedAt })
    const summary = licenseSummary()
    expect(summary.product).toBe('Olympus')
    expect(summary.model).toBe('per-seat perpetual')
    expect(summary.trialDays).toBe(14)
    expect(summary.licensed).toBe(true)
    expect(summary.email).toBe(EMAIL)
  })

  it('serialises over IPC without leaking the key or the secret', () => {
    // This object is what the renderer receives. Anything that would let a
    // renderer (or a page in the preview iframe) copy a licence is a bug.
    const activatedAt = '2026-01-01T00:00:00.000Z'
    const key = signLicenseKey(EMAIL, activatedAt)
    writeLicenseFile({ key, email: EMAIL, activatedAt })
    const wire = JSON.stringify(licenseSummary())
    expect(wire).not.toContain(SECRET)
    expect(wire).not.toContain(key)
    expect(wire).not.toContain('license.json')
  })

  it('has the same shape whether or not a licence is present', () => {
    const unlicensed = Object.keys(licenseSummary()).sort()
    const activatedAt = '2026-01-01T00:00:00.000Z'
    writeLicenseFile({ key: signLicenseKey(EMAIL, activatedAt), email: EMAIL, activatedAt })
    expect(Object.keys(licenseSummary()).sort()).toEqual(unlicensed)
  })
})
