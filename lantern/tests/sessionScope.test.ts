import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { sameDirectory, sessionsInDirectory } from '../electron/sessionScope'

describe('project conversation isolation', () => {
  const root = path.resolve('sample-project')
  it('excludes sibling and nested project histories', () => {
    const own = { id: 'own', directory: root, title: 'Keep all session fields' }
    expect(sessionsInDirectory([own, { id: 'other', directory: root + '-other' }, { id: 'nested', directory: path.join(root, 'child') }], root)).toEqual([own])
  })
  it('fails closed for absent or malformed session data', () => {
    expect(sessionsInDirectory([null, {}, { id: 'bad' }], root)).toEqual([])
    expect(sessionsInDirectory({}, root)).toEqual([])
    expect(sameDirectory(root, null)).toBe(false)
  })
  it('normalizes trailing separators and uses the host case rules', () => {
    expect(sameDirectory(root + path.sep, root)).toBe(true)
    expect(sameDirectory(root.toUpperCase(), root)).toBe(process.platform === 'win32' || root === root.toUpperCase())
  })
})
