import { motion } from 'framer-motion'
import OlympusLogo from './OlympusLogo'

const PARTICLES = Array.from({ length: 12 }, (_, index) => ({
  angle: index * 30,
  delay: 0.18 + (index % 4) * 0.07,
}))

export default function StartupIntro() {
  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-white"
      initial={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0.96, clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.78, ease: [0.76, 0, 0.24, 1] }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(129,140,248,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(129,140,248,.18) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.12 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full border border-sky-400/10"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.05, 1], opacity: [0, 0.8, 0.35], rotate: 120 }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.div
        className="absolute h-72 w-72 rounded-full border border-dashed border-slate-200"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute h-52 w-52 rounded-full border border-sky-400/20"
        animate={{ rotate: -360, scale: [0.96, 1.03, 0.96] }}
        transition={{ rotate: { duration: 7, repeat: Infinity, ease: 'linear' }, scale: { duration: 2.2, repeat: Infinity } }}
      />

      <div className="absolute left-1/2 top-1/2 h-0 w-0">
        {PARTICLES.map(({ angle, delay }) => (
          <motion.span
            key={angle}
            className="absolute h-1 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(165,180,252,.9)]"
            style={{ rotate: angle }}
            initial={{ x: 0, opacity: 0, scale: 0 }}
            animate={{ x: [0, 92, 116], opacity: [0, 1, 0], scale: [0, 1, 0.25] }}
            transition={{ duration: 1.05, delay, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </div>

      <div className="relative flex -translate-y-2 flex-col items-center">
        <motion.div
          className="absolute -inset-16 rounded-full bg-sky-500/10 blur-3xl"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 0.8], opacity: [0, 0.65, 0.25] }}
          transition={{ duration: 1.45, ease: 'easeOut' }}
        />
        <motion.div
          className="relative text-slate-900 drop-shadow-[0_0_28px_rgba(129,140,248,0.5)]"
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.35 }}
        >
          <OlympusLogo size={82} animated />
          {[
            '-left-7 -top-5 border-l border-t',
            '-right-7 -top-5 border-r border-t',
            '-bottom-5 -left-7 border-b border-l',
            '-bottom-5 -right-7 border-b border-r',
          ].map((position) => (
            <motion.span
              key={position}
              className={`absolute h-5 w-5 border-sky-400/55 ${position}`}
              initial={{ opacity: 0, scale: 1.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55, duration: 0.45, ease: 'easeOut' }}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 9, letterSpacing: '0.22em', filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '-0.025em', filter: 'blur(0px)' }}
          transition={{ duration: 0.7, delay: 0.72, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-7 text-[24px] font-semibold text-slate-900"
        >
          Olympus
        </motion.div>
        <motion.div className="relative mt-3 h-px w-32 overflow-hidden bg-slate-100" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.85, duration: 0.45 }}>
          <motion.span className="absolute inset-y-0 w-10 bg-sky-400" animate={{ x: [-42, 130] }} transition={{ delay: 1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        </motion.div>
        <motion.span
          className="relative mt-2 font-mono text-[9px] tracking-[0.24em] text-slate-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.65] }}
          transition={{ delay: 1.05, duration: 0.6 }}
        >
          LOCAL AGENT READY
        </motion.span>
      </div>
    </motion.div>
  )
}
