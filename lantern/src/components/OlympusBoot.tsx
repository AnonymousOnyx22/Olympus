import { motion } from 'framer-motion'
import OlympusLogo from './OlympusLogo'
import heroArt from '../assets/olympus-cartoon-hero.png'

/** Startup progress is supplied by actual initialization milestones. */
export default function OlympusBoot({ progress = 0, label = 'Waking the workspace…' }: { progress?: number; label?: string }) {
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

        <p className="mt-4 text-center text-xs text-slate-600">Preparing your workspace. Your projects stay on your computer.</p>
      </div>
    </motion.div>
  )
}
