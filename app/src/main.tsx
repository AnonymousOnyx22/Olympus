import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

/**
 * Anything that escapes a component's own boundary still lands here rather than becoming an
 * unhandled rejection the user knows nothing about.
 */
window.addEventListener('unhandledrejection', (event) => {
  void window.electronAPI?.reportError?.({
    message: `Unhandled rejection: ${String(event.reason)}`,
    stack: (event.reason as Error | null)?.stack ?? null,
    componentStack: null,
  }).catch(() => {})
})

window.addEventListener('error', (event) => {
  void window.electronAPI?.reportError?.({
    message: event.message,
    stack: event.error?.stack ?? null,
    componentStack: null,
  }).catch(() => {})
})

// The app was called Olympus before it was Kern; carry its saved UI state over once.
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key?.startsWith('olympus.')) continue
    const next = `kern.${key.slice('olympus.'.length)}`
    if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key) ?? '')
    localStorage.removeItem(key)
  }
} catch { /* storage unavailable; start with defaults */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="Kern could not start">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
