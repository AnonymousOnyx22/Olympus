// Checks the built app end to end: opening Kern must start no engine, and connecting a chat must start one.
//
//   npm run build && npm run check:lazy-start
//
// It launches Electron with a throwaway profile (KERN_USER_DATA), restores a chat window, and counts only
// the engine processes that descend from the Kern app, so other tools on the machine cannot confuse it.
// Needs the engine installed (`npm i -g opencode-ai`) for the second half.
const { spawn, execFileSync } = require('node:child_process')
const path = require('node:path')
const os = require('node:os')
const fs = require('node:fs')
const WS = require('ws')

const app = path.resolve(__dirname, '..')
const electronBin = require('electron')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let failures = 0
let child = null
const check = (label, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); if (!ok) failures++ }

/** Every running process as { pid, ppid, cmd }, on Windows and on Unix. */
function processTable() {
  if (process.platform === 'win32') {
    const out = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId)|$($_.ParentProcessId)|$($_.CommandLine)" }'], { encoding: 'utf8', maxBuffer: 50e6 })
    return out.split(/\r?\n/).filter(Boolean).map((line) => { const [pid, ppid, ...cmd] = line.split('|'); return { pid, ppid, cmd: cmd.join('|') } })
  }
  const out = execFileSync('ps', ['-eo', 'pid=,ppid=,args='], { encoding: 'utf8', maxBuffer: 50e6 })
  return out.split('\n').filter(Boolean).map((line) => { const m = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/); return m ? { pid: m[1], ppid: m[2], cmd: m[3] } : null }).filter(Boolean)
}
function enginesUnder(rootPid) {
  const all = processTable()
  const found = []
  const queue = [String(rootPid)]
  while (queue.length) {
    const parent = queue.pop()
    for (const p of all) if (p.ppid === parent && !found.includes(p)) { found.push(p); queue.push(p.pid) }
  }
  return found.filter((p) => /\bserve\b/.test(p.cmd) && /opencode/i.test(p.cmd))
}
function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(pid, 'SIGKILL')
  } catch { /* already gone */ }
}

;(async () => {
  if (!fs.existsSync(path.join(app, 'dist-electron', 'main.js'))) { console.error('Build the app first: npm run build'); process.exit(2) }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'kern-lazy-'))
  const env = { ...process.env, KERN_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE
  const port = 9444
  child = spawn(electronBin, ['.', `--remote-debugging-port=${port}`], { cwd: app, env, stdio: 'ignore' })
  try {
    let page
    for (let i = 0; i < 60 && !page; i++) {
      try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page') } catch { /* not up yet */ }
      await sleep(500)
    }
    if (!page) throw new Error('The app window never appeared')
    const ws = new WS(page.webSocketDebuggerUrl)
    await new Promise((resolve) => ws.once('open', resolve))
    let nextId = 0
    const pending = new Map()
    ws.on('message', (raw) => { const msg = JSON.parse(raw); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) } })
    const send = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
    const run = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Runtime.enable')

    // Watch the whole launch, including a restored chat window, for any engine under the app.
    const started = Date.now()
    let restored = false
    const caught = []
    while (Date.now() - started < 18_000) {
      if (!restored && Date.now() - started > 6_000) {
        await run(`localStorage.setItem('kern.agentWindows', JSON.stringify({ general: ['ses_restored_demo'] })); true`)
        await send('Page.reload')
        restored = true
      }
      for (const p of enginesUnder(child.pid)) if (!caught.find((c) => c.pid === p.pid)) caught.push(p)
      await sleep(400)
    }
    check('opening the app, with a restored chat, starts no engine', caught.length === 0, `(${caught.length} engine processes)`)
    caught.forEach((p) => console.log('  started:', p.cmd.slice(0, 200)))
    const text = await run('document.body.innerText')
    check('the restored chat says no engine is running and offers Connect', /No engine is running/.test(text) && /Connect/.test(text))
    check('the sidebar reads Not started', /Not started/.test(text))

    await run(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Connect'); if (b) b.click(); return !!b })()`)
    let engines = []
    for (let i = 0; i < 45 && !engines.length; i++) { await sleep(1000); engines = enginesUnder(child.pid) }
    check('clicking Connect starts an engine in the background', engines.length >= 1, `(${engines.length} engine process)`)
    ws.close()
  } finally {
    killTree(child.pid)
    try { fs.rmSync(userData, { recursive: true, force: true }) } catch { /* Electron may still hold a file; it is a temp folder */ }
  }
  console.log(failures ? `\n${failures} FAILED` : '\nLazy start verified end to end.')
  process.exit(failures ? 1 : 0)
})().catch((error) => { console.error(error); if (child) killTree(child.pid); process.exit(2) })
