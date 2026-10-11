import fs from 'node:fs'
import path from 'node:path'

/** Browser caches and lock files: rebuilt on demand, and a copied lock would block the first launch. */
const VOLATILE = /^(Singleton|lockfile|Cache|Code Cache|GPUCache|DawnCache|blob_storage)/i

/**
 * The folder Kern keeps its data in. KERN_USER_DATA overrides it (a second profile, or a test run
 * that must not touch real projects). Otherwise it is `Kern` inside the OS application-data folder;
 * if that does not exist yet but one left by the app's earlier name, `Olympus`, does, its contents are
 * copied across once. The old folder is never modified or removed.
 */
export function resolveUserDataDir(appDataDir: string, override: string | undefined = process.env.KERN_USER_DATA): string {
  if (override) return override
  const target = path.join(appDataDir, 'Kern')
  const legacy = path.join(appDataDir, 'Olympus')
  if (!fs.existsSync(target) && fs.existsSync(legacy)) {
    try {
      fs.cpSync(legacy, target, { recursive: true, filter: (source) => !VOLATILE.test(path.basename(source)) })
    } catch (error) {
      console.error('[kern] could not copy the Olympus profile:', error)
    }
  }
  return target
}
