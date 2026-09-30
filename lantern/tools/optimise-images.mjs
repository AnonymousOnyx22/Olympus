// Image pipeline for the site. Converts the oversized PNGs to WebP, drops the
// unreferenced ones, and reports the before/after so the win is measurable rather
// than asserted. Idempotent: safe to re-run.
//
// Run: node tools/optimise-images.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const HERE = path.dirname(fileURLToPath(import.meta.url))
// This script lives in lantern/tools because `sharp` is a dependency of the app.
// The site it maintains is a sibling of lantern/, not a child.
const SITE = path.resolve(HERE, '..', '..', 'olympus-web')
const ASSETS = path.join(SITE, 'assets')

/**
 * Which files are actually referenced, and by what. Anything not in this set is
 * dead weight that is still being published, so it is a candidate for deletion.
 */
function referencedFiles() {
  const haystack = []
  for (const name of fs.readdirSync(SITE)) {
    const p = path.join(SITE, name)
    if (fs.statSync(p).isFile() && /\.(html|css|js|xml|txt)$/i.test(name)) {
      haystack.push(fs.readFileSync(p, 'utf8'))
    }
  }
  for (const d of fs.readdirSync(SITE)) {
    const p = path.join(SITE, d)
    if (!fs.statSync(p).isDirectory()) continue
    for (const f of fs.readdirSync(p)) {
      if (/\.(css|js|json)$/i.test(f)) haystack.push(fs.readFileSync(path.join(p, f), 'utf8'))
    }
  }
  return haystack.join('\n')
}

const used = referencedFiles()
const kb = (n) => `${(n / 1024).toFixed(0)} KB`

const CONVERT = [
  // [source, output, target width cap]
  ['olympus-cartoon-hero.png', 'olympus-cartoon-hero.webp', 2000],
  ['olympus-cartoon-sanctuary.png', 'olympus-cartoon-sanctuary.webp', 2000],
  ['olympus-sanctuary.png', 'olympus-sanctuary.webp', 2000],
  ['olympus-athena.png', 'olympus-athena.webp', 1600],
  ['olympus-clouds.jpg', 'olympus-clouds.webp', 2000],
  ['olympus-mountains.jpg', 'olympus-mountains.webp', 2000],
  ['olympus-hero.jpg', 'olympus-hero.webp', 2000],
]

console.log('converting to WebP')
for (const [src, dst, width] of CONVERT) {
  const from = path.join(ASSETS, src)
  const to = path.join(ASSETS, dst)
  if (!fs.existsSync(from)) {
    console.log(`  skip ${src} (missing)`)
    continue
  }
  const before = fs.statSync(from).size
  await sharp(from)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(to)
  const after = fs.statSync(to).size
  console.log(`  ${src.padEnd(30)} ${kb(before).padStart(8)} -> ${kb(after).padStart(7)}  (${Math.round((1 - after / before) * 100)}% smaller)`)
}

// Anything unreferenced by name is dead. Reported, not deleted: a file may be
// referenced from somewhere this scan cannot see, and deleting on a guess is how
// a hero image disappears from a live site.
console.log('\nunreferenced assets still being published')
for (const f of fs.readdirSync(ASSETS)) {
  const p = path.join(ASSETS, f)
  if (!fs.statSync(p).isFile()) continue
  if (f === 'sources.json' || f === 'olympus-mark.svg') continue
  if (!used.includes(f)) console.log(`  ${f.padEnd(30)} ${kb(fs.statSync(p).size).padStart(8)}`)
}

const total = (dir) =>
  fs.readdirSync(dir).reduce((sum, f) => {
    const p = path.join(dir, f)
    return sum + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0)
  }, 0)

console.log(`\nassets/ now: ${kb(total(ASSETS))}`)
