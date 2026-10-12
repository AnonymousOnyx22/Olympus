// Drafts the next batch of posts and schedules them into the posting slots. Nothing is published here:
// the drafts are files in queue/posts that you approve (or, in CI, a pull request you merge).
import { listJson, readJson, writeJson, zonedToUtc, localDate, slug } from './lib.mjs'
import { checkPost } from './guard.mjs'

const SYSTEM = `You write Instagram content for a software product. Follow the brand brief exactly.
Only state things that appear in the FACTS list. Never invent features, numbers, prices, dates or availability.
Reply with JSON only, in this shape:
{"posts":[{"type":"image"|"carousel"|"reel","assets":["asset id", ...],"caption":"text with hashtags at the end","idea":"one line on why this post"}]}`

/** The slots for a batch: spread over the next 7 days, alternating the daily slots. */
export function scheduleSlots(ctx, count, from = ctx.now()) {
  const slots = ctx.policy.postingSlots?.length ? ctx.policy.postingSlots : ['12:30']
  const tz = ctx.policy.timezone ?? 'UTC'
  const out = []
  for (let i = 0; i < count; i++) {
    const offset = Math.floor((i * 7) / count) + 1
    const day = new Date(from.getTime() + offset * 86_400_000)
    const [y, m, d] = localDate(day, tz).split('-').map(Number)
    const [hh, mm] = slots[i % slots.length].split(':').map(Number)
    out.push(zonedToUtc(y, m, d, hh, mm, tz))
  }
  return out
}

export const assetUrl = (ctx, file) => `${ctx.assetBase.replace(/\/$/, '')}/${file}`

export async function plan(ctx, { count, status = 'pending' } = {}) {
  const n = count ?? ctx.policy.postsPerWeek ?? 5
  const catalog = readJson(ctx.dir('assets', 'catalog.json'), [])
  if (!catalog.length) throw new Error('assets/catalog.json is empty. Run `npm run capture` (or add images and videos and list them in the catalog).')
  const history = listJson(ctx.dir('queue', 'posts')).map((x) => x.data)
  const insights = readJson(ctx.dir('state', 'insights.json'), null)
  const user = [
    `BRAND BRIEF:\n${ctx.brand}`,
    `FACTS (the only things you may claim):\n${ctx.facts.map((f) => `- ${f.text}`).join('\n')}`,
    `ASSETS you can use (use the ids):\n${catalog.map((a) => `- ${a.id} [${a.type}]: ${a.description}`).join('\n')}`,
    `RECENT POSTS (do not repeat these):\n${history.slice(-10).map((p) => `- ${p.caption.slice(0, 120)}`).join('\n') || '(none yet)'}`,
    insights ? `WHAT WORKED LATELY:\n${insights.summary}` : '',
    `Write ${n} different posts. Mix the types. A reel needs one video asset, a carousel two to ten image assets, an image one image asset. Each caption starts with a hook, stays under 600 characters and ends with at most ${ctx.policy.maxHashtags ?? 8} hashtags.`,
  ].filter(Boolean).join('\n\n')

  const result = await ctx.llm.json(SYSTEM, user)
  const drafts = Array.isArray(result) ? result : result.posts ?? []
  const times = scheduleSlots(ctx, Math.min(n, drafts.length))
  const made = []
  const rejected = []
  let slot = 0
  for (const d of drafts) {
    if (slot >= times.length) break
    const assets = (d.assets ?? []).map((id) => catalog.find((a) => a.id === id))
    const wantVideo = d.type === 'reel'
    const post = {
      id: '', type: d.type, caption: String(d.caption ?? '').trim(), idea: d.idea ?? '',
      assets: assets.filter(Boolean).map((a) => a.id),
      media: assets.filter(Boolean).filter((a) => (wantVideo ? a.type === 'video' : a.type === 'image')).map((a) => assetUrl(ctx, a.file)),
      scheduledAt: times[slot].toISOString(), status, createdAt: ctx.now().toISOString(),
    }
    if (assets.some((a) => !a)) { rejected.push({ idea: d.idea, problems: ['uses an asset that is not in the catalog'] }); continue }
    const problems = checkPost(post, ctx, { history: [...history, ...made] })
    if (problems.length) { rejected.push({ idea: d.idea, problems }); continue }
    post.id = `${post.scheduledAt.slice(0, 10)}-${slug(post.idea || post.caption)}`
    writeJson(ctx.dir('queue', 'posts', `${post.id}.json`), post)
    made.push(post)
    slot++
  }
  for (const r of rejected) ctx.log(`Dropped a draft (${r.idea || 'no idea'}): ${r.problems.join('; ')}`)
  ctx.log(`Drafted ${made.length} post(s) as ${status}.`)
  return { made, rejected }
}
