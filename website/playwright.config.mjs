import { defineConfig, devices } from '@playwright/test'

// Real Chromium, Firefox and WebKit (the engine behind Safari). Run `npx playwright install` once.
//   desktop: the whole site in all three engines, with a mouse
//   phones and tablet: real device profiles with touch, no hover, and the browser's own mobile viewport
//   a11y and modes: accessibility scan, reduced motion, and JavaScript switched off
const desktop = (name, device) => ({ name, testMatch: 'site.spec.mjs', use: { ...device, viewport: { width: 1440, height: 900 } } })

export default defineConfig({
  testDir: 'tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4, // several real browsers at once; more than this starves a normal machine
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:4791', trace: 'retain-on-failure' },
  webServer: { command: 'node tests/serve.mjs 4791', url: 'http://127.0.0.1:4791/index.html', reuseExistingServer: false },
  projects: [
    desktop('chromium', devices['Desktop Chrome']),
    desktop('firefox', devices['Desktop Firefox']),
    desktop('webkit', devices['Desktop Safari']),
    { name: 'iphone-webkit', testMatch: 'mobile.spec.mjs', use: { ...devices['iPhone 15'] } },
    { name: 'ipad-webkit', testMatch: 'mobile.spec.mjs', use: { ...devices['iPad (gen 7)'] } },
    { name: 'pixel-chromium', testMatch: 'mobile.spec.mjs', use: { ...devices['Pixel 7'] } },
    { name: 'a11y-chromium', testMatch: 'a11y.spec.mjs', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'a11y-iphone', testMatch: 'a11y.spec.mjs', use: { ...devices['iPhone 15'] } },
    { name: 'modes-chromium', testMatch: 'modes.spec.mjs', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'modes-webkit', testMatch: 'modes.spec.mjs', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
})
