import { motion } from 'framer-motion'

interface OlympusLogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/**
 * The Olympus mark: a cream medallion with a navy ring, struck with a small temple —
 * pediment, architrave, four columns, a base. Fixed two colours rather than `currentColor`:
 * this is a badge, not a recolourable glyph, so it reads the same in the sidebar, the boot
 * screen, and the packaged app icon (`build/icon.svg` mirrors this exact drawing).
 */
export default function OlympusLogo({ size = 24, animated = false, className }: OlympusLogoProps) {
  const draw = (delay: number) => ({
    initial: animated ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      initial={animated ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <circle cx="32" cy="32" r="29" fill="#f5e9cf" stroke="#1c3a5e" strokeWidth="3" />
      <motion.g stroke="#1c3a5e" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Pediment. */}
        <motion.path d="M19 28 32 17 45 28" strokeWidth="3" {...draw(0.05)} />
        {/* Architrave. */}
        <motion.path d="M16 28h32" strokeWidth="3.4" {...draw(0.16)} />
        {/* Four columns. */}
        <motion.path d="M21 28v14M28 28v14M36 28v14M43 28v14" strokeWidth="2.6" {...draw(0.28)} />
        {/* Base. */}
        <motion.path d="M15 46h34" strokeWidth="3.4" {...draw(0.42)} />
      </motion.g>
    </motion.svg>
  )
}
