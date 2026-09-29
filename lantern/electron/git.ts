import { execFile } from 'node:child_process'
import type { GitStatus } from '../src/types/opencode'

export function runGit(cwd: string, args: string[], raw = false): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd, windowsHide: true, timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolve(raw ? stdout : stdout.trim())
    })
  })
}

export async function gitStatus(cwd: string): Promise<GitStatus> {
  cwd = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  const branch = await runGit(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(() => '')
  const raw = await runGit(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], true)
  const entries = raw ? raw.split('\0').filter(Boolean) : []
  const files: string[] = []
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    files.push(entry.slice(3))
    if (/[RC]/.test(entry.slice(0, 2))) i++
  }
  const upstream = await runGit(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']).catch(() => null)
  const remotes = (await runGit(cwd, ['remote'])).split('\n').filter(Boolean)
  let ahead = 0
  let behind = 0
  if (upstream) {
    const counts = (await runGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])).split(/\s+/).map(Number)
    ;[ahead, behind] = counts
  }
  return { branch: branch || null, upstream, remotes, files, ahead, behind }
}

const active = new Set<string>()
export async function gitAction(cwd: string, action: unknown, message: unknown): Promise<string> {
  cwd = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (active.has(cwd)) throw new Error('A Git operation is already running for this project.')
  active.add(cwd)
  try {
    const status = await gitStatus(cwd)
    if (!status.branch) throw new Error('HEAD is detached. Switch to a branch in Terminal first.')
    if (action === 'commit') {
      if (typeof message !== 'string' || !message.trim()) throw new Error('Enter a commit message.')
      if (!status.files.length) throw new Error('There are no saved changes to commit.')
      // Stage only the files the user was already shown, by path. `git add --all` would also
      // sweep in anything untracked it decides to include — a .env, a key file, a build
      // artifact — and it does that invisibly, at the moment the user clicked Commit.
      const paths = [...new Set(status.files.map(String))]
      if (paths.length) await runGit(cwd, ['add', '--', ...paths])
      // Anything the user had already staged by hand stays staged; that is their intent.
      await runGit(cwd, ['commit', '-m', message.trim()])
      return 'Changes committed.'
    }
    if (action === 'push') {
      if (!status.remotes.length) throw new Error('Add a Git remote in Terminal before pushing.')
      if (status.upstream) await runGit(cwd, ['push'])
      else {
        const remote = status.remotes.includes('origin') ? 'origin' : status.remotes.length === 1 ? status.remotes[0] : null
        if (!remote) throw new Error('Multiple remotes found. Set an upstream in Terminal first.')
        await runGit(cwd, ['push', '--set-upstream', '--', remote, status.branch])
      }
      return 'Push completed.'
    }
    throw new Error('Unknown Git action.')
  } finally {
    active.delete(cwd)
  }
}
