import { defineConfig, devices } from '@playwright/test'

// Real Chromium, Firefox and WebKit (the engine behind Safari). Run `npx playwright install` once.
export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: { baseURL: 'http://127.0.0.1:4791', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/serve.mjs 4791', url: 'http://127.0.0.1:4791/index.html', reuseExistingServer: false },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } },
  ],
})
