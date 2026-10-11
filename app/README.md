# Kern desktop app

A desktop workspace that connects all your AI agents and models so you can work on separate projects at
the same time: one window per chat, each with its own model, all side by side. Kern is not an agent itself.

To talk to models it currently uses the [`opencode`](https://opencode.ai) engine. It discovers models served
from your own machine (Ollama, LM Studio, vLLM, llama.cpp and other loopback OpenAI-compatible endpoints),
lists providers you configured in opencode, and bridges to the Claude and Codex command-line tools.

## What it does

- **Runs the agent for you.** Kern starts and supervises one `opencode serve` per open project, so
  switching projects never interrupts another project's running agent.
- **Agents.** Every open conversation is its own window in a grid. Stream reasoning, tool calls with
  expandable output, inline diffs and the agent's live todo list.
- **Reviewable edits.** Edits pause in the diff viewer; nothing is written until you accept. Shell
  commands need their own approval. Pick an approval mode per agent from the header.
- **Projects.** Search, sort, list or grid, watched folders, create, pin, reveal in the file manager,
  hide or remove. Folders that have gone missing are not listed and return if the folder does.
- **Code.** File explorer, Monaco editor, a real terminal (opencode's PTY API) and a live preview of
  your localhost dev server.
- **Git.** Branch, changed files, ahead/behind, and commit and push as two separate explicit actions.
- **Connections.** Save keys for AI models, Stripe, email, analytics, file and image storage, site
  hosting and Figma. Each connection has an "Available to projects" checklist; unchecked projects do
  not receive its environment variables.
- **Skills.** The skills opencode has available are listed in the sidebar.

## Requirements

- Node 20+ (see `.nvmrc`) and `opencode` on your `PATH` (`npm i -g opencode-ai`), or set
  `KERN_OPENCODE_BIN` to the executable.
- At least one local model server running, or a provider already configured in opencode.

## Develop

```bash
npm install
npm run dev        # Vite + Electron with hot reload
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run lint       # eslint
npm run build      # typecheck + bundle renderer, main and preload
npm start          # run the production build
npm run dist       # unsigned installer for this OS (build:win / build:mac / build:linux)
```

Do not launch Electron from a shell that has `ELECTRON_RUN_AS_NODE=1` set (Claude Code's shell does):
Electron then runs as plain Node and crashes. Unset it first: `env -u ELECTRON_RUN_AS_NODE npm run dev`.

Environment variables:

| Variable | Effect |
| --- | --- |
| `KERN_USER_DATA` | Use another profile folder (a second profile, or a throwaway one for tests). |
| `KERN_OPENCODE_BIN` | Path to the `opencode` executable. |
| `KERN_DEBUG_IPC` | Log every IPC channel call to the console. |
| `KERN_BRIDGE_LOG` | File to which the Claude/Codex CLI bridge logs what it does (never prompt text). |

Settings live in `%APPDATA%\Kern` (or the platform equivalent). On first launch the app copies a
profile left by its earlier name, `Olympus`, into it once and leaves the old folder in place.

## How it stays local

- The renderer never talks to the network. All opencode HTTP, the event stream and the terminal
  sockets go through the Electron main process, and the packaged renderer has a CSP of
  `connect-src 'self'`.
- The agent runs with sharing and auto-update disabled and with `edit`, `bash` and
  `external_directory` permissions set to **ask**.
- Endpoints you add in Kern are limited to loopback addresses. A provider you configured in opencode
  can send requests to that provider.
- `contextIsolation` is on, `nodeIntegration` is off, and the preload exposes a small typed API.

## Layout

```
build/       Icon source (icon.svg), generated icons, make-icon.mjs, macOS entitlements
electron/    Main process
  main.ts            Window, IPC, lifecycle
  preload.ts         contextBridge: window.electronAPI
  profile.ts         Profile folder and one-time migration from the Olympus profile
  settings.ts        Persisted settings
  projects.ts        Watched folders, pin/hide, missing-folder handling
  spacePool.ts       One opencode daemon + bridge per project
  daemonManager.ts   Spawns and supervises `opencode serve`
  opencodeBridge.ts  HTTP, SSE and PTY proxy to a daemon
  modelDiscovery.ts  Probes local OpenAI-compatible servers
  connections.ts     Connection providers, saved values, per-project access
  connectionChecks.ts  Live checks of saved keys
  cliBridge.ts       Local bridge that lets opencode use the Claude and Codex CLIs
  sessionScope.ts    Which sessions belong to which folder
  git.ts             git status, diff, commit, push
src/         Renderer (React + Tailwind)
  App.tsx, main.tsx, index.css, constants.ts, errorText.ts
  services/          Typed API client, event-stream reducer, legacy model id migration
  components/        Sidebar, AllAgentsGrid, AgentWorkspace, ChatCanvas, DiffViewer, TerminalPanel,
                     EditorWorkspace, PreviewPanel, ProjectsPage, ConnectionsSettings, ModelPicker, ...
tests/       Vitest suites for the main process, the stream reducer and shared components
```
