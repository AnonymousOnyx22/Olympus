import { useEffect, useRef, useState } from 'react'
import { Terminal, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { api } from '../services/api'
import { onAgentTerminal } from '../services/streamHandler'

interface TerminalPanelProps {
  /** Daemon is up; the interactive shell is only available while it runs. */
  connected: boolean
  /** The focused space's id — the shell always belongs to whichever project has focus. */
  spaceId: string
  /** Changes whenever the daemon restarts so a fresh shell is created. */
  daemonKey: string
  visible: boolean
  initialView?: 'agent' | 'shell'
  /** Incrementing this runs runCommand once in the interactive shell. */
  runNonce?: number
  runCommand?: string | null
}

/**
 * The accent hexes here are deliberately literal rather than `var(--accent-500)`: xterm
 * paints its cursor and selection through the canvas/WebGL renderer, where a custom
 * property has already been resolved away by the time the colour is used. Keep these in
 * step with the `--accent-*` triplets in index.css.
 */
const THEME: ITheme = {
  background: '#f8fafc',
  foreground: '#334155',
  cursor: '#2563eb',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(37,99,235,0.18)',
  black: '#1e293b',
  brightBlack: '#64748b',
  blue: '#1e40af',
  brightBlue: '#2563eb',
  cyan: '#0891b2',
  brightCyan: '#06b6d4',
  green: '#059669',
  brightGreen: '#10b981',
  magenta: '#c026d3',
  brightMagenta: '#d946ef',
  red: '#e11d48',
  brightRed: '#f43f5e',
  yellow: '#d97706',
  brightYellow: '#f59e0b',
  white: '#e2e8f0',
  brightWhite: '#f8fafc',
}

function createTerminal(el: HTMLElement, interactive: boolean) {
  const term = new Terminal({
    theme: THEME,
    fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
    fontSize: 12.5,
    lineHeight: 1.25,
    cursorBlink: interactive,
    disableStdin: !interactive,
    scrollback: 5000,
    convertEol: false,
    allowProposedApi: false,
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(el)
  return { term, fit }
}

/** Keeps an xterm sized to its container, and reports the size once it settles. */
function useFit(el: HTMLElement | null, fit: FitAddon | null, onResize?: () => void) {
  useEffect(() => {
    if (!el || !fit) return
    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (el.clientWidth === 0 || el.clientHeight === 0) return
        try {
          fit.fit()
          onResize?.()
        } catch {
          // terminal disposed mid-resize
        }
      })
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
    }
  }, [el, fit, onResize])
}

function AgentOutput() {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<FitAddon | null>(null)

  useEffect(() => {
    const { term, fit } = createTerminal(ref.current!, false)
    term.writeln('\x1b[36m>\x1b[0m \x1b[2mCommands the agent runs will stream here.\x1b[0m')
    setFit(fit)
    const off = onAgentTerminal((chunk) => term.write(chunk))
    return () => {
      off()
      term.dispose()
    }
  }, [])

  useFit(ref.current, fit)
  return <div ref={ref} className="h-full w-full" />
}

function InteractiveShell({ spaceId, connected, daemonKey, runNonce = 0, runCommand }: { spaceId: string; connected: boolean; daemonKey: string; runNonce?: number; runCommand?: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<FitAddon | null>(null)
  const ptyRef = useRef<string | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const lastRunRef = useRef(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) return
    const { term, fit } = createTerminal(ref.current!, true)
    termRef.current = term
    setFit(fit)
    setError(null)
    let disposed = false
    const offs: (() => void)[] = []

    ;(async () => {
      try {
        const pty = await api.createPty(spaceId, 'Olympus shell')
        if (disposed) return void api.removePty(spaceId, pty.id).catch(() => {})
        ptyRef.current = pty.id
        offs.push(
          window.electronAPI.onPtyData((id, data) => {
            if (id === pty.id) term.write(data)
          }),
        )
        const input = term.onData((data) => window.electronAPI.ptyWrite(pty.id, data))
        offs.push(() => input.dispose())
        offs.push(
          window.electronAPI.onEvent((eventSpaceId, ev) => {
            if (eventSpaceId === spaceId && ev.type === 'pty.exited' && ev.properties.id === pty.id) {
              term.writeln(`\r\n\x1b[2m> shell exited with code ${ev.properties.exitCode}\x1b[0m`)
            }
          }),
        )
        await window.electronAPI.ptyConnect(pty.id)
        fit.fit()
        await api.resizePty(spaceId, pty.id, term.rows, term.cols).catch(() => {})
        if (runCommand && runNonce > lastRunRef.current) {
          lastRunRef.current = runNonce
          window.electronAPI.ptyWrite(pty.id, `${runCommand}\r`)
        }
      } catch (err) {
        if (!disposed) setError((err as Error).message)
      }
    })()

    return () => {
      disposed = true
      offs.forEach((off) => off())
      const id = ptyRef.current
      ptyRef.current = null
      if (id) {
        void window.electronAPI.ptyDisconnect(id)
        void api.removePty(spaceId, id).catch(() => {})
      }
      term.dispose()
      termRef.current = null
      setFit(null)
    }
  }, [connected, daemonKey, spaceId])

  useEffect(() => {
    const id = ptyRef.current
    if (!id || !runCommand || runNonce <= lastRunRef.current) return
    lastRunRef.current = runNonce
    window.electronAPI.ptyWrite(id, `${runCommand}\r`)
  }, [runCommand, runNonce])

  const onResizeRef = useRef(() => {
    const id = ptyRef.current
    const term = termRef.current
    if (id && term) void api.resizePty(spaceId, id, term.rows, term.cols).catch(() => {})
  })
  useFit(ref.current, fit, onResizeRef.current)

  if (!connected) {
    return <div className="flex h-full items-center justify-center text-xs text-slate-400">Open a project to start a shell.</div>
  }
  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      {error && <div className="absolute inset-x-3 bottom-3 rounded-xl bg-rose-500/10 px-2 py-1 text-xs text-rose-600">{error}</div>}
    </div>
  )
}

export default function TerminalPanel({ spaceId, connected, daemonKey, visible, initialView = 'agent', runNonce = 0, runCommand = null, onClose }: TerminalPanelProps & { onClose?: () => void }) {
  const [view, setView] = useState<'agent' | 'shell'>(initialView)
  // Only spawn a shell once the user actually opens it.
  const [shellWanted, setShellWanted] = useState(false)
  useEffect(() => {
    if ((visible && view === 'shell') || runNonce > 0) setShellWanted(true)
  }, [runNonce, visible, view])

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ display: visible ? 'flex' : 'none' }}>
      <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        {(['agent', 'shell'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-xl px-2.5 py-0.5 text-[11px] transition ${
              view === v ? 'bg-white text-slate-900 shadow-aegean' : 'text-slate-500 hover:bg-white hover:text-slate-700'
            }`}
          >
            {v === 'agent' ? 'Agent output' : 'Shell'}
          </button>
        ))}
        {onClose && <button onClick={onClose} aria-label="Close terminal" title="Close terminal (Ctrl/⌘ J)" className="ml-auto grid h-6 w-6 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>}
      </div>
      <div className="relative min-h-0 flex-1 bg-slate-50 p-2">
        <div className="absolute inset-2" style={{ visibility: view === 'agent' ? 'visible' : 'hidden' }}>
          <AgentOutput />
        </div>
        <div className="absolute inset-2" style={{ visibility: view === 'shell' ? 'visible' : 'hidden' }}>
          {shellWanted && <InteractiveShell spaceId={spaceId} connected={connected} daemonKey={daemonKey} runNonce={runNonce} runCommand={runCommand} />}
        </div>
      </div>
    </div>
  )
}
