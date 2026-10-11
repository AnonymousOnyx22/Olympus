import type { CSSProperties } from 'react'

/**
 * The working indicator for an agent: three glowing dots that pulse in turn. The same mark is used in
 * every window, whatever model it runs, and matches the website. Styles live in index.css (.think-dots).
 */
export default function ThinkingMark({ size = 18 }: { size?: number }) {
  const dot = Math.max(3, Math.round(size * 0.26))
  return (
    <span className="think-dots" style={{ '--dot': `${dot}px`, minWidth: size, height: size } as CSSProperties} aria-hidden="true">
      <i /><i /><i />
    </span>
  )
}
