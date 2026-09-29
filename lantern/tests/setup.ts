// Shared test setup.
//
// The single most important job here is stopping any test from touching the
// REAL user data directory. If a test reads or writes %APPDATA%/olympus, it
// mutates the developer's actual project list, and a bug in a test looks
// exactly like a bug in the app. Every suite that imports a module calling
// app.getPath() gets the temp sandbox through the `electron` mock below.

import { afterEach, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// A fresh temp dir per test, removed in afterEach.
let sandbox = ''

vi.mock('electron', () => ({
  app: {
    getPath: (_name: string) => sandbox,
    getName: () => 'Olympus',
    getVersion: () => '0.0.0-test',
  },
  // Surface enough of the Electron surface that importing a module which
  // touches these at module scope does not throw. None are called: no test in
  // this suite launches Electron.
  ipcMain: { handle: () => undefined, removeHandler: () => undefined },
  BrowserWindow: { getAllWindows: () => [] as unknown[] },
  dialog: {
    showMessageBox: async () => ({ response: 0 }),
    showErrorBox: () => undefined,
  },
  shell: { openExternal: () => undefined },
}))

beforeEach(() => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-test-'))
})

afterEach(() => {
  // Only delete what we created. A bug that hands the wrong path here must not
  // turn into a recursive delete of a real directory, so the path is checked
  // against the OS temp dir before rmSync is called.
  if (sandbox && path.dirname(path.dirname(sandbox)) === os.tmpdir()) {
    fs.rmSync(sandbox, { recursive: true, force: true })
  }
  sandbox = ''
})
