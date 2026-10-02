import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('site publication gate', () => {
  const script = path.resolve('tools/build-site.mjs')
  function fixture(value = 'Olympus test fixture') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-build-test-'))
    fs.writeFileSync(path.join(dir, 'site.config.json'), JSON.stringify({ entity: { legalName: value }, urls: { site: 'https://audit.invalid' }, _required: ['entity.legalName'] }))
    fs.writeFileSync(path.join(dir, 'index.html'), '<h1>{{entity.legalName}}</h1>')
    return dir
  }
  it('checks a configured site without replacing existing output', () => {
    const dir = fixture()
    fs.mkdirSync(path.join(dir, 'dist'))
    fs.writeFileSync(path.join(dir, 'dist', 'sentinel.txt'), 'keep')
    execFileSync(process.execPath, [script, '--site', dir, '--check'])
    expect(fs.readdirSync(path.join(dir, 'dist'))).toEqual(['sentinel.txt'])
  })
  it('rejects missing owner information before writing output', () => {
    const dir = fixture('TODO: owner')
    expect(() => execFileSync(process.execPath, [script, '--site', dir], { stdio: 'pipe' })).toThrow()
    expect(fs.existsSync(path.join(dir, 'dist'))).toBe(false)
  })
  it('rejects unresolved page tokens before replacing existing output', () => {
    const dir = fixture()
    fs.writeFileSync(path.join(dir, 'index.html'), '{{unknown.value}}')
    expect(() => execFileSync(process.execPath, [script, '--site', dir], { stdio: 'pipe' })).toThrow()
    expect(fs.existsSync(path.join(dir, 'dist'))).toBe(false)
  })
})
