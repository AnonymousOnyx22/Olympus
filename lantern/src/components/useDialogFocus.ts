import { useEffect, useRef } from 'react'

/** Contains modal keyboard focus, hides background controls, and restores the trigger. */
export function useDialogFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    const hidden: Array<[HTMLElement, boolean]> = []
    let branch: HTMLElement = dialog
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          hidden.push([sibling, sibling.inert])
          sibling.inert = true
        }
      }
      branch = branch.parentElement
    }
    const controls = () => [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length > 0)
    const first = () => (controls()[0] ?? dialog).focus()
    first()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const items = controls()
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (!items.length || (event.shiftKey ? index <= 0 : index === items.length - 1 || index < 0)) {
        event.preventDefault()
        ;(event.shiftKey ? items.at(-1) : items[0])?.focus()
      }
    }
    const onFocus = (event: FocusEvent) => { if (!dialog.contains(event.target as Node)) first() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocus)
      hidden.forEach(([el, inert]) => { el.inert = inert })
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  return ref
}
