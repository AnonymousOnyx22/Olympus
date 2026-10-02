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

const files = new Map()
const collect = (dir, prefix = '') => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const from = path.join(dir, entry.name)
    const relative = path.join(prefix, entry.name)
    if (entry.isDirectory()) { collect(from, relative); continue }
    let data = fs.readFileSync(from)
    if (/\.(html|css|js|xml|txt|json)$/i.test(entry.name)) {
      let text = data.toString('utf8')
      for (const [k, v] of Object.entries(T)) text = text.split('{{' + k + '}}').join(v)
      data = Buffer.from(text)
    }
    files.set(relative, data)
  }
}

const SKIP = new Set(['dist', 'site.config.json', 'README.md', 'node_modules'])

console.log('olympus site build')
console.log(`  config: site.config.json (${Object.keys(T).length} tokens)`)

if (missing.length) {
  console.log(`\n  REFUSING TO BUILD — ${missing.length} required value(s) still TODO:`)
  for (const k of missing) console.log(`     ${k.padEnd(28)} = ${T[k]}`)
  console.log('\n  Fill these in site.config.json and re-run. A site that names no seller and')
  console.log('  points its download buttons at a host that does not exist is worse than unbuilt,')
  console.log('  because it looks finished.')
  console.log('\n  --check reports missing configuration without publishing incomplete pages.')
  process.exit(1)
}

if (checkOnly) {
  console.log('  --check: verifying only, not writing')
}

// ---- render ---------------------------------------------------------------
collect(SITE)
const bytes = [...files.values()].reduce((sum, data) => sum + data.length, 0)

// ---- verify the OUTPUT, not the source -----------------------------------
const problems = []
for (const [f, data] of files) {
  if (!f.endsWith('.html')) continue
  const text = data.toString('utf8')
  for (const d of domains) {
    if (text.includes(d)) problems.push(`${f}: still references ${d}`)
  }
  if (/\{\{[\w.]+\}\}/.test(text)) problems.push(`${f}: unresolved {{token}}`)
}
const sm = files.get('sitemap.xml')?.toString('utf8') ?? ''
if (sm && !sm.includes(T['urls.site'])) problems.push('sitemap.xml: canonical origin not substituted')

if (problems.length) {
  console.log(`\n  ${problems.length} problem(s) in the built output:`)
  for (const p of problems) console.log(`     ${p}`)
  process.exit(1)
}

if (!checkOnly) {
  if (path.dirname(OUT) !== SITE || path.basename(OUT) !== 'dist') throw new Error('Unsafe output directory')
  fs.rmSync(OUT, { recursive: true, force: true })
  for (const [relative, data] of files) {
    const target = path.join(OUT, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, data)
  }
}
console.log(checkOnly ? '  checked without writing files' : '  built dist/ ' + (bytes / 1024 / 1024).toFixed(2) + ' MB')
console.log(`  verified: no placeholder domains, no unresolved tokens`)
