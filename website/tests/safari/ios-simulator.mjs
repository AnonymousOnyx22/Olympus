// Opens the site in real Mobile Safari inside the iOS Simulator and saves a screenshot of each page (macOS only).
//   node tests/safari/ios-simulator.mjs [outputDir]
// A page counts as loaded when its screenshot is not blank. The screenshots are kept as CI artifacts so a
// person can look at the real iPhone rendering.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = path.resolve(process.argv[2] || path.join(root, 'ios-screenshots'))
const PORT = 4796
const PAGES = ['index', 'features', 'models', 'agents', 'projects', 'connections', 'security', 'faq']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sh = (...args) => execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', maxBuffer: 50e6 })

// the newest available iPhone
const listing = JSON.parse(sh('list', 'devices', 'available', '-j')).devices
const runtimes = Object.keys(listing).filter((r) => /iOS/.test(r)).sort()
let device
for (const r of runtimes.reverse()) { device = listing[r].filter((d) => /^iPhone/.test(d.name)).pop(); if (device) { console.log(`Simulator: ${device.name} on ${r.split('.').pop()}`); break } }
if (!device) { console.error('No iPhone simulator is installed'); process.exit(2) }

fs.mkdirSync(out, { recursive: true })
const server = spawn(process.execPath, [path.join(root, 'tests', 'serve.mjs'), String(PORT)], { stdio: 'ignore' })
let failures = 0
try {
  await sleep(800)
  try { sh('boot', device.udid) } catch { /* already booted */ }
  sh('bootstatus', device.udid, '-b')
  await sleep(3000)
  for (const page of PAGES) {
    sh('openurl', device.udid, `http://127.0.0.1:${PORT}/${page}.html`)
    await sleep(page === 'index' ? 9000 : 6000)
    const file = path.join(out, `iphone-${page}.png`)
    sh('io', device.udid, 'screenshot', file)
    const size = fs.statSync(file).size
    // a blank or error page compresses to a tiny PNG; a rendered page is far larger
    const ok = size > 60_000
    console.log(`${ok ? 'PASS' : 'FAIL'} ${page}.html renders in Mobile Safari  (${Math.round(size / 1024)} KB screenshot)`)
    if (!ok) failures++
  }
} finally {
  try { sh('shutdown', device.udid) } catch { /* ignore */ }
  server.kill()
}
console.log(failures ? `\n${failures} pages failed to render` : `\nAll pages rendered in Mobile Safari. Screenshots: ${out}`)
process.exit(failures ? 1 : 0)
