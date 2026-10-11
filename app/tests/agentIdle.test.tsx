// @vitest-environment jsdom
// An agent window whose engine has not been started. Opening Kern starts no engine; a window says so,
// offers Connect, and starts the engine only when asked (or when the user sends a message).
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentPane, type AgentPaneProps } from '../src/components/AgentWorkspace'
import { api } from '../src/services/api'

let root: Root
let host: HTMLDivElement

const model = { providerID: 'ollama', modelID: 'llama3.1:8b' }
const baseProps = (over: Partial<AgentPaneProps> = {}): AgentPaneProps => ({
  mode: 'agent',
  defaultModel: model,
  defaultVariant: null,
  providers: [{ id: 'ollama', name: 'Ollama', baseURL: 'http://127.0.0.1:11434/v1', online: true, models: ['llama3.1:8b'], access: { 'llama3.1:8b': 'local' }, source: 'local' }],
  rescanning: false,
  onRescan: () => undefined,
  onAddEndpoint: async () => undefined,
  onRemoveEndpoint: async () => undefined,
  onReviewEdits: () => undefined,
  onOpenProjects: () => undefined,
  goToProject: () => undefined,
  spaceId: 'studio',
  projectName: 'studio',
  ready: false,
  sessionID: 'ses_1',
  title: 'Agent 1',
  onClose: () => undefined,
  onDelete: () => undefined,
  deleting: false,
  ...over,
})

const render = async (props: AgentPaneProps) => { await act(async () => { root.render(<AgentPane {...props} />) }) }
const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label)
const type = async (text: string) => {
  const box = host.querySelector('textarea') as HTMLTextAreaElement
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  await act(async () => { set.call(box, text); box.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  Element.prototype.scrollTo = () => undefined
  Element.prototype.scrollIntoView = () => undefined
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('an agent window with no engine started', () => {
  it('says so, in the header and in a notice with a Connect button', async () => {
    await render(baseProps({ idle: true, onStartEngine: () => undefined }))
    expect(host.textContent).toContain('No engine is running for this chat')
    expect(host.textContent).toContain('Not started')
    expect(button('Connect')).toBeTruthy()
  })

  it('starts the engine only when Connect is pressed', async () => {
    const onStartEngine = vi.fn()
    await render(baseProps({ idle: true, onStartEngine }))
    expect(onStartEngine).not.toHaveBeenCalled()
    await act(async () => { button('Connect')!.click() })
    expect(onStartEngine).toHaveBeenCalledTimes(1)
  })

  it('starts the engine when a message is sent, and holds the message instead of sending it', async () => {
    const onStartEngine = vi.fn()
    const prompt = vi.spyOn(api, 'prompt').mockResolvedValue(undefined as never)
    await render(baseProps({ idle: true, onStartEngine }))
    await type('Add search to the notes list')
    await act(async () => { button('Send message')!.click() })
    expect(onStartEngine).toHaveBeenCalledTimes(1)
    expect(prompt).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Add search to the notes list') // queued, visible, waiting for the engine
  })

  it('shows no notice once an engine is running, and does not claim "Not started"', async () => {
    // A connected window talks to the engine through the Electron bridge; answer everything with nothing.
    vi.stubGlobal('electronAPI', new Proxy({}, { get: (_, name: string) => (name.startsWith('on') ? () => () => undefined : async () => ({ ok: true, status: 200, data: [], error: null })) }))
    await render(baseProps({ ready: true, idle: false }))
    expect(host.textContent).not.toContain('No engine is running')
    expect(host.textContent).not.toContain('Not started')
  })

  it('does not show the notice while an engine is starting up', async () => {
    await render(baseProps({ ready: false, idle: false }))
    expect(host.textContent).not.toContain('No engine is running')
    expect(host.textContent).toContain('Connecting')
  })

  it('shows the failure, not the idle notice, when the engine could not start', async () => {
    await render(baseProps({ idle: false, startError: 'opencode is not installed', onRetryStart: () => undefined }))
    expect(host.textContent).toContain("couldn't start")
    expect(host.textContent).not.toContain('No engine is running')
  })
})
