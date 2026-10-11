import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort()

/** Collects console errors and uncaught exceptions for the life of a page. */
function watch(page) {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return errors
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)

test.describe('every page', () => {
  for (const file of PAGES) {
    test(`${file} loads clean with no horizontal scroll, desktop and phone`, async ({ page }) => {
      const errors = watch(page)
      await page.goto(`/${file}`)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page).toHaveTitle(/Kern/)
      expect(await overflow(page)).toBeLessThanOrEqual(1)
      await page.setViewportSize({ width: 390, height: 800 })
      await page.waitForTimeout(300)
      expect(await overflow(page)).toBeLessThanOrEqual(1)
      expect(errors).toEqual([])
    })
  }
})

test.describe('home page', () => {
  test('the dot grid paints real pixels', async ({ page }) => {
    await page.goto('/index.html')
    await page.waitForTimeout(800)
    const lit = await page.evaluate(() => {
      const c = document.querySelector('canvas.dots--hero')
      const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 3; i < data.length; i += 160) if (data[i] > 0) n++
      return n
    })
    expect(lit).toBeGreaterThan(200)
  })

  test('the logo strip hands the glow from logo to logo under a still mouse, and never pauses', async ({ page }) => {
    await page.goto('/index.html')
    const strip = page.locator('.marquee')
    await strip.scrollIntoViewIfNeeded()
    const box = await strip.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const seen = new Set()
    for (let i = 0; i < 28; i++) {
      const hot = await page.locator('.marquee__item.is-hot').first().textContent({ timeout: 300 }).catch(() => '')
      if (hot) seen.add(hot.trim())
      await page.waitForTimeout(250)
    }
    expect(seen.size).toBeGreaterThanOrEqual(2)
    expect(await page.locator('.marquee__track').evaluate((e) => getComputedStyle(e).animationPlayState)).toBe('running')
    await page.mouse.move(5, 5)
    await expect(page.locator('.marquee__item.is-hot')).toHaveCount(0)
  })

  test('the four agent windows are always working and move on to new tasks', async ({ page }) => {
    await page.goto('/index.html')
    await page.locator('[data-agent]').first().scrollIntoViewIfNeeded()
    await expect(page.locator('[data-mark] .think-dots')).toHaveCount(4)
    const titles = () => page.locator('[data-agent] [data-title]').allTextContents()
    const first = await titles()
    await expect.poll(async () => (await titles()).some((t, i) => t !== first[i]), { timeout: 40_000 }).toBe(true)
    await expect(page.locator('[data-agent] [data-body]').first()).not.toBeEmpty()
  })

  test('scroll animations replay, the header hides and returns, the progress bar moves', async ({ page }) => {
    await page.goto('/index.html')
    const probe = page.locator('.section [data-reveal]').first()
    await probe.scrollIntoViewIfNeeded()
    await expect(probe).toHaveClass(/is-in/)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(probe).not.toHaveClass(/is-in/)
    await probe.scrollIntoViewIfNeeded()
    await expect(probe).toHaveClass(/is-in/)
    await page.evaluate(() => window.scrollTo(0, 0))
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 260); await page.waitForTimeout(60) }
    await expect(page.locator('[data-site]')).toHaveClass(/is-hidden/)
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(60) }
    await expect(page.locator('[data-site]')).not.toHaveClass(/is-hidden/)
    expect(await page.locator('[data-site]').evaluate((e) => parseFloat(e.style.getPropertyValue('--p')))).toBeGreaterThan(0)
  })

  test('the app preview switches sections', async ({ page }) => {
    await page.goto('/index.html')
    await page.locator('[data-tab="connections"]').click()
    await expect(page.locator('#pane-connections .cx-row')).toHaveCount(21)
    await page.locator('[data-tab="projects"]').click()
    await expect(page.locator('#pane-projects')).toHaveClass(/is-on/)
  })
})

test.describe('navigation', () => {
  test('hovering opens a menu, the highlight sits behind the current section, a click navigates', async ({ page }) => {
    await page.goto('/security.html')
    const rects = await page.evaluate(() => {
      const i = document.querySelector('.nav__ind').getBoundingClientRect()
      const l = document.querySelector('.nav__group.is-current > .nav__link').getBoundingClientRect()
      return { dx: Math.abs(i.left - l.left), dw: Math.abs(i.width - l.width) }
    })
    expect(rects.dx).toBeLessThan(2)
    expect(rects.dw).toBeLessThan(2)
    await page.locator('div.nav__group').first().locator('.nav__link').hover()
    const menu = page.locator('div.nav__group').first().locator('.menu')
    await expect(menu).toBeVisible()
    await menu.locator('a', { hasText: 'Models' }).click()
    await expect(page).toHaveURL(/models\.html/)
  })

  test('the cursor spotlight follows the mouse across a whole card grid', async ({ page }) => {
    await page.goto('/features.html')
    const grid = page.locator('.grid').first()
    await grid.scrollIntoViewIfNeeded()
    const b = await grid.boundingBox()
    await page.mouse.move(b.x + 150, b.y + b.height / 2)
    const a = await grid.evaluate((e) => e.style.getPropertyValue('--mx'))
    await page.mouse.move(b.x + b.width - 150, b.y + b.height / 2)
    const z = await grid.evaluate((e) => e.style.getPropertyValue('--mx'))
    expect(a).not.toBe('')
    expect(a).not.toBe(z)
    await expect.poll(() => grid.evaluate((e) => getComputedStyle(e, '::after').opacity)).toBe('1')
  })
})

test.describe('demos', () => {
  test('model picker opens inside the viewport and switches the window to Kimi', async ({ page }) => {
    await page.goto('/models.html')
    await page.locator('.mp__btn').scrollIntoViewIfNeeded()
    await page.locator('.mp__btn').click()
    await expect(page.locator('.mp__pop')).toBeVisible()
    const box = await page.locator('.mp__pop').boundingBox()
    expect(box.y).toBeGreaterThanOrEqual(0)
    await page.locator('.mp__opt[data-model="Kimi"]').click()
    await expect(page.locator('[data-name]')).toHaveText('Kimi')
  })

  test('connections: open a service, save a key, see it verified, per project access changes the env panel', async ({ page }) => {
    await page.goto('/connections.html')
    await page.locator('.cx-row[data-id="netlify"]').click()
    await expect(page.locator('.cx-card-name')).toHaveText('Netlify')
    await expect(page.locator('[data-act="save"]')).toBeDisabled()
    await page.locator('[data-field="NETLIFY_AUTH_TOKEN"]').fill('nfp_abcdefghij')
    await page.locator('[data-act="save"]').click()
    await expect(page.locator('.cx-badge')).toContainText('Checking')
    await expect(page.locator('.cx-badge')).toContainText('Verified')
    await expect(page.locator('#env')).toContainText('NETLIFY_AUTH_TOKEN')
    await page.locator('input[data-project="studio"]').uncheck()
    await expect(page.locator('#env .cx-env').first()).not.toContainText('NETLIFY_AUTH_TOKEN')
    await expect(page.locator('#env .cx-env').nth(1)).toContainText('NETLIFY_AUTH_TOKEN')
    await page.locator('[data-field="NETLIFY_AUTH_TOKEN"]').fill('bad')
    await page.locator('[data-act="save"]').click()
    await expect(page.locator('.cx-badge')).toContainText('Failed')
  })

  test('connections: search and filters', async ({ page }) => {
    await page.goto('/connections.html')
    await expect(page.locator('.cx-row')).toHaveCount(21)
    await page.locator('#cx-search').fill('figma')
    await expect(page.locator('.cx-row')).toHaveCount(1)
    await page.locator('#cx-search').fill('zzz')
    await expect(page.locator('.cx-state')).toContainText('No matching connections')
    await page.locator('[data-act="clear"]').click()
    await page.locator('[data-act="savedonly"]').click()
    await expect(page.locator('.cx-row')).toHaveCount(3)
  })

  test('diff review: accept writes the change, reject asks for a reason', async ({ page }) => {
    await page.goto('/agents.html')
    await page.locator('[data-diff]').scrollIntoViewIfNeeded()
    await page.locator('[data-accept]').click()
    await expect(page.locator('[data-diff]')).toHaveClass(/is-accepted/)
    await expect(page.locator('[data-status]')).toContainText('Accepted')
    await page.locator('[data-reset]').click()
    await page.locator('[data-reject]').click()
    await expect(page.locator('[data-diff]')).toHaveClass(/is-asking/)
    await page.locator('[data-reason]').fill('too wordy')
    await page.locator('[data-reject]').click()
    await expect(page.locator('[data-status]')).toContainText('too wordy')
  })

  test('approval modes: approve for me lets two actions through and holds the risky one', async ({ page }) => {
    await page.goto('/agents.html')
    await page.locator('[data-modes]').scrollIntoViewIfNeeded()
    await page.locator('[data-mode="edit"]').click()
    await page.locator('[data-run]').click()
    await expect(page.locator('[data-tl] li')).toHaveCount(3, { timeout: 8000 })
    await expect(page.locator('[data-tl] li .st.ok')).toHaveCount(2)
    await expect(page.locator('[data-tl] li').nth(2)).toContainText('Waiting for you')
    await page.locator('[data-allow]').click()
    await expect(page.locator('[data-tl]')).toContainText('Approved by you')
  })

  test('projects library: search, pin and a missing folder', async ({ page }) => {
    await page.goto('/projects.html')
    await expect(page.locator('.pj')).toHaveCount(6)
    await page.locator('[data-q]').fill('python')
    await expect(page.locator('.pj')).toHaveCount(1)
    await page.locator('[data-q]').fill('')
    await page.locator('[data-pin="api"]').click()
    await expect(page.locator('.pj h3').first()).toContainText('studio')
    await page.locator('[data-missing]').click()
    await expect(page.locator('.pj')).toHaveCount(5)
    await expect(page.locator('.lib__missing')).toBeVisible()
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('the menu opens as a sheet and lists every page', async ({ page }) => {
    await page.goto('/index.html')
    await page.locator('[data-nav-toggle]').click()
    await expect(page.locator('#site-nav')).toBeVisible()
    await expect(page.locator('[data-nav-toggle]')).toHaveAttribute('aria-expanded', 'true')
    expect(await page.locator('#site-nav .menu a').count()).toBe(12)
    await page.locator('#site-nav .menu a', { hasText: 'Connections' }).click()
    await expect(page).toHaveURL(/connections\.html/)
  })

  test('the connections replica stacks instead of squeezing into a strip', async ({ page }) => {
    await page.goto('/connections.html')
    const cx = page.locator('.cx')
    await cx.scrollIntoViewIfNeeded()
    expect((await cx.boundingBox()).width).toBeGreaterThan(300)
  })

  test('footer links are large enough to tap', async ({ page }) => {
    await page.goto('/features.html')
    const heights = await page.locator('.foot li a').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(28)
  })
})
