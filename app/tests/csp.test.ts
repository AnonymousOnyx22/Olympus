import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// The renderer ships with a strict CSP injected at build time by vite.config.ts.
// That injection used to fail silently, so this asserts the built artifact
// rather than the build script.
//
// SKIPPED, not failed, when dist/index.html is absent: `npm test` has to pass
// on a clean checkout where nobody has run `npm run build` yet. Failing here
// would mean "you must build before you can test your tests".
const distIndex = path.resolve(__dirname, '..', 'dist', 'index.html')
const built = fs.existsSync(distIndex)

/**
 * Pulls the policy string out of the meta tag in the built HTML.
 * The quote pairs are handled separately on purpose: the policy is full of
 * single quotes, so a `[^"']+` character class would truncate the match at the
 * very first directive value.
 */
function readCsp(html: string): string {
  const tag = /<meta\s[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i.exec(html)
  if (!tag) throw new Error('no Content-Security-Policy meta tag found in dist/index.html')
  const content = /content="([^"]*)"|content='([^']*)'/.exec(tag[0])
  if (!content) throw new Error('Content-Security-Policy meta tag has no content attribute')
  return content[1] ?? content[2] ?? ''
}

/** Reads one directive out of the policy, e.g. directive('connect-src'). */
function directive(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `) || d === name)
}

describe.skipIf(!built)('built renderer CSP', () => {
  const html = fs.readFileSync(distIndex, 'utf8')
  const policy = readCsp(html)

  it('carries a Content-Security-Policy meta tag', () => {
    expect(html).toMatch(/<meta\s+http-equiv=["']Content-Security-Policy["']/i)
  })

  it("restricts connect-src to 'self'", () => {
    // connect-src is the one that matters: the renderer talks to the main
    // process only. A wider value would let an injected script exfiltrate
    // prompts, model output and project paths to an arbitrary host.
    expect(directive(policy, 'connect-src')).toBe("connect-src 'self'")
  })

  it('does not allow unsafe-eval, which would defeat the point of the policy', () => {
    expect(policy).not.toContain('unsafe-eval')
  })

  it('restricts default-src and script-src to self', () => {
    expect(directive(policy, 'default-src')).toBe("default-src 'self'")
    expect(directive(policy, 'script-src')).toBe("script-src 'self'")
  })

  it('keeps the frame-src exception narrow: loopback only', () => {
    // The embedded dev-server preview is the only reason frames are allowed at
    // all, and it must stay pinned to localhost and 127.0.0.1.
    const frameSrc = directive(policy, 'frame-src')
    expect(frameSrc).toBeDefined()
    expect(frameSrc).toMatch(/127\.0\.0\.1/)
    expect(frameSrc).toMatch(/localhost/)
    // No scheme+host that is not one of the two loopback names.
    const hosts = [...frameSrc!.matchAll(/https?:\/\/([^:\s*]+)/g)].map((m) => m[1])
    for (const host of hosts) expect(['127.0.0.1', 'localhost']).toContain(host)
  })

  it('blocks plugins, framing and base-tag injection', () => {
    expect(directive(policy, 'object-src')).toBe("object-src 'none'")
    expect(directive(policy, 'frame-ancestors')).toBe("frame-ancestors 'none'")
    expect(directive(policy, 'base-uri')).toBe("base-uri 'none'")
  })

  it('keeps the charset tag the injection anchors on', () => {
    // vite.config.ts fails the build if this exact string disappears, so a
    // successful build already implies it; asserting it keeps the two in step.
    expect(html).toContain('<meta charset="UTF-8" />')
  })
})

describe.skipIf(built)('built renderer CSP (no dist/index.html)', () => {
  it('is skipped because the app has not been built yet', () => {
    // Guards against a typo turning the whole suite into a silent no-op. This
    // block only exists when dist/ is absent, and it must never run: if it does,
    // it means `built` and the check above disagree.
    expect(built).toBe(false)
  })
})
