// Drives the real Safari application through Apple's own safaridriver (macOS only).
//   sudo safaridriver --enable     (once per machine)
//   node tests/safari/real-safari.mjs
// This is Safari itself, not the WebKit engine inside Playwright.
import { Builder, By, until } from 'selenium-webdriver'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort()
const PORT = 4795
const base = `http://127.0.0.1:${PORT}`
let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = spawn(process.execPath, [path.join(root, 'tests', 'serve.mjs'), String(PORT)], { stdio: 'ignore' })
await sleep(800)
const driver = await new Builder().forBrowser('safari').build()
try {
  const caps = await driver.getCapabilities()
  console.log(`Safari ${caps.get('browserVersion')} on ${caps.get('platformName')}`)
  await driver.manage().window().setRect({ width: 1440, height: 900, x: 0, y: 0 })
  const js = (script, ...args) => driver.executeScript(script, ...args)
  const open = async (file) => { await driver.get(`${base}/${file}`); await driver.wait(until.elementLocated(By.css('h1')), 10000); await sleep(600) }
  const css = (selector) => driver.findElement(By.css(selector))

  // every page: loads, one h1, a Kern title, no sideways scroll
  for (const file of PAGES) {
    await open(file)
    const info = await js('return { h1: document.querySelectorAll("h1").length, title: document.title, over: document.documentElement.scrollWidth - innerWidth }')
    check(`${file} loads in Safari with one h1, a Kern title and no sideways scroll`, info.h1 === 1 && /Kern/.test(info.title) && info.over <= 1, JSON.stringify(info))
  }

  // the dot grid draws real pixels in Safari's canvas
  await open('index.html')
  const lit = await js('const c=document.querySelector("canvas.dots--hero");const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=160)if(d[i]>0)n++;return n')
  check('the dot grid paints in Safari', lit > 200, `(${lit} lit samples)`)

  // the four agent windows: working dots, unless macOS has Reduce Motion on (then they stay still, by design)
  await sleep(2500)
  const reduced = await js('return matchMedia("(prefers-reduced-motion: reduce)").matches')
  const marks = await js('return document.querySelectorAll("[data-mark] .think-dots").length')
  const title = await js('return document.querySelector("[data-agent] [data-title]").textContent')
  console.log(`Reduce Motion is ${reduced ? 'ON' : 'off'} on this machine`)
  check(reduced ? 'with Reduce Motion on, the agent windows stay on their first state' : 'the four agent windows show the working dots',
    reduced ? marks === 0 && title === 'Homepage headline' : marks === 4, `(${marks} dots, "${title}")`)

  // app preview: switch to Connections and see all 21 services
  await css('[data-tab="connections"]').click()
  await sleep(500)
  check('the preview switches to Connections with 21 services', (await js('return document.querySelectorAll("#pane-connections .cx-row").length')) === 21)

  // navigation: hovering opens a menu, and clicking an item navigates
  await open('features.html')
  const group = await css('div.nav__group')
  await driver.actions({ async: true }).move({ origin: group }).perform()
  await sleep(500)
  check('hovering Product opens its menu', await js('return getComputedStyle(document.querySelector("div.nav__group .menu")).visibility') === 'visible')
  await js('document.querySelector("div.nav__group .menu a[href=\\"models.html\\"]").click()')
  await driver.wait(until.urlContains('models.html'), 5000)
  await driver.wait(until.elementLocated(By.css('.mp__btn')), 10000)
  check('a menu item navigates', (await driver.getCurrentUrl()).includes('models.html'))

  // model picker
  await js('document.querySelector(".mp__btn").scrollIntoView({block:"center"})')
  await sleep(300)
  await css('.mp__btn').click()
  await sleep(400)
  await js('document.querySelector(".mp__opt[data-model=\\"Kimi\\"]").scrollIntoView({block:"nearest"})')
  await css('.mp__opt[data-model="Kimi"]').click()
  await sleep(400)
  check('the model picker switches the window to Kimi', (await css('[data-name]').getText()) === 'Kimi')

  // connections: open a service, type a key, save, see it verified
  await open('connections.html')
  await js('document.querySelector(".cx-row[data-id=\\"netlify\\"]").scrollIntoView({block:"center"})')
  await css('.cx-row[data-id="netlify"]').click()
  await sleep(500)
  await css('[data-field="NETLIFY_AUTH_TOKEN"]').sendKeys('nfp_abcdefghij')
  await css('[data-act="save"]').click()
  await driver.wait(until.elementTextContains(await css('.cx-badge'), 'Verified'), 6000).catch(() => {})
  check('a saved key verifies, and the env panel lists it', /Verified/.test(await css('.cx-badge').getText()) && /NETLIFY_AUTH_TOKEN/.test(await css('#env').getText()))

  // diff review
  await open('agents.html')
  await js('document.querySelector("[data-accept]").scrollIntoView({block:"center"})')
  await css('[data-accept]').click()
  await sleep(600)
  check('Accept writes the change', await js('return document.querySelector("[data-diff]").classList.contains("is-accepted")'))

  // projects library
  await open('projects.html')
  await css('[data-q]').sendKeys('python')
  await sleep(400)
  check('searching the projects library finds one match', (await js('return document.querySelectorAll(".pj").length')) === 1)

  // scroll reveal replays in Safari
  await open('index.html')
  await js('const e=document.querySelector(".section [data-reveal]"); e.scrollIntoView({block:"center"})')
  await sleep(900)
  const shown = await js('return document.querySelector(".section [data-reveal]").classList.contains("is-in")')
  await js('window.scrollTo(0,0)')
  await sleep(900)
  const hidden = !(await js('return document.querySelector(".section [data-reveal]").classList.contains("is-in")'))
  check('scroll animations fade in and out in Safari', shown && hidden, JSON.stringify({ shown, hidden }))
} finally {
  await driver.quit().catch(() => {})
  server.kill()
}
console.log(failures ? `\n${failures} FAILED in real Safari` : '\nAll checks passed in real Safari.')
process.exit(failures ? 1 : 0)
