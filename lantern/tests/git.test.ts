import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gitStatus } from '../electron/git'

// A real throwaway repo, because gitStatus's whole job is parsing porcelain
// output, and a hand-written fixture would only prove the fixture parses.
function gitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore', windowsHide: true })
    return true
  } catch {
    return false
  }
}

// Deterministic identity: a fixed author/committer and a fixed timezone, so a
// commit made "now" is reproducible and no test reads the user's global config.
const gitEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Olympus Test',
  GIT_AUTHOR_EMAIL: 'test@olympus.invalid',
  GIT_COMMITTER_NAME: 'Olympus Test',
  GIT_COMMITTER_EMAIL: 'test@olympus.invalid',
  GIT_TERMINAL_PROMPT: '0',
}

let repo = ''
const run = (...args: string[]) => execFileSync('git', args, { cwd: repo, env: gitEnv, windowsHide: true }).toString()
const write = (name: string, body: string) => fs.writeFileSync(path.join(repo, name), body, 'utf8')

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-git-'))
  // `init` with an explicit branch, because the default initial branch name
  // differs between git versions and is user-configurable. Relying on the
  // default made this test fail on a machine with init.defaultBranch set.
  run('init', '--quiet', '--initial-branch=main', '.')
  write('README.md', '# fixture\n')
  run('add', 'README.md')
  run('commit', '--quiet', '-m', 'initial')
})

afterAll(() => {
  if (repo && path.dirname(path.dirname(repo)) === os.tmpdir()) {
    fs.rmSync(repo, { recursive: true, force: true })
  }
})

describe.skipIf(!gitAvailable())('gitStatus', () => {
  it('reports the branch, no upstream, and no remote on a fresh local repo', async () => {
    const status = await gitStatus(repo)
    expect(status.branch).toBe('main')
    expect(status.upstream).toBeNull()
    expect(status.remotes).toEqual([])
    expect(status.files).toEqual([])
    expect(status.ahead).toBe(0)
    expect(status.behind).toBe(0)
  })

  it('reports a clean tree as no files at all, not an empty-string entry', async () => {
    // A stray '' in `files` would render as a blank row in the diff view.
    expect((await gitStatus(repo)).files).toStrictEqual([])
  })

  it('lists an untracked file', async () => {
    write('untracked.txt', 'hello\n')
    try {
      const status = await gitStatus(repo)
      expect(status.files).toContain('untracked.txt')
    } finally {
      fs.rmSync(path.join(repo, 'untracked.txt'))
    }
  })

  it('lists modified, added and deleted paths with their porcelain status', async () => {
    write('README.md', '# fixture\nchanged\n')
    write('added.txt', 'new\n')
    run('add', 'added.txt')
    try {
      const status = await gitStatus(repo)
      expect(status.files).toContain('README.md')
      expect(status.files).toContain('added.txt')
    } finally {
      run('checkout', '--', 'README.md')
      run('reset', '--quiet', 'HEAD', '--', 'added.txt')
      fs.rmSync(path.join(repo, 'added.txt'))
    }
  })

  it('strips the 3-character porcelain prefix from every path', async () => {
    // gitStatus slices entry.slice(3). A path that still starts with a status
    // letter means the porcelain format assumption broke, and the diff viewer
    // would try to open a file literally named " M foo.txt".
    write('prefix-check.txt', 'x\n')
    try {
      const { files } = await gitStatus(repo)
      for (const file of files) {
        expect(file).not.toMatch(/^[ MADRCU?!]{2} /)
      }
    } finally {
      fs.rmSync(path.join(repo, 'prefix-check.txt'))
    }
  })

  it('handles a staged file, where the status letter is in the first column', async () => {
    // Staged entries put their letter at index 0, not 1. A parser that only
    // looks at the second column misses the rename/delete skip and emits a
    // bogus extra file.
    write('staged.txt', 's\n')
    run('add', 'staged.txt')
    try {
      const status = await gitStatus(repo)
      expect(status.files).toContain('staged.txt')
      expect(status.files).toHaveLength(1)
    } finally {
      run('reset', '--quiet', 'HEAD', '--', 'staged.txt')
      fs.rmSync(path.join(repo, 'staged.txt'))
    }
  })

  it('reports a detached HEAD as a null branch rather than throwing', async () => {
    // gitAction refuses to commit on a detached HEAD, so gitStatus has to
    // surface that as data instead of a rejected promise.
    const head = run('rev-parse', 'HEAD').trim()
    run('checkout', '--quiet', '--detach', head)
    try {
      const status = await gitStatus(repo)
      expect(status.branch).toBeNull()
    } finally {
      run('checkout', '--quiet', 'main')
    }
  })

  it('rejects for a directory that is not a repository at all', async () => {
    const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-notrepo-'))
    try {
      await expect(gitStatus(notARepo)).rejects.toThrow()
    } finally {
      fs.rmSync(notARepo, { recursive: true, force: true })
    }
  })

  it('works from a subdirectory, because the user opens a project at any depth', async () => {
    const nested = path.join(repo, 'a', 'b')
    fs.mkdirSync(nested, { recursive: true })
    try {
      const status = await gitStatus(nested)
      expect(status.branch).toBe('main')
    } finally {
      fs.rmSync(path.join(repo, 'a'), { recursive: true, force: true })
    }
  })
})
