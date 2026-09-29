import type {
  MessageWithParts,
  ModelRef,
  PermissionReply,
  PermissionRequest,
  Pty,
  Session,
  SessionStatus,
} from '../types/opencode'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function call<T>(spaceId: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await window.electronAPI.request<T>(spaceId, method, path, body)
  if (!res.ok) throw new ApiError(res.error ?? `Request failed (${res.status})`, res.status)
  return res.data
}

const enc = encodeURIComponent

/**
 * Typed wrappers over the opencode HTTP API, proxied through the Electron main process.
 * Every call is scoped to a space id, since each open project runs its own daemon.
 */
export const api = {
  listSessions: (spaceId: string) => call<Session[]>(spaceId, 'GET', '/session'),
  skills: (spaceId: string) => call<{ name: string; description?: string }[]>(spaceId, 'GET', '/skill'),
  createSession: (spaceId: string, title?: string) => call<Session>(spaceId, 'POST', '/session', title ? { title } : {}),
  deleteSession: (spaceId: string, id: string) => call<boolean>(spaceId, 'DELETE', `/session/${enc(id)}`),
  sessionStatus: (spaceId: string) => call<Record<string, SessionStatus>>(spaceId, 'GET', '/session/status'),
  messages: (spaceId: string, id: string) => call<MessageWithParts[]>(spaceId, 'GET', `/session/${enc(id)}/message`),

  /** Fire-and-forget prompt; progress arrives over the event stream. */
  prompt: (spaceId: string, id: string, text: string, model: ModelRef, variant?: string | null) =>
    call<void>(spaceId, 'POST', `/session/${enc(id)}/prompt_async`, {
      model,
      ...(variant ? { variant } : {}),
      parts: [{ type: 'text', text }],
    }),
  abort: (spaceId: string, id: string) => call<boolean>(spaceId, 'POST', `/session/${enc(id)}/abort`),

  listPermissions: (spaceId: string) => call<PermissionRequest[]>(spaceId, 'GET', '/permission'),
  /** Resolves a paused tool call. The agent stays blocked until this is sent. */
  replyPermission: (spaceId: string, requestID: string, reply: PermissionReply, message?: string) =>
    call<boolean>(spaceId, 'POST', `/permission/${enc(requestID)}/reply`, message ? { reply, message } : { reply }),

  createPty: (spaceId: string, title: string) => call<Pty>(spaceId, 'POST', '/pty', { title }),
  resizePty: (spaceId: string, id: string, rows: number, cols: number) =>
    call<Pty>(spaceId, 'PUT', `/pty/${enc(id)}`, { size: { rows, cols } }),
  removePty: (spaceId: string, id: string) => call<boolean>(spaceId, 'DELETE', `/pty/${enc(id)}`),

  /** The daemon's event stream reconnected after a gap: re-read state instead of guessing. */
  onResync: (handler: (spaceId: string) => void) => window.electronAPI.onResync(handler),
  openExternal: (url: string) => window.electronAPI.openExternal(url),
  opencodeStatus: () => window.electronAPI.opencodeStatus(),
  /** Display-only. The key and the signing secret never reach the renderer. */
  licenseState: () => window.electronAPI.licenseState(),
}
