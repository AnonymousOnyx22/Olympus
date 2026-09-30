import { describe, expect, it } from 'vitest'
import { projectKey } from '../electron/projects'
import path from 'node:path'

const IS_WIN = process.platform === 'win32'

describe('projectKey', () => {
  it('resolves a relative path to an absolute one', () => {
    // Project ids are stored absolute, so a relative path must never produce
    // a key that could collide with the real project.
    const key = projectKey('.')
    expect(path.isAbsolute(key)).toBe(true)
  })

  it('is stable: the same input always produces the same key', () => {
    const dir = path.resolve('some', 'project')
    expect(projectKey(dir)).toBe(projectKey(dir))
  })

  it('treats the same path written differently as the same project', () => {
    // path.resolve normalises trailing separators and `.`/`..` segments, so a
    // user who picks "C:\code\app\" and "C:\code\app" gets one project, not two.
    const base = path.resolve('code', 'app')
    expect(projectKey(base)).toBe(projectKey(`${base}${path.sep}`))
    expect(projectKey(base)).toBe(projectKey(path.join(base, '.', '..', 'app')))
  })

  it('keeps genuinely different paths distinct', () => {
    const a = path.resolve('code', 'app-one')
    const b = path.resolve('code', 'app-two')
    expect(projectKey(a)).not.toBe(projectKey(b))
  })

  it('lowercases on Windows only, because NTFS is case-insensitive there', () => {
    // A neutral fixture path: nothing in a shipped repository should carry the
    // name or home directory of whoever happened to write the test.
    const base = path.resolve('Users', 'SomeUser', 'Project')
    const key = projectKey(base)
    if (IS_WIN) {
      // On Windows "C:\Users\SomeUser" and "C:\users\someuser" are the same directory.
      // Comparing them case-sensitively would register the project twice.
      expect(key).toBe(projectKey(base.toLowerCase()))
      expect(key).toBe(projectKey(base.toUpperCase()))
    } else {
      // On macOS/Linux the filesystem may be case-sensitive, so collapsing case
      // would merge two directories that are genuinely different. Do not.
      expect(key).not.toBe(projectKey(base.toLowerCase()))
    }
  })

  it('does not throw on a trailing backslash after a drive letter', () => {
    // "C:\" vs "C:" is a classic source of two-entries-for-one-project bugs.
    const rooted = path.parse(process.cwd()).root
    expect(() => projectKey(rooted)).not.toThrow()
    expect(projectKey(rooted)).toBe(projectKey(path.normalize(rooted)))
  })
})
