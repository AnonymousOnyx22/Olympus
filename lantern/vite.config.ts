import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// Strict CSP for the packaged app. The dev server needs inline scripts for
// React Fast Refresh, so the policy is only injected into production builds.
// API traffic is proxied through the main process. The only renderer network
// surface is the explicit localhost frame used by the project preview.
const RENDERER_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "frame-src http://127.0.0.1:* http://localhost:*",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')

const CHARSET_TAG = '<meta charset="UTF-8" />'

const productionCsp = (): Plugin => ({
  name: 'olympus-csp',
  apply: 'build',
  transformIndexHtml(html) {
    // This injection used to fail silently: if the charset tag changed shape, the packaged
    // renderer would ship with no CSP at all. Fail the build instead, and keep a test that
    // asserts the built dist/index.html actually carries the policy.
    if (!html.includes(CHARSET_TAG)) {
      throw new Error(
        `vite.config: index.html no longer contains the exact tag ${CHARSET_TAG}. ` +
          'Update the charset meta in index.html and the CSP injection together, otherwise the ' +
          'packaged renderer ships with no Content-Security-Policy.',
      )
    }
    return html.replace(
      CHARSET_TAG,
      `${CHARSET_TAG}\n    <meta http-equiv="Content-Security-Policy" content="${RENDERER_CSP}" />`,
    )
  },
})

const electronOutput = {
  build: {
    outDir: 'dist-electron',
    // TEMP DIAGNOSTIC: minification off so a startup stack trace points at real source.
    minify: process.env.OLYMPUS_DEBUG_BUILD === '1' ? false : undefined,
    rolldownOptions: {
      external: ['electron'],
      output: { format: 'cjs' as const, entryFileNames: '[name].js' },
    },
  },
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    productionCsp(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: electronOutput,
      },
      preload: {
        input: 'electron/preload.ts',
        vite: electronOutput,
      },
    }),
  ],
  worker: { format: 'es' },
  // Monaco is the bulk of the bundle and is loaded lazily by the editor routes; the ceiling
  // here is deliberately not raised to hide it, so a regression in lazy-loading shows up.
  build: { chunkSizeWarningLimit: 1200 },
})
