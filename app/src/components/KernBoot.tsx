import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import KernLogo from './KernLogo'

/** The bar climbs steadily from 0 and never passes this until startup has really finished. */
const HOLD_AT = 90
/** Time constant of the climb: about 63% of HOLD_AT after this long. */
const CLIMB_MS = 2600
/** After this long without finishing, say so instead of looking frozen. */
const SLOW_START_MS = 8000

/**
 * The startup screen. `progress` only says whether startup is done (100) and which step is running;
 * the bar itself is driven by time so it always starts at 0 and moves visibly. It eases toward
 * HOLD_AT while the work runs, so a slow step still reads as work in progress, and it only fills to
 * 100 once startup is genuinely complete.
 */
export default function KernBoot({ progress = 0 }: { progress?: number }) {
  const reduceMotion = useReducedMotion()
  const done = progress >= 100
  const [shown, setShown] = useState(0)
  const [slow, setSlow] = useState(false)
  const doneRef = useRef(done)
  useEffect(() => { doneRef.current = done }, [done])

  useEffect(() => {
    if (reduceMotion) return
    let frame = 0
    const start = performance.now()
    let last = start
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64)
      last = now
      setShown((current) => {
        if (doneRef.current) {
          const next = current + (100 - current) * Math.min(1, dt * 0.009)
          return 100 - next < 0.4 ? 100 : next
        }
        const curve = HOLD_AT * (1 - Math.exp(-(now - start) / CLIMB_MS))
        return Math.max(current, curve)
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reduceMotion])

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_START_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const completion = reduceMotion ? (done ? 100 : 50) : shown
  const label = done ? (completion >= 99 ? 'Ready' : 'Almost ready') : progress < 55 ? 'Loading settings and projects' : 'Starting the local agent'
  return <motion.div className="fixed inset-0 z-50 grid place-items-center bg-midnight px-6 text-slate-900" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
    <div className="w-full max-w-xs">
      <div className="flex items-center gap-3"><KernLogo size={32} /><h1 className="text-[24px] font-semibold">Kern</h1></div>
      <div className="mt-8 flex items-center justify-between gap-4 text-[14px] text-slate-500"><span role="status">{label}</span><span className="tabular-nums">{Math.round(completion)}%</span></div>
      <div className="mt-3 h-1 overflow-hidden bg-slate-200" role="progressbar" aria-label="Starting Kern" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(completion)}><div className="h-full bg-accent-600" style={{ width: `${completion}%` }} /></div>
      <p className="mt-4 min-h-[18px] text-[12px] text-slate-400" aria-live="polite">{slow && !done ? 'Still starting. The first launch after an update can take a little longer.' : ''}</p>
    </div>
  </motion.div>
}
