#!/usr/bin/env node
// node src/cli.mjs <plan|publish|engage|report|approve|status>
// Nothing reaches Instagram unless LIVE=1 is set. Without it every command is a dry run.
import { makeContext, listJson } from './lib.mjs'
import { makeGraph } from './graph.mjs'
import { llmFromEnv } from './llm.mjs'
import { plan } from './plan.mjs'
import { publish } from './publish.mjs'
import { engage } from './engage.mjs'
import { report } from './report.mjs'
import { describe, setStatus } from './approve.mjs'

const [command, ...args] = process.argv.slice(2)
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const needGraph = () => makeGraph({ userId: process.env.IG_USER_ID, token: process.env.IG_ACCESS_TOKEN, host: process.env.IG_API_HOST || undefined, version: process.env.IG_API_VERSION || undefined })

async function main() {
  const ctx = makeContext()
  if (command === 'plan') {
    ctx.llm = llmFromEnv()
    return plan(ctx, { count: flag('count') ? Number(flag('count')) : undefined, status: flag('as') === 'approved' ? 'approved' : 'pending' })
  }
  if (command === 'publish') { if (ctx.live) ctx.graph = needGraph(); return publish(ctx) }
  if (command === 'engage') { ctx.llm = llmFromEnv(); ctx.graph = needGraph(); return engage(ctx) }
  if (command === 'report') { ctx.graph = needGraph(); return report(ctx) }
  if (command === 'status') {
    const posts = listJson(ctx.dir('queue', 'posts')).map((x) => x.data)
    const count = (s) => posts.filter((p) => p.status === s).length
    console.log(`Mode: ${ctx.live ? 'LIVE' : 'dry run (set LIVE=1 to post)'}`)
    console.log(['pending', 'approved', 'published', 'missed', 'failed', 'rejected'].map((s) => `${s}: ${count(s)}`).join('  '))
    return
  }
  if (command === 'approve') {
    const [kind, id] = args
    if (!kind || kind === 'list') return console.log(describe(ctx))
    if (!['post', 'reply', 'reject'].includes(kind)) throw new Error('Usage: approve list | post <id> | reply <id> [--text "..."] | reject <post|reply> <id>')
    if (kind === 'reject') { setStatus(ctx, args[1], args[2], 'rejected'); return console.log('Rejected.') }
    setStatus(ctx, kind, id, 'approved', { text: flag('text') })
    return console.log('Approved. It goes out at its scheduled time on the next publish run.')
  }
  throw new Error('Usage: node src/cli.mjs <plan|publish|engage|report|approve|status>')
}

main().then((r) => { if (r && typeof r === 'object') console.log(JSON.stringify(r, null, 2)) }).catch((e) => { console.error(e.message); process.exit(e.auth ? 3 : 1) })
