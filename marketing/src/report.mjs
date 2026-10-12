// A weekly read of how recent posts did, written to state/insights.json so the next plan can learn from it.
// Deterministic on purpose: no model needed to count.
import { listJson, writeJson } from './lib.mjs'

export async function report(ctx) {
  const mine = new Map(listJson(ctx.dir('queue', 'posts')).map((x) => [x.data.igMediaId, x.data]).filter(([id]) => id))
  const rows = []
  for (const m of await ctx.graph.recentMedia(30)) {
    const ins = await ctx.graph.insights(m.id)
    const score = (m.like_count ?? 0) + (m.comments_count ?? 0) * 3 + (ins.saved ?? 0) * 4 + (ins.shares ?? 0) * 4
    const known = mine.get(m.id)
    rows.push({ id: m.id, type: known?.type ?? m.media_type?.toLowerCase(), caption: (m.caption ?? '').slice(0, 80), timestamp: m.timestamp, hour: new Date(m.timestamp).getUTCHours(), likes: m.like_count ?? 0, comments: m.comments_count ?? 0, reach: ins.reach ?? null, saved: ins.saved ?? 0, shares: ins.shares ?? 0, score })
  }
  const byType = {}
  for (const r of rows) { (byType[r.type] ??= []).push(r.score) }
  const avg = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
  const ranked = [...rows].sort((a, b) => b.score - a.score)
  const lines = []
  if (ranked[0]) lines.push(`Best post so far: "${ranked[0].caption}" (${ranked[0].type}, score ${ranked[0].score}).`)
  const types = Object.entries(byType).map(([t, xs]) => [t, avg(xs), xs.length]).sort((a, b) => b[1] - a[1])
  if (types.length) lines.push(`Average score by type: ${types.map(([t, a, n]) => `${t} ${a} (${n} post${n === 1 ? '' : 's'})`).join(', ')}.`)
  if (ranked.length > 1) lines.push(`Weakest: "${ranked.at(-1).caption}" (${ranked.at(-1).type}).`)
  if (!rows.length) lines.push('No posts yet, so there is nothing to learn from.')
  const result = { generatedAt: ctx.now().toISOString(), posts: rows, summary: lines.join(' ') }
  writeJson(ctx.dir('state', 'insights.json'), result)
  ctx.log(result.summary)
  return result
}
