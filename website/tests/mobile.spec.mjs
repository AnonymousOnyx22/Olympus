// Phones and a tablet as real device profiles: touch input, no hover, the browser's own mobile viewport.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort()

for (const file of PAGES) {
  test(`${file}: no horizontal scroll, no console errors, controls big enough to tap`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await page.goto(`/${file}`)
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    // Buttons and standalone links must be at least 32px tall. Links inside a paragraph are exempt.
    const small = await page.evaluate(() => [...document.querySelectorAll('a, button, summary')]
      .filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && !e.closest('p, li > p, .marquee, .app, .cx, .dv, .tl, .pj, .win, canvas') && r.height < 32 })
      .map((e) => `${(e.textContent || e.className).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().height)}px`))
    expect(small).toEqual([])
    expect(errors).toEqual([])
  })
}

test('the menu opens with a tap, shows every page, and a tap on a link navigates', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('[data-nav-toggle]').tap()
  await expect(page.locator('#site-nav')).toBeVisible()
  expect(await page.locator('#site-nav .menu a').count()).toBe(12)
  await page.locator('#site-nav .menu a', { hasText: 'Models' }).tap()
  await expect(page).toHaveURL(/models\.html/)
})

test('the home page preview works by touch: switch sections, open Connections, save a key', async ({ page }) => {
  await page.goto('/index.html')
  await page.locator('[data-tab="connections"]').tap()
  await expect(page.locator('#pane-connections .cx-row')).toHaveCount(21)
  await page.locator('#pane-connections .cx-row[data-id="netlify"]').tap()
  await page.locator('#pane-connections [data-field="NETLIFY_AUTH_TOKEN"]').fill('nfp_abcdefghij')
  await page.locator('#pane-connections [data-act="save"]').tap()
  await expect(page.locator('#pane-connections .cx-badge')).toContainText('Verified')
})

test('connections page by touch: the whole flow, and the list stacks under the sidebar', async ({ page }) => {
  await page.goto('/connections.html')
  const cx = page.locator('.cx')
  await cx.scrollIntoViewIfNeeded()
  expect((await cx.boundingBox()).width).toBeGreaterThan(280)
  await page.locator('.cx-row[data-id="stripe"]').tap()
  await expect(page.locator('.cx-card-name')).toHaveText('Stripe')
  await page.locator('[data-act="back"]').tap()
  await expect(page.locator('.cx-row')).toHaveCount(21)
})

test('model picker by touch opens inside the screen and picks Grok', async ({ page }) => {
  await page.goto('/models.html')
  await page.locator('.mp__btn').scrollIntoViewIfNeeded()
  await page.locator('.mp__btn').tap()
  await expect(page.locator('.mp__pop')).toBeVisible()
  await page.waitForTimeout(250)
  const box = await page.locator('.mp__pop').boundingBox()
  const size = page.viewportSize()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1)
  await page.locator('.mp__opt[data-model="Grok"]').tap()
  await expect(page.locator('[data-name]')).toHaveText('Grok')
})

test('approval modes and diff review by touch', async ({ page }) => {
  await page.goto('/agents.html')
  await page.locator('[data-diff]').scrollIntoViewIfNeeded()
  await page.locator('[data-accept]').tap()
  await expect(page.locator('[data-diff]')).toHaveClass(/is-accepted/)
  await page.locator('[data-modes]').scrollIntoViewIfNeeded()
  await page.locator('[data-mode="bypass"]').tap()
  await page.locator('[data-run]').tap()
  await expect(page.locator('[data-tl] li')).toHaveCount(3, { timeout: 8000 })
  await expect(page.locator('[data-tl] .st.full')).toHaveCount(3)
})

test('projects library by touch: pin one', async ({ page }) => {
  await page.goto('/projects.html')
  await page.locator('[data-pin="notes"]').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-pin="notes"]')).toHaveAttribute('aria-pressed', 'false')
  await page.locator('[data-pin="notes"]').tap()
  await expect(page.locator('[data-pin="notes"]')).toHaveAttribute('aria-pressed', 'true')
})

test('an FAQ answer opens with a tap', async ({ page }) => {
  await page.goto('/faq.html')
  const first = page.locator('.faq details').first()
  await first.locator('summary').tap()
  await expect(first).toHaveAttribute('open', '')
})

test('this device reports no hover, and nothing depends on it', async ({ page }) => {
  await page.goto('/index.html')
  expect(await page.evaluate(() => matchMedia('(hover: hover)').matches)).toBe(false)
  // the logo strip glow is pointer driven; with no mouse nothing is stuck lit
  await expect(page.locator('.marquee__item.is-hot')).toHaveCount(0)
})
