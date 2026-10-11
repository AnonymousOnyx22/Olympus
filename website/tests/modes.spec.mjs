// Visitors who ask for less motion, or who have JavaScript switched off, still get a complete, readable site.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort()

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('home page: nothing loops or slides, and everything is still shown', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForTimeout(600)
    expect(await page.locator('.marquee__track').evaluate((e) => getComputedStyle(e).animationName)).toBe('none')
    expect(await page.locator('.marquee__set[aria-hidden="true"]').first().evaluate((e) => getComputedStyle(e).display)).toBe('none')
    await page.locator('.section [data-reveal]').first().scrollIntoViewIfNeeded()
    await expect(page.locator('.section [data-reveal]').first()).toHaveCSS('opacity', '1')
    // the agent windows keep their first state instead of looping
    await expect(page.locator('[data-agent] [data-title]').first()).toHaveText('Homepage headline')
    await page.waitForTimeout(3000)
    await expect(page.locator('[data-agent] [data-title]').first()).toHaveText('Homepage headline')
  })

  test('the logo strip shows every name in a static, wrapped row', async ({ page }) => {
    await page.goto('/index.html')
    // GPT and Grok carry a decorative monogram (aria-hidden); the visible name is the text after it.
    const names = await page.locator('.marquee__set:not([aria-hidden="true"]) .marquee__item').evaluateAll((items) => items.map((i) => i.lastChild.textContent.trim()))
    expect(names).toEqual(expect.arrayContaining(['Claude', 'GPT', 'Gemini', 'Kimi', 'Grok', 'Llama']))
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  })
})

test.describe('JavaScript switched off', () => {
  test.use({ javaScriptEnabled: false })

  for (const file of PAGES) {
    test(`${file} is fully readable and reachable`, async ({ page }) => {
      await page.goto(`/${file}`)
      await expect(page.locator('h1')).toBeVisible()
      // scroll reveals and the dimmed steps must not hide anything without scripts
      const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], .step')].filter((e) => parseFloat(getComputedStyle(e).opacity) < 1).length)
      expect(hidden).toBe(0)
      // every page is still reachable from the footer
      expect(await page.locator('.foot a').count()).toBeGreaterThanOrEqual(12)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    })
  }
})
