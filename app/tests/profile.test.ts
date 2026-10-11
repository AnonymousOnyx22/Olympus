import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveUserDataDir } from '../electron/profile'

let appData: string
beforeEach(() => { appData = fs.mkdtempSync(path.join(os.tmpdir(), 'kern-profile-')) })
afterEach(() => fs.rmSync(appData, { recursive: true, force: true }))

describe('resolveUserDataDir', () => {
  it('uses the override untouched', () => {
    expect(resolveUserDataDir(appData, '/somewhere/else')).toBe('/somewhere/else')
    expect(fs.existsSync(path.join(appData, 'Kern'))).toBe(false)
  })

  it('copies an Olympus profile into Kern once, leaving the old one alone and skipping locks and caches', () => {
    const legacy = path.join(appData, 'Olympus')
    fs.mkdirSync(path.join(legacy, 'Cache'), { recursive: true })
    fs.writeFileSync(path.join(legacy, 'settings.json'), '{"projects":[]}')
    fs.writeFileSync(path.join(legacy, 'SingletonLock'), 'x')
    fs.writeFileSync(path.join(legacy, 'Cache', 'blob'), 'x')

    const dir = resolveUserDataDir(appData, undefined)
    expect(dir).toBe(path.join(appData, 'Kern'))
    expect(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).toBe('{"projects":[]}')
    expect(fs.existsSync(path.join(dir, 'SingletonLock'))).toBe(false)
    expect(fs.existsSync(path.join(dir, 'Cache'))).toBe(false)
    expect(fs.existsSync(path.join(legacy, 'settings.json'))).toBe(true)
  })

  it('never overwrites an existing Kern profile', () => {
    fs.mkdirSync(path.join(appData, 'Olympus'))
    fs.writeFileSync(path.join(appData, 'Olympus', 'settings.json'), 'old')
    fs.mkdirSync(path.join(appData, 'Kern'))
    fs.writeFileSync(path.join(appData, 'Kern', 'settings.json'), 'new')
    resolveUserDataDir(appData, undefined)
    expect(fs.readFileSync(path.join(appData, 'Kern', 'settings.json'), 'utf8')).toBe('new')
  })

  it('does nothing on a fresh machine', () => {
    expect(resolveUserDataDir(appData, undefined)).toBe(path.join(appData, 'Kern'))
    expect(fs.existsSync(path.join(appData, 'Kern'))).toBe(false)
  })
})
