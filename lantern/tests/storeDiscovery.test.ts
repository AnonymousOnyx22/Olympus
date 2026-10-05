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
let projectsRoot: string
let storesRoot: string

beforeEach(async () => {
  settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-settings-test-'))
  // createStore puts a store beside its Projects root, in a sibling "Stores" folder - mirror
  // that layout exactly so discovery is reading the same place the real app writes to.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-base-'))
  projectsRoot = path.join(base, 'Projects')
  storesRoot = path.join(base, 'Stores')
  fs.mkdirSync(projectsRoot, { recursive: true })
  const electron = await import('electron')
  ;(electron.app as unknown as { __setUserData: (d: string) => void }).__setUserData(settingsDir)
  vi.resetModules()
})
afterEach(() => {
  fs.rmSync(settingsDir, { recursive: true, force: true })
  fs.rmSync(path.dirname(projectsRoot), { recursive: true, force: true })
})

describe('store auto-discovery', () => {
  it('finds a folder written straight to the Stores root, never created through createStore', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ projectRoots: [projectsRoot] })
    fs.mkdirSync(path.join(storesRoot, 'harbor-desk-muucj959'), { recursive: true })
    const { listStores, projectKey } = await import('../electron/projects')

    const stores = listStores()

    expect(stores).toHaveLength(1)
    expect(stores[0].id).toBe(projectKey(path.join(storesRoot, 'harbor-desk-muucj959')))
    expect(stores[0].path).toBe(path.join(storesRoot, 'harbor-desk-muucj959'))
  })

  it('turns a bare folder name into a readable title', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ projectRoots: [projectsRoot] })
    fs.mkdirSync(path.join(storesRoot, 'harbor-desk-muucj959'), { recursive: true })
    const { listStores } = await import('../electron/projects')

    expect(listStores()[0].name).toBe('Harbor Desk')
  })

  it('does not duplicate a store that was properly registered through createStore', async () => {
    const { updateSettings } = await import('../electron/settings')
    const target = path.join(storesRoot, 'registered-store')
    fs.mkdirSync(target, { recursive: true })
    updateSettings({ projectRoots: [projectsRoot], stores: [{ id: target, name: 'Registered Store', path: target }] })
    const { listStores } = await import('../electron/projects')

    const stores = listStores()

    expect(stores).toHaveLength(1)
    expect(stores[0].name).toBe('Registered Store')
  })

  it('resolves a discovered store to its own folder, so its agent never starts in the wrong place', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ projectRoots: [projectsRoot] })
    const target = path.join(storesRoot, 'harbor-desk-muucj959')
    fs.mkdirSync(target, { recursive: true })
    const { findProject, projectKey } = await import('../electron/projects')

    const found = findProject(projectKey(target))

    expect(found?.path).toBe(target)
    expect(found?.exists).toBe(true)
  })

  it('can delete a discovered store even though it was never in settings.stores', async () => {
    const { updateSettings } = await import('../electron/settings')
    updateSettings({ projectRoots: [projectsRoot] })
    const target = path.join(storesRoot, 'harbor-desk-muucj959')
    fs.mkdirSync(target, { recursive: true })
    const { listStores, removeStore, projectKey } = await import('../electron/projects')
    expect(listStores()).toHaveLength(1)

    removeStore(projectKey(target), true)

    expect(fs.existsSync(target)).toBe(false)
    expect(listStores()).toHaveLength(0)
  })
})
