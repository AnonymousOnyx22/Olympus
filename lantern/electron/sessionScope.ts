import path from 'node:path'

export function sameDirectory(candidate: unknown, root: string | null): boolean {
  if (typeof candidate !== 'string' || !root) return false
  const normalize = (value: string) => {
    const resolved = path.resolve(value)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return normalize(candidate) === normalize(root)
}

export function sessionsInDirectory(data: unknown, root: string | null): Array<{ id: string; directory: string }> {
  if (!Array.isArray(data)) return []
  return data.filter(item => item && typeof item.id === 'string' && sameDirectory(item.directory, root))
}
