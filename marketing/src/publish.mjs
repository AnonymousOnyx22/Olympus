// Publishes approved posts whose time has come. Safe by default: without LIVE=1 it only says what it would do.
import { listJson, writeJson, localDate } from './lib.mjs'
import { checkPost, publishedOn } from './guard.mjs'

const MAX_ATTEMPTS = 3

export async function publish(ctx) {
  const tz = ctx.policy.timezone ?? 'UTC'
  const now = ctx.now()
  const stale = (ctx.policy.staleAfterHours ?? 24) * 3_600_000
  const all = listJson(ctx.dir('queue', 'posts'))
  const posts = all.map((x) => x.data)
  const result = { published: [], missed: [], failed: [], waiting: 0, dryRun: [] }

  for (const { file, data: post } of all) {
    if (post.status !== 'approved') continue
    const due = Date.parse(post.scheduledAt)
    if (due > now.getTime()) { result.waiting++; continue }
    if (now.getTime() - due > stale) {
      post.status = 'missed'; post.note = 'Not published: it was more than the allowed time past its slot'
      writeJson(file, post); result.missed.push(post.id); continue
    }
    const problems = checkPost(post, ctx, { history: posts.filter((p) => p.status === 'published') })
    if (problems.length) { post.status = 'failed'; post.note = `Blocked by the rules: ${problems.join('; ')}`; writeJson(file, post); result.failed.push(post.id); continue }
    const today = localDate(now, tz)
    if (publishedOn(posts, today, tz) >= (ctx.policy.maxPostsPerDay ?? 1)) { ctx.log(`Holding ${post.id}: the daily post limit is reached`); result.waiting++; continue }

    if (!ctx.live) { ctx.log(`DRY RUN: would publish ${post.id} (${post.type})`); result.dryRun.push(post.id); continue }
    try {
      const media = post.type === 'carousel' ? await ctx.graph.publishCarousel({ imageUrls: post.media, caption: post.caption })
        : post.type === 'reel' ? await ctx.graph.publishReel({ videoUrl: post.media[0], caption: post.caption })
          : await ctx.graph.publishImage({ imageUrl: post.media[0], caption: post.caption })
      post.status = 'published'; post.publishedAt = now.toISOString(); post.igMediaId = media
      post.permalink = await ctx.graph.permalink(media).catch(() => undefined)
      writeJson(file, post); result.published.push(post.id)
      ctx.log(`Published ${post.id}`)
    } catch (error) {
      post.attempts = (post.attempts ?? 0) + 1; post.lastError = error.message
      if (error.auth) { writeJson(file, post); throw error }
      if (post.attempts >= MAX_ATTEMPTS) post.status = 'failed'
      writeJson(file, post); result.failed.push(post.id)
      ctx.log(`Could not publish ${post.id} (attempt ${post.attempts}): ${error.message}`)
    }
  }
  return result
}
