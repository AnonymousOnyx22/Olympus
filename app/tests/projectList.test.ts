import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let settings: Record<string, unknown>
vi.mock('../electron/settings', () => ({
  getSettings: () => settings,
  updateSettings: (patch: Record<string, unknown>) => { settings = { ...settings, ...patch } },
}))

describe('listProjects', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kern-projects-'))
    settings = { projects: [], projectRoots: [], hiddenProjects: [], projectMeta: {} }
  })

  it('does not list a project whose folder no longer exists, but keeps one that does', async () => {
    const present = path.join(dir, 'present')
    fs.mkdirSync(present)
    settings.projects = [
      { id: 'present', name: 'Present', path: present },
      { id: 'gone', name: 'Gone', path: path.join(dir, 'gone') },
    ]
    const { listProjects } = await import('../electron/projects')
    const names = listProjects().map((project) => project.name)
    expect(names).toEqual(['Present'])
    // The entry is only hidden, so it returns if the folder does.
    expect((settings.projects as unknown[]).length).toBe(2)
  })
})
