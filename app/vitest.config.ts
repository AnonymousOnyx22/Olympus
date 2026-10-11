/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

// Tests import the app's own TypeScript modules directly, so no transform
// pipeline beyond esbuild (vitest's default) is needed.
export default defineConfig({
  test: {
    // `src/` is renderer code that touches window/document at module scope in a
    // few places; jsdom gives those modules a DOM. `electron/` is Node-only and
    // mocked per-test where it matters.
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setup.ts'],
    // Deterministic in CI. On a dev machine the wall clock is still used for
    // the vitest process itself; individual tests must never depend on it.
    globals: false,
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: { junit: 'release/vitest-junit.xml' },
    coverage: {
      provider: 'v8',
      // Only the pure, importable logic is worth measuring. The Electron main
      // process and React components are exercised through their own tests or
      // not at all; including them here would just show a low number.
      include: ['electron/*.ts', 'src/services/*.ts'],
      reporter: ['text-summary', 'html'],
      reportsDirectory: 'release/coverage',
    },
  },
})
