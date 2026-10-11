export type OrbKind = 'idle' | 'connecting' | 'working' | 'thinking' | 'ready' | 'attention' | 'open'
interface Props { kind: OrbKind; size?: number }
/** A quiet state marker. Adjacent status text carries the meaning. */
export default function StatusOrb({ kind, size = 14 }: Props) {
  const active = kind === 'working' || kind === 'thinking' || kind === 'connecting'
  const color = kind === 'attention' ? 'bg-amber-400' : kind === 'working' ? 'bg-emerald-400' : 'bg-slate-400'
  return <span className="status-orb inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
    {active ? <span className={`inline-block rounded-full border border-current border-t-transparent ${kind === 'working' ? 'text-emerald-400' : 'text-slate-500'} motion-safe:animate-spin`} style={{ width: size * .7, height: size * .7 }} />
      : <span className={`inline-block rounded-full ${color}`} style={{ width: size * .4, height: size * .4 }} />}
  </span>
}
