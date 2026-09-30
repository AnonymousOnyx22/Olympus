import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import OlympusLogo from './OlympusLogo'
import heroArt from '../assets/olympus-cartoon-hero.png'

/** Fake-technical boot log. Cosmetic — nothing here reflects real progress, the bar does that —
 * but it reads like a real startup trace, the way an OS or a game boot screen does. */
const LOG_LINES = [
  'mounting workspace/',
  'resolving opencode on PATH… ok',
  'probing local model servers',
  'handshake: daemon 0x' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
  'loading project index',
  'restoring last session',
  'warming the composer',
]

/**
 * The boot screen shown while settings, the project list, and the first space load. Full-bleed
 * cartoon hero art from the marketing site (assets/olympus-cartoon-hero.png there, mirrored
 * here), a frosted panel on top with the mark, a real progress bar, and a small boot log.
 * `progress` is driven by actual startup milestones in App.tsx; the log lines are decoration,
 * not a task list.
 */
export default function OlympusBoot({ progress = 0, label = 'Waking the workspace…' }: { progress?: number; label?: string }) {
  const [lines, setLines] = useState<string[]>([])

  useEffect(() => {
    let i = 0
    const id = window.setInterval(() => {
      if (i >= LOG_LINES.length) { window.clearInterval(id); return }
      setLines((current) => [...current, LOG_LINES[i]])
      i += 1
    }, 260)
    return () => window.clearInterval(id)
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#cfe6f7]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      role="status"
      aria-live="polite"
    >
      <img src={heroArt} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/25 to-white/55" />

      {/* ---- the panel ------------------------------------------------------------------ */}
      <div className="relative flex w-72 flex-col items-center rounded-2xl border border-white/70 bg-white/80 px-6 py-7 shadow-[0_20px_60px_-20px_rgba(28,58,94,0.4)] backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          <OlympusLogo size={48} animated />
        </motion.div>

        <div className="mt-5 flex w-full items-center justify-between text-[10px] font-medium text-[#1c3a5e]/70">
          <span>{label}</span>
          <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[#1c3a5e]/15">
          <motion.div
            className="h-full rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.95)]"
            animate={{ width: `${Math.max(6, progress)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        <div className="mt-4 h-24 w-full overflow-hidden rounded-lg bg-[#1c3a5e]/[0.06] px-2.5 py-2 font-mono text-[9.5px] leading-[1.6] text-[#1c3a5e]/60">
          {lines.map((line, i) => (
            <motion.p key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
              <span className="text-[#1c3a5e]/35">&gt;</span> {line}
            </motion.p>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
