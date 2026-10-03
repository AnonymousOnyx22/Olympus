// Types for the subset of the opencode server API (v1.18) that Olympus uses,
// plus the contract of the preload bridge exposed as `window.electronAPI`.

// ---------- opencode: sessions & messages ----------

export interface Session {
  id: string
  title: string
  directory: string
  parentID?: string
  time: { created: number; updated: number }
}

export interface ModelRef {
  providerID: string
  modelID: string
}

export interface MessageError {
  name: string
  data?: { message?: string; [key: string]: unknown }
}

export interface UserMessageInfo {
  id: string
  sessionID: string
  role: 'user'
  time: { created: number }
  model?: ModelRef
}

export interface AssistantMessageInfo {
  id: string
  sessionID: string
  role: 'assistant'
  time: { created: number; completed?: number }
  providerID?: string
  modelID?: string
  error?: MessageError
}

export type MessageInfo = UserMessageInfo | AssistantMessageInfo

interface PartBase {
  id: string
  sessionID: string
  messageID: string
}

export interface TextPart extends PartBase {
  type: 'text'
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: { start: number; end?: number }
}

export interface ReasoningPart extends PartBase {
  type: 'reasoning'
  text: string
  time: { start: number; end?: number }
}

export type ToolState =
  | { status: 'pending'; input: Record<string, unknown>; raw: string }
  | {
      status: 'running'
      input: Record<string, unknown>
      title?: string
      metadata?: Record<string, unknown>
      time: { start: number }
    }
  | {
      status: 'completed'
      input: Record<string, unknown>
      output: string
      title: string
      metadata: Record<string, unknown>
      time: { start: number; end: number }
    }
  | {
      status: 'error'
      input: Record<string, unknown>
      error: string
      metadata?: Record<string, unknown>
      time: { start: number; end: number }
    }

export interface ToolPart extends PartBase {
  type: 'tool'
  callID: string
  tool: string
  state: ToolState
}

export interface OtherPart extends PartBase {
  type: 'step-start' | 'step-finish' | 'snapshot' | 'patch' | 'agent' | 'retry' | 'compaction' | 'file' | 'subtask'
  [key: string]: unknown
}

export type Part = TextPart | ReasoningPart | ToolPart | OtherPart

export interface MessageWithParts {
  info: MessageInfo
  parts: Part[]
}

// ---------- opencode: permissions (human-in-the-loop) ----------

export interface PermissionRequest {
  id: string
  sessionID: string
  /** e.g. "edit", "bash", "external_directory", "read" */
  permission: string
  patterns: string[]
  metadata: Record<string, unknown>
  always: string[]
  tool?: { messageID: string; callID: string }
}

export type PermissionReply = 'once' | 'always' | 'reject'

export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number }

export interface Pty {
  id: string
  title: string
  command: string
  args: string[]
  cwd: string
  status: 'running' | 'exited'
  pid: number
  exitCode?: number
}

/** Events delivered over the `/event` SSE stream. Only the ones Olympus reacts to are typed. */
export type OpencodeEvent =
  | { type: 'server.connected'; properties: Record<string, never> }
  | { type: 'session.created'; properties: { info: Session } }
  | { type: 'session.updated'; properties: { info: Session } }
  | { type: 'session.deleted'; properties: { info: Session } }
  | { type: 'session.status'; properties: { sessionID: string; status: SessionStatus } }
  | { type: 'session.idle'; properties: { sessionID: string } }
  | { type: 'session.error'; properties: { sessionID?: string; error?: MessageError } }
  | { type: 'message.updated'; properties: { sessionID: string; info: MessageInfo } }
  | { type: 'message.removed'; properties: { sessionID: string; messageID: string } }
  | { type: 'message.part.updated'; properties: { sessionID: string; part: Part } }
  | {
      type: 'message.part.delta'
      properties: { sessionID: string; messageID: string; partID: string; field: string; delta: string }
    }
  | { type: 'message.part.removed'; properties: { sessionID: string; messageID: string; partID: string } }
  | { type: 'permission.asked'; properties: PermissionRequest }
  | { type: 'permission.replied'; properties: { sessionID: string; requestID: string; reply: PermissionReply } }
  | { type: 'pty.exited'; properties: { id: string; exitCode: number } }

// ---------- Olympus: local models & daemon ----------

export interface LocalEndpoint {
  /** Provider id used in opencode config, e.g. "ollama" */
  id: string
  name: string
  /** OpenAI-compatible base URL, e.g. http://127.0.0.1:11434/v1 */
  baseURL: string
  custom?: boolean
}

export interface LocalProvider extends LocalEndpoint {
  online: boolean
  models: string[]
  /** Variant ids reported by OpenCode for each model (provider-specific thinking modes). */
  variants?: Record<string, string[]>
  /** How the model is reached, used for the small access tag in the picker. */
  access?: Record<string, 'local' | 'free' | 'api'>
  error?: string
  /** Where this provider came from: a probed local server, or the opencode daemon's own config. */
  source?: 'local' | 'opencode'
}

export type DaemonStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface DaemonState {
  status: DaemonStatus
  port: number | null
  cwd: string | null
  error?: string
}

/** A saved project = a folder you return to. Its chats live in opencode's per-directory history. */
export interface ProjectRef {
  id: string
  name: string
  path: string
}

/** Per-project bookkeeping that applies to both manual and auto-detected projects. */
export interface ProjectMeta {
  pinned?: boolean
  lastOpened?: number
  /** When Olympus first noticed this folder - drives the "New" badge. */
  firstSeen?: number
}

/** One field a connection asks for, e.g. Stripe's secret key. */
export interface ConnectionField {
  /** Also the environment variable name an agent's code reads it from, e.g. STRIPE_SECRET_KEY. */
  key: string
  label: string
  secret: boolean
  placeholder?: string
}

/** A real API/service a store's agent can be given access to - never through the chat. */
export interface ConnectionProvider {
  id: string
  name: string
  /** Groups providers in the library view, e.g. "Payments", "Marketplaces". */
  category: string
  description: string
  fields: ConnectionField[]
}

/** What the renderer is allowed to know about a connection: never the decrypted values. */
export interface ConnectionStatus {
  id: string
  name: string
  category: string
  description: string
  fields: ConnectionField[]
  /** Field keys that currently have a saved value. */
  configuredFields: string[]
  /** True for providers where "Sign in" (a real logged-in browser session) is offered as an
   * alternative to an API key - currently Pinterest and Etsy, whose app-approval process is
   * slow enough that most people never get an API key at all. */
  supportsBrowserSignIn: boolean
  /** Whether a signed-in browser session is currently saved for this provider. */
  browserSessionConnected: boolean
}

/** A project as shown in the manager: saved or detected, plus facts read from disk. */
export interface ProjectInfo extends ProjectRef {
  /** 'manual' = added one by one; 'watched' = a subfolder of a watched projects folder. */
  source: 'manual' | 'watched'
  /** The watched folder this project was found in. */
  root: string | null
  exists: boolean
  pinned: boolean
  hidden: boolean
  lastOpened: number | null
  firstSeen: number | null
  modifiedAt: number | null
  /** Detected tech, e.g. ["TypeScript", "React"]. */
  stack: string[]
  gitBranch: string | null
  description: string | null
}

export interface Skill {
  name: string
  description?: string
}

export type PermissionMode = 'ask' | 'edit' | 'bypass'

export interface OlympusSettings {
  lastProject: string | null
  selectedModel: ModelRef | null
  customEndpoints: LocalEndpoint[]
  projects: ProjectRef[]
  /** Store workspaces live beside project roots and are managed only by Station. */
  stores: ProjectRef[]
  /** Folders whose immediate subfolders are each treated as a project. */
  projectRoots: string[]
  /** Detected project paths the user chose to hide. */
  hiddenProjects: string[]
  /** Pin / recency data keyed by project id (its resolved path). */
  projectMeta: Record<string, ProjectMeta>
  /** Which space was open last: GENERAL_SPACE or a project id. */
  lastSpace: string | null
  /** Controls which agent actions pause for approval. */
  permissionMode: PermissionMode
  /** Last selected OpenCode variant, keyed by provider/model. */
  selectedVariants: Record<string, string>
}

export interface BridgeResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
  error?: string
}

export interface StartDaemonResult {
  state: DaemonState
  providers: LocalProvider[]
}

export interface ElectronAPI {
  gitStatus: (projectId: string) => Promise<GitStatus>
  gitAction: (projectId: string, action: 'commit' | 'push', message?: string) => Promise<string>
  selectDirectory(): Promise<string | null>
  /** Per-space daemon state; each open space (project or General) runs its own agent process. */
  getDaemonState(spaceId: string): Promise<DaemonState>
  onDaemonLog(callback: (spaceId: string, line: string) => void): () => void
  onDaemonState(callback: (spaceId: string, state: DaemonState) => void): () => void

  discoverModels(): Promise<LocalProvider[]>
  addEndpoint(endpoint: { name: string; baseURL: string }): Promise<OlympusSettings>
  removeEndpoint(id: string): Promise<OlympusSettings>

  /**
   * Focuses a space's Code/Preview/Terminal tabs and starts its daemon if needed (GENERAL_SPACE
   * or a saved project id). Pass `force` to restart it even if already running unchanged
   * (needed after a config change, e.g. switching approval mode).
   */
  startSpace(spaceId: string, force?: boolean): Promise<StartDaemonResult>
  /** Starts a space's daemon in the background, without changing which space is focused. */
  openSpace(spaceId: string): Promise<StartDaemonResult>
  /** Spaces with open agent windows; the daemon pool never evicts these. */
  setPinnedSpaces(spaceIds: string[]): Promise<void>

  /** Every known connection provider and which of its fields currently have a saved value.
   * Never includes a decrypted secret - those stay in the main process. */
  listConnections(): Promise<ConnectionStatus[]>
  /** Saves (or, for an empty string, clears) field values for one connection, encrypted at rest. */
  setConnection(providerId: string, values: Record<string, string>): Promise<ConnectionStatus[]>
  /** Deletes every saved value for one connection. */
  clearConnection(providerId: string): Promise<ConnectionStatus[]>

  /**
   * Opens a real, visible browser window on the provider's own login page (Pinterest, Etsy).
   * Olympus never sees the password - only the resulting session, which the user ends by
   * closing the window. Resolves once that session has been captured for later use.
   */
  openConnectionSignIn(providerId: string): Promise<ConnectionStatus[]>
  /** Forgets a saved browser session for a provider (cookies and the exported session file). */
  forgetConnectionSignIn(providerId: string): Promise<ConnectionStatus[]>
  /** Stops a background space's daemon, e.g. when its multi-project tab is closed. */
  closeSpace(spaceId: string): Promise<void>
  listProjects(): Promise<ProjectInfo[]>
  addProject(path: string): Promise<ProjectInfo[]>
  /** Forgets a manual project, or hides a detected one (its folder is never touched). */
  removeProject(id: string): Promise<ProjectInfo[]>
  unhideProject(id: string): Promise<ProjectInfo[]>
  pinProject(id: string, pinned: boolean): Promise<ProjectInfo[]>
  /** Creates a new, empty folder inside a watched projects folder. Returns the new project's id. */
  createProject(root: string, name: string): Promise<{ id: string; projects: ProjectInfo[] }>
  createStore(projectRoot: string, folderName: string, displayName?: string): Promise<{ id: string; stores: ProjectInfo[] }>
  listStores(): Promise<ProjectInfo[]>
  /** Stops the store's agent, unlists it, and - if `deleteFiles` is true - deletes its folder from disk. */
  removeStore(id: string, deleteFiles: boolean): Promise<ProjectInfo[]>
  revealProject(id: string): Promise<void>
  listProjectRoots(): Promise<string[]>
  addProjectRoot(path: string): Promise<{ roots: string[]; projects: ProjectInfo[] }>
  removeProjectRoot(path: string): Promise<{ roots: string[]; projects: ProjectInfo[] }>
  /** Fires when a watched folder gains or loses a project folder. */
  onProjectsChanged(callback: (projects: ProjectInfo[]) => void): () => void

  getSettings(): Promise<OlympusSettings>
  setSettings(patch: Partial<OlympusSettings>): Promise<OlympusSettings>

  request<T = unknown>(spaceId: string, method: string, path: string, body?: unknown): Promise<BridgeResponse<T>>
  /** Every space's opencode event stream, tagged with which space it came from. */
  onEvent(callback: (spaceId: string, event: OpencodeEvent) => void): () => void

  ptyConnect(ptyID: string): Promise<void>
  ptyWrite(ptyID: string, data: string): void
  ptyDisconnect(ptyID: string): Promise<void>
  onPtyData(callback: (ptyID: string, data: string) => void): () => void

  /** Reads a UTF-8 file inside the open project. Returns null if missing or outside the project. */
  confirmProjectSwitch(file: string): Promise<'save' | 'discard' | 'cancel'>
  readProjectFile(spaceId: string, path: string): Promise<string | null>
  readProjectImage(spaceId: string, path: string): Promise<string | null>
  /** Lists files inside the active project, excluding dependency and build folders. */
  listProjectFiles(spaceId: string): Promise<string[]>
  /** Saves an existing UTF-8 file inside the active project. */
  writeProjectFile(spaceId: string, path: string, content: string): Promise<boolean>
  /** Returns a detected package run command, if the project declares one. */
  getRunCommand(): Promise<string | null>
  /** Finds a conventional localhost development server. */
  discoverPreview(): Promise<string | null>
  /**
   * Called when the daemon's event stream reconnects after a gap. Anything derived from
   * events (busy state, message lists) must be re-read from the daemon, because events
   * that arrived while the stream was down were never seen.
   */
  onResync(callback: (spaceId: string) => void): () => void
  /** Opens an http(s) link in the user's default browser. Anything else is refused. */
  onPreviewError(callback: (url: string, message: string) => void): () => void
  openExternal(url: string): Promise<void>
  /**
   * Registers a last-chance save. Returning false (or throwing) blocks the window from
   * closing, so unsaved work is never discarded by a stray window close.
   */
  onBeforeClose(handler: () => boolean | Promise<boolean>): () => void
  /** Whether `opencode` is installed and whether its version is one Olympus supports. */
  opencodeStatus(): Promise<{ version: string | null; supported: boolean; available: boolean }>
  /** Display-only licence state. Contains no key and no signing secret. */
  licenseState(): Promise<{
    product: string
    model: string
    valid: boolean
    trial: boolean
    expired: boolean
    daysLeft: number
    email: string | null
  }>
  /**
   * Forwards a renderer crash or unhandled rejection to the main-process log. Kept free of
   * anything identifying, and never leaves the machine.
   */
  reportError(error: { message: string; stack: string | null; componentStack: string | null }): Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export interface GitStatus {
  branch: string | null
  upstream: string | null
  remotes: string[]
  files: string[]
  ahead: number
  behind: number
}
