import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  trigger: RefObject<HTMLButtonElement | null>
  onClose: () => void
  label: string
  children: ReactNode
  direction?: 'up' | 'down'
  width?: number
  className?: string
}

/** Shared nonmodal dropdown: viewport placement, focus, dismissal and arrow navigation. */
export default function Popover({ trigger, onClose, label, children, direction = 'down', width = 320, className = '' }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 400, ready: false })

  useLayoutEffect(() => {
    const place = () => {
      const button = trigger.current?.getBoundingClientRect()
      const menu = panel.current
      if (!button || !menu) return
      const viewport = window.visualViewport
      const top = viewport?.offsetTop ?? 0
      const left = viewport?.offsetLeft ?? 0
      const height = viewport?.height ?? innerHeight
      const right = left + (viewport?.width ?? innerWidth)
      const bottom = top + height
      const above = Math.max(0, button.top - top - 16)
      const below = Math.max(0, bottom - button.bottom - 16)
      const desired = Math.min(menu.scrollHeight, height - 16)
      const up = direction === 'up' ? above >= desired || above >= below : below < desired && above > below
      const maxHeight = Math.max(80, up ? above : below)
      const menuHeight = Math.min(desired, maxHeight)
      setPosition({
        left: Math.max(left + 8, Math.min(button.right - menu.offsetWidth, right - menu.offsetWidth - 8)),
        top: Math.max(top + 8, Math.min(up ? button.top - menuHeight - 8 : button.bottom + 8, bottom - menuHeight - 8)),
        maxHeight, ready: true,
      })
    }
    place()
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [trigger, direction, width])

  useLayoutEffect(() => {
    // Switching a menu's view can remove the focused control. Keep keyboard focus inside.
    if (document.activeElement === document.body && panel.current) {
      panel.current.querySelector<HTMLElement>('input:not(:disabled),button[aria-pressed="true"]:not(:disabled),button:not(:disabled)')?.focus()
    }
  }, [children])

  useEffect(() => {
    const controls = () => [...(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') ?? [])]
      .filter(element => element.getClientRects().length > 0)
    const frame = requestAnimationFrame(() => (panel.current?.querySelector<HTMLElement>('input:not(:disabled)') ?? panel.current?.querySelector<HTMLElement>('button[aria-pressed="true"]:not(:disabled)') ?? controls()[0] ?? panel.current)?.focus())
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close.current()
    }
    const focus = (event: FocusEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) close.current()
    }
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
        trigger.current?.focus()
        return
      }
      if (!panel.current?.contains(event.target as Node)) return
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement
      if (editing && (event.key !== 'ArrowDown' || (event.target instanceof HTMLInputElement && event.target.type !== 'search'))) return
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
      const items = controls()
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      event.preventDefault()
      items[next]?.focus()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', focus)
    document.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', focus)
      document.removeEventListener('keydown', key)
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the trigger must be read at close time, not captured at open
      if (document.activeElement === document.body) trigger.current?.focus()
    }
  }, [trigger])

  return createPortal(
    <div ref={panel} role="dialog" aria-label={label} tabIndex={-1} className={`app-popover ${className}`}
      style={{ width, maxWidth: 'calc(100vw - 16px)', left: position.left, top: position.top, maxHeight: position.maxHeight, visibility: position.ready ? 'visible' : 'hidden' }}>
      {children}
    </div>, document.body,
  )
}
