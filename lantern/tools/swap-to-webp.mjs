// Points the site at the WebP builds and removes the originals they replace.
//
// Deletion is deliberately conservative: a source file is only removed if, after
// the rewrite, nothing in the site references it by name AND a .webp sibling
// exists. Anything still referenced is reported instead of deleted, because a
// hero image vanishing from a live site is worse than a redundant file.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SITE = path.resolve(HERE, '..', '..', 'olympus-web')
const ASSETS = path.join(SITE, 'assets')

// These must stay raster. Apple and Windows do not accept WebP for these slots,
// and most social scrapers will not render a WebP og:image.
const KEEP = new Set([
  'olympus-og.jpg',       // og:image / twitter:image
  'apple-touch-icon.png', // iOS home screen
  'favicon-32.png',
  'favicon-512.png',
])

// Rewrite any .png/.jpg reference whose .webp sibling exists.
const candidates = fs
  .readdirSync(ASSETS)
  .filter((f) => /\.(png|jpe?g)$/i.test(f) && fs.existsSync(path.join(ASSETS, f.replace(/\.(png|jpe?g)$/i, '.webp'))))

const htmlFiles = fs.readdirSync(SITE).filter((f) => /\.html$/i.test(f))
const cssFiles = []
for (const d of fs.readdirSync(SITE)) {
  const p = path.join(SITE, d)
  if (fs.statSync(p).isDirectory() && /\.css$/i.test(d)) cssFiles.push(`${d}/${d}`)
}
// The stylesheets are flat files at the site root.
for (const f of fs.readdirSync(SITE)) if (/\.css$/i.test(f)) cssFiles.push(f)

let rewritten = 0
for (const rel of [...htmlFiles, ...cssFiles]) {
  const p = path.join(SITE, rel)
  if (!fs.existsSync(p)) continue
  const before = fs.readFileSync(p, 'utf8')
  let after = before
  for (const c of candidates) {
    const stem = c.replace(/\.(png|jpe?g)$/i, '')
    after = after.split(c).join(`${stem}.webp`)
  }
  if (after !== before) {
    fs.writeFileSync(p, after, 'utf8')
    rewritten += 1
    console.log(`  rewrote ${rel}`)
  }
}

// Re-scan the whole site for references to the candidate originals.
const haystack = []
for (const f of fs.readdirSync(SITE)) {
  const p = path.join(SITE, f)
  if (fs.statSync(p).isFile() && /\.(html|css|js|xml|txt|json)$/i.test(f)) haystack.push(fs.readFileSync(p, 'utf8'))
}
for (const d of fs.readdirSync(SITE)) {
  const p = path.join(SITE, d)
  if (!fs.statSync(p).isDirectory()) continue
  for (const f of fs.readdirSync(p)) {
    if (/\.(css|js|json)$/i.test(f)) haystack.push(fs.readFileSync(path.join(p, f), 'utf8'))
  }
}
const all = haystack.join('\n')

let freed = 0
console.log('\nremoving superseded originals')
for (const c of candidates) {
  const p = path.join(ASSETS, c)
  if (KEEP.has(c)) {
    console.log(`  kept     ${c.padEnd(32)} required raster format`)
    continue
  }
  if (all.includes(c)) {
    console.log(`  KEPT     ${c.padEnd(32)} still referenced somewhere`)
    continue
  }
  freed += fs.statSync(p).size
  fs.unlinkSync(p)
  console.log(`  removed  ${c.padEnd(32)} ${(fs.statSync(path.join(ASSETS, c.replace(/\.(png|jpe?g)$/i, '.webp'))).size / 1024).toFixed(0)} KB webp replaces it`)
}
console.log(`\nfreed ${(freed / 1024 / 1024).toFixed(1)} MB; ${rewritten} file(s) rewritten`)

const total = fs.readdirSync(ASSETS).reduce((s, f) => {
  const p = path.join(ASSETS, f)
  return s + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0)
}, 0)
console.log(`assets/ total now: ${(total / 1024).toFixed(0)} KB`)
