import { motion } from 'framer-motion'

interface OlympusLogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/**
 * The Olympus mark: a single Greek column — pediment arch, capital, fluted shaft and
 * base — under a Helios Gold sun. It is deliberately drawn from a 2px stroke at a
 * 32-unit grid so it stays crisp from the 19px sidebar lockup up to the 82px boot
 * screen. The stroke inherits `currentColor` so the lockup can sit on any surface;
 * the sun is always gold because it is the only fixed-colour element in the identity.
 */
export default function OlympusLogo({ size = 24, animated = false, className }: OlympusLogoProps) {
  const rise = (delay: number) => ({
    initial: animated ? { pathLength: 0, opacity: 0 } : false,
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden
      initial={animated ? { opacity: 0, scale: 0.94 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Pediment — the arch over the summit. */}
      <motion.path
        d="M5 13.5a11 11 0 0 1 22 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        {...rise(0.05)}
      />
      {/* Capital. */}
      <motion.path
        d="M4.5 13.5h23"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        {...rise(0.18)}
      />
      {/* Shaft. */}
      <motion.path
        d="M11 16.5h10V26H11V16.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        {...rise(0.3)}
      />
      {/* Base. */}
      <motion.path
        d="M7 26h18"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        {...rise(0.42)}
      />
      {/* Fluting, kept faint so it reads as texture rather than as extra lines. */}
      <motion.g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.4" {...rise(0.54)}>
        <path d="M14 18.5v5.5" />
        <path d="M18 18.5v5.5" />
      </motion.g>
      {/* Helios Gold sun above the summit — the one fixed-colour element. */}
      <motion.circle
        cx="16"
        cy="5.4"
        r="1.7"
        fill="#fbbf24"
        initial={animated ? { opacity: 0, scale: 0 } : false}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: animated ? 0.62 : 0 }}
        style={{ transformOrigin: '16px 5.4px' }}
      />
    </motion.svg>
  )
}
