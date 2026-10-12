import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makeContext, defaultRoot, writeJson } from '../src/lib.mjs'

/** A context rooted in a temp folder, with the real config, a fixed clock and recorded logs. */
export function tempCtx(over = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kern-marketing-'))
  fs.cpSync(path.join(defaultRoot, 'config'), path.join(root, 'config'), { recursive: true })
  writeJson(path.join(root, 'assets', 'catalog.json'), [
    { id: 'hero', file: 'hero.jpg', type: 'image', description: 'Hero' },
    { id: 'agents', file: 'agents.jpg', type: 'image', description: 'Agents' },
    { id: 'diff', file: 'diff.jpg', type: 'image', description: 'Diff' },
    { id: 'demo', file: 'demo.mp4', type: 'video', description: 'Demo reel' },
  ])
  const logs = []
  const ctx = makeContext({ root, now: () => new Date('2026-10-12T15:00:00Z'), live: true, assetBase: 'https://example.com/assets', log: (...a) => logs.push(a.join(' ')), ...over })
  ctx.username = 'kernapp'
  ctx.logs = logs
  return ctx
}

/** An Instagram stand in that records every call. */
export function fakeGraph({ media = [], comments = {}, failPublish } = {}) {
  const calls = []
  const rec = (name) => async (...args) => { calls.push([name, ...args]); return undefined }
  return {
    calls,
    publishImage: async (a) => { calls.push(['publishImage', a]); if (failPublish) throw failPublish; return 'media_1' },
    publishCarousel: async (a) => { calls.push(['publishCarousel', a]); return 'media_2' },
    publishReel: async (a) => { calls.push(['publishReel', a]); return 'media_3' },
    permalink: async (id) => `https://instagram.com/p/${id}`,
    me: async () => ({ username: 'kernapp' }),
    recentMedia: async () => media,
    comments: async (id) => comments[id] ?? [],
    reply: async (id, text) => { calls.push(['reply', id, text]) },
    hide: async (id) => { calls.push(['hide', id]) },
    insights: async () => ({ reach: 100, saved: 2, shares: 1 }),
    unused: rec('unused'),
  }
}

export const fakeLlm = (fn) => ({ json: async (system, user) => fn(system, user) })
