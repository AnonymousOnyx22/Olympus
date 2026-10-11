import type { ReactNode } from 'react'

/** One restrained language for loading, empty results and recoverable errors. */
export default function InterfaceState({ title, description, tone = 'empty', action, compact = false }: {
  title: string
  description?: ReactNode
  tone?: 'empty' | 'loading' | 'error'
  action?: ReactNode
  compact?: boolean
}) {
  return <div className={`interface-state ${compact ? 'interface-state-compact' : ''}`} role={tone === 'error' ? 'alert' : tone === 'loading' ? 'status' : undefined} aria-busy={tone === 'loading' || undefined}>
    <div className="interface-state-heading">
      {tone === 'loading' && <span className="interface-state-spinner" aria-hidden="true" />}
      {tone === 'error' && <span className="interface-state-error" aria-hidden="true">!</span>}
      <p className="interface-state-title">{title}</p>
    </div>
    {description && <div className="interface-state-description">{description}</div>}
    {action && <div className="interface-state-action">{action}</div>}
  </div>
}
