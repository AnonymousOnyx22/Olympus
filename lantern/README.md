# Olympus

A local-first desktop GUI and execution harness for the [`opencode`](https://opencode.ai) coding agent, powered by models running on your own computer.

It discovers models served from your machine through Ollama, LM Studio, vLLM, llama.cpp, and other
loopback-only OpenAI-compatible endpoints. Providers already configured in opencode may also appear in
the model picker. The interface uses a light "Aegean Greek High-Tech" theme.

## What it does

- **Manages the daemon for you.** Olympus spawns and supervises `opencode serve` in the background,
  switching its working directory when you open a different project and shutting it down cleanly on exit.
- **Per-project agents.** Each project (a "space") gets its own daemon, so switching projects never
  interrupts another project's running agent. Busy state is visible in the project tree.
- **Local models by default.** It probes common local server ports, lists the models each one has
  loaded, and injects them into opencode as `@ai-sdk/openai-compatible` providers. Endpoints added in
  Olympus are restricted to this computer (loopback only).
- **Reviewable edits.** Edits made through the edit tool pause for review in the diff viewer; nothing is
  written to disk until you accept. Shell commands require separate approval, because they can change files.
- **Live tooling.** Streamed reasoning, tool-call cards with expandable output and inline diffs, an
  agent-output console, and a real interactive shell (via opencode's PTY API).
- **Three views on one session.** Agent (live transcript), Code (file explorer, editor, run) and Thread
  (conversation-forward) share session state and the composer draft.
- **Project library.** Search, sort, list or grid, watched folders, create, pin, reveal in the file
  manager, hide or remove, plus honest states for folders that have gone missing.
- **Git in the project header.** Branch, tracking branch, changed files, ahead/behind, and commit and
  push as two separate explicit actions. Ahead/behind uses locally known remote refs; Refresh does not fetch.
- **Run and live preview.** Starts the detected project command, and a dev server opens in an embedded
  preview of your real localhost app. The preview never substitutes a fake dashboard for a project that
  has not started.

## Requirements

- Node 18+ and `opencode` on your `PATH` (`npm i -g opencode-ai`).
- At least one local model server running, or a provider already configured in opencode.

## Develop

```bash
npm install
npm run dev      # Vite + Electron with hot reload
```

## Build

```bash
npm run build    # type-check + bundle renderer, main, and preload
npm start        # run the production build
```

## How it stays local

- The renderer never talks to the network directly. All opencode HTTP, the SSE event stream, and the
  terminal WebSockets are proxied through the Electron main process, and the packaged renderer ships
  with a CSP of `connect-src 'self'`.
- The daemon is started with sharing and auto-update disabled, and with
  `edit` / `bash` / `external_directory` permissions set to **ask**.
- Selecting a provider previously configured in opencode can send requests to that provider.
  Olympus-added endpoints are limited to loopback addresses.
- `contextIsolation` is on, `nodeIntegration` is off, and the preload exposes a small, typed API surface.

## Layout

```
build/
  icon.svg         Source artwork
  icon.png/.ico    Generated app icons
  make-icon.mjs    Renders the PNG and ICO from the SVG
electron/
  main.ts            Window, IPC, lifecycle, graceful teardown
  preload.ts         contextBridge — window.electronAPI
  daemonManager.ts   Spawns/supervises `opencode serve`; adds local model configuration
  opencodeBridge.ts  HTTP + SSE + PTY proxy to the daemon
  modelDiscovery.ts  Probes local OpenAI-compatible servers
  spacePool.ts       One daemon + bridge per space, so projects run concurrently
  projects.ts        Watched-folder scanning, pin/hide, missing-folder states
  git.ts             `git` invocations for status, diff, commit and push
  settings.ts        Persisted app settings
src/
  main.tsx           Renderer entry point
  App.tsx            Three-pane layout and state wiring
  constants.ts       GENERAL_SPACE — the id of the always-present General chats space
  index.css          Tailwind layers and global light-theme base styles
  services/          Typed API client + SSE stream reducer
  types/             opencode response and event types
  components/        Sidebar, ChatCanvas, DiffViewer, TerminalPanel, AgentStatus,
                     ProjectsPage, EditorWorkspace, PreviewPanel, GitMenu, ModelPicker,
                     ContextPanel, TodoPanel, WorkspaceBar, StatusOrb,
                     OlympusLogo and OlympusBoot
```
