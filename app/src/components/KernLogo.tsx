import { motion } from 'framer-motion'
import mark from '../assets/kern-mark.svg'

interface KernLogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/** The Kern mark: a clear stem and two angular branches. */
export default function KernLogo({ size = 24, animated = false, className }: KernLogoProps) {
  return (
    <motion.img
      src={mark}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: 'block' }}
      aria-hidden
      initial={animated ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}
