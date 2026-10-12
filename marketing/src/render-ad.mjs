// Renders a motion graphics advert from marketing/ads/*.html to a 1080x1920 MP4 reel.
//   node src/render-ad.mjs ads/workspace.html assets/kern-ad-workspace.mp4
// Needs the website dependencies (Playwright) and ffmpeg (set FFMPEG to its path if it is not on PATH).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { defaultRoot, readJson } from './lib.mjs'

const [htmlArg, outArg] = process.argv.slice(2)
if (!htmlArg || !outArg) { console.error('Usage: node src/render-ad.mjs <ad.html> <out.mp4>'); process.exit(2) }
const website = path.resolve(defaultRoot, '..', 'website')
const { chromium } = createRequire(path.join(website, 'package.json'))('@playwright/test')
const FPS = 30
const html = path.resolve(defaultRoot, htmlArg)
const out = path.resolve(defaultRoot, outArg)
const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'kern-ad-'))

const browser = await chromium.launch()
try {
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 } })).newPage()
  await page.goto(pathToFileURL(html).href)
  await page.evaluate((icons) => window.setIcons(icons), readJson(path.join(website, 'assets', 'model-icons.json'), {}).icons)
  const seconds = await page.evaluate(() => window.DURATION)
  const total = seconds * FPS
  for (let i = 0; i < total; i++) {
    const data = await page.evaluate((t) => { window.draw(t); return document.getElementById('c').toDataURL('image/jpeg', 0.92) }, i / FPS)
    fs.writeFileSync(path.join(frames, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(data.split(',')[1], 'base64'))
  }
} finally { await browser.close() }

const ffmpeg = process.env.FFMPEG || 'ffmpeg'
const run = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.jpg'),
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', out], { encoding: 'utf8' })
fs.rmSync(frames, { recursive: true, force: true })
if (run.status !== 0) { console.error(run.stderr || 'ffmpeg failed'); process.exit(1) }
console.log(`Wrote ${out}`)
