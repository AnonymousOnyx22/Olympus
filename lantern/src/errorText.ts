/**
 * Text for an error shown to the user. Errors thrown in Electron's main process reach the
 * renderer wrapped as "Error invoking remote method 'x': Error: message"; only the message matters.
 */
export function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': /, '').replace(/^(Error: )+/, '')
}
