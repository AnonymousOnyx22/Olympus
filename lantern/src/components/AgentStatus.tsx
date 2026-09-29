import { motion } from 'framer-motion'
import StatusOrb from './StatusOrb'

export default function AgentStatus({ label }: { label: string }) {
  return (
    <motion.div
      role="status"
      animate={{ y: [0, -4, 0] }}
      transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
      className="flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 font-mono text-xs text-slate-500 shadow-[0_8px_30px_rgb(14,165,233,0.08)] ring-1 ring-sky-100"
    >
      <StatusOrb kind="thinking" size={18} />
      {label || 'Agent working...'}
    </motion.div>
  )
}
