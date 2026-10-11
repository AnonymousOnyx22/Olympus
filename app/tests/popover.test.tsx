import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Popover from '../src/components/Popover'

let root: Root
let host: HTMLDivElement
function Harness() {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState(false)
  return <><button ref={trigger} onClick={() => setOpen(value => !value)}>Open</button><button>Outside</button>
    {open && <Popover trigger={trigger} onClose={() => setOpen(false)} label="Options">
      {next ? <button>Replacement</button> : <><button onClick={() => setNext(true)}>First</button><button disabled>Disabled</button><button>Last</button></>}
    </Popover>}</>
}
const button = (text: string) => [...document.querySelectorAll('button')].find(element => element.textContent === text)!
const key = async (name: string) => act(() => { document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })) })
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('requestAnimationFrame', () => 0)
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{ width: 100, height: 40 }] as unknown as DOMRectList)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 950, right: 990, top: 740, bottom: 780, width: 40, height: 40 } as DOMRect)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
  vi.stubGlobal('innerWidth', 1024)
  vi.stubGlobal('innerHeight', 800)
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  await act(() => root.render(<Harness />))
  await act(() => button('Open').click())
})
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('shared dropdown behavior', () => {
  it('escapes clipping containers and flips above a trigger near the bottom', () => {
    const panel = document.querySelector('[role="dialog"]') as HTMLElement
    expect(panel.parentElement).toBe(document.body)
    expect(panel.style.left).toBe('670px')
    expect(panel.style.top).toBe('432px')
  })
  it('returns focus to the trigger on Escape', async () => {
    button('First').focus()
    await key('Escape')
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(button('Open'))
  })
  it('skips disabled choices and supports arrows, Home and End', async () => {
    button('First').focus()
    await key('ArrowDown')
    expect(document.activeElement).toBe(button('Last'))
    await key('Home')
    expect(document.activeElement).toBe(button('First'))
    await key('End')
    expect(document.activeElement).toBe(button('Last'))
  })
  it('dismisses on outside pointer input', async () => {
    await act(() => button('Outside').dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
  it('dismisses when keyboard focus moves outside', async () => {
    await act(() => button('Outside').focus())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
  it('keeps focus in the replacement view', async () => {
    button('First').focus()
    await act(() => button('First').click())
    expect(document.activeElement).toBe(button('Replacement'))
  })
})
