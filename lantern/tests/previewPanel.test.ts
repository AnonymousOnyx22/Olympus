import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import PreviewPanel from '../src/components/PreviewPanel'

let root: Root
let container: HTMLDivElement
const discover = vi.fn()
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.clear()
  discover.mockReset().mockResolvedValue(['http://127.0.0.1:3000', 'http://127.0.0.1:4321'])
  Object.assign(window, { electronAPI: { discoverPreview: discover, onPreviewError: () => () => {} } })
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
const render = async (key: string) => { await act(async () => root.render(createElement(PreviewPanel, { projectKey: key, available: true, visible: true }))) }
describe('project preview selection', () => {
  it('requires choosing a discovered server and remembers the choice per project', async () => {
    await render('A')
    expect(container.querySelector('iframe')).toBeNull()
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'http://127.0.0.1:4321')!
    await act(async () => button.click())
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('http://127.0.0.1:4321')
    await render('B')
    expect(container.querySelector('iframe')).toBeNull()
    await render('A')
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('http://127.0.0.1:4321')
  })
  it('ignores discovery that completes after switching projects', async () => {
    let resolve!: (urls: string[]) => void
    discover.mockImplementationOnce(() => new Promise<string[]>(r => { resolve = r }))
    await render('A'); await render('B')
    await act(async () => resolve(['http://127.0.0.1:9999']))
    expect(container.textContent).not.toContain('9999')
    expect(container.querySelector('iframe')).toBeNull()
  })
  it('does not restore a remote URL saved in local storage', async () => {
    localStorage.setItem('olympus.preview.A', 'https://example.com')
    await render('A')
    expect(container.querySelector('iframe')).toBeNull()
  })
})
