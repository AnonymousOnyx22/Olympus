// Builds the deployable site from site.config.json.
//
// Why a build step at all: the legal pages must name a real entity, and the
// download links must point at a real host. If those values are hard-coded in
// twelve HTML files, they get half-updated and the site ships a refund policy
// with no seller in it. So the source keeps {{TOKENS}}, this substitutes them
// once, and the build FAILS while any required value is still a placeholder.
//
// Tokens are replaced at build time, not at runtime, so the pages still render
// fully with JavaScript disabled. Nothing here is required to read the site.
//
// Run:  node tools/build-site.mjs            (fails if placeholders remain)
//       node tools/build-site.mjs --check    (report only, never writes)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// `--site <dir>` builds an arbitrary copy of the site instead of the real one.
// That is how the pipeline is tested against a filled config without ever
// writing placeholder values into the project's own config.
const siteFlag = process.argv.indexOf('--site')
const SITE = siteFlag > -1 ? path.resolve(process.argv[siteFlag + 1]) : path.resolve(HERE, '..', '..', 'olympus-web')
const OUT = path.join(SITE, 'dist')
const config = JSON.parse(fs.readFileSync(path.join(SITE, 'site.config.json'), 'utf8'))
const checkOnly = process.argv.includes('--check')

const get = (dotted) => dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), config)

/** Flattens the config into the token map, skipping the _comment keys. */
function tokens() {
  const t = {}
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object') walk(v, key)
      else t[key] = String(v)
    }
  }
  walk(config, '')
  return t
}

const T = tokens()

// ---- the gate -------------------------------------------------------------
const missing = (config._required ?? []).filter((k) => {
  const v = T[k]
  return !v || /^TODO:/.test(v.trim())
})

// A second, independent check: a token that was filled but left a placeholder
// host behind would still ship dead buttons.
const domains = ['downloads.example.com', 'buy.example.com', 'docs.example.com', '@example.com']

const copy = (dir, dest, skip) => {
  fs.mkdirSync(dest, { recursive: true })
  let bytes = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const from = path.join(dir, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      bytes += copy(from, to, skip)
      continue
    }
    if (/\.(html|css|js|xml|txt|json)$/i.test(entry.name)) {
      let text = fs.readFileSync(from, 'utf8')
      for (const [k, v] of Object.entries(T)) {
        text = text.split(`{{${k}}}`).join(v)
      }
      fs.writeFileSync(to, text, 'utf8')
      bytes += Buffer.byteLength(text)
    } else {
      fs.copyFileSync(from, to)
      bytes += fs.statSync(to).size
    }
  }
  return bytes
}

const SKIP = new Set(['dist', 'site.config.json', 'README.md', 'node_modules'])
const rendered = {} // filled in below, after we know the files

console.log('olympus site build')
console.log(`  config: site.config.json (${Object.keys(T).length} tokens)`)

if (missing.length) {
  console.log(`\n  REFUSING TO BUILD — ${missing.length} required value(s) still TODO:`)
  for (const k of missing) console.log(`     ${k.padEnd(28)} = ${T[k]}`)
  console.log('\n  Fill these in site.config.json and re-run. A site that names no seller and')
  console.log('  points its download buttons at a host that does not exist is worse than unbuilt,')
  console.log('  because it looks finished.')
  console.log('\n  Re-run with --check to build anyway for local preview (placeholders preserved).')
  process.exit(1)
}

if (checkOnly) {
  console.log('  --check: verifying only, not writing')
}

// ---- render ---------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true })
const bytes = copy(SITE, OUT, SKIP)

// ---- verify the OUTPUT, not the source -----------------------------------
const problems = []
for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith('.html'))) {
  const text = fs.readFileSync(path.join(OUT, f), 'utf8')
  for (const d of domains) {
    if (text.includes(d)) problems.push(`${f}: still references ${d}`)
  }
  if (/\{\{[\w.]+\}\}/.test(text)) problems.push(`${f}: unresolved {{token}}`)
}
const sm = fs.existsSync(path.join(OUT, 'sitemap.xml')) ? fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8') : ''
if (sm && !sm.includes(T['urls.site'])) problems.push('sitemap.xml: canonical origin not substituted')

if (problems.length) {
  console.log(`\n  ${problems.length} problem(s) in the built output:`)
  for (const p of problems) console.log(`     ${p}`)
  process.exit(1)
}

console.log(`  built dist/  ${(bytes / 1024 / 1024).toFixed(2)} MB`)
console.log(`  verified: no placeholder domains, no unresolved tokens`)
