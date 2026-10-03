import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import OlympusLogo from './OlympusLogo'
import heroArt from '../assets/olympus-cartoon-hero.png'

/**
 * Purely cosmetic flavor lines, cycled on a timer independent of real progress - the boot bar's
 * fill and percentage are the only things here backed by an actual milestone (see App.tsx's
 * bootProgress). This list just keeps the wait from reading as frozen; it never claims a step
 * actually finished.
 */
const BOOT_LINES = [
  'Waking the workspace…',
  'Lighting the lamps…',
  'Checking local models…',
  'Gathering your projects…',
  'Opening the agora…',
  'Raising the columns…',
  'Almost there…',
]

/** Startup progress is supplied by actual initialization milestones. */
export default function OlympusBoot({ progress = 0, label = 'Waking the workspace…' }: { progress?: number; label?: string }) {
  const reduceMotion = useReducedMotion()
  const [lineIndex, setLineIndex] = useState(0)
  useEffect(() => {
    if (reduceMotion) return
    const id = window.setInterval(() => setLineIndex((i) => (i + 1) % BOOT_LINES.length), 450)
    return () => window.clearInterval(id)
  }, [reduceMotion])
  const line = reduceMotion ? label : BOOT_LINES[lineIndex]
  const completion = Math.max(0, Math.min(100, progress))

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#cfe6f7]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, delay: !reduceMotion && completion === 100 ? 0.7 : 0, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
    >
      <img src={heroArt} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/25 to-white/55" />

      {/* ---- the panel ------------------------------------------------------------------ */}
      <div className="relative flex w-[30rem] max-w-[90vw] flex-col items-center rounded-2xl border border-white/70 bg-white/80 px-8 py-7 shadow-[0_20px_60px_-20px_rgba(28,58,94,0.4)] backdrop-blur-sm">
        <motion.div initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <OlympusLogo size={48} animated={!reduceMotion} />
        </motion.div>

        <div className="mt-6 flex w-full items-center justify-between text-[10px] font-medium text-slate-400">
          <span aria-live="polite">{line}</span>
          <span className="font-mono tabular-nums">{Math.round(completion)}%</span>
        </div>
        {/* Literal black/white here, not the themed `white`/`slate` utilities: those are
            remapped for the app's dark theme (`white` -> the dark card colour), which inverted
            this bar - the "empty" track read light and the "filled" portion read dark.
            Keep a full-width layer anchored on the right and scale it from zero. Animating
            an unspecified width starts from `auto`, which can flash full before shrinking.
            Scaling avoids layout changes and advances smoothly from right to left. */}
        <div
          className="relative mt-2 h-[5px] w-full overflow-hidden rounded-full bg-black/50"
          role="progressbar"
          aria-label="Starting Olympus"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(completion)}
        >
          <motion.div
            className="absolute inset-0 rounded-full bg-[#ffffff] shadow-[0_0_10px_2px_rgba(255,255,255,0.85)]"
            style={{ transformOrigin: 'right center' }}
            initial={reduceMotion ? false : { scaleX: 0 }}
            animate={{ scaleX: completion / 100 }}
            transition={{ duration: reduceMotion ? 0 : 0.65, ease: 'easeOut' }}
          />
        </div>

        <p className="mt-4 text-center text-xs text-slate-600">Preparing your workspace. Your projects stay on your computer.</p>
      </div>
    </motion.div>
  )
}
