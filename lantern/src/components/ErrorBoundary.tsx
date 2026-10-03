import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Shown instead of the blank screen. Defaults to the app chrome fallback. */
  label?: string
}

interface State {
  error: Error | null
  info: string | null
}

/**
 * Keeps one bad component from taking the whole window to a white screen.
 *
 * React unmounts the entire tree when a render throws and there is no boundary above it, so
 * a user with a paid licence would have lost their window with no way back and no record of
 * what happened. This boundary catches it, shows a recoverable state, and reports the
 * failure so it can be diagnosed from a user's description.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const detail = info.componentStack ?? null
    this.setState({ info: detail })
    // Surface it in the main process, where it lands in the log file next to daemon output.
    void window.electronAPI?.reportError?.({
      message: error.message,
      stack: error.stack ?? null,
      componentStack: detail,
    }).catch(() => {})
    console.error('[olympus] renderer error', error, detail)
  }

  private reset = () => this.setState({ error: null, info: null })

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid h-screen w-screen place-items-center bg-slate-50 px-6 text-slate-900">
        <div className="max-w-lg text-center">
          <h1 className="text-lg font-semibold">{this.props.label ?? 'Something in this view broke'}</h1>
          <p className="mt-2 text-sm text-slate-600">
            The rest of the app is still running. Reloading this view usually clears it. If it keeps happening,
            the details below identify the component responsible.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={this.reset} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm transition hover:bg-slate-100">
              Try again
            </button>
            <button onClick={() => window.location.reload()} className="rounded-lg bg-aether-600 px-3 py-1.5 text-sm text-white transition hover:bg-aether-400">
              Reload window
            </button>
          </div>
          <details className="mt-5 text-left text-xs text-slate-500">
            <summary className="cursor-pointer">Technical detail</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 ring-1 ring-slate-200">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
              {info ? `\n\n${info}` : ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
