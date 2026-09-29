import { describe, expect, it } from 'vitest'
import { describeActivity } from '../src/services/streamHandler'
import type { MessageEntry, StreamState, ToolPart, ToolState } from '../src/types/opencode'

// describeActivity is the one exported piece of the stream state machine. The
// reducer itself is module-private, so this tests the derived view the status
// bar renders from a hand-built state -- which is where the bugs actually are:
// wrong precedence between "waiting on you" and "working", and a running tool
// that loses to a later non-tool part.

const part = (over: Partial<ToolPart> & { id: string }): ToolPart => ({
  type: 'tool',
  sessionID: 'ses_1',
  messageID: 'msg_1',
  callID: 'call_1',
  tool: 'bash',
  state: { status: 'completed', input: {}, output: '', title: 'bash', metadata: {}, time: { start: 0, end: 1 } },
  ...over,
})

const message = (parts: ToolPart[] | Record<string, unknown>[]): MessageEntry => ({
  info: { id: 'msg_1', sessionID: 'ses_1', role: 'assistant', time: { created: 0 } },
  parts: parts as never,
})

const state = (over: Partial<StreamState> = {}): StreamState => ({
  sessionID: 'ses_1',
  messages: [],
  status: { type: 'idle' },
  permissions: [],
  error: null,
  ...over,
})

describe('describeActivity', () => {
  it('reports Starting when there are no messages yet', () => {
    expect(describeActivity(state())).toBe('Starting')
  })

  it('reports Starting when only user messages exist, ignoring them', () => {
    // The status bar describes what the agent is doing. A user message with no
    // assistant reply yet is still "Starting", not "Thinking".
    const state_: StreamState = state({
      messages: [
        {
          info: { id: 'm', sessionID: 'ses_1', role: 'user', time: { created: 0 } },
          parts: [{ id: 'p', sessionID: 'ses_1', messageID: 'm', type: 'text', text: 'hi' }],
        },
      ],
    })
    expect(describeActivity(state_)).toBe('Starting')
  })

  it('puts a pending permission request above everything else', () => {
    // The agent is blocked on the human, so no tool or status can outrank it.
    const s = state({
      permissions: [{ id: 'p1', sessionID: 'ses_1', permission: 'edit', patterns: [], metadata: {}, always: [] }],
      status: { type: 'retry', attempt: 1, message: 'rate limited', next: 0 },
      messages: [message([part({ id: 'a', state: { status: 'running', input: {}, time: { start: 0 } } })])],
    })
    expect(describeActivity(s)).toBe('Awaiting your approval')
  })

  it('shows the retry reason, ahead of any tool, when the daemon is retrying', () => {
    const s = state({
      status: { type: 'retry', attempt: 2, message: 'rate limited', next: 0 },
      messages: [message([part({ id: 'a', state: { status: 'running', input: {}, time: { start: 0 } } })])],
    })
    expect(describeActivity(s)).toBe('Retrying: rate limited')
  })

  it('clips a very long retry message so the status bar keeps its height', () => {
    const s = state({ status: { type: 'retry', attempt: 1, message: 'x'.repeat(200), next: 0 } })
    const out = describeActivity(s)
    expect(out.startsWith('Retrying: ')).toBe(true)
    expect(out.length).toBeLessThanOrEqual('Retrying: '.length + 49)
  })

  it('names the running tool rather than describing the phase', () => {
    const s = state({
      messages: [
        message([
          part({ id: 'a', state: { status: 'running', input: {}, time: { start: 0 } } }),
          { id: 'b', sessionID: 'ses_1', messageID: 'msg_1', type: 'text', text: 'done thinking' },
        ]),
      ],
    })
    // The text part is last, but the tool is what is actually in flight.
    expect(describeActivity(s)).toBe('Running command')
  })

  it('describes a running bash tool by its command', () => {
    const s = state({
      messages: [
        message([
          part({ id: 'a', tool: 'bash', state: { status: 'running', input: { command: 'npm test' }, time: { start: 0 } } }),
        ]),
      ],
    })
    expect(describeActivity(s)).toBe('Running npm test')
  })

  it('shows the basename, not the full path, when reading a file', () => {
    // A full absolute path in a status pill blows out the AgentStatus layout.
    const s = state({
      messages: [
        message([
          part({ id: 'a', tool: 'read', state: { status: 'running', input: { filePath: '/a/b/c/notes.md' }, time: { start: 0 } } }),
        ]),
      ],
    })
    expect(describeActivity(s)).toBe('Reading notes.md')
  })

  it('falls back to a generic label for a tool it does not know', () => {
    // A newer opencode can add tools; the status bar must still say something
    // rather than going blank.
    const s = state({
      messages: [message([part({ id: 'a', tool: 'webfetch', state: { status: 'running', input: {}, time: { start: 0 } } })])],
    })
    expect(describeActivity(s)).toBe('Using webfetch')
  })

  it('treats a pending tool as still running', () => {
    const s = state({
      messages: [message([part({ id: 'a', tool: 'todowrite', state: { status: 'pending', input: {}, raw: '{}' } })])],
    })
    expect(describeActivity(s)).toBe('Updating plan')
  })

  it('falls back to the last part once no tool is in flight', () => {
    const tail = (type: string) =>
      state({ messages: [message([{ id: 'x', sessionID: 'ses_1', messageID: 'msg_1', type }])] })

    expect(describeActivity(tail('reasoning'))).toBe('Reasoning')
    expect(describeActivity(tail('text'))).toBe('Composing reply')
    expect(describeActivity(tail('step-start'))).toBe('Starting')
    expect(describeActivity(tail('step-finish'))).toBe('Thinking')
  })

  it('reports "Reviewing results" for a tool that has already finished', () => {
    // Not "Using <tool>": the work is done, the user is being asked to read it.
    const s = state({ messages: [message([part({ id: 'a', tool: 'bash' })])] })
    expect(describeActivity(s)).toBe('Reviewing results')
  })

  it('uses the most recent assistant message, not the first', () => {
    // Streamed state accumulates messages; reading the wrong one shows a stale
    // tool call long after the turn moved on.
    const s = state({
      messages: [
        message([part({ id: 'a', state: { status: 'running', input: {}, time: { start: 0 } } })]),
        {
          info: { id: 'msg_2', sessionID: 'ses_1', role: 'assistant', time: { created: 1 } },
          parts: [{ id: 'b', sessionID: 'ses_1', messageID: 'msg_2', type: 'reasoning', text: '...' }],
        },
      ],
    })
    expect(describeActivity(s)).toBe('Reasoning')
  })

  it('never throws on an empty message, which a partial stream can produce', () => {
    const s = state({ messages: [message([])] })
    expect(() => describeActivity(s)).not.toThrow()
    expect(describeActivity(s)).toBe('Starting')
  })
})

// Guards the assumption the ToolPart fixture above is built on: a completed
// tool carries both branches of ToolState, and a running one carries only start.
describe('ToolState fixture sanity', () => {
  const states: ToolState[] = [
    { status: 'pending', input: {}, raw: '{}' },
    { status: 'running', input: {}, time: { start: 0 } },
    { status: 'completed', input: {}, output: '', title: 't', metadata: {}, time: { start: 0, end: 1 } },
    { status: 'error', input: {}, error: 'boom', metadata: {}, time: { start: 0, end: 1 } },
  ]

  it('treats error as finished, so a failed tool does not pin the status bar', () => {
    const s = state({ messages: [message([part({ id: 'a', state: states[3] })])] })
    expect(describeActivity(s)).toBe('Reviewing results')
  })
})
