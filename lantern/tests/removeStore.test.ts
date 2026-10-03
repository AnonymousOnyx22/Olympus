import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

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
  }
})

let settingsDir: string
let storeDir: string
beforeEach(async () => {
  settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-settings-test-'))
  storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-store-test-'))
  fs.writeFileSync(path.join(storeDir, 'index.html'), '<html></html>')
  const electron = await import('electron')
  ;(electron.app as unknown as { __setUserData: (d: string) => void }).__setUserData(settingsDir)
  vi.resetModules()
})
afterEach(() => {
  fs.rmSync(settingsDir, { recursive: true, force: true })
  fs.rmSync(storeDir, { recursive: true, force: true })
})

describe('removeStore', () => {
  it('unlists a store but leaves its folder on disk by default', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ stores: [{ id: storeDir, name: 'Test Store', path: storeDir }] })
    const { removeStore, listStores } = await import('../electron/projects')

    const after = removeStore(storeDir, false)

    expect(after.some((s) => s.id === storeDir)).toBe(false)
    expect(listStores().some((s) => s.id === storeDir)).toBe(false)
    expect(fs.existsSync(storeDir)).toBe(true)
  })

  it('also deletes the folder from disk when deleteFiles is true', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ stores: [{ id: storeDir, name: 'Test Store', path: storeDir }] })
    const { removeStore } = await import('../electron/projects')

    removeStore(storeDir, true)

    expect(fs.existsSync(storeDir)).toBe(false)
  })

  it('leaves other stores untouched', async () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-other-store-'))
    try {
      const { updateSettings } = await import('../electron/settings')
      updateSettings({ stores: [{ id: storeDir, name: 'Test Store', path: storeDir }, { id: otherDir, name: 'Other Store', path: otherDir }] })
      const { removeStore } = await import('../electron/projects')

      const after = removeStore(storeDir, true)

      expect(after.some((s) => s.id === otherDir)).toBe(true)
      expect(fs.existsSync(otherDir)).toBe(true)
    } finally {
      fs.rmSync(otherDir, { recursive: true, force: true })
    }
  })

  it('is a no-op, not a throw, for a store id that no longer exists', async () => {
    const { removeStore, listStores } = await import('../electron/projects')
    expect(() => removeStore('not-a-real-store-id', true)).not.toThrow()
    expect(listStores()).toEqual([])
  })
})
