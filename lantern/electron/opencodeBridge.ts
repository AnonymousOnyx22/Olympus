import { WebSocket as NodeWebSocket } from 'ws'
import { basicAuthHeader, type DaemonCredentials } from './daemonManager'
import type { BridgeResponse } from '../src/types/opencode'

/** Requests the renderer is allowed to make. Anything else is refused at the boundary. */
const ALLOWED_ROUTES: { method: string; pattern: RegExp }[] = [
  { method: 'GET', pattern: /^\/session$/ },
  { method: 'POST', pattern: /^\/session$/ },
  { method: 'GET', pattern: /^\/session\/status$/ },
  { method: 'GET', pattern: /^\/session\/[^/]+\/message$/ },
  { method: 'POST', pattern: /^\/session\/[^/]+\/prompt_async$/ },
  { method: 'POST', pattern: /^\/session\/[^/]+\/abort$/ },
  { method: 'DELETE', pattern: /^\/session\/[^/]+$/ },
  { method: 'GET', pattern: /^\/skill$/ },
  { method: 'GET', pattern: /^\/permission$/ },
  { method: 'POST', pattern: /^\/permission\/[^/]+\/reply$/ },
  { method: 'POST', pattern: /^\/pty$/ },
  { method: 'PUT', pattern: /^\/pty\/[^/]+$/ },
  { method: 'DELETE', pattern: /^\/pty\/[^/]+$/ },
  { method: 'GET', pattern: /^\/config\/providers$/ },
]

/** A single API response is never legitimately this large. */
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 120_000
const PTY_ID_PATTERN = /^pty[\w-]+$/

const isAllowed = (method: string, path: string) =>
  ALLOWED_ROUTES.some((route) => route.method === method && route.pattern.test(path))

/**
 * Proxies the renderer's traffic to the local opencode daemon.
 * Running this in the main process sidesteps CORS for the packaged (file://) renderer
 * and lets the renderer keep a CSP with no network access at all.
 *
 * Every request carries the daemon's per-launch basic-auth credential, so the local HTTP
 * surface is not reachable by another process or by a page in the user's browser.
 */
export class OpencodeBridge {
  private baseUrl: string | null = null
  private credentials: DaemonCredentials | null = null
  private sseAbort: AbortController | null = null
  private sockets = new Map<string, NodeWebSocket>()

  constructor(
    private readonly onEvent: (event: unknown) => void,
    private readonly onPtyData: (ptyID: string, data: string) => void,
    private readonly log: (line: string) => void,
    /** Called after the event stream reconnects, so the renderer can re-read real state. */
    private readonly onResync: () => void = () => {},
  ) {}

  /** Points the bridge at a new daemon (or detaches it with null) and (re)opens the event stream. */
  attach(baseUrl: string | null, credentials: DaemonCredentials | null = null) {
    if (baseUrl === this.baseUrl && credentials?.password === this.credentials?.password) return
    this.detach()
    this.baseUrl = baseUrl
    this.credentials = credentials
    if (baseUrl && credentials) void this.runEventStream(baseUrl, credentials)
    else if (baseUrl) this.log('[olympus] bridge attached without credentials; the daemon will refuse requests')
  }

  detach() {
    this.sseAbort?.abort()
    this.sseAbort = null
    for (const ws of this.sockets.values()) ws.close()
    this.sockets.clear()
    this.baseUrl = null
    this.credentials = null
  }

  private authHeader(): Record<string, string> | null {
    return this.credentials ? { authorization: basicAuthHeader(this.credentials) } : null
  }

  async request(method: string, path: string, body?: unknown): Promise<BridgeResponse> {
    if (!this.baseUrl || !this.credentials) {
      return { ok: false, status: 0, data: null, error: 'opencode daemon is not running' }
    }
    if (!path.startsWith('/')) return { ok: false, status: 0, data: null, error: 'path must start with /' }
    if (!isAllowed(method, path)) {
      return { ok: false, status: 0, data: null, error: `route not allowed: ${method} ${path}` }
    }
    const auth = this.authHeader()!
    try {
      const res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          ...auth,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      const text = await readBoundedText(res, MAX_RESPONSE_BYTES)
      let data: unknown = null
      if (text) {
        try {
          data = JSON.parse(text)
        } catch {
          data = text
        }
      }
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: res.ok ? undefined : extractError(data) ?? `HTTP ${res.status}`,
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        return { ok: false, status: 0, data: null, error: `opencode did not respond within ${REQUEST_TIMEOUT_MS / 1000}s` }
      }
      return { ok: false, status: 0, data: null, error: (err as Error).message }
    }
  }

  /** Reads `/event` as Server-Sent Events and forwards each JSON payload; reconnects until detached. */
  private async runEventStream(baseUrl: string, credentials: DaemonCredentials) {
    const abort = new AbortController()
    this.sseAbort = abort

    while (!abort.signal.aborted) {
      try {
        const res = await fetch(baseUrl + '/event', {
          headers: { accept: 'text/event-stream', authorization: basicAuthHeader(credentials) },
          signal: abort.signal,
        })
        if (!res.ok || !res.body) throw new Error(`event stream HTTP ${res.status}`)

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          // Normalize only after a complete event boundary is found. CRLF can be
          // split across network chunks, so normalizing each chunk loses boundaries.
          buffer += value
          // Unlike an ordinary request, nothing here bounds how long this can grow if a
          // single event is never terminated by a blank-line boundary. Cap it the same
          // as any other single response, so a malformed or hostile stream can't grow
          // this buffer without limit and exhaust the whole process's memory.
          if (buffer.length > MAX_RESPONSE_BYTES) throw new Error('event stream exceeded the response size cap')
          let match: RegExpMatchArray | null
          while ((match = buffer.match(/\r\n\r\n|\n\n|\r\r/))) {
            const boundary = match.index ?? 0
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + match[0].length)
            const data = block
              .split(/\r\n|\n|\r/)
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).replace(/^ /, ''))
              .join('\n')
            if (!data) continue
            try {
              const parsed = JSON.parse(data) as { payload?: unknown }
              // /global/event wraps events in { directory, payload }; /event does not.
              this.onEvent(parsed.payload ?? parsed)
            } catch {
              this.log(`[olympus] dropped malformed event: ${data.slice(0, 200)}`)
            }
          }
        }
      } catch (err) {
        if (abort.signal.aborted) return
        this.log(`[olympus] event stream error: ${(err as Error).message}; reconnecting`)
      }
      if (!abort.signal.aborted) await new Promise((r) => setTimeout(r, 1000))
      // A dropped stream can have swallowed a `session.idle`. Tell the renderer to
      // re-read authoritative state rather than trusting a stream that had a hole in it.
      if (!abort.signal.aborted) this.onResync()
    }
  }

  ptyConnect(ptyID: string): Promise<void> {
    if (!this.baseUrl || !this.credentials) return Promise.reject(new Error('opencode daemon is not running'))
    if (!PTY_ID_PATTERN.test(ptyID)) return Promise.reject(new Error('invalid pty id'))
    this.sockets.get(ptyID)?.close()

    // Credentials as URL userinfo relies on the client turning it into a Basic-Auth header,
    // which the platform WebSocket does not do — the request would go out unauthenticated.
    // `ws` (unlike the global WebSocket) takes a real `headers` option, so send it there.
    const host = this.baseUrl.replace(/^http/, 'ws')
    const ws = new NodeWebSocket(`${host}/pty/${ptyID}/connect`, {
      headers: { authorization: basicAuthHeader(this.credentials) },
    })
    ws.binaryType = 'arraybuffer'
    this.sockets.set(ptyID, ws)
    const decoder = new TextDecoder()

    ws.addEventListener('message', (e) => {
      const text = typeof e.data === 'string' ? e.data : decoder.decode(e.data as ArrayBuffer, { stream: true })
      // Frames starting with NUL are control messages (e.g. {"cursor":16}), not terminal output.
      if (text.startsWith('\u0000')) return
      this.onPtyData(ptyID, text)
    })
    ws.addEventListener('close', () => {
      if (this.sockets.get(ptyID) === ws) this.sockets.delete(ptyID)
    })

    return new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true })
      ws.addEventListener('error', () => reject(new Error('failed to connect to terminal')), { once: true })
    })
  }

  ptyWrite(ptyID: string, data: string) {
    const ws = this.sockets.get(ptyID)
    if (ws?.readyState === NodeWebSocket.OPEN) ws.send(data)
  }

  ptyDisconnect(ptyID: string) {
    this.sockets.get(ptyID)?.close()
    this.sockets.delete(ptyID)
  }
}

function extractError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return typeof data === 'string' ? data : undefined
  const d = data as { message?: string; error?: unknown; data?: { message?: string } }
  if (typeof d.message === 'string') return d.message
  if (typeof d.data?.message === 'string') return d.data.message
  if (typeof d.error === 'string') return d.error
  return undefined
}

/**
 * Reads a response body, giving up past `maxBytes`. A wedged or hostile local endpoint must not
 * be able to exhaust the main process's memory, which would take down every open project.
 */
async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`response too large (${declared} bytes)`)
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > maxBytes) {
      await reader.cancel()
      throw new Error(`response exceeded ${Math.round(maxBytes / (1024 * 1024))} MB`)
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}
