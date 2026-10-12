// Makes free post images from the real website, so every image shows the real product.
//   node src/capture.mjs        (needs website dependencies: cd ../website && npm ci && npx playwright install chromium)
// Writes 1080x1350 JPEGs (Instagram's portrait size, and JPEG is the format its API accepts) to assets/
// and lists them in assets/catalog.json. Add your own images or MP4 videos to the same catalog by hand.
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { defaultRoot, readJson, writeJson } from './lib.mjs'

const website = path.resolve(defaultRoot, '..', 'website')
const require = createRequire(path.join(website, 'package.json'))
const { chromium } = require('@playwright/test')
const PORT = 4797

const SHOTS = [
  { id: 'hero', file: 'kern-hero.jpg', page: 'index.html', target: '.hero', description: 'Home page hero: "Every agent. One workspace." with the animated violet dot background' },
  { id: 'agents-working', file: 'kern-agents-working.jpg', page: 'index.html', target: '.app', description: 'Four agent windows working side by side on different projects, each with a different model' },
  { id: 'connections', file: 'kern-connections.jpg', page: 'connections.html', target: '.app', description: 'The Connections page: save a key once and choose which projects get it' },
  { id: 'diff-review', file: 'kern-diff-review.jpg', page: 'agents.html', target: '[data-diff]', description: 'A diff waiting for review: nothing is written until you accept' },
  { id: 'approval-modes', file: 'kern-approval-modes.jpg', page: 'agents.html', target: '[data-modes]', description: 'Three approval modes and what each lets an agent do without asking', before: async (p) => { await p.locator('[data-mode="edit"]').click(); await p.locator('[data-run]').click(); await p.waitForTimeout(2200) } },
  { id: 'projects', file: 'kern-projects.jpg', page: 'projects.html', target: '[data-library]', description: 'The projects library with search, pins and status for every agent' },
  { id: 'features-grid', file: 'kern-features.jpg', page: 'features.html', target: '.grid', description: 'Nine features around your agents: every model, many windows, separate projects, reviewable edits, approval modes, code view, git, local models, connections' },
  { id: 'how-it-works', file: 'kern-how-it-works.jpg', page: 'how-it-works.html', target: '.steps', description: 'Six steps from adding projects to shipping: add projects, connect models, open a window per task, work in parallel, review, run and ship' },
  { id: 'security', file: 'kern-security.jpg', page: 'security.html', target: 'table', description: 'Seven things the app enforces: no network access for the interface, ask first, local endpoints, encrypted keys, no telemetry' },
  { id: 'three-ways', file: 'kern-three-ways.jpg', page: 'models.html', target: '.grid', description: 'Three ways to connect a model: on your computer, with a key, or with the Claude and Codex tools you already use' },
  { id: 'principles', file: 'kern-principles.jpg', page: 'about.html', target: '.grid', description: 'Three principles: neutral, local and quiet' },
  { id: 'model-picker', file: 'kern-model-picker.jpg', page: 'models.html', target: '[data-modelpicker]', description: 'One window, any model: a picker listing Claude, GPT, Gemini, Kimi, Grok and local models', before: async (p) => { await p.locator('.mp__btn').click(); await p.waitForTimeout(400) } },
]

const server = spawn(process.execPath, [path.join(website, 'tests', 'serve.mjs'), String(PORT)], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 800))
const browser = await chromium.launch()
try {
  // 864 CSS px wide at 1.25x is exactly 1080x1350 (Instagram's 4:5 portrait), and keeps text large enough to read
  // on a phone. Reduced motion shows the site's fully populated, still state (the agent windows are not mid-animation).
  const page = await (await browser.newContext({ viewport: { width: 864, height: 1080 }, deviceScaleFactor: 1.25, reducedMotion: 'reduce' })).newPage()
  const out = path.join(defaultRoot, 'assets')
  fs.mkdirSync(out, { recursive: true })
  const catalog = readJson(path.join(out, 'catalog.json'), [])
  for (const shot of SHOTS) {
    await page.goto(`http://127.0.0.1:${PORT}/${shot.page}`)
    await page.addStyleTag({ content: '[data-site]{display:none!important}[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}.note,.try{display:none!important}' })
    await page.waitForTimeout(1200)
    if (shot.before) await shot.before(page)
    // show only the section being featured, centred on its own page
    await page.evaluate((selector) => {
      const target = document.querySelector(selector)
      const section = target.closest('section')
      const main = document.querySelector('main')
      for (const el of [...main.children]) if (el !== section) el.style.display = 'none'
      document.querySelector('footer')?.remove()
      main.style.cssText = 'min-height:100vh;display:grid;align-content:center'
      section.style.borderTop = '0'
      window.scrollTo(0, 0)
    }, shot.target)
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(out, shot.file), type: 'jpeg', quality: 90 })
    const entry = { id: shot.id, file: shot.file, type: 'image', description: shot.description }
    const at = catalog.findIndex((c) => c.id === shot.id)
    if (at >= 0) catalog[at] = entry; else catalog.push(entry)
    console.log(`Captured ${shot.file}`)
  }
  writeJson(path.join(out, 'catalog.json'), catalog)
} finally {
  await browser.close()
  server.kill()
}
