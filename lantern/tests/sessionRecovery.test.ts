import { act, createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../src/services/api'
import { sessionFamily, sessionOutcome, useSessionStream } from '../src/services/streamHandler'
import type { MessageWithParts, OpencodeEvent, Session, SessionStatus } from '../src/types/opencode'

vi.mock('../src/services/api', () => ({ api: { messages: vi.fn(), listPermissions: vi.fn(), sessionStatus: vi.fn(), listSessions: vi.fn(), onResync: vi.fn() } }))
let emit: (space: string, event: OpencodeEvent) => void
let resync: (space: string) => void
let root: Root
let container: HTMLDivElement
let stream: ReturnType<typeof useSessionStream>
const session = (id: string, parentID?: string): Session => ({ id, parentID, title: id, directory: '/project', time: { created: 1, updated: 1 } })
const messages: MessageWithParts[] = [{ info: { id: 'm', sessionID: 'root', role: 'assistant', time: { created: 1 } }, parts: [{ id: 'p', messageID: 'm', sessionID: 'root', type: 'text', text: 'Hello' }] }]
function Probe() {
  // Captured in an effect rather than assigned during render: assigning a module-level
  // variable inside the component body is a render side-effect, and React's compiler
  // lint rule is right to refuse it.
  const value = useSessionStream('project', 'root', true)
  useEffect(() => { stream = value }, [value])
  return null
}
const mount = async () => { await act(async () => { root.render(createElement(Probe)) }) }

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetAllMocks()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { onEvent: (cb: typeof emit) => { emit = cb; return () => {} } } })
  vi.mocked(api.onResync).mockImplementation((cb) => { resync = cb; return () => {} })
  vi.mocked(api.messages).mockResolvedValue(messages)
  vi.mocked(api.listPermissions).mockResolvedValue([])
  vi.mocked(api.sessionStatus).mockResolvedValue({ root: { type: 'busy' } })
  vi.mocked(api.listSessions).mockResolvedValue([session('root'), session('child', 'root'), session('grandchild', 'child'), session('sibling')])
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })

describe('session recovery', () => {
  it('recovers a missed idle and transcript on reconnection without restarting', async () => {
    await mount(); expect(stream.status.type).toBe('busy')
    vi.mocked(api.sessionStatus).mockResolvedValue({})
    vi.mocked(api.messages).mockResolvedValue([{ ...messages[0], info: { ...messages[0].info, role: 'assistant', error: { name: 'MessageAbortedError' } } }])
    await act(async () => resync('other-project')); expect(stream.status.type).toBe('busy')
    await act(async () => resync('project'))
    expect(stream.status.type).toBe('idle'); expect(sessionOutcome(stream.messages)).toBe('stopped')
  })
  it('polls a silently stale stream and discovers descendant approvals', async () => {
    await mount()
    vi.mocked(api.listPermissions).mockResolvedValue([{ id: 'approval', sessionID: 'grandchild', permission: 'bash', patterns: ['npm test'], metadata: {}, always: [] }])
    vi.mocked(api.sessionStatus).mockResolvedValue({})
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(stream.status.type).toBe('idle')
    expect(stream.permissions.filter(p => stream.sessionIDs.has(p.sessionID))).toHaveLength(1)
    expect(stream.sessionIDs.has('sibling')).toBe(false)
  })
  it('keeps known busy state when a status check fails, instead of pretending idle', async () => {
    await mount(); vi.mocked(api.sessionStatus).mockRejectedValue(new Error('Disconnected'))
    await act(async () => { await stream.refresh() })
    expect(stream.status.type).toBe('busy'); expect(stream.syncError).toContain('Disconnected')
  })
  it('does not overwrite newer streamed text with a stale snapshot', async () => {
    await mount()
    let finish!: (value: Record<string, SessionStatus>) => void
    vi.mocked(api.sessionStatus).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    let pending!: Promise<void>
    await act(async () => { pending = stream.refresh() })
    await act(async () => emit('project', { type: 'message.part.delta', properties: { sessionID: 'root', messageID: 'm', partID: 'p', field: 'text', delta: ' world' } }))
    await act(async () => { finish({}); await pending })
    expect(stream.messages[0].parts[0]).toMatchObject({ text: 'Hello world' })
    expect(stream.status.type).toBe('busy')
  })
  it('reports inactivity without aborting work, and resets it when a descendant makes progress', async () => {
    await mount()
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
    expect(stream.quietSeconds).toBe(120); expect(stream.status.type).toBe('busy')
    await act(async () => emit('project', { type: 'message.part.delta', properties: { sessionID: 'child', messageID: 'c', partID: 'cp', field: 'text', delta: 'Working' } }))
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(stream.quietSeconds).toBe(15)
  })
  it('does not confuse idle failures with success or keep a failure after a new user turn', () => {
    const failed: MessageWithParts = { ...messages[0], info: { ...messages[0].info, role: 'assistant', error: { name: 'APIError', data: { message: 'Unavailable' } } } }
    expect(sessionOutcome([failed])).toBe('failed')
    expect(sessionOutcome([failed, { info: { id: 'new', sessionID: 'root', role: 'user', time: { created: 2 } }, parts: [] }])).toBeNull()
    expect([...sessionFamily([session('grandchild', 'child'), session('child', 'root'), session('other')], 'root')]).toEqual(['root', 'child', 'grandchild'])
  })
})
