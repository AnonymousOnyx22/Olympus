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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary label="Olympus could not start">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
