import { describe, expect, it } from 'vitest'
import { SETTINGS_SCHEMA_VERSION, migrateSettings } from '../electron/settings'

describe('SETTINGS_SCHEMA_VERSION', () => {
  it('is a positive integer, since 0 is the implicit "unversioned" marker', () => {
    expect(Number.isInteger(SETTINGS_SCHEMA_VERSION)).toBe(true)
    expect(SETTINGS_SCHEMA_VERSION).toBeGreaterThan(0)
  })
})

describe('migrateSettings', () => {
  it('stamps a version onto a version-0 (unversioned) file', () => {
    // A version 0 file is any settings.json written before the schemaVersion
    // field existed. Every existing user has one, so this is the path that
    // matters most on the first release that ships this.
    const legacy = { lastProject: '/home/me/project', projects: [{ id: 'a', name: 'A', path: '/home/me/a' }] }
    const result = migrateSettings(legacy)
    expect(result.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('preserves the user data of a version-0 file through the migration', () => {
    const legacy = {
      lastProject: '/home/me/project',
      permissionMode: 'bypass',
      projectRoots: ['/home/me'],
    }
    const result = migrateSettings(legacy)
    expect(result.lastProject).toBe('/home/me/project')
    expect(result.permissionMode).toBe('bypass')
    expect(result.projectRoots).toEqual(['/home/me'])
  })

  it('migrates a version-1 file through to the current version', () => {
    const current = { schemaVersion: 1, lastProject: '/x' }
    const result = migrateSettings(current)
    expect(result.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(result.lastProject).toBe('/x')
  })

  it('is idempotent: migrating an already-migrated file changes nothing', () => {
    const once = migrateSettings({ lastProject: '/x', projectRoots: ['/r'] })
    const twice = migrateSettings(once)
    expect(twice).toEqual(once)
  })

  it('idempotent across three passes, not just two', () => {
    // Cheap insurance against a migration step that is not a fixed point.
    let state: Record<string, unknown> = { lastProject: '/x' }
    for (let i = 0; i < 3; i += 1) state = migrateSettings(state)
    expect(state.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('leaves a file that is already current untouched, by identity', () => {
    // migrateSettings returns `raw` itself when from >= current, so a
    // no-op migration allocates nothing. Asserting identity catches an
    // accidental rewrite of a current file on every launch.
    const current = { schemaVersion: SETTINGS_SCHEMA_VERSION, lastProject: '/x' }
    expect(migrateSettings(current)).toBe(current)
  })

  it('does not downgrade a file written by a newer build', () => {
    // A user who ran a newer Olympus, then downgraded, must not have their
    // schema version rewritten downward and have step N+1 silently re-run.
    const future = { schemaVersion: SETTINGS_SCHEMA_VERSION + 5, lastProject: '/x' }
    expect(migrateSettings(future).schemaVersion).toBe(SETTINGS_SCHEMA_VERSION + 5)
  })

  it('does not mutate its input', () => {
    const input = { lastProject: '/x' }
    const snapshot = { ...input }
    migrateSettings(input)
    expect(input).toEqual(snapshot)
  })

  it('does not fail on an entirely empty object', () => {
    expect(migrateSettings({}).schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('treats a non-numeric schemaVersion as version 0 rather than trusting it', () => {
    // A hand-edited file with "schemaVersion": "1" would otherwise compare as
    // NaN and skip every migration step, silently losing user data.
    const result = migrateSettings({ schemaVersion: '1', lastProject: '/x' } as unknown as Record<string, unknown>)
    expect(result.schemaVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(result.lastProject).toBe('/x')
  })
})
