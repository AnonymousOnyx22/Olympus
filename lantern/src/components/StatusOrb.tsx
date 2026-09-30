import thinkingLaurel from '../assets/olympus-thinking.svg'

export type OrbKind = 'idle' | 'connecting' | 'working' | 'thinking' | 'ready' | 'attention' | 'open'

interface Props {
  kind: OrbKind
  size?: number
}

/** Compact status marks. Thinking uses the same animated laurel as the website. */
export default function StatusOrb({ kind, size = 14 }: Props) {
  const style = { width: size, height: size }
  if (kind === 'connecting') {
    return (
      <span className="status-orb relative inline-flex shrink-0 items-center justify-center" style={style} aria-hidden="true">
        <span className="absolute inline-block rounded-full bg-aether-400/50" style={{ ...style, animation: 'olympus-radar 1.6s cubic-bezier(0,0,.2,1) infinite' }} />
        <span className="absolute inline-block rounded-full bg-aether-400/40" style={{ ...style, animation: 'olympus-radar 1.6s cubic-bezier(0,0,.2,1) infinite .5s' }} />
        <span className="relative inline-block rounded-full bg-aether-500" style={{ width: size * 0.32, height: size * 0.32 }} />
      </span>
    )
  }
  if (kind === 'thinking') {
    return <img className="status-orb shrink-0" src={thinkingLaurel} width={size} height={size} style={style} alt="" aria-hidden="true" />
  }
  const dotColor = kind === 'ready' || kind === 'working' ? 'bg-aether-500' : kind === 'attention' ? 'bg-amber-400' : kind === 'open' ? 'bg-slate-300' : 'bg-slate-200'
  return (
    <span className="status-orb inline-flex shrink-0 items-center justify-center" style={style} aria-hidden="true">
      <span className={`inline-block rounded-full ${dotColor}`} style={{ width: size * 0.32, height: size * 0.32, animation: kind === 'attention' ? 'olympus-breathe .9s ease-in-out infinite' : undefined }} />
    </span>
  )
}
