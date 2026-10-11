// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import ThinkingMark from '../src/components/ThinkingMark'
import AgentStatus from '../src/components/AgentStatus'

const mount = (node: React.ReactElement) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  act(() => { createRoot(host).render(node) })
  return host
}

describe('ThinkingMark', () => {
  it('is three dots, hidden from assistive tech', () => {
    const mark = mount(<ThinkingMark size={13} />).querySelector('.think-dots')
    expect(mark?.querySelectorAll('i')).toHaveLength(3)
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
  })

  it('scales its dots with the size', () => {
    const small = mount(<ThinkingMark size={13} />).querySelector<HTMLElement>('.think-dots')
    const large = mount(<ThinkingMark size={26} />).querySelector<HTMLElement>('.think-dots')
    expect(parseInt(small?.style.getPropertyValue('--dot') ?? '0')).toBeLessThan(parseInt(large?.style.getPropertyValue('--dot') ?? '0'))
  })
})

describe('AgentStatus', () => {
  it('shows the dots next to what the agent is doing', () => {
    const host = mount(<AgentStatus label="Reading src/Hero.tsx" />)
    expect(host.querySelector('.think-dots')).not.toBeNull()
    expect(host.textContent).toContain('Reading src/Hero.tsx')
  })
})
