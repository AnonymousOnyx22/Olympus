// Automated accessibility audit (axe-core) of every page, at desktop width and on a phone.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort()

for (const file of PAGES) {
  test(`${file} has no accessibility violations`, async ({ page }) => {
    await page.goto(`/${file}`)
    await page.waitForTimeout(1200) // let reveals, the dot grid and the demos settle
    // Reveal everything so the scan sees the final colours, not a fade in progress.
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}[data-reveal]{opacity:1!important;transform:none!important;filter:none!important}.step{opacity:1!important}' })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze()
    const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0].target.join(' ')}`)
    expect(summary).toEqual([])
  })
}
