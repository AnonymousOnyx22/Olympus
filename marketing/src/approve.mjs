// Approving is a status change on a file. In CI, merging the weekly plan's pull request does the same thing.
import path from 'node:path'
import { listJson, writeJson } from './lib.mjs'

const dirFor = (kind) => (kind === 'reply' ? 'replies' : 'posts')

export function pending(ctx) {
  return {
    posts: listJson(ctx.dir('queue', 'posts')).map((x) => x.data).filter((p) => p.status === 'pending'),
    replies: listJson(ctx.dir('queue', 'replies')).map((x) => x.data).filter((r) => r.status === 'pending'),
  }
}

function find(ctx, kind, id) {
  const dir = ctx.dir('queue', dirFor(kind))
  const hit = listJson(dir).find((x) => (kind === 'reply' ? x.data.commentId : x.data.id) === id)
  if (!hit) throw new Error(`No ${kind} with id ${id}`)
  return hit
}

export function setStatus(ctx, kind, id, status, { text } = {}) {
  const { file, data } = find(ctx, kind, id)
  if (!['approved', 'rejected', 'pending'].includes(status)) throw new Error(`Unknown status ${status}`)
  data.status = status
  if (text !== undefined) { if (kind === 'reply') data.text = text; else data.caption = text }
  data.decidedAt = ctx.now().toISOString()
  writeJson(file, data)
  return data
}

export function describe(ctx) {
  const { posts, replies } = pending(ctx)
  const lines = []
  for (const p of posts) lines.push(`POST ${p.id}  ${p.type}  ${p.scheduledAt}\n  ${p.caption.replace(/\n/g, '\n  ')}\n  approve: npm run approve -- post ${p.id}`)
  for (const r of replies) lines.push(`REPLY ${r.commentId}  @${r.username} (${r.intent}, ${r.why})\n  comment: ${r.comment}\n  suggested: ${r.text || '(none)'}\n  approve: npm run approve -- reply ${r.commentId}`)
  return lines.length ? lines.join('\n\n') : 'Nothing is waiting for approval.'
}
export const rel = (ctx, file) => path.relative(ctx.root, file)
