import fs from 'node:fs'
import path from 'node:path'

const read = (file: string): string | null => {
  try { return fs.readFileSync(file, 'utf8').slice(0, 4000) } catch { return null }
}

const clean = (raw: string | undefined | null): string | null => {
  const value = (raw ?? '').replace(/[*_`#]/g, '').trim()
  return value && value.length <= 40 ? value : null
}

const titleCase = (value: string) => value.split(/[-_\s]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/**
 * The name a store gave itself, as opposed to the folder it was created in (which comes from the
 * owner's prompt, e.g. "Build me a store"). Looks where an agent leaves it, most deliberate first:
 * the STORE-LOG.md title, the package name when it is not just the folder name, the home page title.
 */
export function storeBrandName(dir: string): string | null {
  const log = read(path.join(dir, 'STORE-LOG.md'))
  const heading = log?.match(/^#\s*(?:STORE-LOG(?:\.md)?\s*[-–—:]\s*)?(.+)$/im)?.[1]
  const fromLog = clean(heading)
  if (fromLog && !/^store log$/i.test(fromLog)) return fromLog

  const pkg = read(path.join(dir, 'package.json'))
  try {
    const name = String(JSON.parse(pkg ?? '{}').name ?? '')
    const folder = path.basename(dir).toLowerCase()
    if (name && name.toLowerCase() !== folder && !/^build-/.test(name)) return clean(titleCase(name.replace(/-(store|shop|site|web|app)$/i, '')))
  } catch { /* not JSON */ }

  for (const page of ['public/index.html', 'index.html', 'dist/index.html']) {
    const title = read(path.join(dir, page))?.match(/<title>([^<]+)<\/title>/i)?.[1]
    const first = clean(title?.split(/\s[|–—-]\s|:/)[0])
    if (first) return first
  }
  return null
}
