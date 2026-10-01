import { motion } from 'framer-motion'
import mark from '../assets/olympus-mark.png'

interface OlympusLogoProps {
  size?: number
  animated?: boolean
  className?: string
}

/**
 * The Olympus mark: a painted profile portrait, crowned with a wheat leaf, on a sky-blue
 * ground. A raster image rather than a drawn glyph — this one has real brushwork and
 * can't be redrawn in strokes — so it reads the same in the sidebar, the boot screen, and
 * the packaged app icon (`build/icon.svg` is generated from this same source image).
 */
export default function OlympusLogo({ size = 24, animated = false, className }: OlympusLogoProps) {
  return (
    <motion.img
      src={mark}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: '50%', display: 'block' }}
      aria-hidden
      initial={animated ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}
