import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ElectronAPI } from '../src/types/opencode'

function subscribe<A extends unknown[]>(channel: string, callback: (...args: A) => void): () => void {
  const listener = (_event: IpcRendererEvent, ...args: unknown[]) => callback(...(args as A))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: ElectronAPI = {
  gitStatus: (id) => ipcRenderer.invoke('git:status', id),
  gitAction: (id, action, message) => ipcRenderer.invoke('git:action', id, action, message),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getDaemonState: (spaceId) => ipcRenderer.invoke('daemon:state', spaceId),
  onDaemonLog: (callback) => subscribe('daemon:log', callback),
  onDaemonState: (callback) => subscribe('daemon:state', callback),

  discoverModels: () => ipcRenderer.invoke('models:discover'),
  addEndpoint: (endpoint) => ipcRenderer.invoke('models:addEndpoint', endpoint),
  removeEndpoint: (id) => ipcRenderer.invoke('models:removeEndpoint', id),

  startSpace: (spaceId, force) => ipcRenderer.invoke('space:start', spaceId, force),
  openSpace: (spaceId) => ipcRenderer.invoke('space:open', spaceId),
  closeSpace: (spaceId) => ipcRenderer.invoke('space:close', spaceId),
  listProjects: () => ipcRenderer.invoke('projects:list'),
  addProject: (path) => ipcRenderer.invoke('projects:add', path),
  removeProject: (id) => ipcRenderer.invoke('projects:remove', id),
  unhideProject: (id) => ipcRenderer.invoke('projects:unhide', id),
  pinProject: (id, pinned) => ipcRenderer.invoke('projects:pin', id, pinned),
  createProject: (root, name) => ipcRenderer.invoke('projects:create', root, name),
  revealProject: (id) => ipcRenderer.invoke('projects:reveal', id),
  listProjectRoots: () => ipcRenderer.invoke('projects:roots'),
  addProjectRoot: (path) => ipcRenderer.invoke('projects:addRoot', path),
  removeProjectRoot: (path) => ipcRenderer.invoke('projects:removeRoot', path),
  onProjectsChanged: (callback) => subscribe('projects:changed', callback),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),

  request: (spaceId, method, path, body) => ipcRenderer.invoke('oc:request', spaceId, method, path, body),
  onEvent: (callback) => subscribe('oc:event', callback),

  ptyConnect: (id) => ipcRenderer.invoke('pty:connect', id),
  ptyWrite: (id, data) => ipcRenderer.send('pty:write', id, data),
  ptyDisconnect: (id) => ipcRenderer.invoke('pty:disconnect', id),
  onPtyData: (callback) => subscribe('pty:data', callback),

  readProjectFile: (path) => ipcRenderer.invoke('fs:readProjectFile', path),
  listProjectFiles: () => ipcRenderer.invoke('fs:listProjectFiles'),
  writeProjectFile: (path, content) => ipcRenderer.invoke('fs:writeProjectFile', path, content),
  getRunCommand: () => ipcRenderer.invoke('workspace:runCommand'),
  discoverPreview: () => ipcRenderer.invoke('preview:discover'),

  // Fired by the main process when the event stream reconnects after a gap, so the renderer
  // can re-read authoritative state instead of trusting a stream that may have lost events.
  onResync: (callback) => subscribe('oc:resync', callback),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  opencodeStatus: () => ipcRenderer.invoke('app:opencodeStatus'),
  /** Display-only licence state. Never contains the key or the signing secret. */
  licenseState: () => ipcRenderer.invoke('license:state'),
  /** Forwards a renderer crash or unhandled rejection to the main-process log. */
  reportError: (error: { message: string; stack: string | null; componentStack: string | null }) =>
    ipcRenderer.invoke('app:reportError', error),

  /**
   * Registers a last-chance save. When the window is about to close, main asks every
   * registrant to flush; the app only closes once they have all reported success.
   */
  onBeforeClose: (handler: () => boolean | Promise<boolean>) => {
    const listener = () => {
      void Promise.resolve(handler()).then(
        (ok) => ipcRenderer.send('app:closeReady', ok !== false),
        () => ipcRenderer.send('app:closeReady', false),
      )
    }
    ipcRenderer.on('app:beforeClose', listener)
    return () => ipcRenderer.removeListener('app:beforeClose', listener)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
