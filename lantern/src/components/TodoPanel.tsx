import { motion, AnimatePresence } from 'framer-motion'
import type { MessageEntry } from '../services/streamHandler'

export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

function normalizeTodo(item: unknown, index: number): Todo | null {
  if (!item || typeof item !== 'object') return null
  const r = item as Record<string, unknown>
  const content = typeof r.content === 'string' ? r.content : typeof r.text === 'string' ? r.text : typeof r.title === 'string' ? r.title : null
  if (!content) return null
  const raw = typeof r.status === 'string' ? r.status.toLowerCase() : ''
  const status: Todo['status'] = raw.includes('progress') || raw === 'active' ? 'in_progress' : raw === 'completed' || raw === 'done' ? 'completed' : 'pending'
  return { id: typeof r.id === 'string' ? r.id : String(index), content, status }
}

/** The agent's latest plan: the most recent `todowrite` call across the transcript. */
export function extractTodos(messages: MessageEntry[]): Todo[] | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i].parts
    for (let j = parts.length - 1; j >= 0; j--) {
      const part = parts[j]
      if (part.type !== 'tool' || part.tool !== 'todowrite') continue
      const raw = (part.state.input as { todos?: unknown } | undefined)?.todos
      if (!Array.isArray(raw)) continue
      const todos = raw.map(normalizeTodo).filter((t): t is Todo => t !== null)
      if (todos.length) return todos
    }
  }
  return null
}

/**
 * The agent's live plan. Each item's strikethrough draws across on a CSS transition
 * (not a remount), so it only animates the moment a todo actually flips to completed —
 * not on every re-render — and the in-progress item gets a slow Aether glow.
 */
export default function TodoPanel({ todos }: { todos: Todo[] }) {
  const done = todos.filter((t) => t.status === 'completed').length
  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="font-medium text-slate-900">Plan</span>
        <span className="font-mono text-slate-500">{done}/{todos.length}</span>
      </div>
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {todos.map((todo) => {
            const active = todo.status === 'in_progress'
            const completed = todo.status === 'completed'
            return (
              <motion.li
                key={todo.id}
                layout
                className={`flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors duration-500 ${active ? 'todo-active bg-sky-50 ring-1 ring-sky-200' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors duration-500 ${
                    completed ? 'border-emerald-500 bg-emerald-500' : active ? 'border-sky-500' : 'border-slate-300'
                  }`}
                >
                  {completed && (
                    <svg className="h-2 w-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
                  )}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-sky-500 motion-safe:animate-pulse" />}
                </span>
                <span className="relative min-w-0 flex-1 text-[12px] leading-snug">
                  <span className={`transition-colors duration-700 ${completed ? 'text-slate-400' : active ? 'text-sky-700' : 'text-slate-700'}`}>{todo.content}</span>
                  <span aria-hidden="true" className="absolute left-0 top-1/2 h-px bg-slate-300" style={{ width: completed ? '100%' : '0%', transition: 'width 700ms ease' }} />
                </span>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </motion.div>
  )
}
