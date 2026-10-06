import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { storeBrandName } from '../electron/storeBrand'

const dirs: string[] = []
const make = (name: string, files: Record<string, string>) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-'))
  dirs.push(root)
  const dir = path.join(root, name)
  for (const [file, body] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); fs.writeFileSync(path.join(dir, file), body) }
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
afterEach(() => { while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true }) })

describe('storeBrandName', () => {
  it('prefers the STORE-LOG.md title', () => {
    expect(storeBrandName(make('build-me-a-xyz', { 'STORE-LOG.md': '# STORE-LOG.md - Chalkline\n\nbody', 'package.json': '{"name":"other"}' }))).toBe('Chalkline')
  })
  it('uses a package name that is not the folder name, without a store suffix', () => {
    expect(storeBrandName(make('build-a-small-abc123', { 'package.json': '{"name":"marginalia-store"}' }))).toBe('Marginalia')
  })
  it('falls back to the home page title', () => {
    expect(storeBrandName(make('build-a-small-def456', { 'package.json': '{"name":"build-a-small-def456"}', 'public/index.html': '<title>Dogear | Sticker books</title>' }))).toBe('Dogear')
  })
  it('returns null when the store has not named itself yet', () => {
    expect(storeBrandName(make('build-me-a-new', { 'package.json': '{"name":"build-me-a-new"}' }))).toBeNull()
  })
})
