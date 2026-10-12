// The rules every post and reply must pass before anything is sent. They are code, not a request to the
// model, so a model that ignores its instructions still cannot publish something the rules forbid.
import { localDate } from './lib.mjs'

const words = (text) => new Set(String(text).toLowerCase().match(/[a-z0-9']+/g) ?? [])
export function similarity(a, b) {
  const x = words(a), y = words(b)
  if (!x.size || !y.size) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / (x.size + y.size - shared)
}

/** Claims that would be untrue while Kern is not publicly available. */
const AVAILABILITY = [/\bdownload(s|ed)?\b/i, /\bnow available\b|\bavailable (now|today|to everyone|for everyone)\b/i, /\b(is|are|now|going) live\b/i, /\blaunch(ed|ing)?\b/i, /\bsign ?up\b/i, /\bwaitlist\b/i, /\bprice|pricing|\$\d|free trial\b/i, /\bget it\b/i, /\btry it (now|today)\b/i]

export function checkText(text, policy, { allowLinks = false } = {}) {
  const problems = []
  const lower = String(text).toLowerCase()
  for (const phrase of policy.bannedPhrases ?? []) if (lower.includes(phrase.toLowerCase())) problems.push(`uses a banned phrase: "${phrase}"`)
  if (!policy.publicLaunch) for (const re of AVAILABILITY) if (re.test(text)) { problems.push(`claims availability, but Kern is not public (${re})`); break }
  if (!allowLinks && /https?:\/\/|www\./i.test(text)) problems.push('contains a link')
  return problems
}

export function checkPost(post, ctx, { history = [] } = {}) {
  const { policy } = ctx
  const problems = checkText(post.caption ?? '', policy, { allowLinks: true })
  const tags = (post.caption?.match(/#\w+/g) ?? [])
  if ((post.caption ?? '').length > 2200) problems.push('caption is over 2200 characters')
  if (!post.caption || post.caption.trim().length < 20) problems.push('caption is missing or too short')
  if (tags.length > (policy.maxHashtags ?? 8)) problems.push(`more than ${policy.maxHashtags ?? 8} hashtags`)
  if (!['image', 'carousel', 'reel'].includes(post.type)) problems.push(`unknown post type: ${post.type}`)
  const urls = post.media ?? []
  if (!urls.length) problems.push('has no media')
  if (post.type === 'carousel' && (urls.length < 2 || urls.length > 10)) problems.push('a carousel needs 2 to 10 images')
  if (post.type !== 'carousel' && urls.length > 1) problems.push('only a carousel can have several media items')
  for (const u of urls) if (!/^https:\/\//.test(u)) problems.push(`media must be a public https URL: ${u}`)
  for (const old of history.slice(-20)) if (similarity(old.caption, post.caption) > 0.8) { problems.push('is nearly identical to a recent post'); break }
  if (post.scheduledAt && Number.isNaN(Date.parse(post.scheduledAt))) problems.push('scheduledAt is not a date')
  return problems
}

/** How many posts went out on a given local day, to enforce maxPostsPerDay. */
export function publishedOn(posts, day, timeZone) {
  return posts.filter((p) => p.status === 'published' && p.publishedAt && localDate(new Date(p.publishedAt), timeZone) === day).length
}

export function checkReply(text, ctx) {
  const problems = checkText(text, ctx.policy)
  if (!text || !text.trim()) problems.push('empty reply')
  if (text && text.length > (ctx.policy.replyMaxChars ?? 280)) problems.push('reply is too long')
  if (/[\u{1F300}-\u{1FAFF}].*[\u{1F300}-\u{1FAFF}].*[\u{1F300}-\u{1FAFF}]/u.test(text ?? '')) problems.push('too many emoji')
  return problems
}
