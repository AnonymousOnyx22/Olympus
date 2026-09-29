export type OrbKind = 'idle' | 'connecting' | 'working' | 'thinking' | 'ready' | 'attention' | 'open'

interface Props {
  kind: OrbKind
  size?: number
}

/**
 * A small status indicator. `ready` and `working` are plain solid Aether Blue dots —
 * a quick, glanceable "this is live" signal for sidebars and headers, same weight as
 * the other dots; `attention` is Helios Gold because it is a warning, and `open` /
 * `idle` step down through slate so "dormant" never competes with "live".
 * `thinking` is the elaborate one: layered counter-rotating rings in sky tones with a
 * single emerald accent, reserved for the one big "the agent is composing a reply"
 * banner in the transcript, where it earns the extra attention. `connecting` pings
 * like a radar while something boots up. Pure CSS (see the olympus-radar,
 * olympus-orbit, olympus-orbit-reverse and olympus-breathe keyframes in index.css)
 * so it costs nothing to render dozens of these in a busy multi-agent grid.
 */
export default function StatusOrb({ kind, size = 14 }: Props) {
  const style = { width: size, height: size }
  if (kind === 'connecting') {
    return (
      <span className="status-orb relative inline-flex shrink-0 items-center justify-center" style={style} aria-hidden="true">
        <span className="absolute inline-block rounded-full bg-sky-400/50" style={{ ...style, animation: 'olympus-radar 1.6s cubic-bezier(0,0,.2,1) infinite' }} />
        <span className="absolute inline-block rounded-full bg-sky-400/40" style={{ ...style, animation: 'olympus-radar 1.6s cubic-bezier(0,0,.2,1) infinite .5s' }} />
        <span className="relative inline-block rounded-full bg-sky-500" style={{ width: size * 0.32, height: size * 0.32 }} />
      </span>
    )
  }
  if (kind === 'thinking') {
    return (
      <span className="status-orb relative inline-flex shrink-0 items-center justify-center" style={style} aria-hidden="true">
        <span
          className="absolute inline-block rounded-full"
          style={{ ...style, animation: 'olympus-orbit 2.4s linear infinite', background: 'conic-gradient(from 0deg, transparent, #0ea5e9 20%, transparent 40%)' }}
        />
        <span
          className="absolute inline-block rounded-full"
          style={{ width: size * 0.76, height: size * 0.76, animation: 'olympus-orbit-reverse 1.3s linear infinite', background: 'conic-gradient(from 90deg, transparent, #38bdf8 18%, #34d399 32%, transparent 56%)' }}
        />
        <span
          className="absolute inline-block rounded-full"
          style={{ width: size * 0.5, height: size * 0.5, animation: 'olympus-orbit 0.7s linear infinite', background: 'conic-gradient(from 180deg, transparent, #7dd3fc 30%, #0ea5e9 44%, transparent 68%)' }}
        />
        <span className="absolute inline-block rounded-full bg-slate-50" style={{ width: size * 0.32, height: size * 0.32 }} />
        <span className="relative inline-block rounded-full bg-white" style={{ width: size * 0.14, height: size * 0.14, animation: 'olympus-breathe 1s ease-in-out infinite' }} />
      </span>
    )
  }
  const dotColor = kind === 'ready' || kind === 'working' ? 'bg-sky-500' : kind === 'attention' ? 'bg-amber-400' : kind === 'open' ? 'bg-slate-300' : 'bg-slate-200'
  return (
    <span className="status-orb inline-flex shrink-0 items-center justify-center" style={style} aria-hidden="true">
      <span className={`inline-block rounded-full ${dotColor}`} style={{ width: size * 0.32, height: size * 0.32, animation: kind === 'attention' ? 'olympus-breathe .9s ease-in-out infinite' : undefined }} />
    </span>
  )
}
