import { motion } from 'framer-motion'
import OlympusLogo from './OlympusLogo'

/**
 * The boot screen shown while the local `opencode` daemon starts. Intentionally almost
 * empty: a white field, the Olympus mark, a hairline progress bar, and one line of
 * status text. Everything else is ornament, and ornament is what this rebrand removed.
 */
export default function OlympusBoot({ label = 'Summoning local daemon…' }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-white" role="status" aria-live="polite">
      <div className="flex w-64 flex-col items-center">
        <motion.div
          className="text-sky-600"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <OlympusLogo size={56} animated />
        </motion.div>

        <div className="mt-8 h-px w-40 overflow-hidden bg-slate-100">
          <motion.div
            className="h-px w-1/4 bg-sky-400"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>

        <p className="mt-4 text-xs text-slate-400">{label}</p>
      </div>
    </div>
  )
}
