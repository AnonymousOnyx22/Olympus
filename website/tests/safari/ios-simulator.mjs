// Opens the site in real Mobile Safari inside the iOS Simulator and saves a screenshot of each page (macOS only).
//   node tests/safari/ios-simulator.mjs [outputDir]
// A page counts as loaded when its screenshot is mostly the site's dark background (a page still loading
// is white, and Safari's own toolbar alone is a hundred kilobytes). The screenshots are kept as CI artifacts so a
// person can look at the real iPhone rendering.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = path.resolve(process.argv[2] || path.join(root, 'ios-screenshots'))
const PORT = 4796
const PAGES = ['index', 'features', 'models', 'agents', 'projects', 'connections', 'security', 'faq']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
/** The share of the middle of the screenshot that is dark: the site's background, not a blank white page. */
function darkShare(file) {
  const png = PNG.sync.read(fs.readFileSync(file))
  let dark = 0
  let total = 0
  for (let y = Math.floor(png.height * 0.15); y < png.height * 0.85; y += 6) {
    for (let x = 0; x < png.width; x += 6) {
      const i = (y * png.width + x) * 4
      total++
      if ((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3 < 90) dark++
    }
  }
  return dark / total
}
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
    const file = path.join(out, `iphone-${page}.png`)
    let dark = 0
    // The simulator is slow: keep looking until the page has painted, for up to 40 seconds.
    for (let waited = 0; waited < 40_000 && dark < 0.5; waited += 4000) {
      await sleep(4000)
      sh('io', device.udid, 'screenshot', file)
      dark = darkShare(file)
    }
    const ok = dark >= 0.5
    console.log(`${ok ? 'PASS' : 'FAIL'} ${page}.html renders in Mobile Safari  (${Math.round(dark * 100)}% of the screen is the dark page)`)
    if (!ok) failures++
  }
} finally {
  try { sh('shutdown', device.udid) } catch { /* ignore */ }
  server.kill()
}
console.log(failures ? `\n${failures} pages failed to render` : `\nAll pages rendered in Mobile Safari. Screenshots: ${out}`)
process.exit(failures ? 1 : 0)
