// Replaces hard-coded placeholder values in the site source with {{tokens}},
// so site.config.json becomes the single place they are set.
//
// Run once. Idempotent: a token that is already a token is left alone.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'olympus-web')
const files = fs.readdirSync(SITE).filter((f) => f.endsWith('.html'))

// Longest first: the download URLs embed filenames that also exist as tokens,
// so the whole URL must be replaced before its parts.
const MAP = [
  ['https://downloads.example.com/olympus/0.1.0/Olympus-0.1.0-arm64.dmg', '{{urls.downloadBase}}/{{artifacts.macArm64}}'],
  ['https://downloads.example.com/olympus/0.1.0/Olympus-0.1.0-x64.dmg', '{{urls.downloadBase}}/{{artifacts.macIntel}}'],
  ['https://downloads.example.com/olympus/0.1.0/Olympus-0.1.0-setup.exe', '{{urls.downloadBase}}/{{artifacts.windows}}'],
  ['https://downloads.example.com/olympus/0.1.0/olympus_0.1.0_amd64.AppImage', '{{urls.downloadBase}}/{{artifacts.linux}}'],
  ['https://buy.example.com/olympus', '{{urls.checkout}}'],
  ['https://docs.example.com/olympus', '{{urls.docs}}'],
  ['support@example.com', '{{contact.supportEmail}}'],
  ['security@example.com', '{{contact.securityEmail}}'],
  ['[SERVICE EMAIL]', '{{contact.serviceEmail}}'],
  ['[LEGAL NAME]', '{{entity.legalName}}'],
  ['[THE LICENSOR]', '{{entity.legalName}}'],
  ['[THE SELLER]', '{{entity.legalName}}'],
  ['[REGISTERED ADDRESS FOR SERVICE OF PROCESS]', '{{entity.registeredAddress}}'],
  ['[REGISTERED ADDRESS]', '{{entity.registeredAddress}}'],
  ['[JURISDICTION]', '{{entity.jurisdiction}}'],
  ['[COMPANY NUMBER]', '{{entity.companyNumber}}'],
  ['[PLACEHOLDER]', '{{entity.legalName}}'],
  ['https://projectclipforge.netlify.app', '{{urls.site}}'],
]

let total = 0
for (const f of files) {
  const p = path.join(SITE, f)
  let text = fs.readFileSync(p, 'utf8')
  const before = text
  for (const [from, to] of MAP) text = text.split(from).join(to)
  if (text !== before) {
    fs.writeFileSync(p, text, 'utf8')
    const n = MAP.filter(([from]) => before.includes(from)).length
    total += n
    console.log(`  ${f.padEnd(22)} ${n} substitution group(s)`)
  }
}

// sitemap too
const smPath = path.join(SITE, 'sitemap.xml')
if (fs.existsSync(smPath)) {
  let sm = fs.readFileSync(smPath, 'utf8')
  const b = sm
  sm = sm.split('https://projectclipforge.netlify.app').join('{{urls.site}}')
  if (sm !== b) {
    fs.writeFileSync(smPath, sm, 'utf8')
    console.log('  sitemap.xml            origin -> {{urls.site}}')
  }
}

console.log(`\n  ${total} placeholder group(s) tokenised`)

const left = []
for (const f of files) {
  const text = fs.readFileSync(path.join(SITE, f), 'utf8')
  for (const d of ['downloads.example.com', 'buy.example.com', 'docs.example.com', '@example.com']) {
    if (text.includes(d)) left.push(`${f}: ${d}`)
  }
  for (const m of text.matchAll(/\[[A-Z][A-Z \-]{3,40}\]/g)) left.push(`${f}: ${m[0]}`)
}
console.log(left.length ? `\n  still present:\n     ${left.join('\n     ')}` : '\n  no placeholder domains or bracketed names remain in the source')
