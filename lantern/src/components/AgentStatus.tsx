import StatusOrb from './StatusOrb'

export default function AgentStatus({ label }: { label: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-1 font-mono text-xs text-slate-500">
      <StatusOrb kind="thinking" size={18} />
      <span>{label || 'Thinking...'}</span>
    </div>
  )
}
