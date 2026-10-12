// Shared helpers: files, time zones, and the context every command runs with.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
export const writeJson = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}
export const listJson = (dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: path.join(dir, f), data: readJson(path.join(dir, f), null) })).filter((x) => x.data)
}

/** The offset of a time zone from UTC at a given instant, in milliseconds. */
function tzOffsetMs(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - date.getTime()
}
/** 2026-10-12 at 12:30 in Toronto as a UTC Date. */
export function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - tzOffsetMs(new Date(guess), timeZone)
  return new Date(guess - tzOffsetMs(new Date(first), timeZone))
}
/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(date, timeZone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'post'

/** Everything a command needs. Tests pass their own graph, llm, clock and root. */
export function makeContext(over = {}) {
  const root = over.root ?? defaultRoot
  const policy = over.policy ?? readJson(path.join(root, 'config', 'policy.json'), {})
  return {
    root,
    policy,
    brand: over.brand ?? (fs.existsSync(path.join(root, 'config', 'brand.md')) ? fs.readFileSync(path.join(root, 'config', 'brand.md'), 'utf8') : ''),
    facts: over.facts ?? readJson(path.join(root, 'config', 'facts.json'), []),
    now: over.now ?? (() => new Date()),
    live: over.live ?? process.env.LIVE === '1',
    log: over.log ?? ((...args) => console.log(...args)),
    graph: over.graph ?? null,
    llm: over.llm ?? null,
    assetBase: over.assetBase ?? process.env.ASSET_BASE_URL ?? (process.env.GITHUB_REPOSITORY ? `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/marketing/assets` : ''),
    dir: (...parts) => path.join(root, ...parts),
  }
}

export const loadState = (ctx) => readJson(ctx.dir('state', 'state.json'), { handled: {}, repliesToday: { date: '', count: 0 } })
export const saveState = (ctx, state) => writeJson(ctx.dir('state', 'state.json'), state)
